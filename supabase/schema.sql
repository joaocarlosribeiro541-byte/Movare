-- =============================================================================
-- MOVARE LOCALIZADOR — SCHEMA CENTRALIZADO SUPABASE (POSTGRESQL + RLS + REALTIME)
-- =============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase:
-- Dashboard -> SQL Editor -> New Query -> Cole e execute todo o conteúdo.
-- =============================================================================

-- 1. TABELA DE ADMINISTRADORES AUTORIZADOS
-- Somente administradores cadastrados aqui (ou com app_metadata.role = 'admin')
-- têm permissão de escrita no mapa central.
-- NUNCA há política de INSERT/UPDATE/DELETE público nesta tabela.
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin status" ON public.admin_users;
CREATE POLICY "Users can read own admin status"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. FUNÇÃO SEGURA DE VERIFICAÇÃO DE ADMINISTRADOR
-- Verifica EXCLUSIVAMENTE fontes confiáveis não editáveis pelo navegador:
--   a) JWT app_metadata.role = 'admin' (gerenciado no servidor/Dashboard)
--   b) Tabela public.admin_users (gerenciada via SQL/service_role)
-- IMPORTANTE: user_metadata NUNCA é consultado por segurança.
CREATE OR REPLACE FUNCTION public.is_movare_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'admin'
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_movare_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_movare_admin() TO anon, authenticated;

-- 3. TABELA DO MAPA CENTRAL COMPARTILHADO (REGISTRO ÚNICO)
-- Preserva integralmente o modelo FloorArea[] no campo JSONB "data".
CREATE TABLE IF NOT EXISTS public.shared_map (
  id TEXT PRIMARY KEY CHECK (id = 'central-warehouse-map'),
  data JSONB NOT NULL CHECK (
    jsonb_typeof(data) = 'array' AND jsonb_array_length(data) > 0
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email TEXT NULL
);

ALTER TABLE public.shared_map ENABLE ROW LEVEL SECURITY;

-- Políticas de Row Level Security (RLS):
-- VISITANTES (anon) e usuários comuns autenticados podem APENAS visualizar (SELECT).
-- SOMENTE administradores confiáveis podem inserir, atualizar ou excluir.
DROP POLICY IF EXISTS "Public read access for shared_map" ON public.shared_map;
CREATE POLICY "Public read access for shared_map"
  ON public.shared_map
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert shared_map" ON public.shared_map;
CREATE POLICY "Admins can insert shared_map"
  ON public.shared_map
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_movare_admin());

DROP POLICY IF EXISTS "Admins can update shared_map" ON public.shared_map;
CREATE POLICY "Admins can update shared_map"
  ON public.shared_map
  FOR UPDATE
  TO authenticated
  USING (public.is_movare_admin())
  WITH CHECK (public.is_movare_admin());

DROP POLICY IF EXISTS "Admins can delete shared_map" ON public.shared_map;
CREATE POLICY "Admins can delete shared_map"
  ON public.shared_map
  FOR DELETE
  TO authenticated
  USING (public.is_movare_admin());

-- 4. RPC ATÔMICA COM CONTROLE DE CONCORRÊNCIA OTIMISTA (VERSIONAMENTO)
-- Impede sobrescrita silenciosa quando dois administradores editam simultaneamente.
--   - p_expected_version = 0 (ou NULL quando tabela vazia): cria o registro inicial v1.
--   - p_expected_version = v_atual: atualiza atomicamente e incrementa version + 1.
--   - Se version divergir: retorna status 'conflict' com a versão/dados mais recentes.
CREATE OR REPLACE FUNCTION public.save_shared_map(
  p_map_id TEXT,
  p_data JSONB,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := auth.jwt() ->> 'email';
  v_existing public.shared_map%ROWTYPE;
  v_saved public.shared_map%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_movare_admin() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Permissão negada: apenas administradores autenticados podem alterar o mapa central.'
    );
  END IF;

  IF p_map_id IS DISTINCT FROM 'central-warehouse-map' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Identificador de mapa inválido.'
    );
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'array' OR jsonb_array_length(p_data) = 0 THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Dados inválidos: o mapa central precisa conter ao menos uma área válida.'
    );
  END IF;

  SELECT *
    INTO v_existing
    FROM public.shared_map
   WHERE id = p_map_id
   FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version IS NOT NULL AND p_expected_version > 0 THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'error', 'O mapa central não existe na nuvem para a versão esperada.'
      );
    END IF;

    INSERT INTO public.shared_map (id, data, version, updated_at, updated_by, updated_by_email)
    VALUES (
      p_map_id,
      p_data,
      1,
      timezone('utc', now()),
      v_uid,
      v_email
    )
    RETURNING * INTO v_saved;

    RETURN jsonb_build_object(
      'status', 'ok',
      'id', v_saved.id,
      'version', v_saved.version,
      'updated_at', v_saved.updated_at,
      'updated_by', v_saved.updated_by,
      'updated_by_email', v_saved.updated_by_email,
      'data', v_saved.data
    );
  END IF;

  IF p_expected_version IS NULL OR v_existing.version <> p_expected_version THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'id', v_existing.id,
      'version', v_existing.version,
      'updated_at', v_existing.updated_at,
      'updated_by', v_existing.updated_by,
      'updated_by_email', v_existing.updated_by_email,
      'data', v_existing.data,
      'error', 'Conflito de edição: outro administrador salvou uma versão mais recente.'
    );
  END IF;

  UPDATE public.shared_map
     SET data = p_data,
         version = v_existing.version + 1,
         updated_at = timezone('utc', now()),
         updated_by = v_uid,
         updated_by_email = v_email
   WHERE id = p_map_id
   RETURNING * INTO v_saved;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_saved.id,
    'version', v_saved.version,
    'updated_at', v_saved.updated_at,
    'updated_by', v_saved.updated_by,
    'updated_by_email', v_saved.updated_by_email,
    'data', v_saved.data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_map(TEXT, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_map(TEXT, JSONB, INTEGER) TO authenticated;

-- 5. CONFIGURAÇÃO DO SUPABASE REALTIME
ALTER TABLE public.shared_map REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shared_map'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_map;
  END IF;
END $$;

-- =============================================================================
-- EXEMPLO DE CADASTRO MANUAL DE ADMINISTRADOR (EXECUTAR APÓS CRIAR O USUÁRIO)
-- =============================================================================
-- 1) No Supabase Dashboard: Authentication -> Users -> Add User (Create new user)
-- 2) Execute abaixo substituindo o e-mail real do administrador:
--
-- INSERT INTO public.admin_users (user_id, email, role)
-- SELECT id, email, 'admin'
-- FROM auth.users
-- WHERE email = 'admin@suaempresa.com.br'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
--
-- Opcional (reforço também no app_metadata do JWT):
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'admin@suaempresa.com.br';
-- =============================================================================

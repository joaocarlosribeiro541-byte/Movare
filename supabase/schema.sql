-- =============================================================================
-- MOVARE LOCALIZADOR — SCHEMA CENTRALIZADO SUPABASE (POSTGRESQL + RLS + REALTIME)
-- =============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase:
-- Dashboard -> SQL Editor -> New Query -> Cole e execute todo o conteúdo.
-- Script idempotente: seguro para executar em projetos novos ou já configurados.
-- =============================================================================

-- 1. TABELA DE CARGOS E CLASSIFICAÇÃO DE PERMISSÕES
-- Define os cargos padrão do sistema ('admin', 'assistencia', 'conferente')
-- e permite que administradores criem, editem ou removam cargos personalizados.
CREATE TABLE IF NOT EXISTS public.movare_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'slate',
  base_profile TEXT NOT NULL DEFAULT 'visitor',
  can_edit_map BOOLEAN NOT NULL DEFAULT FALSE,
  can_reserve_positions BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_conferente_panel BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_roles BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
  ALTER TABLE public.movare_roles DROP CONSTRAINT IF EXISTS movare_roles_base_profile_check;
  ALTER TABLE public.movare_roles
    ADD CONSTRAINT movare_roles_base_profile_check
    CHECK (base_profile IN ('admin', 'assistencia', 'conferente', 'visitor'));
END $$;

ALTER TABLE public.movare_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read movare_roles" ON public.movare_roles;
CREATE POLICY "Public read movare_roles"
  ON public.movare_roles
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Seed idempotente dos cargos padrão do sistema
INSERT INTO public.movare_roles (
  id, name, description, color, base_profile,
  can_edit_map, can_reserve_positions, can_use_conferente_panel, can_manage_roles, is_system
)
VALUES
  (
    'admin',
    'Administrador',
    'Edição completa do mapa, galpões, zonas, posições, reservas, nuvem e gestão de cargos.',
    'emerald',
    'admin',
    TRUE, TRUE, FALSE, TRUE, TRUE
  ),
  (
    'assistencia',
    'Assistência Técnica',
    'Consulta ao mapa, busca de produtos, exportação PNG e marcação de itens reservados na nuvem.',
    'amber',
    'assistencia',
    FALSE, TRUE, FALSE, FALSE, TRUE
  ),
  (
    'conferente',
    'Conferente',
    'Painel operacional dedicado de conferência e localização rápida (somente leitura).',
    'sky',
    'conferente',
    FALSE, FALSE, TRUE, FALSE, TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- 2. PERFIS DE USUÁRIOS COMUNS CADASTRADOS (AUTOCADASTRO PARA POSTERIOR ATRIBUIÇÃO DE CARGO)
-- Armazena apenas dados básicos de identificação (NUNCA armazena cargos ou permissões aqui).
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  phone TEXT NULL,
  department TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN phone TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN department TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());
  END IF;
END $$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger automática ao criar usuário no Supabase Auth (autocadastro comum ou Dashboard)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.user_profiles.email),
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill seguro de usuários já existentes em auth.users
INSERT INTO public.user_profiles (user_id, email, full_name)
SELECT
  u.id,
  COALESCE(u.email, ''),
  NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), '')
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. TABELA DE ATRIBUIÇÃO DE CARGOS POR USUÁRIO (PROTEGIDA CONTRA AUTOELEVAÇÃO)
-- Somente administradores confiáveis podem atribuir ou remover cargos nesta tabela.
-- Usuários comuns recém-cadastrados NÃO possuem registro aqui até receberem um cargo.
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  cargo_id TEXT NULL REFERENCES public.movare_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.admin_users
      ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'cargo_id'
  ) THEN
    ALTER TABLE public.admin_users
      ADD COLUMN cargo_id TEXT NULL REFERENCES public.movare_roles(id) ON DELETE CASCADE;
  END IF;

  ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
  ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('admin', 'assistencia', 'conferente', 'visitor'));

  UPDATE public.admin_users au
     SET cargo_id = au.role
   WHERE au.cargo_id IS NULL
     AND EXISTS (SELECT 1 FROM public.movare_roles mr WHERE mr.id = au.role);
END $$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin status" ON public.admin_users;
CREATE POLICY "Users can read own admin status"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. FUNÇÕES SEGURAS DE VERIFICAÇÃO DE CARGO E PERMISSÕES (TEMPO REAL)
-- Consultam EXCLUSIVAMENTE fontes confiáveis no servidor:
--   a) public.admin_users + public.movare_roles (atualização instantânea ao atribuir/editar/remover cargos)
--   b) auth.users.raw_app_meta_data (somente como fallback caso não haja registro em admin_users)
-- IMPORTANTE: user_metadata NUNCA é usado para autorização.
CREATE OR REPLACE FUNCTION public.get_my_movare_access()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cargo RECORD;
  v_profile RECORD;
  v_app_role TEXT;
  v_profile_json JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'role', 'visitor',
      'cargo_id', NULL,
      'cargo_name', NULL,
      'cargo_color', NULL,
      'profile', NULL,
      'permissions', jsonb_build_object(
        'can_edit_map', FALSE,
        'can_reserve_positions', FALSE,
        'can_use_conferente_panel', FALSE,
        'can_manage_roles', FALSE
      )
    );
  END IF;

  SELECT
    up.user_id,
    COALESCE(up.email, u.email, '') AS email,
    COALESCE(up.full_name, NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), '')) AS full_name,
    up.phone,
    up.department,
    COALESCE(up.created_at, u.created_at) AS created_at,
    COALESCE(up.updated_at, up.created_at, u.created_at) AS updated_at
  INTO v_profile
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON up.user_id = u.id
  WHERE u.id = v_uid
  LIMIT 1;

  IF FOUND THEN
    v_profile_json := jsonb_build_object(
      'user_id', v_profile.user_id,
      'email', v_profile.email,
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'department', v_profile.department,
      'created_at', v_profile.created_at,
      'updated_at', v_profile.updated_at
    );
  ELSE
    v_profile_json := NULL;
  END IF;

  SELECT
    mr.id AS cargo_id,
    mr.name AS cargo_name,
    mr.color AS cargo_color,
    mr.base_profile,
    mr.can_edit_map,
    mr.can_reserve_positions,
    mr.can_use_conferente_panel,
    mr.can_manage_roles
  INTO v_cargo
  FROM public.admin_users au
  JOIN public.movare_roles mr ON mr.id = COALESCE(au.cargo_id, au.role)
  WHERE au.user_id = v_uid
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'role', v_cargo.base_profile,
      'cargo_id', v_cargo.cargo_id,
      'cargo_name', v_cargo.cargo_name,
      'cargo_color', v_cargo.cargo_color,
      'profile', v_profile_json,
      'permissions', jsonb_build_object(
        'can_edit_map', v_cargo.can_edit_map,
        'can_reserve_positions', v_cargo.can_reserve_positions,
        'can_use_conferente_panel', v_cargo.can_use_conferente_panel,
        'can_manage_roles', v_cargo.can_manage_roles
      )
    );
  END IF;

  -- Fallback caso o registro em admin_users exista sem vínculo explícito em movare_roles
  SELECT au.role INTO v_app_role
  FROM public.admin_users au
  WHERE au.user_id = v_uid
    AND au.role IN ('admin', 'assistencia', 'conferente')
  LIMIT 1;

  -- Ou fallback via raw_app_meta_data atual do servidor (nunca JWT antigo após revogação)
  IF v_app_role IS NULL THEN
    SELECT lower(COALESCE(u.raw_app_meta_data ->> 'role', ''))
      INTO v_app_role
      FROM auth.users u
     WHERE u.id = v_uid;
  END IF;

  IF v_app_role IN ('admin', 'assistencia', 'conferente') THEN
    SELECT
      mr.id AS cargo_id,
      mr.name AS cargo_name,
      mr.color AS cargo_color,
      mr.base_profile,
      mr.can_edit_map,
      mr.can_reserve_positions,
      mr.can_use_conferente_panel,
      mr.can_manage_roles
    INTO v_cargo
    FROM public.movare_roles mr
    WHERE mr.id = v_app_role
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'role', v_cargo.base_profile,
        'cargo_id', v_cargo.cargo_id,
        'cargo_name', v_cargo.cargo_name,
        'cargo_color', v_cargo.cargo_color,
        'profile', v_profile_json,
        'permissions', jsonb_build_object(
          'can_edit_map', v_cargo.can_edit_map,
          'can_reserve_positions', v_cargo.can_reserve_positions,
          'can_use_conferente_panel', v_cargo.can_use_conferente_panel,
          'can_manage_roles', v_cargo.can_manage_roles
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'role', 'visitor',
    'cargo_id', NULL,
    'cargo_name', NULL,
    'cargo_color', NULL,
    'profile', v_profile_json,
    'permissions', jsonb_build_object(
      'can_edit_map', FALSE,
      'can_reserve_positions', FALSE,
      'can_use_conferente_panel', FALSE,
      'can_manage_roles', FALSE
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_movare_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_movare_access() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_movare_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_movare_access() ->> 'role', 'visitor');
$$;

REVOKE ALL ON FUNCTION public.get_movare_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_movare_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_movare_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_my_movare_access() -> 'permissions' ->> 'can_edit_map')::BOOLEAN, FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_movare_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_movare_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_movare_assistencia()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_movare_role() = 'assistencia';
$$;

REVOKE ALL ON FUNCTION public.is_movare_assistencia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_movare_assistencia() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_movare_conferente()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_movare_role() = 'conferente';
$$;

REVOKE ALL ON FUNCTION public.is_movare_conferente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_movare_conferente() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_movare_reserve()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_my_movare_access() -> 'permissions' ->> 'can_edit_map')::BOOLEAN, FALSE)
      OR COALESCE((public.get_my_movare_access() -> 'permissions' ->> 'can_reserve_positions')::BOOLEAN, FALSE);
$$;

REVOKE ALL ON FUNCTION public.can_movare_reserve() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_movare_reserve() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_movare_manage_roles()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_movare_role() = 'admin'
      OR COALESCE((public.get_my_movare_access() -> 'permissions' ->> 'can_manage_roles')::BOOLEAN, FALSE);
$$;

REVOKE ALL ON FUNCTION public.can_movare_manage_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_movare_manage_roles() TO anon, authenticated;

-- Políticas de escrita na tabela public.movare_roles (somente quem pode gerenciar cargos)
DROP POLICY IF EXISTS "Role managers can insert movare_roles" ON public.movare_roles;
CREATE POLICY "Role managers can insert movare_roles"
  ON public.movare_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_movare_manage_roles());

DROP POLICY IF EXISTS "Role managers can update movare_roles" ON public.movare_roles;
CREATE POLICY "Role managers can update movare_roles"
  ON public.movare_roles
  FOR UPDATE
  TO authenticated
  USING (public.can_movare_manage_roles())
  WITH CHECK (public.can_movare_manage_roles());

DROP POLICY IF EXISTS "Role managers can delete custom movare_roles" ON public.movare_roles;
CREATE POLICY "Role managers can delete custom movare_roles"
  ON public.movare_roles
  FOR DELETE
  TO authenticated
  USING (public.can_movare_manage_roles() AND is_system = FALSE);

-- 5. TABELA DO MAPA CENTRAL COMPARTILHADO (REGISTRO ÚNICO)
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

-- 6. RPC ATÔMICA DE PUBLICAÇÃO COMPLETA (CARGOS COM PERMISSÃO DE EDIÇÃO DE MAPA)
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
      'error', 'Permissão negada: apenas cargos com edição do mapa podem alterar o mapa central.'
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

-- 7. RPC DEDICADA DE RESERVA DE POSIÇÃO (CARGOS COM PERMISSÃO DE RESERVA)
DROP FUNCTION IF EXISTS public.toggle_position_reservation(TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.toggle_position_reservation(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.toggle_position_reservation(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.toggle_position_reservation(
  p_map_id TEXT,
  p_area_id TEXT,
  p_element_id TEXT,
  p_position_id TEXT,
  p_reserved BOOLEAN DEFAULT NULL,
  p_reserved_store TEXT DEFAULT NULL,
  p_reserved_by TEXT DEFAULT NULL,
  p_reserved_quantity NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := auth.jwt() ->> 'email';
  v_profile_name TEXT;
  v_resolved_by TEXT;
  v_resolved_store TEXT := NULLIF(btrim(COALESCE(p_reserved_store, '')), '');
  v_stock_qty NUMERIC;
  v_resolved_reserved_qty NUMERIC;
  v_existing public.shared_map%ROWTYPE;
  v_saved public.shared_map%ROWTYPE;
  v_areas JSONB;
  v_area JSONB;
  v_elements JSONB;
  v_el JSONB;
  v_positions JSONB;
  v_pos JSONB;
  v_area_idx INT;
  v_el_idx INT;
  v_pos_idx INT;
  v_found BOOLEAN := FALSE;
  v_should_reserve BOOLEAN;
  v_next_status TEXT;
  v_has_sku BOOLEAN;
  v_has_qty BOOLEAN;
  v_now_iso TEXT := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_reserve() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Permissão negada: seu cargo atual não possui permissão para gerenciar reservas.'
    );
  END IF;

  IF p_map_id IS DISTINCT FROM 'central-warehouse-map'
     OR p_area_id IS NULL OR btrim(p_area_id) = ''
     OR p_element_id IS NULL OR btrim(p_element_id) = ''
     OR p_position_id IS NULL OR btrim(p_position_id) = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Parâmetros inválidos para atualizar reserva da posição.'
    );
  END IF;

  SELECT NULLIF(btrim(full_name), '')
    INTO v_profile_name
    FROM public.user_profiles
   WHERE user_id = v_uid;

  v_resolved_by := COALESCE(
    NULLIF(btrim(COALESCE(p_reserved_by, '')), ''),
    v_profile_name,
    NULLIF(btrim(COALESCE(v_email, '')), ''),
    'Operador'
  );

  SELECT *
    INTO v_existing
    FROM public.shared_map
   WHERE id = p_map_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'O mapa central ainda não foi publicado na nuvem pelo administrador.'
    );
  END IF;

  v_areas := v_existing.data;

  FOR v_area_idx IN 0 .. COALESCE(jsonb_array_length(v_areas), 0) - 1 LOOP
    v_area := v_areas -> v_area_idx;
    IF (v_area ->> 'id') = p_area_id THEN
      v_elements := v_area -> 'elements';
      FOR v_el_idx IN 0 .. COALESCE(jsonb_array_length(v_elements), 0) - 1 LOOP
        v_el := v_elements -> v_el_idx;
        IF (v_el ->> 'id') = p_element_id THEN
          v_positions := v_el -> 'internalPositions';
          FOR v_pos_idx IN 0 .. COALESCE(jsonb_array_length(v_positions), 0) - 1 LOOP
            v_pos := v_positions -> v_pos_idx;
            IF (v_pos ->> 'id') = p_position_id THEN
              v_should_reserve := COALESCE(p_reserved, COALESCE(v_pos ->> 'status', '') <> 'reserved');
              IF v_should_reserve THEN
                v_next_status := 'reserved';
              ELSE
                v_has_sku := COALESCE(btrim(v_pos ->> 'sku'), '') <> '';
                v_has_qty := CASE
                  WHEN (v_pos ->> 'quantity') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN ((v_pos ->> 'quantity')::NUMERIC > 0)
                  ELSE FALSE
                END;
                v_next_status := CASE WHEN v_has_sku OR v_has_qty THEN 'occupied' ELSE 'empty' END;
              END IF;

              v_pos := jsonb_set(v_pos, '{status}', to_jsonb(v_next_status), TRUE);
              v_pos := jsonb_set(v_pos, '{updatedAt}', to_jsonb(v_now_iso), TRUE);

              IF v_next_status = 'reserved' THEN
                IF v_resolved_store IS NOT NULL THEN
                  v_pos := jsonb_set(v_pos, '{reservedStore}', to_jsonb(v_resolved_store), TRUE);
                END IF;
                v_stock_qty := CASE
                  WHEN (v_pos ->> 'quantity') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN (v_pos ->> 'quantity')::NUMERIC
                  ELSE NULL
                END;
                v_resolved_reserved_qty := CASE
                  WHEN p_reserved_quantity IS NOT NULL AND p_reserved_quantity > 0 THEN
                    CASE
                      WHEN v_stock_qty IS NOT NULL AND v_stock_qty > 0
                        THEN LEAST(v_stock_qty, p_reserved_quantity)
                      ELSE p_reserved_quantity
                    END
                  WHEN v_stock_qty IS NOT NULL AND v_stock_qty > 0 THEN v_stock_qty
                  ELSE NULL
                END;
                IF v_resolved_reserved_qty IS NOT NULL THEN
                  v_pos := jsonb_set(v_pos, '{reservedQuantity}', to_jsonb(v_resolved_reserved_qty), TRUE);
                END IF;
                v_pos := jsonb_set(v_pos, '{reservedAt}', to_jsonb(v_now_iso), TRUE);
                v_pos := jsonb_set(v_pos, '{reservedBy}', to_jsonb(v_resolved_by), TRUE);
                IF v_email IS NOT NULL AND btrim(v_email) <> '' THEN
                  v_pos := jsonb_set(v_pos, '{reservedByEmail}', to_jsonb(v_email), TRUE);
                END IF;
              ELSE
                v_pos := v_pos - 'reservedStore' - 'reservedQuantity' - 'reservedAt' - 'reservedBy' - 'reservedByEmail';
              END IF;

              v_positions := jsonb_set(v_positions, ARRAY[v_pos_idx::TEXT], v_pos, FALSE);
              v_el := jsonb_set(v_el, '{internalPositions}', v_positions, FALSE);
              v_elements := jsonb_set(v_elements, ARRAY[v_el_idx::TEXT], v_el, FALSE);
              v_area := jsonb_set(v_area, '{elements}', v_elements, FALSE);
              v_areas := jsonb_set(v_areas, ARRAY[v_area_idx::TEXT], v_area, FALSE);
              v_found := TRUE;
              EXIT;
            END IF;
          END LOOP;
        END IF;
        EXIT WHEN v_found;
      END LOOP;
    END IF;
    EXIT WHEN v_found;
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'error', 'Posição interna não encontrada no mapa central.'
    );
  END IF;

  UPDATE public.shared_map
     SET data = v_areas,
         version = v_existing.version + 1,
         updated_at = timezone('utc', now()),
         updated_by = v_uid,
         updated_by_email = v_email
   WHERE id = p_map_id
   RETURNING * INTO v_saved;

  RETURN jsonb_build_object(
    'status', 'ok',
    'next_status', v_next_status,
    'id', v_saved.id,
    'version', v_saved.version,
    'updated_at', v_saved.updated_at,
    'updated_by', v_saved.updated_by,
    'updated_by_email', v_saved.updated_by_email,
    'data', v_saved.data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_position_reservation(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_position_reservation(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, NUMERIC) TO authenticated;

-- 8. RPCS DE SINCRONIZAÇÃO DE PERFIL COMUM E GESTÃO DE CARGOS / USUÁRIOS
DROP FUNCTION IF EXISTS public.sync_my_profile(TEXT);
CREATE OR REPLACE FUNCTION public.sync_my_profile(
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := COALESCE(auth.jwt() ->> 'email', '');
  v_clean_name TEXT := NULLIF(btrim(COALESCE(p_full_name, '')), '');
  v_clean_phone TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_clean_dept TEXT := NULLIF(btrim(COALESCE(p_department, '')), '');
  v_saved public.user_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  INSERT INTO public.user_profiles (user_id, email, full_name, phone, department, updated_at)
  VALUES (v_uid, v_email, v_clean_name, v_clean_phone, v_clean_dept, timezone('utc', now()))
  ON CONFLICT (user_id) DO UPDATE
    SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.user_profiles.email),
        full_name = CASE WHEN p_full_name IS NULL THEN public.user_profiles.full_name ELSE EXCLUDED.full_name END,
        phone = CASE WHEN p_phone IS NULL THEN public.user_profiles.phone ELSE EXCLUDED.phone END,
        department = CASE WHEN p_department IS NULL THEN public.user_profiles.department ELSE EXCLUDED.department END,
        updated_at = timezone('utc', now())
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object(
    'status', 'ok',
    'profile', jsonb_build_object(
      'user_id', v_saved.user_id,
      'email', v_saved.email,
      'full_name', v_saved.full_name,
      'phone', v_saved.phone,
      'department', v_saved.department,
      'created_at', v_saved.created_at,
      'updated_at', v_saved.updated_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_my_profile(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_movare_member_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target_email TEXT;
  v_clean_name TEXT := NULLIF(btrim(COALESCE(p_full_name, '')), '');
  v_clean_phone TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_clean_dept TEXT := NULLIF(btrim(COALESCE(p_department, '')), '');
  v_saved public.user_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem atualizar o perfil de membros.'
    );
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid', 'error', 'Membro inválido.');
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'error', 'Usuário não encontrado.');
  END IF;

  INSERT INTO public.user_profiles (user_id, email, full_name, phone, department, updated_at)
  VALUES (p_user_id, COALESCE(v_target_email, ''), v_clean_name, v_clean_phone, v_clean_dept, timezone('utc', now()))
  ON CONFLICT (user_id) DO UPDATE
    SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.user_profiles.email),
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        department = EXCLUDED.department,
        updated_at = timezone('utc', now())
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object(
    'status', 'ok',
    'profile', jsonb_build_object(
      'user_id', v_saved.user_id,
      'email', v_saved.email,
      'full_name', v_saved.full_name,
      'phone', v_saved.phone,
      'department', v_saved.department
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_movare_member_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_movare_member_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_movare_cargos()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', 'ok',
    'cargos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', mr.id,
          'name', mr.name,
          'description', mr.description,
          'color', mr.color,
          'base_profile', mr.base_profile,
          'can_edit_map', mr.can_edit_map,
          'can_reserve_positions', mr.can_reserve_positions,
          'can_use_conferente_panel', mr.can_use_conferente_panel,
          'can_manage_roles', mr.can_manage_roles,
          'is_system', mr.is_system,
          'member_count', (
            SELECT COUNT(*)::INT
            FROM public.admin_users au
            WHERE COALESCE(au.cargo_id, au.role) = mr.id
          )
        )
        ORDER BY mr.is_system DESC, mr.created_at ASC, mr.name ASC
      )
      FROM public.movare_roles mr
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.list_movare_cargos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_movare_cargos() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_movare_cargo(
  p_id TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_color TEXT DEFAULT 'slate',
  p_base_profile TEXT DEFAULT NULL,
  p_can_edit_map BOOLEAN DEFAULT FALSE,
  p_can_reserve_positions BOOLEAN DEFAULT FALSE,
  p_can_use_conferente_panel BOOLEAN DEFAULT FALSE,
  p_can_manage_roles BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_id TEXT := regexp_replace(lower(btrim(COALESCE(p_id, ''))), '[^a-z0-9_-]+', '-', 'g');
  v_color TEXT := COALESCE(NULLIF(btrim(p_color), ''), 'slate');
  v_base_profile TEXT;
  v_saved public.movare_roles%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem criar ou editar cargos.'
    );
  END IF;

  IF v_name = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Informe um nome válido para o cargo.'
    );
  END IF;

  IF v_id = '' THEN
    v_id := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  END IF;

  IF v_id = '' THEN
    v_id := 'cargo-' || substring(replace(gen_random_uuid()::TEXT, '-', '') from 1 for 8);
  END IF;

  IF p_base_profile IN ('admin', 'assistencia', 'conferente', 'visitor') THEN
    v_base_profile := p_base_profile;
  ELSIF p_can_edit_map OR p_can_manage_roles THEN
    v_base_profile := 'admin';
  ELSIF p_can_reserve_positions THEN
    v_base_profile := 'assistencia';
  ELSIF p_can_use_conferente_panel THEN
    v_base_profile := 'conferente';
  ELSE
    v_base_profile := 'visitor';
  END IF;

  -- Proteção: não remove permissão administrativa do cargo de sistema 'admin'
  IF v_id = 'admin' THEN
    v_base_profile := 'admin';
    p_can_edit_map := TRUE;
    p_can_manage_roles := TRUE;
  END IF;

  INSERT INTO public.movare_roles (
    id, name, description, color, base_profile,
    can_edit_map, can_reserve_positions, can_use_conferente_panel, can_manage_roles,
    is_system, created_by
  )
  VALUES (
    v_id,
    v_name,
    COALESCE(btrim(p_description), ''),
    v_color,
    v_base_profile,
    COALESCE(p_can_edit_map, FALSE),
    COALESCE(p_can_reserve_positions, FALSE),
    COALESCE(p_can_use_conferente_panel, FALSE),
    COALESCE(p_can_manage_roles, FALSE),
    FALSE,
    v_uid
  )
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        base_profile = EXCLUDED.base_profile,
        can_edit_map = EXCLUDED.can_edit_map,
        can_reserve_positions = EXCLUDED.can_reserve_positions,
        can_use_conferente_panel = EXCLUDED.can_use_conferente_panel,
        can_manage_roles = EXCLUDED.can_manage_roles
  RETURNING * INTO v_saved;

  -- Propaga o novo perfil base aos usuários vinculados a este cargo
  UPDATE public.admin_users
     SET role = v_saved.base_profile
   WHERE cargo_id = v_saved.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'cargo', jsonb_build_object(
      'id', v_saved.id,
      'name', v_saved.name,
      'description', v_saved.description,
      'color', v_saved.color,
      'base_profile', v_saved.base_profile,
      'can_edit_map', v_saved.can_edit_map,
      'can_reserve_positions', v_saved.can_reserve_positions,
      'can_use_conferente_panel', v_saved.can_use_conferente_panel,
      'can_manage_roles', v_saved.can_manage_roles,
      'is_system', v_saved.is_system
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_movare_cargo(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_movare_cargo(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_movare_cargo(p_cargo_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target public.movare_roles%ROWTYPE;
  v_affected_ids UUID[];
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem excluir cargos.'
    );
  END IF;

  SELECT * INTO v_target
    FROM public.movare_roles
   WHERE id = p_cargo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'error', 'Cargo não encontrado.');
  END IF;

  IF v_target.is_system THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Os cargos padrão do sistema não podem ser excluídos.'
    );
  END IF;

  SELECT ARRAY_AGG(au.user_id)
    INTO v_affected_ids
    FROM public.admin_users au
   WHERE au.cargo_id = p_cargo_id;

  DELETE FROM public.admin_users WHERE cargo_id = p_cargo_id;
  DELETE FROM public.movare_roles WHERE id = p_cargo_id;

  IF v_affected_ids IS NOT NULL THEN
    BEGIN
      UPDATE auth.users
         SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role' - 'cargo_id'
       WHERE id = ANY(v_affected_ids);
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_movare_cargo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_movare_cargo(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_movare_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem visualizar usuários cadastrados.'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'users', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', u.id,
          'email', COALESCE(u.email, up.email, au.email),
          'full_name', COALESCE(up.full_name, NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), '')),
          'phone', up.phone,
          'department', up.department,
          'role', COALESCE(mr.base_profile, au.role, 'visitor'),
          'cargo_id', mr.id,
          'cargo_name', mr.name,
          'cargo_color', mr.color,
          'email_confirmed', (u.email_confirmed_at IS NOT NULL),
          'last_sign_in_at', u.last_sign_in_at,
          'created_at', COALESCE(au.created_at, up.created_at, u.created_at)
        )
        ORDER BY
          CASE WHEN mr.id IS NULL THEN 0 ELSE 1 END ASC,
          COALESCE(au.created_at, up.created_at, u.created_at) DESC
      )
      FROM auth.users u
      LEFT JOIN public.user_profiles up ON up.user_id = u.id
      LEFT JOIN public.admin_users au ON au.user_id = u.id
      LEFT JOIN public.movare_roles mr ON mr.id = COALESCE(au.cargo_id, au.role)
      WHERE COALESCE(u.email, up.email, au.email, '') <> ''
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_movare_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_movare_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_movare_user_role(
  p_email TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_norm_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_norm_cargo TEXT := lower(btrim(COALESCE(p_role, '')));
  v_cargo public.movare_roles%ROWTYPE;
  v_target_uid UUID;
  v_target_email TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem atribuir cargos operacionais.'
    );
  END IF;

  IF v_norm_cargo = 'assistência' THEN
    v_norm_cargo := 'assistencia';
  END IF;

  IF v_norm_email = '' OR v_norm_cargo = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Informe um e-mail válido e selecione um cargo.'
    );
  END IF;

  SELECT * INTO v_cargo
    FROM public.movare_roles
   WHERE id = v_norm_cargo
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Cargo selecionado não encontrado em public.movare_roles.'
    );
  END IF;

  SELECT id, email
    INTO v_target_uid, v_target_email
    FROM auth.users
   WHERE lower(email) = v_norm_email
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'error', 'Usuário não encontrado. Peça para criar uma conta ou cadastre em Authentication -> Users.'
    );
  END IF;

  IF v_target_uid = v_uid AND NOT v_cargo.can_manage_roles THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Não é possível remover sua própria permissão de gestão enquanto estiver logado.'
    );
  END IF;

  INSERT INTO public.user_profiles (user_id, email)
  VALUES (v_target_uid, COALESCE(v_target_email, v_norm_email))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.admin_users (user_id, email, role, cargo_id, created_by)
  VALUES (v_target_uid, COALESCE(v_target_email, v_norm_email), v_cargo.base_profile, v_cargo.id, v_uid)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        cargo_id = EXCLUDED.cargo_id,
        email = EXCLUDED.email;

  BEGIN
    UPDATE auth.users
       SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
           jsonb_build_object('role', v_cargo.base_profile, 'cargo_id', v_cargo.id)
     WHERE id = v_target_uid;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'user', jsonb_build_object(
      'user_id', v_target_uid,
      'email', COALESCE(v_target_email, v_norm_email),
      'role', v_cargo.base_profile,
      'cargo_id', v_cargo.id,
      'cargo_name', v_cargo.name,
      'cargo_color', v_cargo.color
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_movare_user_role(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_movare_user_role(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_movare_user_role(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_movare_manage_roles() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'error', 'Apenas administradores podem remover cargos.'
    );
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'error', 'Não é permitido remover o próprio cargo administrador ativo.'
    );
  END IF;

  DELETE FROM public.admin_users WHERE user_id = p_user_id;

  BEGIN
    UPDATE auth.users
       SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role' - 'cargo_id'
     WHERE id = p_user_id;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.remove_movare_user_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_movare_user_role(UUID) TO authenticated;

-- 9. CONFIGURAÇÃO DO SUPABASE REALTIME (MAPA + CARGOS E PERMISSÕES AO VIVO)
ALTER TABLE public.shared_map REPLICA IDENTITY FULL;
ALTER TABLE public.admin_users REPLICA IDENTITY FULL;
ALTER TABLE public.movare_roles REPLICA IDENTITY FULL;

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_users;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movare_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movare_roles;
  END IF;
END $$;

-- =============================================================================
-- EXEMPLO DE CADASTRO MANUAL DE PRIMEIRO ADMINISTRADOR
-- =============================================================================
-- 1) No Supabase Dashboard: Authentication -> Users -> Add User (ou pelo "Criar Conta" no app)
-- 2) Execute substituindo pelo e-mail do Administrador inicial:
--
-- INSERT INTO public.admin_users (user_id, email, role, cargo_id)
-- SELECT id, email, 'admin', 'admin'
-- FROM auth.users
-- WHERE email = 'admin@suaempresa.com.br'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin', cargo_id = 'admin', email = EXCLUDED.email;
--
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin", "cargo_id": "admin"}'::jsonb
-- WHERE email = 'admin@suaempresa.com.br';
-- =============================================================================

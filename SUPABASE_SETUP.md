# Configuração do Supabase & Deploy (Movare Localizador)

Este guia descreve exatamente o que deve ser configurado manualmente no **Supabase Dashboard** e na **Vercel** para ativar a autenticação de administradores, as permissões em banco (RLS) e a sincronização em tempo real do mapa central compartilhado.

---

## 1. Criar Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Copie em **Project Settings → API**:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon / public key** (`VITE_SUPABASE_ANON_KEY`)
3. **Nunca** utilize `service_role` no front-end ou em variáveis `VITE_*`.

---

## 2. Executar o Schema, RLS, RPC e Realtime
1. No Supabase Dashboard, abra **SQL Editor → New Query**.
2. Copie integralmente o conteúdo do arquivo `supabase/schema.sql` deste repositório e execute (**Run**).
3. Verifique se foram criados sem erros:
   - Tabela `public.shared_map` (com RLS ativo)
   - Tabela `public.admin_users` (com RLS ativo)
   - Função `public.is_movare_admin()`
   - Função RPC `public.save_shared_map(p_map_id, p_data, p_expected_version)`
   - Publicação `supabase_realtime` incluindo `public.shared_map`
4. Em **Database → Replication → supabase_realtime**, confirme que a tabela `shared_map` está marcada como habilitada.

---

## 3. Configurar Autenticação e Recuperação de Senha
1. No Supabase Dashboard, acesse **Authentication → Sign In / Providers**:
   - Mantenha **Email** ativado.
   - Recomenda-se desativar **Allow new users to sign up** caso deseje impedir criação pública de contas comuns, já que administradores sempre são promovidos manualmente no servidor.
2. Em **Authentication → URL Configuration**:
   - Configure **Site URL** com o domínio de produção da Vercel (ex: `https://movare.vercel.app`).
   - Adicione em **Redirect URLs** o domínio de produção e `http://localhost:3000/**` para desenvolvimento e recuperação de senha.

---

## 4. Cadastrar o Primeiro Administrador (Seguro)
Nenhum usuário consegue se tornar administrador via interface ou manipulando dados do navegador (`user_metadata` é ignorado).

1. No Supabase Dashboard, acesse **Authentication → Users → Add user → Create new user**.
2. Informe o e-mail e uma senha forte para o administrador e marque **Auto Confirm User**.
3. No **SQL Editor**, execute o bloco abaixo substituindo pelo e-mail cadastrado:

```sql
INSERT INTO public.admin_users (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@suaempresa.com.br'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'admin@suaempresa.com.br';
```

---

## 5. Variáveis de Ambiente na Vercel e Local
Adicione as seguintes variáveis no painel da **Vercel** (**Project Settings → Environment Variables**) para *Production*, *Preview* e *Development*:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Para desenvolvimento local, crie um arquivo `.env.local` dentro de `artifacts/movare-localizador/` (ou na raiz configurada) com as mesmas variáveis e reinicie o servidor Vite.

Após configurar as variáveis na Vercel, realize um novo deploy (**Redeploy**) para que o bundle do Vite receba as chaves públicas.

---

## 6. Migração Inicial do Mapa Existente
1. Após o deploy com Supabase configurado, acesse o Movare em um dispositivo que já possui o mapa atual salvo localmente.
2. Clique no indicador de acesso no topo e faça login com sua conta de **Administrador**.
3. Como o banco central estará vazio na primeira vez, o sistema detectará automaticamente os dados locais válidos e abrirá o assistente **Migração para Nuvem**.
4. Você poderá baixar uma cópia JSON de segurança e confirmar o envio como **Versão 1 (v1)** do mapa central compartilhado.
5. A partir desse momento, todos os demais celulares e computadores (visitantes ou outros administradores) passarão a carregar diretamente o mapa central em tempo real.

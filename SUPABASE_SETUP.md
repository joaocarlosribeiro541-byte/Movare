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
   - Tabela `public.movare_roles` (cargos padrão + personalizados e suas permissões)
   - Tabela `public.user_profiles` + trigger `on_auth_user_created` (registro de usuários comuns que se cadastrarem pelo app)
   - Tabela `public.admin_users` (vínculo protegido de usuário ↔ cargo)
   - Funções `public.get_my_movare_access()`, `public.get_movare_role()`, `public.is_movare_admin()`, `public.can_movare_reserve()` e `public.can_movare_manage_roles()`
   - RPC `public.save_shared_map(...)` (cargos com edição de mapa)
   - RPC `public.toggle_position_reservation(...)` (cargos com permissão de reserva)
   - RPCs `public.list_movare_cargos()`, `public.save_movare_cargo(...)`, `public.delete_movare_cargo(...)`, `public.list_movare_users()`, `public.assign_movare_user_role(...)` e `public.remove_movare_user_role(...)`
   - Publicação `supabase_realtime` incluindo `shared_map`, `admin_users` e `movare_roles`
4. Em **Database → Replication → supabase_realtime**, confirme que as tabelas `shared_map`, `admin_users` e `movare_roles` estão habilitadas.

---

## 3. Configurar Autenticação e Autocadastro de Usuário Comum
1. No Supabase Dashboard, acesse **Authentication → Sign In / Providers**:
   - Mantenha **Email** ativado.
   - Mantenha **Allow new users to sign up** ativado para que novos colaboradores possam se cadastrar pela aba **"Criar Conta"** no app como **Usuário Comum** (somente leitura) e aguardar a atribuição de um cargo pelo Administrador.
   - *(Opcional)* Se quiser acesso imediato sem confirmação de e-mail em ambiente interno, desative **Confirm email** em **Authentication → Providers → Email**.
2. Em **Authentication → URL Configuration**:
   - Configure **Site URL** com o domínio da aplicação (ex: `https://movare.vercel.app`).
   - Adicione em **Redirect URLs** o domínio de produção e `http://localhost:3000/**` para desenvolvimento e recuperação de senha.

---

## 4. Cadastrar o Primeiro Administrador e Gerenciar Cargos
Nenhum usuário consegue elevar privilégios pelo navegador (`user_metadata` é ignorado e novos usuários começam sempre sem cargo, em modo leitura).

1. Crie a conta do Administrador inicial em **Authentication → Users → Add user** (com **Auto Confirm User** marcado) ou pela aba **Criar Conta** no próprio app.
2. No **SQL Editor**, promova o primeiro Administrador executando:

```sql
INSERT INTO public.admin_users (user_id, email, role, cargo_id)
SELECT id, email, 'admin', 'admin'
FROM auth.users
WHERE email = 'admin@suaempresa.com.br'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', cargo_id = 'admin', email = EXCLUDED.email;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin", "cargo_id": "admin"}'::jsonb
WHERE email = 'admin@suaempresa.com.br';
```

3. Depois de entrar como Administrador, abra **Central de Acesso & Nuvem**:
   - Em **Cargos & Permissões**: crie, edite ou exclua cargos personalizados classificando exatamente quais permissões cada cargo concede (**Editar Mapa**, **Reservar Posições**, **Painel Conferente**, **Gerenciar Cargos**).
   - Em **Equipe & Usuários**: visualize todos os usuários comuns cadastrados e atribua ou remova cargos com um clique — o usuário recebe automaticamente as permissões em tempo real.

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

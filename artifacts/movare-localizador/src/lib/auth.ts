import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'visitor' | 'admin';

export type AuthActionResult = {
  ok: boolean;
  error?: string;
  role?: UserRole;
  user?: User | null;
  session?: Session | null;
};

/**
 * Extrai papel administrativo EXCLUSIVAMENTE de fontes confiáveis no servidor.
 * NUNCA confia em user.user_metadata (pois é editável pelo cliente no Supabase Auth).
 */
export function extractRoleFromAppMetadata(user: User | null | undefined): UserRole {
  if (!user) return 'visitor';
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  return appMeta?.role === 'admin' ? 'admin' : 'visitor';
}

/**
 * Resolve o nível de acesso real do usuário autenticado:
 * 1) Verifica JWT app_metadata.role === 'admin'
 * 2) Verifica tabela protegida public.admin_users via RLS (somente próprio user_id)
 * Fail-closed: qualquer falha ou ausência retorna 'visitor'.
 */
export async function resolveUserRole(
  user: User | null | undefined,
  client: SupabaseClient | null = supabase
): Promise<UserRole> {
  if (!user) return 'visitor';

  if (extractRoleFromAppMetadata(user) === 'admin') {
    return 'admin';
  }

  if (!client) return 'visitor';

  try {
    const { data, error } = await client
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return 'visitor';
    }

    return data.role === 'admin' ? 'admin' : 'visitor';
  } catch {
    return 'visitor';
  }
}

export function formatAuthErrorMessage(rawMessage?: string | null): string {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'Não foi possível concluir a autenticação.';
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
  }
  if (msg.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado no Supabase Authentication.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Falha de conexão com o servidor de autenticação. Verifique sua internet.';
  }
  if (msg.includes('password') && msg.includes('6')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  return rawMessage || 'Falha na autenticação.';
}

export async function signInWithEmail(
  email: string,
  password: string,
  client: SupabaseClient | null = supabase
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured && client === supabase) {
    return {
      ok: false,
      role: 'visitor',
      error: 'Supabase não configurado neste ambiente. Configure as variáveis antes de autenticar.',
    };
  }
  if (!client) {
    return {
      ok: false,
      role: 'visitor',
      error: 'Cliente de autenticação indisponível.',
    };
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return {
      ok: false,
      role: 'visitor',
      error: 'Informe e-mail e senha para entrar.',
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return {
        ok: false,
        role: 'visitor',
        error: formatAuthErrorMessage(error.message),
      };
    }

    const role = await resolveUserRole(data.user, client);

    return {
      ok: true,
      role,
      user: data.user,
      session: data.session,
    };
  } catch (err) {
    return {
      ok: false,
      role: 'visitor',
      error: formatAuthErrorMessage(err instanceof Error ? err.message : null),
    };
  }
}

export async function signOutAdmin(client: SupabaseClient | null = supabase): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: true };
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return { ok: false, error: formatAuthErrorMessage(error.message) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatAuthErrorMessage(err instanceof Error ? err.message : null) };
  }
}

export async function sendPasswordReset(
  email: string,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { ok: false, error: 'Digite seu e-mail para receber o link de recuperação.' };
  }

  try {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await client.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
    if (error) {
      return { ok: false, error: formatAuthErrorMessage(error.message) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatAuthErrorMessage(err instanceof Error ? err.message : null) };
  }
}

export async function updateRecoveredPassword(
  newPassword: string,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  try {
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, error: formatAuthErrorMessage(error.message) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatAuthErrorMessage(err instanceof Error ? err.message : null) };
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseEnvCheck = {
  configured: boolean;
  url: string | null;
  anonKey: string | null;
  error: string | null;
};

export function checkSupabaseEnv(env: Record<string, unknown> = import.meta.env): SupabaseEnvCheck {
  const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const rawKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';

  if (!rawUrl || !rawKey) {
    return {
      configured: false,
      url: rawUrl || null,
      anonKey: rawKey || null,
      error:
        'Integração Supabase não configurada neste ambiente (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).',
    };
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        configured: false,
        url: null,
        anonKey: null,
        error: 'VITE_SUPABASE_URL deve usar protocolo http:// ou https:// válido.',
      };
    }
  } catch {
    return {
      configured: false,
      url: null,
      anonKey: null,
      error: 'VITE_SUPABASE_URL inválida nas variáveis de ambiente.',
    };
  }

  return {
    configured: true,
    url: rawUrl,
    anonKey: rawKey,
    error: null,
  };
}

const envStatus = checkSupabaseEnv();

export const isSupabaseConfigured: boolean = envStatus.configured;
export const supabaseConfigError: string | null = envStatus.error;

export const supabase: SupabaseClient | null =
  envStatus.configured && envStatus.url && envStatus.anonKey
    ? createClient(envStatus.url, envStatus.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

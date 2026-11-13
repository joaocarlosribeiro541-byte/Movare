import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';
import {
  resolveUserRole,
  sendPasswordReset,
  signInWithEmail,
  signOutAdmin,
  updateRecoveredPassword,
  type UserRole,
} from '../lib/auth';

export type AuthState = {
  isConfigured: boolean;
  configError: string | null;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  role: UserRole;
  isAdmin: boolean;
  passwordRecoveryPending: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; role: UserRole; error?: string }>;
  logout: () => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  clearPasswordRecovery: () => void;
  refreshRole: () => Promise<UserRole>;
};

export function useAuth(): AuthState {
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('visitor');
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);

  const syncSessionAndRole = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setRole('visitor');
      return 'visitor' as UserRole;
    }

    const resolvedRole = await resolveUserRole(nextUser, supabase);
    setRole(resolvedRole);
    return resolvedRole;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      setRole('visitor');
      setSession(null);
      setUser(null);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        await syncSessionAndRole(data.session ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRole('visitor');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryPending(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryPending(false);
      }
      void syncSessionAndRole(nextSession ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncSessionAndRole]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await signInWithEmail(email, password, supabase);
    if (res.ok && res.session) {
      setSession(res.session);
      setUser(res.user ?? null);
      setRole(res.role ?? 'visitor');
    }
    return {
      ok: res.ok,
      role: res.role ?? 'visitor',
      error: res.error,
    };
  }, []);

  const logout = useCallback(async () => {
    const res = await signOutAdmin(supabase);
    if (res.ok) {
      setSession(null);
      setUser(null);
      setRole('visitor');
      setPasswordRecoveryPending(false);
    }
    return res;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return sendPasswordReset(email, supabase);
  }, []);

  const completePasswordRecovery = useCallback(async (newPassword: string) => {
    const res = await updateRecoveredPassword(newPassword, supabase);
    if (res.ok) {
      setPasswordRecoveryPending(false);
    }
    return res;
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecoveryPending(false);
  }, []);

  const refreshRole = useCallback(async () => {
    const resolved = await resolveUserRole(user, supabase);
    setRole(resolved);
    return resolved;
  }, [user]);

  return {
    isConfigured: isSupabaseConfigured,
    configError: supabaseConfigError,
    isLoading,
    user,
    session,
    role,
    isAdmin: role === 'admin' && Boolean(user) && Boolean(session),
    passwordRecoveryPending,
    login,
    logout,
    requestPasswordReset,
    completePasswordRecovery,
    clearPasswordRecovery,
    refreshRole,
  };
}

import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';
import {
  buildFallbackProfileFromUser,
  computePermissionsFromRole,
  createVisitorAccess,
  resolveUserAccess,
  sendPasswordReset,
  signInWithEmail,
  signOutAdmin,
  signUpCommonUser,
  updateMyProfile,
  updateRecoveredPassword,
  type AuthSignUpResult,
  type CargoColor,
  type ResolvedUserAccess,
  type UpdateProfileInput,
  type UserPermissions,
  type UserProfileData,
  type UserRole,
} from '../lib/auth';

export type AuthState = {
  isConfigured: boolean;
  configError: string | null;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  role: UserRole;
  cargoId: string | null;
  cargoName: string | null;
  cargoColor: CargoColor | null;
  permissions: UserPermissions;
  profile: UserProfileData | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAssistencia: boolean;
  isConferente: boolean;
  canReservePositions: boolean;
  canUseConferentePanel: boolean;
  canManageRoles: boolean;
  isCommonUser: boolean;
  isVisitor: boolean;
  passwordRecoveryPending: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; role: UserRole; error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthSignUpResult>;
  logout: () => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  clearPasswordRecovery: () => void;
  refreshRole: () => Promise<UserRole>;
  updateProfile: (input: UpdateProfileInput) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
};

export function useAuth(): AuthState {
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<ResolvedUserAccess>(() => createVisitorAccess());
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);

  const syncSessionAndRole = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setAccess(createVisitorAccess());
      return 'visitor' as UserRole;
    }

    const resolvedAccess = await resolveUserAccess(nextUser, supabase);
    setAccess(resolvedAccess);
    return resolvedAccess.role;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      setAccess(createVisitorAccess());
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
        setAccess(createVisitorAccess());
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

  const userId = user?.id ?? null;

  const refreshRole = useCallback(async () => {
    if (!user) {
      setAccess(createVisitorAccess());
      return 'visitor' as UserRole;
    }
    const resolved = await resolveUserAccess(user, supabase);
    setAccess(resolved);
    return resolved.role;
  }, [user]);

  // Atualização automática de permissões via Realtime quando o Admin atribui, edita ou remove um cargo
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) return;

    const client = supabase;
    const channel = client
      .channel(`movare-access-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_users',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshRole();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movare_roles',
        },
        () => {
          void refreshRole();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refreshRole, userId]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await signInWithEmail(email, password, supabase);
    if (res.ok && res.session) {
      setSession(res.session);
      setUser(res.user ?? null);
      if (res.access) {
        setAccess(res.access);
      } else {
        const resolved = await resolveUserAccess(res.user ?? null, supabase);
        setAccess(resolved);
      }
    }
    return {
      ok: res.ok,
      role: res.role ?? 'visitor',
      error: res.error,
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const res = await signUpCommonUser(email, password, fullName, supabase);
    if (res.ok && res.session && res.user) {
      setSession(res.session);
      setUser(res.user);
      const resolved = await resolveUserAccess(res.user, supabase);
      setAccess(resolved);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    const res = await signOutAdmin(supabase);
    if (res.ok) {
      setSession(null);
      setUser(null);
      setAccess(createVisitorAccess());
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

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const res = await updateMyProfile(input, supabase);
      if (res.ok && res.profile) {
        setAccess((prev) => ({
          ...prev,
          profile: res.profile,
        }));
      }
      return { ok: res.ok, error: res.error };
    },
    []
  );

  const changePassword = useCallback(async (newPassword: string) => {
    return updateRecoveredPassword(newPassword, supabase);
  }, []);

  const isAuthenticated = Boolean(user) && Boolean(session);
  const effectivePermissions = isAuthenticated ? access.permissions : computePermissionsFromRole('visitor');
  const hasAnyOperationalPermission =
    effectivePermissions.canEditMap ||
    effectivePermissions.canReservePositions ||
    effectivePermissions.canUseConferentePanel ||
    effectivePermissions.canManageRoles;

  const resolvedProfile = isAuthenticated
    ? access.profile ?? buildFallbackProfileFromUser(user)
    : null;

  return {
    isConfigured: isSupabaseConfigured,
    configError: supabaseConfigError,
    isLoading,
    user,
    session,
    role: access.role,
    cargoId: isAuthenticated ? access.cargoId : null,
    cargoName: isAuthenticated ? access.cargoName : null,
    cargoColor: isAuthenticated ? access.cargoColor : null,
    permissions: effectivePermissions,
    profile: resolvedProfile,
    isAuthenticated,
    isAdmin: isAuthenticated && effectivePermissions.canEditMap,
    isAssistencia:
      isAuthenticated &&
      (access.role === 'assistencia' || (effectivePermissions.canReservePositions && !effectivePermissions.canEditMap)),
    isConferente:
      isAuthenticated &&
      (access.role === 'conferente' || (effectivePermissions.canUseConferentePanel && !effectivePermissions.canEditMap)),
    canReservePositions: isAuthenticated && effectivePermissions.canReservePositions,
    canUseConferentePanel: isAuthenticated && effectivePermissions.canUseConferentePanel,
    canManageRoles: isAuthenticated && effectivePermissions.canManageRoles,
    isCommonUser: isAuthenticated && access.role === 'visitor' && !hasAnyOperationalPermission,
    isVisitor: !isAuthenticated || (access.role === 'visitor' && !hasAnyOperationalPermission),
    passwordRecoveryPending,
    login,
    signUp,
    logout,
    requestPasswordReset,
    completePasswordRecovery,
    clearPasswordRecovery,
    refreshRole,
    updateProfile,
    changePassword,
  };
}

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'assistencia' | 'conferente' | 'visitor';

export type CargoColor = 'emerald' | 'amber' | 'sky' | 'orange' | 'violet' | 'rose' | 'slate';

export type UserPermissions = {
  canEditMap: boolean;
  canReservePositions: boolean;
  canUseConferentePanel: boolean;
  canManageRoles: boolean;
};

export type MovareCargo = {
  id: string;
  name: string;
  description: string;
  color: CargoColor;
  base_profile: UserRole;
  can_edit_map: boolean;
  can_reserve_positions: boolean;
  can_use_conferente_panel: boolean;
  can_manage_roles: boolean;
  is_system: boolean;
  member_count?: number;
};

export type UserProfileData = {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  department: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ResolvedUserAccess = {
  role: UserRole;
  cargoId: string | null;
  cargoName: string | null;
  cargoColor: CargoColor | null;
  permissions: UserPermissions;
  profile?: UserProfileData | null;
};

export type RoleMetadata = {
  id: UserRole;
  label: string;
  shortLabel: string;
  description: string;
};

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  admin: {
    id: 'admin',
    label: 'Administrador',
    shortLabel: 'Admin',
    description: 'Edição completa do mapa, galpões, zonas, posições, reservas, cargos e publicação na nuvem.',
  },
  assistencia: {
    id: 'assistencia',
    label: 'Assistência Técnica',
    shortLabel: 'Assistência',
    description: 'Consulta ao mapa, busca de produtos e sinalização/gestão de itens reservados na nuvem.',
  },
  conferente: {
    id: 'conferente',
    label: 'Conferente',
    shortLabel: 'Conferente',
    description: 'Consulta operacional rápida por código, SKU, modelo e fornecedor (somente leitura).',
  },
  visitor: {
    id: 'visitor',
    label: 'Visitante',
    shortLabel: 'Visitante',
    description: 'Visualização simplificada do mapa e consulta básica (somente leitura).',
  },
};

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, UserPermissions> = {
  admin: {
    canEditMap: true,
    canReservePositions: true,
    canUseConferentePanel: false,
    canManageRoles: true,
  },
  assistencia: {
    canEditMap: false,
    canReservePositions: true,
    canUseConferentePanel: false,
    canManageRoles: false,
  },
  conferente: {
    canEditMap: false,
    canReservePositions: false,
    canUseConferentePanel: true,
    canManageRoles: false,
  },
  visitor: {
    canEditMap: false,
    canReservePositions: false,
    canUseConferentePanel: false,
    canManageRoles: false,
  },
};

export function computePermissionsFromRole(role: UserRole): UserPermissions {
  const base = DEFAULT_PERMISSIONS_BY_ROLE[role] ?? DEFAULT_PERMISSIONS_BY_ROLE.visitor;
  return { ...base };
}

export function deriveBaseProfileFromPermissions(perms: UserPermissions): UserRole {
  if (perms.canEditMap || perms.canManageRoles) return 'admin';
  if (perms.canReservePositions) return 'assistencia';
  if (perms.canUseConferentePanel) return 'conferente';
  return 'visitor';
}

export function normalizeCargoColor(raw: unknown): CargoColor {
  if (typeof raw !== 'string') return 'slate';
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'emerald' ||
    normalized === 'amber' ||
    normalized === 'sky' ||
    normalized === 'orange' ||
    normalized === 'violet' ||
    normalized === 'rose' ||
    normalized === 'slate'
  ) {
    return normalized;
  }
  return 'slate';
}

export function normalizeTrustedRole(raw: unknown): UserRole {
  if (typeof raw !== 'string') return 'visitor';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'assistencia' || normalized === 'assistência') return 'assistencia';
  if (normalized === 'conferente') return 'conferente';
  return 'visitor';
}

export type AuthActionResult = {
  ok: boolean;
  error?: string;
  role?: UserRole;
  access?: ResolvedUserAccess;
  user?: User | null;
  session?: Session | null;
};

export type AuthSignUpResult = {
  ok: boolean;
  error?: string;
  role: UserRole;
  needsEmailConfirmation: boolean;
  user?: User | null;
  session?: Session | null;
};

/**
 * Extrai papel de acesso EXCLUSIVAMENTE de fontes confiáveis no servidor (app_metadata).
 * NUNCA confia em user.user_metadata (pois é editável pelo cliente no Supabase Auth).
 */
export function extractRoleFromAppMetadata(user: User | null | undefined): UserRole {
  if (!user) return 'visitor';
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  return normalizeTrustedRole(appMeta?.role);
}

function defaultColorForRole(role: UserRole): CargoColor | null {
  if (role === 'admin') return 'emerald';
  if (role === 'assistencia') return 'amber';
  if (role === 'conferente') return 'sky';
  return null;
}

export function parseUserProfileData(
  raw: unknown,
  fallbackUser?: User | null
): UserProfileData | null {
  if (!raw || typeof raw !== 'object') {
    return buildFallbackProfileFromUser(fallbackUser);
  }
  const obj = raw as Record<string, unknown>;
  const userId =
    typeof obj.user_id === 'string' && obj.user_id
      ? obj.user_id
      : fallbackUser?.id || '';
  const email =
    typeof obj.email === 'string' && obj.email
      ? obj.email
      : fallbackUser?.email || '';
  const metaName =
    fallbackUser?.user_metadata &&
    typeof (fallbackUser.user_metadata as Record<string, unknown>).full_name === 'string'
      ? ((fallbackUser.user_metadata as Record<string, unknown>).full_name as string).trim()
      : null;

  return {
    userId,
    email,
    fullName:
      typeof obj.full_name === 'string' && obj.full_name.trim()
        ? obj.full_name.trim()
        : metaName || null,
    phone: typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : null,
    department:
      typeof obj.department === 'string' && obj.department.trim()
        ? obj.department.trim()
        : null,
    createdAt: typeof obj.created_at === 'string' ? obj.created_at : fallbackUser?.created_at ?? null,
    updatedAt: typeof obj.updated_at === 'string' ? obj.updated_at : null,
  };
}

export function buildFallbackProfileFromUser(user: User | null | undefined): UserProfileData | null {
  if (!user) return null;
  const rawName = (user.user_metadata as Record<string, unknown> | undefined)?.full_name;
  return {
    userId: user.id,
    email: user.email || '',
    fullName: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null,
    phone: null,
    department: null,
    createdAt: user.created_at ?? null,
    updatedAt: null,
  };
}

export function createVisitorAccess(): ResolvedUserAccess {
  return {
    role: 'visitor',
    cargoId: null,
    cargoName: null,
    cargoColor: null,
    permissions: computePermissionsFromRole('visitor'),
  };
}

/**
 * Resolve o nível de acesso real do usuário autenticado:
 * 1) Verifica JWT app_metadata.role ('admin' | 'assistencia' | 'conferente')
 * 2) Verifica tabela protegida public.admin_users via RLS (somente próprio user_id)
 * Fail-closed: qualquer falha ou ausência retorna 'visitor'.
 */
export async function resolveUserRole(
  user: User | null | undefined,
  client: SupabaseClient | null = supabase
): Promise<UserRole> {
  if (!user) return 'visitor';

  const appMetaRole = extractRoleFromAppMetadata(user);
  if (appMetaRole !== 'visitor') {
    return appMetaRole;
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

    return normalizeTrustedRole(data.role);
  } catch {
    return 'visitor';
  }
}

/**
 * Resolve o cargo e as permissões granulares ao vivo do usuário autenticado via RPC `get_my_movare_access`,
 * com fallback seguro para `admin_users` / `app_metadata` caso a RPC não exista em ambientes antigos.
 */
export async function resolveUserAccess(
  user: User | null | undefined,
  client: SupabaseClient | null = supabase
): Promise<ResolvedUserAccess> {
  if (!user) return createVisitorAccess();

  if (client && typeof client.rpc === 'function') {
    try {
      const { data, error } = await client.rpc('get_my_movare_access');
      if (!error && data && typeof data === 'object') {
        const raw = data as Record<string, unknown>;
        const rawPerms = (raw.permissions || {}) as Record<string, unknown>;
        const permissions: UserPermissions = {
          canEditMap: Boolean(rawPerms.can_edit_map),
          canReservePositions: Boolean(rawPerms.can_reserve_positions),
          canUseConferentePanel: Boolean(rawPerms.can_use_conferente_panel),
          canManageRoles: Boolean(rawPerms.can_manage_roles),
        };
        const parsedRole = normalizeTrustedRole(raw.role);
        const derivedRole =
          parsedRole !== 'visitor'
            ? parsedRole
            : deriveBaseProfileFromPermissions(permissions);

        const cargoId = typeof raw.cargo_id === 'string' && raw.cargo_id ? raw.cargo_id : null;
        const cargoName = typeof raw.cargo_name === 'string' && raw.cargo_name ? raw.cargo_name : null;
        const cargoColor = raw.cargo_color ? normalizeCargoColor(raw.cargo_color) : defaultColorForRole(derivedRole);

        const resolved: ResolvedUserAccess = {
          role: derivedRole,
          cargoId,
          cargoName,
          cargoColor,
          permissions,
        };

        if ('profile' in raw) {
          resolved.profile = parseUserProfileData(raw.profile, user);
        }

        return resolved;
      }
    } catch {
      // Fall back to direct role lookup below
    }
  }

  const fallbackRole = await resolveUserRole(user, client);
  if (fallbackRole === 'visitor') {
    return createVisitorAccess();
  }

  return {
    role: fallbackRole,
    cargoId: fallbackRole,
    cargoName: ROLE_METADATA[fallbackRole].label,
    cargoColor: defaultColorForRole(fallbackRole),
    permissions: computePermissionsFromRole(fallbackRole),
  };
}

export function formatAuthErrorMessage(rawMessage?: string | null): string {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'Não foi possível concluir a autenticação.';
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Este e-mail já está cadastrado no sistema. Faça login ou recupere sua senha.';
  }
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return 'Cadastro público desabilitado no Supabase Authentication. Ative "Allow new users to sign up" nas configurações do projeto.';
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

    const access = await resolveUserAccess(data.user, client);

    return {
      ok: true,
      role: access.role,
      access,
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

/**
 * Autocadastro de Usuário Comum (sem cargo/permissões privilegiadas).
 * O cargo e as permissões serão atribuídos posteriormente por um Administrador no painel.
 */
export async function signUpCommonUser(
  email: string,
  password: string,
  fullName?: string,
  client: SupabaseClient | null = supabase
): Promise<AuthSignUpResult> {
  if (!isSupabaseConfigured && client === supabase) {
    return {
      ok: false,
      role: 'visitor',
      needsEmailConfirmation: false,
      error: 'Supabase não configurado neste ambiente.',
    };
  }
  if (!client) {
    return {
      ok: false,
      role: 'visitor',
      needsEmailConfirmation: false,
      error: 'Cliente de autenticação indisponível.',
    };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const cleanName = fullName?.trim() || '';

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return {
      ok: false,
      role: 'visitor',
      needsEmailConfirmation: false,
      error: 'Informe um e-mail válido para criar sua conta.',
    };
  }

  if (!password || password.length < 6) {
    return {
      ok: false,
      role: 'visitor',
      needsEmailConfirmation: false,
      error: 'A senha deve conter no mínimo 6 caracteres.',
    };
  }

  try {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await client.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: cleanName ? { full_name: cleanName } : undefined,
      },
    });

    if (error) {
      return {
        ok: false,
        role: 'visitor',
        needsEmailConfirmation: false,
        error: formatAuthErrorMessage(error.message),
      };
    }

    if (data.session && data.user && typeof client.rpc === 'function') {
      try {
        await client.rpc('sync_my_profile', { p_full_name: cleanName || null });
      } catch {
        // Trigger on_auth_user_created already creates the profile row
      }
    }

    return {
      ok: true,
      role: 'visitor',
      needsEmailConfirmation: !data.session,
      user: data.user ?? null,
      session: data.session ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      role: 'visitor',
      needsEmailConfirmation: false,
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

export type OperationalUserRecord = {
  user_id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  department?: string | null;
  role: UserRole;
  cargo_id: string | null;
  cargo_name?: string | null;
  cargo_color?: CargoColor | null;
  email_confirmed?: boolean;
  last_sign_in_at?: string | null;
  created_at?: string;
};

export type UpdateProfileInput = {
  fullName: string;
  phone?: string;
  department?: string;
};

export async function updateMyProfile(
  input: UpdateProfileInput,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; profile?: UserProfileData | null; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }

  const cleanName = input.fullName.trim();
  const cleanPhone = input.phone?.trim() ?? '';
  const cleanDept = input.department?.trim() ?? '';

  try {
    const { data, error } = await client.rpc('sync_my_profile', {
      p_full_name: cleanName || null,
      p_phone: cleanPhone,
      p_department: cleanDept,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível atualizar seu perfil.',
      };
    }

    if (client.auth && typeof client.auth.updateUser === 'function') {
      try {
        await client.auth.updateUser({
          data: { full_name: cleanName || null },
        });
      } catch {
        // Non-blocking sync to auth metadata
      }
    }

    return {
      ok: true,
      profile: parseUserProfileData(payload.profile),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao atualizar perfil.',
    };
  }
}

export async function updateMemberProfile(
  userId: string,
  input: UpdateProfileInput,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; profile?: UserProfileData | null; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  if (!userId.trim()) {
    return { ok: false, error: 'Membro inválido.' };
  }

  const cleanName = input.fullName.trim();
  const cleanPhone = input.phone?.trim() ?? '';
  const cleanDept = input.department?.trim() ?? '';

  try {
    const { data, error } = await client.rpc('update_movare_member_profile', {
      p_user_id: userId,
      p_full_name: cleanName || null,
      p_phone: cleanPhone,
      p_department: cleanDept,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível atualizar os dados do membro.',
      };
    }

    return {
      ok: true,
      profile: parseUserProfileData(payload.profile),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao atualizar perfil do membro.',
    };
  }
}

function parseMovareCargo(raw: Record<string, unknown>): MovareCargo {
  const canEditMap = Boolean(raw.can_edit_map);
  const canReservePositions = Boolean(raw.can_reserve_positions);
  const canUseConferentePanel = Boolean(raw.can_use_conferente_panel);
  const canManageRoles = Boolean(raw.can_manage_roles);
  const parsedBase = normalizeTrustedRole(raw.base_profile);
  const baseProfile =
    parsedBase !== 'visitor'
      ? parsedBase
      : deriveBaseProfileFromPermissions({
          canEditMap,
          canReservePositions,
          canUseConferentePanel,
          canManageRoles,
        });

  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    color: normalizeCargoColor(raw.color),
    base_profile: baseProfile,
    can_edit_map: canEditMap,
    can_reserve_positions: canReservePositions,
    can_use_conferente_panel: canUseConferentePanel,
    can_manage_roles: canManageRoles,
    is_system: Boolean(raw.is_system),
    member_count: typeof raw.member_count === 'number' ? raw.member_count : undefined,
  };
}

export async function listCargos(
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; cargos: MovareCargo[]; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, cargos: [], error: 'Supabase não configurado neste ambiente.' };
  }
  try {
    const { data, error } = await client.rpc('list_movare_cargos');
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('could not find the function') || msg.includes('list_movare_cargos')) {
        return {
          ok: false,
          cargos: [],
          error: 'Execute o script supabase/schema.sql atualizado no SQL Editor para habilitar o sistema de cargos.',
        };
      }
      return { ok: false, cargos: [], error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok' || !Array.isArray(payload.cargos)) {
      return {
        ok: false,
        cargos: [],
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível carregar os cargos.',
      };
    }

    const cargos = payload.cargos
      .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
      .map(parseMovareCargo)
      .filter((c) => Boolean(c.id && c.name));

    return { ok: true, cargos };
  } catch (err) {
    return {
      ok: false,
      cargos: [],
      error: err instanceof Error ? err.message : 'Erro ao listar cargos.',
    };
  }
}

export type SaveCargoInput = {
  id?: string;
  name: string;
  description?: string;
  color: CargoColor;
  canEditMap: boolean;
  canReservePositions: boolean;
  canUseConferentePanel: boolean;
  canManageRoles: boolean;
};

export async function saveCargo(
  input: SaveCargoInput,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; cargo?: MovareCargo; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  const cleanName = input.name.trim();
  if (!cleanName) {
    return { ok: false, error: 'Informe um nome válido para o cargo.' };
  }

  const baseProfile = deriveBaseProfileFromPermissions({
    canEditMap: input.canEditMap,
    canReservePositions: input.canReservePositions,
    canUseConferentePanel: input.canUseConferentePanel,
    canManageRoles: input.canManageRoles,
  });

  try {
    const { data, error } = await client.rpc('save_movare_cargo', {
      p_id: input.id?.trim() || '',
      p_name: cleanName,
      p_description: input.description?.trim() || '',
      p_color: input.color || 'slate',
      p_base_profile: baseProfile,
      p_can_edit_map: Boolean(input.canEditMap),
      p_can_reserve_positions: Boolean(input.canReservePositions),
      p_can_use_conferente_panel: Boolean(input.canUseConferentePanel),
      p_can_manage_roles: Boolean(input.canManageRoles),
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok' || !payload.cargo || typeof payload.cargo !== 'object') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível salvar o cargo.',
      };
    }

    return {
      ok: true,
      cargo: parseMovareCargo(payload.cargo as Record<string, unknown>),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao salvar cargo.',
    };
  }
}

export async function deleteCargo(
  cargoId: string,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  if (!cargoId.trim()) {
    return { ok: false, error: 'Cargo inválido.' };
  }
  try {
    const { data, error } = await client.rpc('delete_movare_cargo', {
      p_cargo_id: cargoId.trim(),
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível excluir o cargo.',
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao excluir cargo.',
    };
  }
}

export async function listOperationalUsers(
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; users: OperationalUserRecord[]; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, users: [], error: 'Supabase não configurado neste ambiente.' };
  }
  try {
    const { data, error } = await client.rpc('list_movare_users');
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('could not find the function') || msg.includes('list_movare_users')) {
        return {
          ok: false,
          users: [],
          error: 'Execute o script supabase/schema.sql atualizado no SQL Editor para gerenciar cargos pelo painel.',
        };
      }
      return { ok: false, users: [], error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok' || !Array.isArray(payload.users)) {
      return {
        ok: false,
        users: [],
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível carregar os usuários.',
      };
    }

    const users: OperationalUserRecord[] = payload.users
      .filter((u): u is Record<string, unknown> => Boolean(u && typeof u === 'object'))
      .map((u) => {
        const role = normalizeTrustedRole(u.role);
        const cargoId =
          typeof u.cargo_id === 'string' && u.cargo_id.trim()
            ? u.cargo_id.trim()
            : role !== 'visitor'
            ? role
            : null;
        return {
          user_id: typeof u.user_id === 'string' ? u.user_id : '',
          email: typeof u.email === 'string' ? u.email : '',
          full_name: typeof u.full_name === 'string' && u.full_name.trim() ? u.full_name.trim() : null,
          phone: typeof u.phone === 'string' && u.phone.trim() ? u.phone.trim() : null,
          department: typeof u.department === 'string' && u.department.trim() ? u.department.trim() : null,
          role,
          cargo_id: cargoId,
          cargo_name:
            typeof u.cargo_name === 'string' && u.cargo_name.trim()
              ? u.cargo_name.trim()
              : cargoId && role !== 'visitor'
              ? ROLE_METADATA[role].label
              : null,
          cargo_color: u.cargo_color ? normalizeCargoColor(u.cargo_color) : defaultColorForRole(role),
          email_confirmed: typeof u.email_confirmed === 'boolean' ? u.email_confirmed : undefined,
          last_sign_in_at: typeof u.last_sign_in_at === 'string' ? u.last_sign_in_at : null,
          created_at: typeof u.created_at === 'string' ? u.created_at : undefined,
        };
      })
      .filter((u) => u.user_id && u.email);

    return { ok: true, users };
  } catch (err) {
    return {
      ok: false,
      users: [],
      error: err instanceof Error ? err.message : 'Erro ao consultar usuários operacionais.',
    };
  }
}

export async function assignOperationalUserRole(
  email: string,
  cargoId: string,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; user?: OperationalUserRecord; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  const trimmedEmail = email.trim().toLowerCase();
  const cleanCargoId = cargoId.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { ok: false, error: 'Informe um e-mail válido cadastrado no sistema.' };
  }
  if (!cleanCargoId) {
    return { ok: false, error: 'Selecione um cargo válido.' };
  }

  try {
    const { data, error } = await client.rpc('assign_movare_user_role', {
      p_email: trimmedEmail,
      p_role: cleanCargoId,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('could not find the function') || msg.includes('assign_movare_user_role')) {
        return {
          ok: false,
          error: 'Execute o script supabase/schema.sql atualizado no SQL Editor para habilitar a gestão de cargos.',
        };
      }
      return { ok: false, error: error.message };
    }

    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Falha ao atribuir cargo ao usuário.',
      };
    }

    const rawUser = (payload.user || {}) as Record<string, unknown>;
    const assignedRole = normalizeTrustedRole(rawUser.role);
    const assignedCargoId =
      typeof rawUser.cargo_id === 'string' && rawUser.cargo_id ? rawUser.cargo_id : cleanCargoId;

    return {
      ok: true,
      user: {
        user_id: typeof rawUser.user_id === 'string' ? rawUser.user_id : '',
        email: typeof rawUser.email === 'string' ? rawUser.email : trimmedEmail,
        role: assignedRole,
        cargo_id: assignedCargoId,
        cargo_name: typeof rawUser.cargo_name === 'string' ? rawUser.cargo_name : null,
        cargo_color: rawUser.cargo_color ? normalizeCargoColor(rawUser.cargo_color) : defaultColorForRole(assignedRole),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao salvar cargo operacional.',
    };
  }
}

export async function removeOperationalUserRole(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<{ ok: boolean; error?: string }> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return { ok: false, error: 'Supabase não configurado neste ambiente.' };
  }
  if (!userId) {
    return { ok: false, error: 'Identificador de usuário inválido.' };
  }
  try {
    const { data, error } = await client.rpc('remove_movare_user_role', {
      p_user_id: userId,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    const payload = (data || {}) as Record<string, unknown>;
    if (payload.status !== 'ok') {
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : 'Não foi possível remover o acesso.',
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao remover acesso operacional.',
    };
  }
}

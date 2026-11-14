import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  ROLE_METADATA,
  assignOperationalUserRole,
  deleteCargo,
  listCargos,
  listOperationalUsers,
  removeOperationalUserRole,
  saveCargo,
  updateMemberProfile,
  type CargoColor,
  type MovareCargo,
  type OperationalUserRecord,
  type UpdateProfileInput,
  type UserPermissions,
  type UserProfileData,
  type UserRole,
} from '../../lib/auth';
import type { RealtimeConnectionStatus } from '../../lib/map-service';
import type { CloudSyncStatus } from '../../hooks/use-shared-map';
import { RESERVATION_CLOUD_INFO_MSG } from '../permissions/permission-guard';
import type { AccessPanelTab } from './profile-menu';

type AdminPanelDialogProps = {
  isOpen: boolean;
  initialTab?: AccessPanelTab;
  onClose: () => void;
  isDark: boolean;
  isConfigured: boolean;
  configError: string | null;
  user: User | null;
  profile?: UserProfileData | null;
  role: UserRole;
  cargoId?: string | null;
  cargoName?: string | null;
  cargoColor?: CargoColor | null;
  permissions?: UserPermissions;
  isAdmin: boolean;
  canManageRoles?: boolean;
  isAuthenticated?: boolean;
  connectionStatus: RealtimeConnectionStatus;
  syncStatus: CloudSyncStatus;
  syncError: string | null;
  mapVersion: number | null;
  lastUpdatedAt: string | null;
  lastUpdatedByEmail: string | null;
  hasUnsavedChanges: boolean;
  onOpenLogin: () => void;
  onLogout: () => Promise<unknown>;
  onRefreshAccess?: () => Promise<unknown>;
  onUpdateProfile?: (input: UpdateProfileInput) => Promise<{ ok: boolean; error?: string }>;
  onChangePassword?: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onForceSyncNow: () => Promise<unknown>;
  onReloadFromCloud: () => Promise<void>;
  onExportBackup: () => void;
  onOpenWarehouseManager?: () => void;
  onOpenResizeDialog?: () => void;
  onOpenScaleDialog?: () => void;
};

const CARGO_COLOR_OPTIONS: {
  id: CargoColor;
  label: string;
  dotClass: string;
  textClass: string;
  badgeClass: string;
}[] = [
  {
    id: 'emerald',
    label: 'Esmeralda',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  },
  {
    id: 'amber',
    label: 'Âmbar',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  },
  {
    id: 'sky',
    label: 'Azul Céu',
    dotClass: 'bg-sky-400',
    textClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  },
  {
    id: 'orange',
    label: 'Laranja',
    dotClass: 'bg-orange-400',
    textClass: 'text-orange-400',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  },
  {
    id: 'violet',
    label: 'Violeta',
    dotClass: 'bg-violet-400',
    textClass: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  },
  {
    id: 'rose',
    label: 'Rosa',
    dotClass: 'bg-rose-400',
    textClass: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
  },
  {
    id: 'slate',
    label: 'Neutro',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-300',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  },
];

function resolveColorOption(color?: CargoColor | null, fallbackRole?: UserRole) {
  const resolvedColor =
    color ||
    (fallbackRole === 'admin'
      ? 'emerald'
      : fallbackRole === 'assistencia'
      ? 'amber'
      : fallbackRole === 'conferente'
      ? 'sky'
      : 'slate');
  return CARGO_COLOR_OPTIONS.find((c) => c.id === resolvedColor) ?? CARGO_COLOR_OPTIONS[6];
}

export function getCargoBadgeClass(color?: CargoColor | null, fallbackRole?: UserRole): string {
  return resolveColorOption(color, fallbackRole).badgeClass;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Ainda não registrado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getInitials(name?: string | null, email?: string | null): string {
  const clean = (name || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
  return ((email || 'US').split('@')[0] || 'US').slice(0, 2).toUpperCase();
}

function buildRoleSqlSnippet(email: string, cargoId: string): string {
  const safeEmail = (email.trim() || 'usuario@suaempresa.com.br').replace(/'/g, "''");
  const safeCargo = (cargoId.trim() || 'assistencia').replace(/'/g, "''");
  return [
    `INSERT INTO public.admin_users (user_id, email, role, cargo_id)`,
    `SELECT u.id, u.email, mr.base_profile, mr.id`,
    `FROM auth.users u`,
    `JOIN public.movare_roles mr ON mr.id = '${safeCargo}'`,
    `WHERE lower(u.email) = lower('${safeEmail}')`,
    `ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, cargo_id = EXCLUDED.cargo_id, email = EXCLUDED.email;`,
  ].join('\n');
}

const DEFAULT_CARGO_FALLBACK: MovareCargo[] = [
  {
    id: 'admin',
    name: 'Administrador',
    description: ROLE_METADATA.admin.description,
    color: 'emerald',
    base_profile: 'admin',
    can_edit_map: true,
    can_reserve_positions: true,
    can_use_conferente_panel: false,
    can_manage_roles: true,
    is_system: true,
  },
  {
    id: 'assistencia',
    name: 'Assistência Técnica',
    description: ROLE_METADATA.assistencia.description,
    color: 'amber',
    base_profile: 'assistencia',
    can_edit_map: false,
    can_reserve_positions: true,
    can_use_conferente_panel: false,
    can_manage_roles: false,
    is_system: true,
  },
  {
    id: 'conferente',
    name: 'Conferente',
    description: ROLE_METADATA.conferente.description,
    color: 'sky',
    base_profile: 'conferente',
    can_edit_map: false,
    can_reserve_positions: false,
    can_use_conferente_panel: true,
    can_manage_roles: false,
    is_system: true,
  },
];

export function AdminPanelDialog({
  isOpen,
  initialTab = 'overview',
  onClose,
  isDark,
  isConfigured,
  configError,
  user,
  profile = null,
  role,
  cargoId = null,
  cargoName = null,
  cargoColor = null,
  permissions,
  isAdmin,
  canManageRoles,
  isAuthenticated = Boolean(user),
  connectionStatus,
  syncStatus,
  syncError,
  mapVersion,
  lastUpdatedAt,
  lastUpdatedByEmail,
  hasUnsavedChanges,
  onOpenLogin,
  onLogout,
  onRefreshAccess,
  onUpdateProfile,
  onChangePassword,
  onForceSyncNow,
  onReloadFromCloud,
  onExportBackup,
  onOpenWarehouseManager,
  onOpenResizeDialog,
  onOpenScaleDialog,
}: AdminPanelDialogProps) {
  const canManage = Boolean(canManageRoles ?? isAdmin);

  const [activeTab, setActiveTab] = useState<AccessPanelTab>(initialTab);
  const [cargos, setCargos] = useState<MovareCargo[]>(DEFAULT_CARGO_FALLBACK);
  const [teamUsers, setTeamUsers] = useState<OperationalUserRecord[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamNotice, setTeamNotice] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetCargoId, setTargetCargoId] = useState<string>('assistencia');
  const [copiedSql, setCopiedSql] = useState(false);
  const [refreshingAccess, setRefreshingAccess] = useState(false);

  // Busca & filtro na aba Membros
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'assigned' | 'pending'>('all');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberEditName, setMemberEditName] = useState('');
  const [memberEditPhone, setMemberEditPhone] = useState('');
  const [memberEditDepartment, setMemberEditDepartment] = useState('');
  const [memberEditBusy, setMemberEditBusy] = useState(false);

  // Estado do Meu Perfil
  const [myName, setMyName] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [myDepartment, setMyDepartment] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Estado do formulário de criação / edição de cargo
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [cargoFormName, setCargoFormName] = useState('');
  const [cargoFormDescription, setCargoFormDescription] = useState('');
  const [cargoFormColor, setCargoFormColor] = useState<CargoColor>('orange');
  const [permEditMap, setPermEditMap] = useState(false);
  const [permReserve, setPermReserve] = useState(false);
  const [permConferente, setPermConferente] = useState(false);
  const [permManageRoles, setPermManageRoles] = useState(false);
  const [roleFormBusy, setRoleFormBusy] = useState(false);

  const loadCargosAndTeam = useCallback(async () => {
    if (!canManage || !isConfigured) return;
    setTeamLoading(true);
    setTeamError(null);
    const [cargosRes, usersRes] = await Promise.all([listCargos(), listOperationalUsers()]);

    if (cargosRes.ok && cargosRes.cargos.length > 0) {
      setCargos(cargosRes.cargos);
      setTargetCargoId((prev) =>
        cargosRes.cargos.some((c) => c.id === prev) ? prev : cargosRes.cargos[0].id
      );
    } else if (cargosRes.error) {
      setTeamError(cargosRes.error);
    }

    if (usersRes.ok) {
      setTeamUsers(usersRes.users);
    } else if (usersRes.error) {
      setTeamError((prev) => prev || usersRes.error || null);
    }
    setTeamLoading(false);
  }, [canManage, isConfigured]);

  useEffect(() => {
    if (!isOpen) {
      setTeamError(null);
      setTeamNotice(null);
      setProfileError(null);
      setProfileNotice(null);
      setCopiedSql(false);
      setEditingMemberId(null);
      setPasswordSectionOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      return;
    }

    const validTab: AccessPanelTab =
      initialTab === 'profile' && !isAuthenticated
        ? 'overview'
        : (initialTab === 'team' || initialTab === 'roles') && (!canManage || !isConfigured)
        ? 'overview'
        : initialTab;

    setActiveTab(validTab);
  }, [canManage, initialTab, isAuthenticated, isConfigured, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMyName(profile?.fullName || '');
    setMyPhone(profile?.phone || '');
    setMyDepartment(profile?.department || '');
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    if ((activeTab === 'team' || activeTab === 'roles') && canManage && isConfigured) {
      void loadCargosAndTeam();
    }
  }, [activeTab, canManage, isConfigured, isOpen, loadCargosAndTeam]);

  const pendingCommonUsersCount = useMemo(
    () => teamUsers.filter((u) => !u.cargo_id).length,
    [teamUsers]
  );

  const assignedUsersCount = useMemo(
    () => teamUsers.filter((u) => Boolean(u.cargo_id)).length,
    [teamUsers]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return teamUsers.filter((m) => {
      if (memberFilter === 'assigned' && !m.cargo_id) return false;
      if (memberFilter === 'pending' && m.cargo_id) return false;
      if (!q) return true;
      return (
        m.email.toLowerCase().includes(q) ||
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.cargo_name || '').toLowerCase().includes(q)
      );
    });
  }, [memberFilter, memberSearch, teamUsers]);

  if (!isOpen) return null;

  const roleMeta = ROLE_METADATA[role];
  const isCommonWaitingCargo = isAuthenticated && role === 'visitor' && !cargoId;
  const displayRoleTitle = isCommonWaitingCargo
    ? 'Usuário Comum · Aguardando Cargo'
    : cargoName || roleMeta.label;

  const displayRoleDescription = isCommonWaitingCargo
    ? 'Sua conta está autenticada como Usuário Comum (somente visualização). Assim que um Administrador atribuir um cargo para o seu e-mail, suas permissões serão liberadas automaticamente.'
    : roleMeta.description;

  const colorMeta = resolveColorOption(cargoColor, role);
  const roleIconBoxClass =
    role === 'admin'
      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
      : role === 'assistencia'
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : 'bg-sky-500/15 border-sky-500/30 text-sky-400';

  const RoleIcon =
    role === 'admin'
      ? ShieldCheck
      : role === 'assistencia'
      ? BookmarkCheck
      : role === 'conferente'
      ? ClipboardCheck
      : isCommonWaitingCargo
      ? UserCheck
      : Eye;

  const connLabel =
    connectionStatus === 'connected'
      ? 'Conectado em Tempo Real'
      : connectionStatus === 'connecting'
      ? 'Conectando...'
      : connectionStatus === 'unconfigured'
      ? 'Nuvem Não Configurada'
      : 'Desconectado';

  const syncLabel =
    syncStatus === 'saved'
      ? 'Sincronizado com Nuvem'
      : syncStatus === 'pending'
      ? 'Alterações locais aguardando envio'
      : syncStatus === 'syncing'
      ? 'Enviando alterações para a nuvem...'
      : syncStatus === 'loading'
      ? 'Carregando mapa central...'
      : syncStatus === 'conflict'
      ? 'Versão mais nova disponível na nuvem'
      : syncStatus === 'error'
      ? 'Erro na Sincronização'
      : syncStatus === 'unconfigured'
      ? 'Modo Local Auxiliar (Sem Supabase)'
      : 'Pronto';

  const resetCargoForm = () => {
    setEditingCargoId(null);
    setCargoFormName('');
    setCargoFormDescription('');
    setCargoFormColor('orange');
    setPermEditMap(false);
    setPermReserve(false);
    setPermConferente(false);
    setPermManageRoles(false);
  };

  const handleStartEditCargo = (cargo: MovareCargo) => {
    setTeamError(null);
    setTeamNotice(null);
    setEditingCargoId(cargo.id);
    setCargoFormName(cargo.name);
    setCargoFormDescription(cargo.description);
    setCargoFormColor(cargo.color);
    setPermEditMap(cargo.can_edit_map);
    setPermReserve(cargo.can_reserve_positions);
    setPermConferente(cargo.can_use_conferente_panel);
    setPermManageRoles(cargo.can_manage_roles);
  };

  const handleSaveCargo = async (e: FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setTeamNotice(null);
    setRoleFormBusy(true);
    try {
      const res = await saveCargo({
        id: editingCargoId ?? undefined,
        name: cargoFormName,
        description: cargoFormDescription,
        color: cargoFormColor,
        canEditMap: permEditMap,
        canReservePositions: permReserve,
        canUseConferentePanel: permConferente,
        canManageRoles: permManageRoles,
      });
      if (!res.ok) {
        setTeamError(res.error || 'Falha ao salvar cargo.');
        return;
      }
      setTeamNotice(
        editingCargoId
          ? `Cargo "${res.cargo?.name || cargoFormName}" atualizado e permissões aplicadas aos usuários vinculados.`
          : `Cargo "${res.cargo?.name || cargoFormName}" criado com sucesso.`
      );
      resetCargoForm();
      await loadCargosAndTeam();
      await onRefreshAccess?.();
    } finally {
      setRoleFormBusy(false);
    }
  };

  const handleDeleteCargo = async (cargo: MovareCargo) => {
    setTeamError(null);
    setTeamNotice(null);
    setRoleFormBusy(true);
    try {
      const res = await deleteCargo(cargo.id);
      if (!res.ok) {
        setTeamError(res.error || 'Não foi possível excluir o cargo.');
        return;
      }
      if (editingCargoId === cargo.id) {
        resetCargoForm();
      }
      setTeamNotice(`Cargo "${cargo.name}" excluído.`);
      await loadCargosAndTeam();
    } finally {
      setRoleFormBusy(false);
    }
  };

  const handleAssignRole = async (e: FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setTeamNotice(null);
    setTeamSaving(true);
    try {
      const res = await assignOperationalUserRole(targetEmail, targetCargoId);
      if (!res.ok) {
        setTeamError(res.error || 'Falha ao configurar cargo.');
        return;
      }
      const cargoObj = cargos.find((c) => c.id === targetCargoId);
      const nextName = res.user?.cargo_name || cargoObj?.name || targetCargoId;
      setTeamNotice(
        `Cargo "${nextName}" atribuído para ${res.user?.email || targetEmail}. Permissões liberadas automaticamente.`
      );
      setTargetEmail('');
      await loadCargosAndTeam();
    } finally {
      setTeamSaving(false);
    }
  };

  const handleInlineAssignUserCargo = async (member: OperationalUserRecord, nextCargoId: string) => {
    if (!nextCargoId) {
      await handleRemoveUserRole(member);
      return;
    }
    setTeamError(null);
    setTeamNotice(null);
    setTeamSaving(true);
    try {
      const res = await assignOperationalUserRole(member.email, nextCargoId);
      if (!res.ok) {
        setTeamError(res.error || 'Não foi possível atualizar o cargo do usuário.');
        return;
      }
      const cargoObj = cargos.find((c) => c.id === nextCargoId);
      setTeamNotice(
        `Cargo "${res.user?.cargo_name || cargoObj?.name || nextCargoId}" aplicado para ${member.email}.`
      );
      await loadCargosAndTeam();
      if (member.user_id === user?.id) {
        await onRefreshAccess?.();
      }
    } finally {
      setTeamSaving(false);
    }
  };

  const handleRemoveUserRole = async (member: OperationalUserRecord) => {
    setTeamError(null);
    setTeamNotice(null);
    setTeamSaving(true);
    try {
      const res = await removeOperationalUserRole(member.user_id);
      if (!res.ok) {
        setTeamError(res.error || 'Não foi possível remover o cargo.');
        return;
      }
      setTeamNotice(`Cargo de ${member.email} removido. O usuário retornou para Usuário Comum.`);
      await loadCargosAndTeam();
    } finally {
      setTeamSaving(false);
    }
  };

  const handleStartEditMember = (member: OperationalUserRecord) => {
    setTeamError(null);
    setTeamNotice(null);
    if (editingMemberId === member.user_id) {
      setEditingMemberId(null);
      return;
    }
    setEditingMemberId(member.user_id);
    setMemberEditName(member.full_name || '');
    setMemberEditPhone(member.phone || '');
    setMemberEditDepartment(member.department || '');
  };

  const handleSaveMemberProfile = async (e: FormEvent, member: OperationalUserRecord) => {
    e.preventDefault();
    setTeamError(null);
    setTeamNotice(null);
    setMemberEditBusy(true);
    try {
      const res = await updateMemberProfile(member.user_id, {
        fullName: memberEditName,
        phone: memberEditPhone,
        department: memberEditDepartment,
      });
      if (!res.ok) {
        setTeamError(res.error || 'Falha ao salvar dados cadastrais do membro.');
        return;
      }
      setEditingMemberId(null);
      setTeamNotice(`Dados de ${member.email} atualizados.`);
      await loadCargosAndTeam();
      if (member.user_id === user?.id) {
        await onRefreshAccess?.();
      }
    } finally {
      setMemberEditBusy(false);
    }
  };

  const handleSaveMyProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setProfileError(null);
    setProfileNotice(null);
    setProfileSaving(true);
    try {
      const res = await onUpdateProfile({
        fullName: myName,
        phone: myPhone,
        department: myDepartment,
      });
      if (!res.ok) {
        setProfileError(res.error || 'Não foi possível salvar seu perfil.');
        return;
      }
      setProfileNotice('Perfil atualizado com sucesso.');
      await onRefreshAccess?.();
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!onChangePassword) return;
    setProfileError(null);
    setProfileNotice(null);

    if (newPassword.length < 6) {
      setProfileError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError('A confirmação de senha não confere.');
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await onChangePassword(newPassword);
      if (!res.ok) {
        setProfileError(res.error || 'Não foi possível atualizar a senha.');
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSectionOpen(false);
      setProfileNotice('Senha atualizada com sucesso.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleCopySql = async () => {
    const snippet = buildRoleSqlSnippet(targetEmail, targetCargoId);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 2200);
    } catch {
      setTeamError('Não foi possível copiar automaticamente. Consulte SUPABASE_SETUP.md.');
    }
  };

  const handleRefreshMyAccess = async () => {
    if (!onRefreshAccess) return;
    setRefreshingAccess(true);
    try {
      await onRefreshAccess();
    } finally {
      setRefreshingAccess(false);
    }
  };

  const tabs: { id: AccessPanelTab; label: string; icon: typeof Cloud; count?: number }[] = [
    ...(isAuthenticated ? [{ id: 'profile' as const, label: 'Meu Perfil', icon: UserCog }] : []),
    { id: 'overview' as const, label: 'Nuvem & Geral', icon: Cloud },
    ...(canManage && isConfigured
      ? [
          {
            id: 'team' as const,
            label: 'Membros',
            icon: Users,
            count: pendingCommonUsersCount > 0 ? pendingCommonUsersCount : undefined,
          },
          { id: 'roles' as const, label: 'Cargos', icon: Tags },
        ]
      : []),
  ];

  const surfaceBoxClass = isDark
    ? 'bg-slate-950/70 border-slate-800'
    : 'bg-slate-50 border-slate-200';

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-orange-500 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
      >
        {/* Cabeçalho do Modal */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${roleIconBoxClass}`}>
              <RoleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-tight truncate">
                {activeTab === 'profile'
                  ? 'Meu Perfil & Permissões'
                  : activeTab === 'team'
                  ? 'Gerenciamento de Membros'
                  : activeTab === 'roles'
                  ? 'Cargos & Matriz de Permissões'
                  : 'Central de Acesso & Nuvem'}
              </h3>
              <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Movare WMS · {displayRoleTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Abas */}
        {tabs.length > 1 && (
          <div
            className={`grid gap-1 px-5 py-2 border-b text-xs shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'
            }`}
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-600 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`font-mono text-[10px] font-bold tabular-nums ${
                        isSelected ? 'text-amber-200' : 'text-amber-400'
                      }`}
                    >
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Corpo com Rolagem */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' && isAuthenticated && user ? (
            <div className="p-5 space-y-4 text-xs">
              {/* Resumo de Identidade */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${surfaceBoxClass}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0 ${roleIconBoxClass}`}>
                    {getInitials(myName || profile?.fullName, user.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {myName.trim() || profile?.fullName || user.email}
                    </div>
                    <div className={`text-[11px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {user.email}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] flex-wrap">
                      <span className={`font-semibold ${colorMeta.textClass}`}>{displayRoleTitle}</span>
                      <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
                      <span className={`font-mono tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Desde {formatTimestamp(profile?.createdAt || user.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {onRefreshAccess && (
                  <button
                    type="button"
                    disabled={refreshingAccess}
                    onClick={() => void handleRefreshMyAccess()}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingAccess ? 'animate-spin' : ''}`} />
                    <span>Sincronizar Cargo</span>
                  </button>
                )}
              </div>

              {profileError && (
                <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileNotice && (
                <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{profileNotice}</span>
                </div>
              )}

              {/* Formulário de Dados Cadastrais */}
              <form onSubmit={handleSaveMyProfile} className={`p-4 rounded-xl border space-y-3 ${surfaceBoxClass}`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  Dados Pessoais & Operacionais
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      disabled={profileSaving}
                      placeholder="Seu nome completo"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Setor / Departamento
                    </label>
                    <input
                      type="text"
                      value={myDepartment}
                      onChange={(e) => setMyDepartment(e.target.value)}
                      disabled={profileSaving}
                      placeholder="Ex: Expedição, Recebimento, TI"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Telefone / Ramal
                    </label>
                    <input
                      type="text"
                      value={myPhone}
                      onChange={(e) => setMyPhone(e.target.value)}
                      disabled={profileSaving}
                      placeholder="(00) 00000-0000 ou Ramal"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={profileSaving || !isConfigured || !onUpdateProfile}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar Dados do Perfil</span>
                  </button>
                </div>
              </form>

              {/* Matriz de Permissões Efetivas */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${surfaceBoxClass}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                    Permissões Liberadas neste Cargo
                  </span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {displayRoleTitle}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      label: 'Editar Mapa & Galpões',
                      allowed: Boolean(permissions?.canEditMap),
                    },
                    {
                      label: 'Reservar Posições (Nuvem)',
                      allowed: Boolean(permissions?.canReservePositions),
                    },
                    {
                      label: 'Painel de Conferência',
                      allowed: Boolean(permissions?.canUseConferentePanel),
                    },
                    {
                      label: 'Gerenciar Membros & Cargos',
                      allowed: Boolean(permissions?.canManageRoles),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className={item.allowed ? 'font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                        {item.label}
                      </span>
                      {item.allowed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Minus className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Segurança: Alterar Senha */}
              {isConfigured && onChangePassword && (
                <div className={`p-4 rounded-xl border space-y-3 ${surfaceBoxClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-orange-400" />
                      <div>
                        <div className="font-bold text-xs">Segurança da Conta</div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Altere sua senha de acesso quando desejar
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPasswordSectionOpen((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        isDark
                          ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                          : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {passwordSectionOpen ? 'Fechar' : 'Alterar Senha'}
                    </button>
                  </div>

                  {passwordSectionOpen && (
                    <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordBusy}
                        placeholder="Nova senha (mín. 6 caracteres)"
                        className={inputClass}
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={passwordBusy}
                        placeholder="Confirmar nova senha"
                        className={inputClass}
                      />
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={passwordBusy}
                          className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center gap-1.5"
                        >
                          {passwordBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Atualizar Senha</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'team' && canManage && isConfigured ? (
            <div className="p-5 space-y-4 text-xs">
              {/* Faixa de Resumo KPI */}
              <div
                className={`grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x rounded-xl border ${
                  isDark
                    ? 'border-slate-800 bg-slate-950/70 divide-slate-800'
                    : 'border-slate-200 bg-slate-50 divide-slate-200'
                }`}
              >
                <div className="p-2.5">
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Membros
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums mt-0.5">{teamUsers.length}</div>
                </div>
                <div className="p-2.5">
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Com Cargo
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
                    {assignedUsersCount}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Aguardando
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-amber-400 mt-0.5">
                    {pendingCommonUsersCount}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Cargos
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-orange-400 mt-0.5">
                    {cargos.length}
                  </div>
                </div>
              </div>

              {/* Atribuição Rápida por E-mail */}
              <form onSubmit={handleAssignRole} className={`p-3.5 rounded-xl border space-y-2.5 ${surfaceBoxClass}`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  Vincular Cargo por E-mail
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    disabled={teamSaving}
                    placeholder="colaborador@empresa.com.br"
                    className={inputClass}
                  />
                  <select
                    value={targetCargoId}
                    onChange={(e) => setTargetCargoId(e.target.value)}
                    disabled={teamSaving}
                    className={inputClass}
                  >
                    {cargos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={teamSaving || !targetEmail.trim()}
                    className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {teamSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Atribuir Cargo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopySql()}
                    title="Copiar SQL equivalente para executar manualmente no Supabase SQL Editor"
                    className={`px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                    }`}
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copiado' : 'SQL'}</span>
                  </button>
                </div>
              </form>

              {teamError && (
                <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{teamError}</span>
                </div>
              )}

              {teamNotice && (
                <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{teamNotice}</span>
                </div>
              )}

              {/* Busca & Filtros da Equipe */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Filtrar por nome, e-mail, setor ou cargo..."
                      className={`${inputClass} pl-8`}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`inline-flex p-0.5 rounded-xl border ${
                        isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100'
                      }`}
                    >
                      {(
                        [
                          { id: 'all', label: 'Todos' },
                          { id: 'assigned', label: 'Com Cargo' },
                          { id: 'pending', label: 'Aguardando' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setMemberFilter(opt.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                            memberFilter === opt.id
                              ? 'bg-orange-600 text-white'
                              : isDark
                              ? 'text-slate-400 hover:text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => void loadCargosAndTeam()}
                      disabled={teamLoading}
                      className={`p-2 rounded-xl border cursor-pointer ${
                        isDark
                          ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="Atualizar lista de membros"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${teamLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {teamLoading && teamUsers.length === 0 ? (
                  <div className={`py-6 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Carregando membros cadastrados...
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className={`p-4 rounded-xl border text-center text-[11px] ${surfaceBoxClass} text-slate-400`}>
                    Nenhum membro encontrado para este filtro.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => {
                      const isSelf = member.user_id === user?.id;
                      const hasCargo = Boolean(member.cargo_id);
                      const isEditing = editingMemberId === member.user_id;
                      const memberColor = resolveColorOption(member.cargo_color, member.role);

                      return (
                        <div
                          key={member.user_id}
                          className={`p-3 rounded-xl border space-y-2.5 ${
                            !hasCargo
                              ? isDark
                                ? 'bg-sky-950/20 border-sky-500/35'
                                : 'bg-sky-50/70 border-sky-200'
                              : surfaceBoxClass
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                  hasCargo
                                    ? memberColor.badgeClass
                                    : isDark
                                    ? 'bg-slate-900 border-slate-700 text-slate-300'
                                    : 'bg-white border-slate-300 text-slate-700'
                                }`}
                              >
                                {getInitials(member.full_name, member.email)}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs truncate">
                                    {member.full_name || member.email}
                                  </span>
                                  {isSelf && (
                                    <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      (você)
                                    </span>
                                  )}
                                </div>

                                <div className={`font-mono text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {member.email}
                                </div>

                                <div className={`mt-1 flex items-center gap-1.5 flex-wrap text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  <span className={!hasCargo ? 'text-sky-400 font-semibold' : `${memberColor.textClass} font-semibold`}>
                                    {hasCargo ? member.cargo_name || ROLE_METADATA[member.role].label : 'Usuário Comum · Aguardando cargo'}
                                  </span>
                                  {member.department && (
                                    <>
                                      <span>·</span>
                                      <span>{member.department}</span>
                                    </>
                                  )}
                                  {member.phone && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono tabular-nums">{member.phone}</span>
                                    </>
                                  )}
                                  {member.last_sign_in_at && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono tabular-nums">
                                        Último login {formatTimestamp(member.last_sign_in_at)}
                                      </span>
                                    </>
                                  )}
                                  {member.email_confirmed === false && (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-400 font-medium">E-mail pendente</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditMember(member)}
                                title="Editar nome, setor ou ramal do membro"
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  isEditing
                                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
                                    : isDark
                                    ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {!isSelf && (
                                <>
                                  <select
                                    aria-label={`Cargo de ${member.email}`}
                                    value={member.cargo_id || ''}
                                    disabled={teamSaving}
                                    onChange={(e) => void handleInlineAssignUserCargo(member, e.target.value)}
                                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold focus:outline-none focus:border-orange-500 cursor-pointer ${
                                      isDark
                                        ? 'bg-slate-900 border-slate-700 text-slate-100'
                                        : 'bg-white border-slate-300 text-slate-800'
                                    }`}
                                  >
                                    <option value="">Sem cargo (Comum)</option>
                                    {cargos.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>

                                  {hasCargo && (
                                    <button
                                      type="button"
                                      disabled={teamSaving}
                                      onClick={() => void handleRemoveUserRole(member)}
                                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer disabled:opacity-40"
                                      title="Remover cargo e retornar para Usuário Comum"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <form
                              onSubmit={(e) => void handleSaveMemberProfile(e, member)}
                              className={`pt-2.5 border-t grid grid-cols-1 sm:grid-cols-3 gap-2 ${
                                isDark ? 'border-slate-800' : 'border-slate-200'
                              }`}
                            >
                              <input
                                type="text"
                                value={memberEditName}
                                onChange={(e) => setMemberEditName(e.target.value)}
                                disabled={memberEditBusy}
                                placeholder="Nome completo"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={memberEditDepartment}
                                onChange={(e) => setMemberEditDepartment(e.target.value)}
                                disabled={memberEditBusy}
                                placeholder="Setor / Departamento"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={memberEditPhone}
                                onChange={(e) => setMemberEditPhone(e.target.value)}
                                disabled={memberEditBusy}
                                placeholder="Telefone / Ramal"
                                className={inputClass}
                              />
                              <div className="sm:col-span-3 flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                    isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  disabled={memberEditBusy}
                                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  {memberEditBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Salvar Membro</span>
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'roles' && canManage && isConfigured ? (
            <div className="p-5 space-y-4 text-xs">
              <form onSubmit={handleSaveCargo} className={`p-4 rounded-xl border space-y-3 ${surfaceBoxClass}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    {editingCargoId ? (
                      <>
                        <Pencil className="w-3.5 h-3.5 text-orange-400" />
                        <span>Editando Cargo</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-orange-400" />
                        <span>Novo Cargo & Permissões</span>
                      </>
                    )}
                  </span>
                  {editingCargoId && (
                    <button
                      type="button"
                      onClick={resetCargoForm}
                      className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Nome do Cargo
                    </label>
                    <input
                      type="text"
                      required
                      value={cargoFormName}
                      onChange={(e) => setCargoFormName(e.target.value)}
                      disabled={roleFormBusy}
                      placeholder="Ex: Supervisor de Estoque"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Cor do Cargo
                    </label>
                    <select
                      value={cargoFormColor}
                      onChange={(e) => setCargoFormColor(e.target.value as CargoColor)}
                      disabled={roleFormBusy}
                      className={inputClass}
                    >
                      {CARGO_COLOR_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={cargoFormDescription}
                    onChange={(e) => setCargoFormDescription(e.target.value)}
                    disabled={roleFormBusy}
                    placeholder="Descreva as responsabilidades deste cargo"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <span className={`block text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Permissões aplicadas automaticamente ao atribuir este cargo
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        permEditMap
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : isDark
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permEditMap}
                        disabled={roleFormBusy || editingCargoId === 'admin'}
                        onChange={(e) => setPermEditMap(e.target.checked)}
                        className="accent-orange-500"
                      />
                      <span className="text-[11px] font-medium">Editar Mapa & Galpões</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        permReserve
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : isDark
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permReserve}
                        disabled={roleFormBusy}
                        onChange={(e) => setPermReserve(e.target.checked)}
                        className="accent-orange-500"
                      />
                      <span className="text-[11px] font-medium">Reservar Posições (Nuvem)</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        permConferente
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                          : isDark
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permConferente}
                        disabled={roleFormBusy}
                        onChange={(e) => setPermConferente(e.target.checked)}
                        className="accent-orange-500"
                      />
                      <span className="text-[11px] font-medium">Painel de Conferência</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        permManageRoles
                          ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                          : isDark
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permManageRoles}
                        disabled={roleFormBusy || editingCargoId === 'admin'}
                        onChange={(e) => setPermManageRoles(e.target.checked)}
                        className="accent-orange-500"
                      />
                      <span className="text-[11px] font-medium">Gerenciar Membros & Cargos</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={roleFormBusy || !cargoFormName.trim()}
                  className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {roleFormBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingCargoId ? 'Salvar Alterações do Cargo' : 'Criar Cargo'}</span>
                </button>
              </form>

              {teamError && (
                <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{teamError}</span>
                </div>
              )}

              {teamNotice && (
                <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{teamNotice}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Cargos Disponíveis ({cargos.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadCargosAndTeam()}
                    disabled={teamLoading}
                    className={`p-1 rounded-lg cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    title="Atualizar cargos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${teamLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  {cargos.map((cargo) => {
                    const colorOpt = resolveColorOption(cargo.color, cargo.base_profile);
                    const memberCount =
                      typeof cargo.member_count === 'number'
                        ? cargo.member_count
                        : teamUsers.filter((u) => u.cargo_id === cargo.id).length;

                    const permList = [
                      cargo.can_edit_map ? 'Editar Mapa' : null,
                      cargo.can_reserve_positions ? 'Reservar Itens' : null,
                      cargo.can_use_conferente_panel ? 'Painel Conferente' : null,
                      cargo.can_manage_roles ? 'Gerenciar Membros & Cargos' : null,
                    ].filter(Boolean) as string[];

                    return (
                      <div key={cargo.id} className={`p-3.5 rounded-xl border space-y-1.5 ${surfaceBoxClass}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${colorOpt.dotClass}`} />
                              <span className={`font-bold text-xs ${colorOpt.textClass}`}>
                                {cargo.name}
                              </span>
                              {cargo.is_system && (
                                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  padrão
                                </span>
                              )}
                              <span className={`text-[10px] font-mono tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                · {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                              </span>
                            </div>

                            {cargo.description && (
                              <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {cargo.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditCargo(cargo)}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Editar permissões do cargo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {!cargo.is_system && (
                              <button
                                type="button"
                                disabled={roleFormBusy}
                                onClick={() => void handleDeleteCargo(cargo)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer disabled:opacity-40"
                                title="Excluir cargo personalizado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {permList.length > 0 ? permList.join(' · ') : 'Somente visualização do mapa'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4 text-xs">
              {/* Bloco de Identidade & Permissão */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${surfaceBoxClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={isDark ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                    Cargo / Perfil Atual
                  </span>
                  <span className={`font-bold text-xs ${colorMeta.textClass}`}>
                    {displayRoleTitle}
                  </span>
                </div>

                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {displayRoleDescription}
                </p>

                {isAuthenticated && permissions && (
                  <div className={`text-[11px] font-medium pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {[
                      permissions.canEditMap ? 'Editar Mapa' : null,
                      permissions.canReservePositions ? 'Reservar Posições' : null,
                      permissions.canUseConferentePanel ? 'Painel Conferente' : null,
                      permissions.canManageRoles ? 'Gerenciar Cargos' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Somente Visualização'}
                  </div>
                )}

                {user && (
                  <div
                    className={`flex items-center justify-between pt-2 border-t ${
                      isDark ? 'border-slate-800/70' : 'border-slate-200'
                    }`}
                  >
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Usuário conectado</span>
                    <span className="font-mono font-semibold truncate max-w-[240px]">
                      {user.email}
                    </span>
                  </div>
                )}
              </div>

              {isCommonWaitingCargo && isConfigured && (
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-start justify-between gap-2 leading-relaxed ${
                    isDark
                      ? 'border-sky-500/35 bg-sky-500/10 text-sky-200'
                      : 'border-sky-300 bg-sky-50 text-sky-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>
                      Aguardando um Administrador atribuir um cargo para <strong>{user?.email}</strong>.
                    </span>
                  </div>
                  {onRefreshAccess && (
                    <button
                      type="button"
                      disabled={refreshingAccess}
                      onClick={() => void handleRefreshMyAccess()}
                      className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-semibold shrink-0 cursor-pointer"
                    >
                      {refreshingAccess ? 'Verificando...' : 'Atualizar'}
                    </button>
                  )}
                </div>
              )}

              {role === 'assistencia' && isConfigured && (
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 leading-relaxed ${
                    isDark
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{RESERVATION_CLOUD_INFO_MSG}</span>
                </div>
              )}

              {/* Atalhos Rápidos de Configuração do Galpão (Admin) */}
              {isAdmin && (onOpenWarehouseManager || onOpenResizeDialog || onOpenScaleDialog) && (
                <div className={`p-3.5 rounded-xl border space-y-2 ${surfaceBoxClass}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                    Configurações Gerais do Galpão
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {onOpenWarehouseManager && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenWarehouseManager();
                        }}
                        className={`p-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Warehouse className="w-3.5 h-3.5 text-orange-400" />
                        <span>Galpões</span>
                      </button>
                    )}
                    {onOpenResizeDialog && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenResizeDialog();
                        }}
                        className={`p-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Dimensões</span>
                      </button>
                    )}
                    {onOpenScaleDialog && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenScaleDialog();
                        }}
                        className={`p-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Ruler className="w-3.5 h-3.5 text-amber-400" />
                        <span>Escala CAD</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bloco de Conexão e Versão */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${surfaceBoxClass}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {connectionStatus === 'connected' ? (
                      <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Realtime</span>
                  </span>
                  <span
                    className={`font-semibold ${
                      connectionStatus === 'connected'
                        ? 'text-emerald-400'
                        : connectionStatus === 'unconfigured'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {connLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                    <span>Estado</span>
                  </span>
                  <span className="font-medium">{syncLabel}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Versão do Mapa Central</span>
                  <span className="font-mono font-bold tabular-nums text-orange-400">
                    {mapVersion && mapVersion > 0 ? `v${mapVersion}` : 'Não inicializado'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Clock className="w-3 h-3" />
                    <span>Última atualização</span>
                  </span>
                  <span className={`font-mono text-[11px] tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {formatTimestamp(lastUpdatedAt)}
                  </span>
                </div>

                {lastUpdatedByEmail && (
                  <div className="flex items-center justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Responsável</span>
                    <span className={`font-mono text-[11px] truncate max-w-[240px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {lastUpdatedByEmail}
                    </span>
                  </div>
                )}
              </div>

              {!isConfigured && configError && (
                <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{configError}</span>
                </div>
              )}

              {syncError && (
                <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{syncError}</span>
                </div>
              )}

              {/* Ações */}
              <div className="space-y-2 pt-1">
                {isAdmin && isConfigured && (
                  <button
                    type="button"
                    onClick={() => void onForceSyncNow()}
                    className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {hasUnsavedChanges ? 'Salvar Alterações na Nuvem Agora' : 'Publicar Versão Atual na Nuvem'}
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => void onReloadFromCloud()}
                      className={`py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Recarregar Nuvem</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onExportBackup}
                    className={`py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    } ${!isConfigured ? 'col-span-2' : ''}`}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Backup JSON</span>
                  </button>
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onLogout().then(() => onClose());
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair e Voltar ao Modo Visitante</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLogin();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Entrar ou Criar Conta</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

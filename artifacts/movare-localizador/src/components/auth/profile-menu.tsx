import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookmarkCheck,
  Camera,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Eye,
  Layers,
  Loader2,
  LogOut,
  Maximize2,
  Moon,
  RefreshCw,
  Ruler,
  Search,
  Sun,
  Tags,
  UploadCloud,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  ROLE_METADATA,
  type CargoColor,
  type UserPermissions,
  type UserProfileData,
  type UserRole,
} from '../../lib/auth';
import type { RealtimeConnectionStatus } from '../../lib/map-service';
import type { CloudSyncStatus } from '../../hooks/use-shared-map';

export type AccessPanelTab = 'profile' | 'overview' | 'team' | 'roles';

type ProfileMenuProps = {
  isDark: boolean;
  userEmail: string;
  profile: UserProfileData | null;
  userRole: UserRole;
  cargoName: string | null;
  cargoColor: CargoColor | null;
  permissions: UserPermissions;
  isAdmin: boolean;
  canManageRoles: boolean;
  canReservePositions: boolean;
  canUseConferentePanel: boolean;
  isCommonUser: boolean;
  connectionStatus: RealtimeConnectionStatus;
  syncStatus: CloudSyncStatus;
  mapVersion: number | null;
  hasUnsavedChanges: boolean;
  bounds: { widthMeters: number; heightMeters: number };
  scaleRatio?: number;
  reservedCount?: number;
  conferentePanelOpen?: boolean;
  onOpenAccessPanelTab: (tab: AccessPanelTab) => void;
  onOpenWarehouseManager?: () => void;
  onOpenResizeDialog?: () => void;
  onOpenScaleDialog?: () => void;
  onOpenLayers: () => void;
  onOpenShortcuts?: () => void;
  onOpenPngExport?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: () => void;
  onSaveToCloud?: () => void;
  onOpenSearch?: () => void;
  onOpenReservedSearch?: () => void;
  onToggleConferentePanel?: () => void;
  onRefreshAccess?: () => Promise<unknown>;
  onToggleTheme: () => void;
  onLogout: () => Promise<unknown>;
};

function getUserInitials(fullName: string | null | undefined, email: string): string {
  const cleanName = (fullName || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const emailPrefix = email.split('@')[0] || 'US';
  return emailPrefix.slice(0, 2).toUpperCase();
}

function getAvatarAccentClasses(color: CargoColor | null, role: UserRole, isDark: boolean): string {
  const effective: CargoColor =
    color ||
    (role === 'admin'
      ? 'emerald'
      : role === 'assistencia'
      ? 'amber'
      : role === 'conferente'
      ? 'sky'
      : 'slate');

  switch (effective) {
    case 'emerald':
      return isDark
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
        : 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'amber':
      return isDark
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
        : 'bg-amber-100 text-amber-800 border-amber-300';
    case 'sky':
      return isDark
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/45'
        : 'bg-sky-100 text-sky-800 border-sky-300';
    case 'orange':
      return isDark
        ? 'bg-orange-500/20 text-orange-300 border-orange-500/45'
        : 'bg-orange-100 text-orange-800 border-orange-300';
    case 'violet':
      return isDark
        ? 'bg-violet-500/20 text-violet-300 border-violet-500/45'
        : 'bg-violet-100 text-violet-800 border-violet-300';
    case 'rose':
      return isDark
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/45'
        : 'bg-rose-100 text-rose-800 border-rose-300';
    default:
      return isDark
        ? 'bg-slate-800 text-slate-200 border-slate-600'
        : 'bg-slate-200 text-slate-800 border-slate-300';
  }
}

export function ProfileMenu({
  isDark,
  userEmail,
  profile,
  userRole,
  cargoName,
  cargoColor,
  permissions,
  isAdmin,
  canManageRoles,
  canReservePositions,
  canUseConferentePanel,
  isCommonUser,
  connectionStatus,
  syncStatus,
  mapVersion,
  hasUnsavedChanges,
  bounds,
  scaleRatio,
  reservedCount = 0,
  conferentePanelOpen = false,
  onOpenAccessPanelTab,
  onOpenWarehouseManager,
  onOpenResizeDialog,
  onOpenScaleDialog,
  onOpenLayers,
  onOpenShortcuts,
  onOpenPngExport,
  onExportBackup,
  onImportBackup,
  onSaveToCloud,
  onOpenSearch,
  onOpenReservedSearch,
  onToggleConferentePanel,
  onRefreshAccess,
  onToggleTheme,
  onLogout,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const roleMeta = ROLE_METADATA[userRole];
  const displayCargoTitle =
    cargoName || (isCommonUser ? 'Usuário Comum' : roleMeta.label);
  const shortCargoLabel =
    cargoName || (isCommonUser ? 'Comum' : roleMeta.shortLabel);
  const displayName = profile?.fullName?.trim() || userEmail.split('@')[0] || 'Usuário';
  const initials = getUserInitials(profile?.fullName, userEmail);
  const avatarClasses = getAvatarAccentClasses(cargoColor, userRole, isDark);

  const runAndClose = (fn?: () => void) => {
    setOpen(false);
    fn?.();
  };

  const handleRefreshCargo = async () => {
    if (!onRefreshAccess) return;
    setRefreshing(true);
    try {
      await onRefreshAccess();
    } finally {
      setRefreshing(false);
    }
  };

  const sectionLabelClass = `px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider ${
    isDark ? 'text-slate-500' : 'text-slate-500'
  }`;

  const menuItemClass = `w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
    isDark
      ? 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
  }`;

  const dividerClass = `my-1.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Botão Retrátil do Ícone de Perfil */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menu do perfil e configurações"
        className={`flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-xl border transition-all cursor-pointer ${
          open
            ? isDark
              ? 'bg-slate-800 border-orange-500/60 text-white'
              : 'bg-slate-100 border-orange-500 text-slate-950'
            : hasUnsavedChanges && isAdmin
            ? isDark
              ? 'bg-amber-500/10 border-amber-500/45 text-amber-200 hover:bg-amber-500/20'
              : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            : isDark
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800/80'
            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-2xs'
        }`}
        title={`${displayName} · ${displayCargoTitle}`}
      >
        <span
          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-bold tracking-tight shrink-0 ${avatarClasses}`}
        >
          {initials}
        </span>

        <div className="hidden sm:flex flex-col items-start leading-tight max-w-[125px] text-left">
          <span className="text-[11px] font-bold truncate max-w-full">{shortCargoLabel}</span>
          <span className={`text-[10px] truncate max-w-full ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {displayName}
          </span>
        </div>

        {(syncStatus === 'syncing' || (hasUnsavedChanges && isAdmin)) && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              syncStatus === 'syncing' ? 'bg-orange-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-orange-400' : isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        />
      </button>

      {/* Painel Retrátil / Menu Suspenso Contextual */}
      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-[calc(100%+8px)] w-[min(92vw,340px)] max-h-[82dvh] overflow-y-auto rounded-2xl border shadow-2xl z-50 p-2 ${
            isDark
              ? 'bg-slate-900/98 border-slate-700/90 text-slate-100 shadow-black/80'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
          }`}
        >
          {/* Cabeçalho de Identidade do Usuário */}
          <div
            className={`p-3 rounded-xl border mb-1.5 ${
              isDark ? 'bg-slate-950/75 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-bold shrink-0 ${avatarClasses}`}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{displayName}</div>
                <div className={`text-[11px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {userEmail}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
                  <span className={isAdmin ? 'text-emerald-400 font-semibold' : isDark ? 'text-slate-300' : 'text-slate-700'}>
                    {displayCargoTitle}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
                  <span className={`font-mono tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {connectionStatus === 'connected'
                      ? `Nuvem v${mapVersion ?? 1}`
                      : 'Local'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(() => onOpenAccessPanelTab('profile'))}
              className={`mt-2.5 w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <UserCog className="w-3.5 h-3.5 text-orange-400" />
              <span>Meu Perfil & Preferências da Conta</span>
            </button>
          </div>

          {/* Publicação Pendente (Admin com rascunho local) */}
          {isAdmin && hasUnsavedChanges && onSaveToCloud && (
            <button
              type="button"
              role="menuitem"
              disabled={syncStatus === 'syncing'}
              onClick={() => runAndClose(onSaveToCloud)}
              className="w-full mb-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>
                {syncStatus === 'syncing' ? 'Salvando na Nuvem...' : 'Salvar Alterações na Nuvem'}
              </span>
            </button>
          )}

          {/* SEÇÃO ADMIN / GESTOR DE CARGOS */}
          {(canManageRoles || isAdmin) && (
            <>
              <div className={sectionLabelClass}>Administração</div>
              <div className="space-y-0.5">
                {canManageRoles && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndClose(() => onOpenAccessPanelTab('team'))}
                      className={menuItemClass}
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Gerenciar Membros</span>
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Equipe</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndClose(() => onOpenAccessPanelTab('roles'))}
                      className={menuItemClass}
                    >
                      <span className="flex items-center gap-2">
                        <Tags className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Cargos & Permissões</span>
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Perfis</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(() => onOpenAccessPanelTab('overview'))}
                  className={menuItemClass}
                >
                  <span className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                      <Cloud className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>Central de Nuvem & Sincronização</span>
                  </span>
                </button>
              </div>
              <div className={dividerClass} />
            </>
          )}

          {/* SEÇÃO CONFIGURAÇÕES DO GALPÃO (ADMIN / CAN EDIT MAP) */}
          {permissions.canEditMap && (
            <>
              <div className={sectionLabelClass}>Configurações do Galpão</div>
              <div className="space-y-0.5">
                {onOpenWarehouseManager && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenWarehouseManager)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Warehouse className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Gerenciar Galpões e Barracões</span>
                    </span>
                  </button>
                )}

                {onOpenResizeDialog && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenResizeDialog)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Tamanho do Galpão</span>
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-slate-400">
                      {bounds.widthMeters}×{bounds.heightMeters}m
                    </span>
                  </button>
                )}

                {onOpenScaleDialog && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenScaleDialog)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Ruler className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Calibrar Escala CAD</span>
                    </span>
                    {scaleRatio && (
                      <span className="font-mono text-[10px] tabular-nums text-slate-400">
                        1m={scaleRatio}px
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(onOpenLayers)}
                  className={menuItemClass}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Camadas & Foco por Espaço</span>
                  </span>
                </button>

                {onOpenPngExport && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenPngExport)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Exportar Imagem PNG</span>
                    </span>
                  </button>
                )}

                {(onExportBackup || onImportBackup) && (
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    {onExportBackup && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndClose(onExportBackup)}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-200'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Exportar JSON</span>
                      </button>
                    )}
                    {onImportBackup && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndClose(onImportBackup)}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-200'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <ArrowUpFromLine className="w-3.5 h-3.5 text-sky-400" />
                        <span>Importar JSON</span>
                      </button>
                    )}
                  </div>
                )}

                {onOpenShortcuts && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenShortcuts)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <CircleHelp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Guia de Atalhos (?)</span>
                    </span>
                  </button>
                )}
              </div>
              <div className={dividerClass} />
            </>
          )}

          {/* SEÇÃO OPERACIONAL POR PERFIL (ASSISTÊNCIA / CONFERENTE / PERSONALIZADOS NÃO-ADMIN) */}
          {!permissions.canEditMap && (canReservePositions || canUseConferentePanel) && (
            <>
              <div className={sectionLabelClass}>Operação do Cargo</div>
              <div className="space-y-0.5">
                {canReservePositions && onOpenReservedSearch && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenReservedSearch)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Itens Reservados</span>
                    </span>
                    <span className="font-mono text-[11px] font-bold tabular-nums text-amber-400">
                      {reservedCount}
                    </span>
                  </button>
                )}

                {canUseConferentePanel && onToggleConferentePanel && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onToggleConferentePanel)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        {conferentePanelOpen ? 'Recolher Painel Conferente' : 'Abrir Painel Conferente'}
                      </span>
                    </span>
                  </button>
                )}

                {onOpenSearch && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenSearch)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Buscar Produto, Código ou SKU</span>
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(onOpenLayers)}
                  className={menuItemClass}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Camadas & Visibilidade</span>
                  </span>
                </button>

                {canReservePositions && onOpenPngExport && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenPngExport)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Exportar Imagem PNG</span>
                    </span>
                  </button>
                )}

                {!canManageRoles && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(() => onOpenAccessPanelTab('overview'))}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Central de Nuvem</span>
                    </span>
                  </button>
                )}
              </div>
              <div className={dividerClass} />
            </>
          )}

          {/* SEÇÃO USUÁRIO COMUM (SEM CARGO ATRIBUÍDO) */}
          {isCommonUser && (
            <>
              <div
                className={`p-2.5 rounded-xl border text-[11px] leading-relaxed mb-1.5 ${
                  isDark
                    ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Aguardando atribuição de cargo</span>
                </div>
                <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  Assim que um administrador vincular seu cargo, suas permissões aparecerão aqui.
                </p>
              </div>
              <div className="space-y-0.5">
                {onOpenSearch && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAndClose(onOpenSearch)}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Buscar no Mapa</span>
                    </span>
                  </button>
                )}
                {onRefreshAccess && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={refreshing}
                    onClick={() => void handleRefreshCargo()}
                    className={menuItemClass}
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-sky-400 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                      <span>{refreshing ? 'Verificando cargo...' : 'Atualizar Permissões'}</span>
                    </span>
                  </button>
                )}
              </div>
              <div className={dividerClass} />
            </>
          )}

          {/* RODAPÉ: TEMA E SAIR */}
          <div className="space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onToggleTheme)}
              className={menuItemClass}
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <span>{isDark ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                isDark
                  ? 'text-rose-400 hover:bg-rose-500/15'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

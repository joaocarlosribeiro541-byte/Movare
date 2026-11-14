import {
  MousePointer2, Move, RectangleHorizontal, Tag, Ruler,
  Magnet, ShieldCheck, CheckSquare, Search, Layers,
  ArrowDownToLine, ArrowUpFromLine, CircleHelp, Sun, Moon,
  Plus, ChevronDown, Maximize2, RotateCcw, Redo2,
  SlidersHorizontal, PanelRightOpen, PanelRightClose, Camera,
  Crosshair, Eye, LogIn, Cloud, CloudOff, AlertTriangle, Pencil,
  UploadCloud, Loader2, BookmarkCheck, ClipboardCheck
} from 'lucide-react';
import type { FloorArea } from '../editor-model';
import type { EditorTool } from './floating-action-dock';
import type { RealtimeConnectionStatus } from '../lib/map-service';
import type { CloudSyncStatus } from '../hooks/use-shared-map';
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  type CargoColor,
  type UserPermissions,
  type UserProfileData,
  type UserRole,
} from '../lib/auth';
import { ProfileMenu, type AccessPanelTab } from './auth/profile-menu';

type TopCommandBarProps = {
  areas: FloorArea[];
  activeAreaId: string;
  onSelectArea: (id: string) => void;
  onCreateNewArea: () => void;
  onOpenWarehouseManager?: () => void;
  bounds: { widthMeters: number; heightMeters: number };
  scaleRatio?: number;
  onOpenResizeDialog: () => void;
  onOpenScaleDialog?: () => void;
  tool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  physicsEnabled: boolean;
  onTogglePhysics: () => void;
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  precisionNavMode?: boolean;
  onTogglePrecisionNav?: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onOpenSpotlight: () => void;
  onOpenSearch?: () => void;
  onOpenReservedSearch?: () => void;
  reservedCount?: number;
  onToggleConferentePanel?: () => void;
  conferentePanelOpen?: boolean;
  onOpenLayers: () => void;
  onOpenShortcuts: () => void;
  onOpenPngExport: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  selectedElementCount: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
  userRole?: UserRole;
  cargoName?: string | null;
  cargoColor?: CargoColor | null;
  profile?: UserProfileData | null;
  permissions?: UserPermissions;
  canManageRoles?: boolean;
  canReserve?: boolean;
  canUseConferente?: boolean;
  isCommonUser?: boolean;
  isAdmin?: boolean;
  userEmail?: string | null;
  connectionStatus?: RealtimeConnectionStatus;
  syncStatus?: CloudSyncStatus;
  mapVersion?: number | null;
  hasUnsavedChanges?: boolean;
  onSaveToCloud?: () => void;
  onOpenAccessPanel?: (tab?: AccessPanelTab) => void;
  onRefreshAccess?: () => Promise<unknown>;
  onLogout?: () => Promise<unknown>;
  onOpenLogin?: () => void;
};

export function TopCommandBar({
  areas,
  activeAreaId,
  onSelectArea,
  onCreateNewArea,
  onOpenWarehouseManager,
  bounds,
  scaleRatio,
  onOpenResizeDialog,
  onOpenScaleDialog,
  tool,
  onSelectTool,
  snapEnabled,
  onToggleSnap,
  physicsEnabled,
  onTogglePhysics,
  multiSelectMode,
  onToggleMultiSelect,
  precisionNavMode = true,
  onTogglePrecisionNav,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onOpenSpotlight,
  onOpenSearch,
  onOpenReservedSearch,
  reservedCount = 0,
  onToggleConferentePanel,
  conferentePanelOpen = false,
  onOpenLayers,
  onOpenShortcuts,
  onOpenPngExport,
  onExportBackup,
  onImportBackup,
  isDark,
  onToggleTheme,
  selectedElementCount,
  sidebarOpen,
  onToggleSidebar,
  onOpenMobileMenu,
  userRole = 'visitor',
  cargoName = null,
  cargoColor = null,
  profile = null,
  permissions,
  canManageRoles,
  canReserve,
  canUseConferente,
  isCommonUser = false,
  isAdmin = false,
  userEmail = null,
  connectionStatus = 'unconfigured',
  syncStatus = 'idle',
  mapVersion = null,
  hasUnsavedChanges = false,
  onSaveToCloud,
  onOpenAccessPanel,
  onRefreshAccess,
  onLogout,
  onOpenLogin,
}: TopCommandBarProps) {
  const showConferenteBtn = Boolean(canUseConferente ?? userRole === 'conferente');
  const showReserveBtn = Boolean(canReserve ?? (isAdmin || userRole === 'assistencia'));
  const isVisitor = userRole === 'visitor' && !isAdmin && !showReserveBtn && !showConferenteBtn;
  const isConferente = showConferenteBtn;
  const isAssistencia = !isAdmin && showReserveBtn;
  const isAuthenticated = Boolean(userEmail);
  const resolvedPermissions: UserPermissions = permissions ?? {
    ...DEFAULT_PERMISSIONS_BY_ROLE[userRole],
    canEditMap: isAdmin,
    canReservePositions: showReserveBtn,
    canUseConferentePanel: showConferenteBtn,
    canManageRoles: Boolean(canManageRoles ?? isAdmin),
  };

  return (
    <header
      className={`h-12 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b z-30 select-none backdrop-blur-2xl transition-colors duration-200 ${
        isDark
          ? 'bg-slate-950/90 border-slate-800/80 text-slate-100 shadow-slate-950/40'
          : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-xs'
      }`}
    >
      {/* SEÇÃO 1: MARCA & SELETOR DE GALPÃO */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
        <div className="h-8 flex items-center shrink-0">
          <img
            src="/movare-logo.png"
            alt="MOVARE"
            className="h-7 w-auto object-contain drop-shadow-xs rounded"
          />
        </div>

        {/* Seletor Compacto do Galpão */}
        <div
          className={`flex items-center rounded-xl border px-2 py-0.5 min-w-0 transition-colors ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/90 border-slate-200'
          }`}
        >
          <select
            aria-label="Escolher galpão"
            className={`text-xs font-semibold bg-transparent border-0 pr-4 appearance-none cursor-pointer truncate max-w-[100px] sm:max-w-[150px] md:max-w-[180px] focus:outline-none ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
            value={activeAreaId}
            onChange={(e) => onSelectArea(e.target.value)}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id} className={isDark ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-900'}>
                {a.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 -ml-3.5 pointer-events-none shrink-0" />

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onCreateNewArea}
                title="Criar novo galpão / barracão"
                aria-label="Criar novo galpão"
                className="p-0.5 ml-1 text-slate-400 hover:text-orange-500 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {onOpenWarehouseManager && (
                <button
                  type="button"
                  onClick={onOpenWarehouseManager}
                  title="Gerenciar, editar ou excluir galpões e barracões"
                  aria-label="Gerenciar galpões"
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-orange-500 transition-colors shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Dimensões em Metros (apenas Admin / Assistência em desktop grande) */}
        {!isVisitor && (
          <button
            type="button"
            onClick={isAdmin ? onOpenResizeDialog : undefined}
            disabled={!isAdmin}
            className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[11px] font-mono transition-colors ${
              isAdmin ? 'cursor-pointer' : 'cursor-default opacity-80'
            } ${
              isDark
                ? 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-orange-500/50 hover:text-orange-400'
                : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:border-orange-500 hover:text-orange-600'
            }`}
            title={isAdmin ? 'Dimensões do Galpão (Clique para redimensionar)' : 'Dimensões atuais do galpão'}
          >
            <Maximize2 className="w-3 h-3 text-orange-500 shrink-0" />
            <span className="tabular-nums font-semibold">{bounds.widthMeters}×{bounds.heightMeters}m</span>
          </button>
        )}
      </div>

      {/* SEÇÃO 2: BARRA DE COMANDO POR PERFIL */}
      {isAdmin ? (
        <div className="hidden md:flex items-center gap-1">
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/80 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTool('select')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'select'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Selecionar (V)"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Selecionar</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('pan')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'pan'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Modo Visualização (H)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visualizar</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('move')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'move'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Mover (M)"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Mover</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('rectangle')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'rectangle'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Nova Zona (R)"
            >
              <RectangleHorizontal className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden xl:inline">Zona</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('corridor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'corridor'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Corredor / Rua (C)"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline">Rua</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('measure')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tool === 'measure'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Fita Métrica (T)"
            >
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Medir</span>
            </button>
          </div>

          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/80 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={onToggleSnap}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                snapEnabled
                  ? isDark
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={snapEnabled ? 'Magnetismo Snap Ativo' : 'Movimento Livre'}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[11px]">Snap</span>
            </button>

            <button
              type="button"
              onClick={onTogglePhysics}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                physicsEnabled
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={physicsEnabled ? 'Física Anti-Sobreposição Ativa' : 'Física Desativada'}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[11px]">Física</span>
            </button>

            <button
              type="button"
              onClick={onToggleMultiSelect}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                multiSelectMode
                  ? isDark
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'bg-sky-100 text-sky-700 border border-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={multiSelectMode ? 'Seleção Múltipla Ativa' : 'Seleção Individual'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[11px]">Multi</span>
            </button>

            {onTogglePrecisionNav && (
              <button
                type="button"
                onClick={onTogglePrecisionNav}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  precisionNavMode
                    ? isDark
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-amber-100 text-amber-700 border border-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={precisionNavMode ? 'Precisão CAD Ativa' : 'Inércia Ativa'}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline text-[11px]">Precisão</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2">
          {isConferente && onToggleConferentePanel && (
            <button
              type="button"
              onClick={onToggleConferentePanel}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                conferentePanelOpen
                  ? 'bg-sky-600 border-sky-500 text-white shadow-xs'
                  : isDark
                  ? 'bg-sky-500/15 border-sky-500/35 text-sky-300 hover:bg-sky-500/25'
                  : 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Localizar Produto</span>
            </button>
          )}

          {isAssistencia && onOpenReservedSearch && (
            <button
              type="button"
              onClick={onOpenReservedSearch}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
              title="Ver posições marcadas como RESERVADO"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Reservados ({reservedCount})</span>
            </button>
          )}
        </div>
      )}

      {/* SEÇÃO 3: BUSCA, CAMADAS, STATUS NUVEM & PERFIL */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Busca Rápida */}
        <button
          type="button"
          onClick={onOpenSpotlight}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs transition-all cursor-pointer group ${
            isDark
              ? 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-orange-500/50'
              : 'bg-slate-100/90 hover:bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-orange-500/50 shadow-2xs'
          }`}
          title="Buscar Espaço, Produto, SKU ou Código (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform shrink-0" />
          <span className="font-medium hidden sm:inline">Buscar</span>
          {!isVisitor && (
            <kbd
              className={`hidden md:inline font-mono text-[9px] px-1 py-0.2 rounded border shrink-0 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'
              }`}
            >
              Ctrl+K
            </kbd>
          )}
        </button>

        {/* Camadas (Admin / Assistência / Conferente) */}
        {!isVisitor && (
          <button
            type="button"
            onClick={onOpenLayers}
            className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
                : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Camadas & Visibilidade de Espaços"
          >
            <Layers className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="hidden lg:inline">Camadas</span>
          </button>
        )}

        {/* Exportar PNG (Admin e Assistência) */}
        {(isAdmin || isAssistencia) && (
          <button
            type="button"
            onClick={onOpenPngExport}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:text-white'
                : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-900'
            }`}
            title="Exportar Imagem PNG em Alta Resolução"
          >
            <Camera className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="hidden xl:inline">Exportar PNG</span>
          </button>
        )}

        {/* Histórico Undo/Redo (Admin apenas) */}
        {isAdmin && (
          <div
            className={`hidden md:flex items-center rounded-xl border p-0.5 ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-100/80'
            }`}
          >
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
              className={`p-1 rounded-lg transition-colors disabled:opacity-25 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className={`w-px h-3.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
              className={`p-1 rounded-lg transition-colors disabled:opacity-25 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Backup JSON (Admin apenas) */}
        {isAdmin && (
          <div
            className={`hidden lg:flex items-center rounded-xl border p-0.5 ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-100/80'
            }`}
          >
            <button
              type="button"
              onClick={onExportBackup}
              title="Exportar Backup JSON"
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <div className={`w-px h-3.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <button
              type="button"
              onClick={onImportBackup}
              title="Importar Backup JSON"
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Botão explícito de Salvar Alterações na Nuvem (Admin com edições pendentes) */}
        {isAdmin && onSaveToCloud && hasUnsavedChanges && (
          <button
            type="button"
            disabled={syncStatus === 'syncing'}
            onClick={onSaveToCloud}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-[11px] shadow-md shadow-amber-500/25 transition-all cursor-pointer shrink-0"
            title="Publicar alterações locais na nuvem (Ctrl+S)"
          >
            {syncStatus === 'syncing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {syncStatus === 'syncing' ? 'Salvando...' : 'Salvar na Nuvem'}
            </span>
            <span className="sm:hidden">Salvar</span>
          </button>
        )}

        {/* Ícone de Perfil Retrátil (Autenticado) OU Visitante (Entrar + Menu Mobile) */}
        {isAuthenticated && userEmail && onOpenAccessPanel && onLogout ? (
          <ProfileMenu
            isDark={isDark}
            userEmail={userEmail}
            profile={profile}
            userRole={userRole}
            cargoName={cargoName}
            cargoColor={cargoColor}
            permissions={resolvedPermissions}
            isAdmin={isAdmin}
            canManageRoles={Boolean(canManageRoles ?? resolvedPermissions.canManageRoles)}
            canReservePositions={showReserveBtn}
            canUseConferentePanel={showConferenteBtn}
            isCommonUser={isCommonUser}
            connectionStatus={connectionStatus}
            syncStatus={syncStatus}
            mapVersion={mapVersion}
            hasUnsavedChanges={hasUnsavedChanges}
            bounds={bounds}
            scaleRatio={scaleRatio}
            reservedCount={reservedCount}
            conferentePanelOpen={conferentePanelOpen}
            onOpenAccessPanelTab={(tab) => onOpenAccessPanel(tab)}
            onOpenWarehouseManager={onOpenWarehouseManager}
            onOpenResizeDialog={isAdmin ? onOpenResizeDialog : undefined}
            onOpenScaleDialog={isAdmin ? onOpenScaleDialog : undefined}
            onOpenLayers={onOpenLayers}
            onOpenShortcuts={isAdmin ? onOpenShortcuts : undefined}
            onOpenPngExport={isAdmin || isAssistencia ? onOpenPngExport : undefined}
            onExportBackup={isAdmin ? onExportBackup : undefined}
            onImportBackup={isAdmin ? onImportBackup : undefined}
            onSaveToCloud={isAdmin ? onSaveToCloud : undefined}
            onOpenSearch={onOpenSearch ?? onOpenSpotlight}
            onOpenReservedSearch={onOpenReservedSearch}
            onToggleConferentePanel={onToggleConferentePanel}
            onRefreshAccess={onRefreshAccess}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
          />
        ) : (
          <>
            {onOpenAccessPanel && (
              <button
                type="button"
                onClick={() => onOpenAccessPanel('overview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                  syncStatus === 'conflict' || syncStatus === 'error'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : isDark
                    ? 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
                title={`Visitante · Versão v${mapVersion ?? 0}`}
              >
                {syncStatus === 'conflict' || syncStatus === 'error' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : connectionStatus === 'connected' ? (
                  <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="hidden sm:inline max-w-[90px] truncate">Visitante</span>
              </button>
            )}

            {onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/50'
                    : 'bg-white border-slate-300 text-orange-600 hover:bg-orange-50'
                }`}
                title="Entrar ou criar conta de usuário"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </>
        )}

        {/* Atalhos (?) (Admin Desktop) */}
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenShortcuts}
            className={`hidden xl:flex p-1.5 rounded-xl border text-slate-400 hover:text-orange-500 transition-colors cursor-pointer ${
              isDark ? 'bg-slate-900/70 border-slate-800 hover:bg-slate-800' : 'bg-slate-100/80 border-slate-200 hover:bg-slate-200'
            }`}
            title="Guia de Atalhos (?)"
          >
            <CircleHelp className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Alternador de Tema */}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
            isDark
              ? 'bg-slate-900/70 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800'
              : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Alternar Tema Claro / Escuro"
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Botão do Inspetor (Admin) */}
        {isAdmin && selectedElementCount > 0 && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              sidebarOpen
                ? 'bg-orange-500 text-white shadow-xs'
                : isDark
                ? 'bg-slate-900 border-slate-800 text-orange-400 hover:text-white hover:bg-slate-800'
                : 'bg-slate-100 border-slate-200 text-orange-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={sidebarOpen ? 'Recolher Inspetor' : 'Abrir Inspetor'}
          >
            {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Inspetor</span>
          </button>
        )}

        {/* Menu Mobile (apenas para Visitante; logados usam o ícone de perfil retrátil) */}
        {!isAuthenticated && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className={`md:hidden p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'text-slate-300 bg-slate-800 hover:bg-slate-700' : 'text-slate-700 bg-slate-200 hover:bg-slate-300'
            }`}
            title="Menu"
          >
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          </button>
        )}
      </div>
    </header>
  );
}



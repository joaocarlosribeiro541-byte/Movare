import {
  MousePointer2, Move, RectangleHorizontal, Tag, Ruler,
  Magnet, ShieldCheck, CheckSquare, Search, Layers,
  ArrowDownToLine, ArrowUpFromLine, CircleHelp, Sun, Moon,
  Plus, ChevronDown, Maximize2, RotateCcw, Redo2,
  SlidersHorizontal, PanelRightOpen, PanelRightClose, Camera, Crosshair,
  Eye, LogIn, Cloud, CloudOff, AlertTriangle, Pencil,
  UploadCloud, Loader2
} from 'lucide-react';
import type { FloorArea } from '../editor-model';
import type { EditorTool } from './floating-action-dock';
import type { RealtimeConnectionStatus } from '../lib/map-service';
import type { CloudSyncStatus } from '../hooks/use-shared-map';

type TopCommandBarProps = {
  areas: FloorArea[];
  activeAreaId: string;
  onSelectArea: (id: string) => void;
  onCreateNewArea: () => void;
  onOpenWarehouseManager?: () => void;
  bounds: { widthMeters: number; heightMeters: number };
  onOpenResizeDialog: () => void;
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
  isAdmin?: boolean;
  userEmail?: string | null;
  connectionStatus?: RealtimeConnectionStatus;
  syncStatus?: CloudSyncStatus;
  mapVersion?: number | null;
  hasUnsavedChanges?: boolean;
  onSaveToCloud?: () => void;
  onOpenAccessPanel?: () => void;
  onOpenLogin?: () => void;
};

export function TopCommandBar({
  areas,
  activeAreaId,
  onSelectArea,
  onCreateNewArea,
  onOpenWarehouseManager,
  bounds,
  onOpenResizeDialog,
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
  isAdmin = false,
  userEmail = null,
  connectionStatus = 'unconfigured',
  syncStatus = 'idle',
  mapVersion = null,
  hasUnsavedChanges = false,
  onSaveToCloud,
  onOpenAccessPanel,
  onOpenLogin,
}: TopCommandBarProps) {
  return (
    <header
      className={`h-12 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b z-30 select-none backdrop-blur-2xl transition-colors duration-200 ${
        isDark
          ? 'bg-slate-950/85 border-slate-800/80 text-slate-100 shadow-slate-950/40'
          : 'bg-white/90 border-slate-200/90 text-slate-800 shadow-xs'
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
            className={`text-xs font-semibold bg-transparent border-0 pr-4 appearance-none cursor-pointer truncate max-w-[90px] sm:max-w-[140px] md:max-w-[170px] focus:outline-none ${
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

        {/* Dimensões em Metros */}
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
      </div>

      {/* SEÇÃO 2: BARRA DE COMANDO CAD CENTRALIZADA (4.0) */}
      <div className="hidden md:flex items-center gap-1">
        {/* Cluster de Modos CAD */}
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
            title="Modo Visualização (H) — Consultar mapa e resumo dos itens sem editar"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizar</span>
          </button>

          {isAdmin && (
            <>
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
            </>
          )}

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

        {/* Toggles de Precisão: Magnetismo CAD & Física (edição apenas para Admin) */}
        <div
          className={`flex items-center p-0.5 rounded-xl border ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/80 border-slate-200'
          }`}
        >
          {isAdmin && (
            <>
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
            </>
          )}

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
              title={precisionNavMode ? 'Precisão CAD Ativa (Trava no ponto exato sem inércia)' : 'Inércia Ativa (Deslize livre)'}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[11px]">Precisão</span>
            </button>
          )}
        </div>
      </div>

      {/* SEÇÃO 3: SPOTLIGHT, GAVETAS, STATUS NUVEM & AÇÕES DE SISTEMA */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Gatilho do Spotlight (Busca rápida Ctrl+K) */}
        <button
          type="button"
          onClick={onOpenSpotlight}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs transition-all cursor-pointer group ${
            isDark
              ? 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-orange-500/50'
              : 'bg-slate-100/90 hover:bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-orange-500/50 shadow-2xs'
          }`}
          title="Buscar Espaço, Produto, SKU ou Comandos (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform shrink-0" />
          <span className="font-medium hidden sm:inline truncate max-w-[100px] lg:max-w-none">Buscar</span>
          <kbd
            className={`hidden md:inline font-mono text-[9px] px-1 py-0.2 rounded border shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'
            }`}
          >
            Ctrl+K
          </kbd>
        </button>

        {/* Camadas */}
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

        {/* Exportar Imagem PNG em Alta Resolução */}
        <button
          type="button"
          onClick={onOpenPngExport}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            isDark
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:text-white'
              : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-900'
          }`}
          title="Exportar Imagem PNG em Alta Resolução (Planta / Documentação)"
        >
          <Camera className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="hidden sm:inline">Exportar PNG</span>
        </button>

        {/* Histórico Desfazer / Refazer (somente Admin) */}
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

        {/* Backup JSON */}
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
          {isAdmin && (
            <>
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
            </>
          )}
        </div>

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

        {/* Status de Acesso & Sincronização Nuvem */}
        {onOpenAccessPanel && (
          <button
            type="button"
            onClick={onOpenAccessPanel}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
              syncStatus === 'conflict' || syncStatus === 'error'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : hasUnsavedChanges && isAdmin
                ? isDark
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : isAdmin
                ? isDark
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                : isDark
                ? 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title={
              isAdmin
                ? hasUnsavedChanges
                  ? 'Alterações locais aguardando envio para a nuvem'
                  : `Administrador conectado (${userEmail || 'admin'}) · Versão v${mapVersion ?? 0}`
                : 'Modo Visitante (somente leitura) · Clique para detalhes de sincronização ou login'
            }
          >
            {syncStatus === 'conflict' || syncStatus === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : connectionStatus === 'connected' ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isAdmin ? 'Admin' : 'Visitante'}
            </span>
            {syncStatus === 'syncing' ? (
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
            ) : hasUnsavedChanges && isAdmin ? (
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            ) : null}
          </button>
        )}

        {!userEmail && onOpenLogin && (
          <button
            type="button"
            onClick={onOpenLogin}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/50'
                : 'bg-white border-slate-300 text-orange-600 hover:bg-orange-50'
            }`}
            title="Entrar como Administrador"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar</span>
          </button>
        )}

        {/* Atalhos (?) */}
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

        {/* Botão da Gaveta de Propriedades (quando há elemento selecionado) */}
        {selectedElementCount > 0 && (
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
            title={sidebarOpen ? 'Recolher Gaveta de Propriedades' : 'Abrir Gaveta de Propriedades'}
          >
            {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Inspetor</span>
          </button>
        )}

        {/* Menu Mobile */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          title="Ferramentas e Menu"
        >
          <SlidersHorizontal className="w-4 h-4 text-orange-400" />
        </button>
      </div>
    </header>
  );
}


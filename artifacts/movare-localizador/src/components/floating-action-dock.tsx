import { useState } from 'react';
import {
  MousePointer2, Move, Eye, RectangleHorizontal, Tag, Ruler,
  Magnet, ShieldCheck, CheckSquare, RotateCcw, Redo2,
  ChevronDown, ChevronUp, SlidersHorizontal, Sparkles
} from 'lucide-react';

export type EditorTool = 'select' | 'move' | 'rectangle' | 'divider' | 'corridor' | 'measure' | 'pan';

type FloatingActionDockProps = {
  tool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  physicsEnabled: boolean;
  onTogglePhysics: () => void;
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  isDark: boolean;
  onOpenSpotlight: () => void;
  isAdmin?: boolean;
};

export function FloatingActionDock({
  tool,
  onSelectTool,
  snapEnabled,
  onToggleSnap,
  physicsEnabled,
  onTogglePhysics,
  multiSelectMode,
  onToggleMultiSelect,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  isDark,
  isAdmin = false,
}: FloatingActionDockProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5 select-none transition-all duration-200">
      {/* BOTÃO DISCRETO PARA RECOLHER / EXPANDIR O DOCK */}
      <button
        type="button"
        onClick={() => setIsMinimized((prev) => !prev)}
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border backdrop-blur-md transition-all shadow-md flex items-center gap-1 ${
          isDark
            ? 'bg-slate-900/90 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            : 'bg-white/90 border-slate-300 text-slate-600 hover:text-slate-900 shadow-slate-300/40'
        }`}
        title={isMinimized ? 'Expandir Dock de Ferramentas' : 'Minimizar Dock para Visão Total'}
      >
        <span>{isMinimized ? 'Mostrar Dock' : 'Dock'}</span>
        {isMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* CÁPSULA PRINCIPAL DO DOCK FLUTUANTE */}
      {!isMinimized && (
        <div
          className={`flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-150 max-w-[96vw] overflow-x-auto scrollbar-none ${
            isDark
              ? 'bg-slate-950/85 border-slate-800/90 text-slate-200 shadow-slate-950/90'
              : 'bg-white/90 border-slate-200/90 text-slate-800 shadow-slate-500/20'
          }`}
        >
          {/* CLUSTER 1: FERRAMENTAS BÁSICAS */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => onSelectTool('select')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                tool === 'select'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Modo Seleção (V) — Clique para consultar"
            >
              <MousePointer2 className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Selecionar</span>
              <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">V</kbd>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onSelectTool('move')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  tool === 'move'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Modo Mover (M) — Arraste elementos"
              >
                <Move className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Mover</span>
                <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">M</kbd>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectTool('pan')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                tool === 'pan'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Navegar no Mapa (H) — Arraste a planta livremente"
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Navegar</span>
              <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">H</kbd>
            </button>
          </div>

          <div className={`w-px h-6 mx-0.5 shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* CLUSTER 2: DESENHO (ADMIN) E MEDIÇÃO (TODOS) */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTool('rectangle')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    tool === 'rectangle'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Desenhar Nova Zona (R)"
                >
                  <RectangleHorizontal className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Nova Zona</span>
                  <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">R</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTool('corridor')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    tool === 'corridor'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Identificador de Corredor (C)"
                >
                  <Tag className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Corredor</span>
                  <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">C</kbd>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onSelectTool('measure')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                tool === 'measure'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Fita Métrica CAD (T) — Medir distâncias reais em metros"
            >
              <Ruler className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Medir</span>
              <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">T</kbd>
            </button>
          </div>

          {isAdmin && (
            <>
              <div className={`w-px h-6 mx-0.5 shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

              {/* CLUSTER 3: ASSISTENTES CAD */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={onToggleSnap}
                  className={`p-1.5 sm:px-2 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
                    snapEnabled
                      ? isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-orange-100 text-orange-700 border border-orange-300'
                      : isDark ? 'text-slate-500 hover:bg-slate-800/60' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title={snapEnabled ? 'Magnetismo / Snap Ativado' : 'Magnetismo / Snap Desativado'}
                >
                  <Magnet className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">Snap</span>
                </button>

                <button
                  type="button"
                  onClick={onTogglePhysics}
                  className={`p-1.5 sm:px-2 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
                    physicsEnabled
                      ? isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : isDark ? 'text-slate-500 hover:bg-slate-800/60' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title={physicsEnabled ? 'Física Anti-Sobreposição Ativada' : 'Física Desativada'}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">Física</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMultiSelect}
                  className={`p-1.5 sm:px-2 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
                    multiSelectMode
                      ? isDark ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'bg-sky-100 text-sky-700 border border-sky-300'
                      : isDark ? 'text-slate-500 hover:bg-slate-800/60' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title={multiSelectMode ? 'Seleção Múltipla Ativa' : 'Ativar Seleção Múltipla'}
                >
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline text-[11px]">Multi</span>
                </button>
              </div>

              <div className={`w-px h-6 mx-0.5 shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

              {/* CLUSTER 4: HISTÓRICO UNDO / REDO */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-xl transition-all shrink-0 disabled:opacity-25 ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Desfazer (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-xl transition-all shrink-0 disabled:opacity-25 ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


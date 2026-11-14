import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box as BoxIcon,
  ChevronDown,
  ChevronUp,
  Copy,
  Lock,
  Move,
  PanelRightClose,
  RotateCw,
  Sliders,
  Tag,
  Target,
  Trash2,
  Unlock,
  Users,
  AlignLeft,
  AlignCenter,
  X,
  Grid,
  Sparkles,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  WMS_COLOR_PALETTE,
  type DrawingElement,
  type ProductSize,
} from '../editor-model';
import { alignGroupElements } from '../physics';
import { ReadOnlyNoticeBanner } from './permissions/permission-guard';
import { ZoneInternalPositionsManager } from './zone-positions-manager';
import type { UserRole } from '../lib/auth';

type InspectorTab = 'summary' | 'positions' | 'adjust';

type SelectionInspectorProps = {
  selected: DrawingElement;
  selectedIds: string[];
  selectedElements: DrawingElement[];
  allElements: DrawingElement[];
  scaleRatio: number;
  worldWidth: number;
  worldHeight: number;
  selectedPositionId: string | null;
  isolatedSpaceId: string | null;
  isDark: boolean;
  isAdmin: boolean;
  userRole?: UserRole;
  isMobile?: boolean;
  onReplaceItem: (updated: DrawingElement) => void;
  onPatchElements: (mapper: (elements: DrawingElement[]) => DrawingElement[], toastMsg?: string) => void;
  onSelectPosition: (posId: string | null) => void;
  onUpdateZoneVolumeType: (size: ProductSize, category?: string) => void;
  onToggleLock: () => void;
  onRotateBy: (deg: number) => void;
  onNudge: (dxMeters: number, dyMeters: number) => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  onOpenRackModal: () => void;
  onToggleIsolate: (el: DrawingElement) => void;
  onSelectGroup: (groupId: string) => void;
  onClearSelection: () => void;
  onEnterFreeMove: () => void;
  onCollapseDesktop?: () => void;
  onRequestLogin: () => void;
  onCreateGroupId: () => string;
};

const CORRIDOR_PRESETS = [
  'RUA A',
  'RUA B',
  'RUA C',
  'RUA D',
  'CORREDOR 01',
  'CORREDOR 02',
  'ENTRADA',
  'SAÍDA',
  'DOCA 01',
  'EXPEDIÇÃO',
  'PULMÃO',
];

const CORRIDOR_SYMBOLS = [
  { symbol: '➔', label: 'Frente' },
  { symbol: '⬅', label: 'Retorno' },
  { symbol: '⬆', label: 'Subida' },
  { symbol: '⬇', label: 'Descida' },
  { symbol: '↔', label: 'Duplo' },
  { symbol: '🔄', label: 'Giro' },
  { symbol: '🚷', label: 'Restrito' },
];

const CORRIDOR_TEXT_COLORS = [
  { value: '#ffffff', label: 'Branco' },
  { value: '#38bdf8', label: 'Azul' },
  { value: '#facc15', label: 'Amarelo' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#c084fc', label: 'Roxo' },
  { value: '#22d3ee', label: 'Ciano' },
];

export function SelectionInspector({
  selected,
  selectedIds,
  selectedElements,
  allElements,
  scaleRatio,
  worldWidth,
  worldHeight,
  selectedPositionId,
  isolatedSpaceId,
  isDark,
  isAdmin,
  userRole = 'visitor',
  isMobile = false,
  onReplaceItem,
  onPatchElements,
  onSelectPosition,
  onUpdateZoneVolumeType,
  onToggleLock,
  onRotateBy,
  onNudge,
  onDuplicate,
  onRequestDelete,
  onOpenRackModal,
  onToggleIsolate,
  onSelectGroup,
  onClearSelection,
  onEnterFreeMove,
  onCollapseDesktop,
  onRequestLogin,
  onCreateGroupId,
}: SelectionInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('summary');
  const [showCorridorShortcuts, setShowCorridorShortcuts] = useState(false);

  // Ao tocar diretamente numa célula no mapa, abre automaticamente a aba Posições
  useEffect(() => {
    if (selectedPositionId && selected.type === 'rectangle') {
      setActiveTab('positions');
    }
  }, [selectedPositionId, selected.type]);

  // Ao trocar para um tipo que não possui Posições (ex: corredor/divisória), volta para Resumo
  useEffect(() => {
    if (selected.type !== 'rectangle' && activeTab === 'positions') {
      setActiveTab('summary');
    }
  }, [selected.id, selected.type, activeTab]);

  const cardSurface = isDark
    ? 'bg-slate-950/65 border-slate-800/90'
    : 'bg-slate-50/90 border-slate-200';
  const inputSurface = isDark
    ? 'border-slate-700/90 bg-slate-950 text-slate-100 placeholder:text-slate-600'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400';
  const labelText = isDark ? 'text-slate-400' : 'text-slate-500';
  const subtleBtn = isDark
    ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/80'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300';

  const typeLabel =
    selected.type === 'rack'
      ? 'Porta-Paletes'
      : selected.type === 'rectangle'
      ? 'Zona WMS'
      : selected.type === 'corridor'
      ? 'Corredor'
      : 'Divisória';

  const widthMeters = (selected.width / scaleRatio).toFixed(1);
  const heightMeters = (selected.height / scaleRatio).toFixed(1);
  const posCount = selected.internalPositions?.length ?? 0;
  const occupiedCount =
    selected.internalPositions?.filter((p) => p.status === 'occupied').length ?? 0;

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="space-y-3">
        {/* BANNER SOMENTE LEITURA PARA PERFIS NÃO-ADMIN */}
        {!isAdmin && (
          <ReadOnlyNoticeBanner isDark={isDark} role={userRole} onRequestLogin={onRequestLogin} />
        )}

        {/* SELEÇÃO MÚLTIPLA & GRUPO (COMPACTO) */}
        {isAdmin && selectedIds.length > 1 && (
          <div
            className={`p-2.5 rounded-xl border space-y-2 ${
              isDark
                ? 'bg-blue-950/35 border-blue-500/40 text-blue-100'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>{selectedIds.length} selecionados</span>
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] font-semibold text-blue-400 hover:underline cursor-pointer"
              >
                Limpar
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { key: 'left', label: 'Esq', icon: <AlignLeft className="w-3 h-3" />, msg: 'Alinhados à esquerda' },
                  { key: 'top', label: 'Topo', icon: <AlignLeft className="w-3 h-3 rotate-90" />, msg: 'Alinhados ao topo' },
                  { key: 'distribute-h', label: 'Dist H', icon: <AlignCenter className="w-3 h-3" />, msg: 'Distribuídos na horizontal' },
                  { key: 'distribute-v', label: 'Dist V', icon: <AlignCenter className="w-3 h-3 rotate-90" />, msg: 'Distribuídos na vertical' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => {
                    const aligned = alignGroupElements(selectedElements, btn.key, worldWidth, worldHeight);
                    onPatchElements(
                      (els) => els.map((el) => aligned.find((it) => it.id === el.id) || el),
                      btn.msg
                    );
                  }}
                  className={`py-1 px-1 rounded-md border text-[10px] font-semibold flex items-center justify-center gap-0.5 cursor-pointer ${subtleBtn}`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const newGroupId = onCreateGroupId();
                  onPatchElements(
                    (els) =>
                      els.map((el) =>
                        selectedIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
                      ),
                    `Grupo criado (${selectedIds.length} itens)`
                  );
                }}
                className="flex-1 py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Users className="w-3 h-3" />
                <span>Agrupar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onPatchElements(
                    (els) =>
                      els.map((el) =>
                        selectedIds.includes(el.id) ? { ...el, groupId: undefined } : el
                      ),
                    'Itens desagrupados'
                  );
                }}
                className={`flex-1 py-1 px-2 rounded-lg border text-[11px] font-semibold cursor-pointer ${subtleBtn}`}
              >
                Desagrupar
              </button>
            </div>
          </div>
        )}

        {/* CABEÇALHO COMPACTO (APENAS DESKTOP, POIS MOBILE JÁ TEM BARRA DE ARRASTO) */}
        {!isMobile && (
          <div
            className={`flex items-center justify-between pb-2.5 border-b gap-2 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20"
                style={{ backgroundColor: selected.color || '#f97316' }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${labelText}`}>
                    {typeLabel}
                  </span>
                  <span className={`text-[10px] font-mono ${labelText}`}>
                    · {widthMeters}×{heightMeters}m
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={onEnterFreeMove}
                    className="px-2 py-1 rounded-lg text-[11px] text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                    title="Minimizar para mover livremente no mapa"
                  >
                    <Move className="w-3 h-3" />
                    <span>Mover</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLock}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      selected.locked
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={selected.locked ? 'Desbloquear item' : 'Travar item'}
                  >
                    {selected.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
              {onCollapseDesktop && (
                <button
                  type="button"
                  onClick={onCollapseDesktop}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Recolher painel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClearSelection}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Fechar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* AVISO COMPACTO DE BLOQUEIO */}
        {selected.locked && (
          <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              <span>Item travado</span>
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={onToggleLock}
                className="font-bold underline hover:text-amber-200 cursor-pointer"
              >
                Destravar
              </button>
            )}
          </div>
        )}

        {/* ABAS DINÂMICAS CONTEXTUAIS (ADMIN) */}
        {isAdmin && selected.type !== 'divider' && (
          <div
            className={`grid gap-1 p-1 rounded-xl border ${
              selected.type === 'rectangle' ? 'grid-cols-3' : 'grid-cols-2'
            } ${isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-100 border-slate-200'}`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>{selected.type === 'corridor' ? 'Texto' : 'Dados'}</span>
            </button>

            {selected.type === 'rectangle' && (
              <button
                type="button"
                onClick={() => setActiveTab('positions')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'positions'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3 h-3" />
                <span>Posições</span>
                {posCount > 0 && (
                  <span
                    className={`px-1 rounded text-[9px] font-mono ${
                      activeTab === 'positions'
                        ? 'bg-white/20 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {posCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('adjust')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'adjust'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Ajustes</span>
            </button>
          </div>
        )}

        {/* VISÃO SIMPLIFICADA PARA VISITANTE (SEM INPUTS DESABILITADOS POLUÍDOS) */}
        {!isAdmin && (
          <div className="space-y-3">
            <div className={`p-3 rounded-xl border space-y-2 text-xs ${cardSurface}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{selected.name}</div>
                  {selected.skuCode && (
                    <div className="font-mono text-xs font-bold text-orange-400 mt-0.5">
                      Código: {selected.skuCode}
                    </div>
                  )}
                </div>
                {posCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    {occupiedCount}/{posCount}
                  </span>
                )}
              </div>

              {(selected.model || selected.supplier || typeof selected.volumesPerItem === 'number') && (
                <div
                  className={`grid grid-cols-2 gap-2 pt-2 border-t text-[11px] ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  {selected.model && (
                    <div>
                      <span className={`block text-[10px] ${labelText}`}>Modelo</span>
                      <span className="font-semibold">{selected.model}</span>
                    </div>
                  )}
                  {selected.supplier && (
                    <div>
                      <span className={`block text-[10px] ${labelText}`}>Fornecedor</span>
                      <span className="font-semibold">{selected.supplier}</span>
                    </div>
                  )}
                  {typeof selected.volumesPerItem === 'number' && (
                    <div>
                      <span className={`block text-[10px] ${labelText}`}>Vol. / Item</span>
                      <span className="font-mono font-bold">{selected.volumesPerItem}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selected.type === 'rectangle' && (
              <ZoneInternalPositionsManager
                element={selected}
                scaleRatio={scaleRatio}
                onUpdateElement={onReplaceItem}
                selectedPositionId={selectedPositionId}
                onSelectPosition={onSelectPosition}
                isDark={isDark}
                readOnly
                userRole={userRole}
              />
            )}
          </div>
        )}

        {/* CONTEÚDO DO ADMIN POR CONTEXTO */}
        {isAdmin && (
          <>
            {/* ======================================================= */}
            {/* ZONA WMS / PORTA-PALETES: ABA DADOS                     */}
            {/* ======================================================= */}
            {(selected.type === 'rectangle' || selected.type === 'rack') &&
              activeTab === 'summary' && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl border space-y-2.5 ${cardSurface}`}>
                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${labelText}`}>
                        Nome / Endereço
                      </label>
                      <input
                        type="text"
                        disabled={selected.locked}
                        value={selected.name}
                        onChange={(e) => onReplaceItem({ ...selected, name: e.target.value })}
                        className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-60 ${inputSurface}`}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className={`block text-[10px] mb-1 ${labelText}`}>
                          Código / SKU
                        </label>
                        <input
                          type="text"
                          disabled={selected.locked}
                          value={selected.skuCode || ''}
                          onChange={(e) =>
                            onReplaceItem({ ...selected, skuCode: e.target.value.toUpperCase() })
                          }
                          placeholder="Ex: PAL-1042"
                          className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border text-orange-400 disabled:opacity-60 ${inputSurface}`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${labelText}`}>
                          Vol. / Item
                        </label>
                        <input
                          type="number"
                          min="0"
                          disabled={selected.locked}
                          value={selected.volumesPerItem ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            onReplaceItem({
                              ...selected,
                              volumesPerItem:
                                raw === '' ? undefined : Math.max(0, parseInt(raw, 10) || 0),
                            });
                          }}
                          placeholder="1"
                          className={`w-full px-2 py-1.5 text-xs font-mono font-bold rounded-lg border disabled:opacity-60 ${inputSurface}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`block text-[10px] mb-1 ${labelText}`}>Modelo</label>
                        <input
                          type="text"
                          disabled={selected.locked}
                          value={selected.model || ''}
                          onChange={(e) => onReplaceItem({ ...selected, model: e.target.value })}
                          placeholder="Ex: BRM56"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border disabled:opacity-60 ${inputSurface}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] mb-1 ${labelText}`}>Fornecedor</label>
                        <input
                          type="text"
                          disabled={selected.locked}
                          value={selected.supplier || ''}
                          onChange={(e) => onReplaceItem({ ...selected, supplier: e.target.value })}
                          placeholder="Ex: Brastemp"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border disabled:opacity-60 ${inputSurface}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`block text-[10px] mb-1 ${labelText}`}>Porte</label>
                        <select
                          disabled={selected.locked}
                          value={selected.productSize || 'pallet'}
                          onChange={(e) =>
                            onUpdateZoneVolumeType(e.target.value as ProductSize, selected.category)
                          }
                          className={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-60 ${inputSurface}`}
                        >
                          {PRODUCT_SIZES.map((size) => (
                            <option key={size.id} value={size.id}>
                              {size.icon} {size.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${labelText}`}>Categoria</label>
                        <select
                          disabled={selected.locked}
                          value={selected.category || 'general'}
                          onChange={(e) =>
                            onUpdateZoneVolumeType(selected.productSize || 'pallet', e.target.value)
                          }
                          className={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-60 ${inputSurface}`}
                        >
                          {PRODUCT_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* COR SETORIAL COMPACTA EM 1 LINHA */}
                    <div className="pt-1">
                      <span className={`block text-[10px] mb-1.5 ${labelText}`}>Cor do Setor</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {WMS_COLOR_PALETTE.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => onReplaceItem({ ...selected, color: c.value })}
                            title={c.name}
                            style={{ backgroundColor: c.value }}
                            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                              (selected.color || '#f97316').toLowerCase() === c.value.toLowerCase()
                                ? `ring-2 ring-orange-400 ring-offset-2 ${isDark ? 'ring-offset-slate-900' : 'ring-offset-white'} scale-110`
                                : 'opacity-80 hover:opacity-100'
                            } disabled:opacity-40`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AÇÃO PRINCIPAL CONTEXTUAL */}
                  {selected.type === 'rack' ? (
                    <button
                      type="button"
                      onClick={onOpenRackModal}
                      className="w-full py-2 px-3 rounded-xl bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/40 text-orange-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <BoxIcon className="w-4 h-4" />
                      <span>Configurar Estrutura de Racks</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('positions')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${subtleBtn}`}
                      >
                        <Grid className="w-3.5 h-3.5 text-orange-400" />
                        <span>Posições ({posCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleIsolate(selected)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                          isolatedSpaceId === selected.id
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-orange-600/15 hover:bg-orange-600/25 border-orange-500/40 text-orange-400'
                        }`}
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>{isolatedSpaceId === selected.id ? 'Sair Foco' : 'Modo Foco'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* ======================================================= */}
            {/* ZONA WMS: ABA POSIÇÕES INTERNAS                         */}
            {/* ======================================================= */}
            {selected.type === 'rectangle' && activeTab === 'positions' && (
              <ZoneInternalPositionsManager
                element={selected}
                scaleRatio={scaleRatio}
                onUpdateElement={onReplaceItem}
                selectedPositionId={selectedPositionId}
                onSelectPosition={onSelectPosition}
                isDark={isDark}
                readOnly={false}
                userRole={userRole}
              />
            )}

            {/* ======================================================= */}
            {/* CORREDOR / RUA: ABA TEXTO & ESTILO (SEM CAMPOS DE ZONA) */}
            {/* ======================================================= */}
            {selected.type === 'corridor' && activeTab === 'summary' && (
              <div className={`p-3 rounded-xl border space-y-3 ${cardSurface}`}>
                <div>
                  <label className={`block text-[10px] font-semibold mb-1 ${labelText}`}>
                    Texto / Identificação da Rua
                  </label>
                  <input
                    type="text"
                    disabled={selected.locked}
                    value={selected.corridorText || selected.name}
                    onChange={(e) => {
                      const text = e.target.value.toUpperCase();
                      const fSize = selected.fontSize || 22;
                      onReplaceItem({
                        ...selected,
                        name: text,
                        corridorText: text,
                        width: Math.max(120, text.length * (fSize * 0.65) + 30),
                      });
                    }}
                    placeholder="Ex: RUA A, CORREDOR 01"
                    className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border text-sky-400 disabled:opacity-60 ${inputSurface}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className={labelText}>Fonte</span>
                      <span className="font-mono font-bold text-sky-400">
                        {selected.fontSize || 22}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="96"
                      disabled={selected.locked}
                      value={selected.fontSize || 22}
                      onChange={(e) => {
                        const size = parseInt(e.target.value, 10);
                        const currentText = selected.corridorText || selected.name || '';
                        onReplaceItem({
                          ...selected,
                          fontSize: size,
                          height: Math.max(30, size * 1.5),
                          width: Math.max(120, currentText.length * (size * 0.65) + 30),
                        });
                      }}
                      className="w-full accent-sky-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className={labelText}>Espaço</span>
                      <span className="font-mono font-bold text-sky-400">
                        {selected.letterSpacing ?? 4}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      disabled={selected.locked}
                      value={selected.letterSpacing ?? 4}
                      onChange={(e) =>
                        onReplaceItem({
                          ...selected,
                          letterSpacing: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      disabled={selected.locked}
                      onClick={() => onReplaceItem({ ...selected, rotation: deg })}
                      className={`py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                        (selected.rotation || 0) === deg
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : subtleBtn
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>

                <div>
                  <span className={`block text-[10px] mb-1.5 ${labelText}`}>Cor do Texto</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CORRIDOR_TEXT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        disabled={selected.locked}
                        onClick={() => onReplaceItem({ ...selected, color: c.value })}
                        title={c.label}
                        style={{ backgroundColor: c.value }}
                        className={`w-6 h-6 rounded-full border border-slate-600/40 transition-transform cursor-pointer ${
                          (selected.color || '#ffffff').toLowerCase() === c.value.toLowerCase()
                            ? `ring-2 ring-sky-400 ring-offset-2 ${isDark ? 'ring-offset-slate-900' : 'ring-offset-white'} scale-110`
                            : 'opacity-85 hover:opacity-100'
                        } disabled:opacity-40`}
                      />
                    ))}
                  </div>
                </div>

                {/* ATALHOS COLAPSÁVEIS (SEM POLUIR A TELA INICIAL) */}
                <div className={`pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setShowCorridorShortcuts((prev) => !prev)}
                    className={`w-full flex items-center justify-between text-[11px] font-semibold cursor-pointer ${
                      isDark ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Nomes Rápidos, Peso & Setas</span>
                    </span>
                    {showCorridorShortcuts ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showCorridorShortcuts && (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { value: 'normal', label: 'Normal' },
                          { value: 'bold', label: 'Negrito' },
                          { value: 'extrabold', label: 'Extra' },
                        ].map((w) => (
                          <button
                            key={w.value}
                            type="button"
                            disabled={selected.locked}
                            onClick={() =>
                              onReplaceItem({ ...selected, fontWeight: w.value as any })
                            }
                            className={`py-1 rounded-md text-[10px] font-bold border cursor-pointer ${
                              (selected.fontWeight || 'extrabold') === w.value
                                ? 'bg-sky-600 border-sky-500 text-white'
                                : subtleBtn
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {CORRIDOR_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => {
                              const fSize = selected.fontSize || 22;
                              onReplaceItem({
                                ...selected,
                                name: preset,
                                corridorText: preset,
                                width: Math.max(120, preset.length * (fSize * 0.65) + 30),
                              });
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${subtleBtn}`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                        {CORRIDOR_SYMBOLS.map((item) => (
                          <button
                            key={item.symbol}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => {
                              const current = selected.corridorText || selected.name || '';
                              if (current.includes(item.symbol)) return;
                              const updated = `${item.symbol} ${current}`;
                              const fSize = selected.fontSize || 22;
                              onReplaceItem({
                                ...selected,
                                name: updated,
                                corridorText: updated,
                                width: Math.max(120, updated.length * (fSize * 0.65) + 30),
                              });
                            }}
                            title={item.label}
                            className={`py-1 rounded-md border text-xs font-bold flex items-center justify-center gap-0.5 cursor-pointer ${subtleBtn}`}
                          >
                            <span>{item.symbol}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================= */}
            {/* DIVISÓRIA / PAREDE (VISÃO ÚNICA ENXUTA)                 */}
            {/* ======================================================= */}
            {selected.type === 'divider' && (
              <div className={`p-3 rounded-xl border space-y-3 ${cardSurface}`}>
                <div>
                  <label className={`block text-[10px] font-semibold mb-1 ${labelText}`}>
                    Nome da Divisória
                  </label>
                  <input
                    type="text"
                    disabled={selected.locked}
                    value={selected.name}
                    onChange={(e) => onReplaceItem({ ...selected, name: e.target.value })}
                    className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-60 ${inputSurface}`}
                  />
                </div>

                <div>
                  <span className={`block text-[10px] mb-1.5 ${labelText}`}>Cor da Linha</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {WMS_COLOR_PALETTE.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        disabled={selected.locked}
                        onClick={() => onReplaceItem({ ...selected, color: c.value })}
                        title={c.name}
                        style={{ backgroundColor: c.value }}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          (selected.color || '#f97316').toLowerCase() === c.value.toLowerCase()
                            ? `ring-2 ring-orange-400 ring-offset-2 ${isDark ? 'ring-offset-slate-900' : 'ring-offset-white'} scale-110`
                            : 'opacity-80 hover:opacity-100'
                        } disabled:opacity-40`}
                      />
                    ))}
                  </div>
                </div>

                <NudgeAndRotatePanel
                  selected={selected}
                  isDark={isDark}
                  subtleBtn={subtleBtn}
                  labelText={labelText}
                  onRotateBy={onRotateBy}
                  onNudge={onNudge}
                />
              </div>
            )}

            {/* ======================================================= */}
            {/* ABA AJUSTES (ROTAÇÃO, MICRO-MOVIMENTO E GRUPO)          */}
            {/* ======================================================= */}
            {selected.type !== 'divider' && activeTab === 'adjust' && (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border space-y-3 ${cardSurface}`}>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className={labelText}>Posição / Dimensões</span>
                    <span className="font-bold text-orange-400">
                      {Math.round(selected.x / scaleRatio)}m, {Math.round(selected.y / scaleRatio)}m ·{' '}
                      {widthMeters}×{heightMeters}m
                    </span>
                  </div>

                  <NudgeAndRotatePanel
                    selected={selected}
                    isDark={isDark}
                    subtleBtn={subtleBtn}
                    labelText={labelText}
                    onRotateBy={onRotateBy}
                    onNudge={onNudge}
                  />
                </div>

                {selected.groupId && (
                  <button
                    type="button"
                    onClick={() => onSelectGroup(selected.groupId!)}
                    className="w-full py-2 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      Selecionar Todo o Grupo (
                      {allElements.filter((e) => (e.groupId || e.id) === selected.groupId).length})
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* RODAPÉ ENXUTO DE AÇÕES RÁPIDAS (ADMIN) */}
      {isAdmin && (
        <div
          className={`pt-2.5 border-t flex items-center gap-2 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onDuplicate}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${subtleBtn}`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicar</span>
          </button>
          <button
            type="button"
            disabled={selected.locked}
            onClick={onRequestDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
            title="Excluir item selecionado"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir</span>
          </button>
        </div>
      )}
    </div>
  );
}

function NudgeAndRotatePanel({
  selected,
  isDark,
  subtleBtn,
  labelText,
  onRotateBy,
  onNudge,
}: {
  selected: DrawingElement;
  isDark: boolean;
  subtleBtn: string;
  labelText: string;
  onRotateBy: (deg: number) => void;
  onNudge: (dxMeters: number, dyMeters: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
          <span className={`flex items-center gap-1 ${labelText}`}>
            <RotateCw className="w-3 h-3 text-orange-400" />
            <span>Rotação</span>
          </span>
          <span className="font-mono text-orange-400 font-bold">{selected.rotation || 0}°</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onRotateBy(-90)}
            className={`py-1.5 px-2 rounded-lg border text-xs font-bold disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            ↺ -90°
          </button>
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onRotateBy(90)}
            className={`py-1.5 px-2 rounded-lg border text-xs font-bold disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            ↻ +90°
          </button>
        </div>
      </div>

      <div className={`pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <span className={`text-[10px] block mb-1.5 ${labelText}`}>Ajuste Fino (0,5m)</span>
        <div className="grid grid-cols-3 gap-1 max-w-[114px] mx-auto">
          <div />
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onNudge(0, -0.5)}
            className={`h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onNudge(-0.5, 0)}
            className={`h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className={`flex items-center justify-center text-[9px] font-mono font-bold ${labelText}`}>
            0.5m
          </div>
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onNudge(0.5, 0)}
            className={`h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            disabled={selected.locked}
            onClick={() => onNudge(0, 0.5)}
            className={`h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer ${subtleBtn}`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}

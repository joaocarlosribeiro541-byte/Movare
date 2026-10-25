import { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  RefreshCw,
  Box,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Sliders,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Tag,
  Hash,
  PackageCheck,
  PackageX,
  X,
  Pencil,
  Trash2,
  Copy,
  Info,
  Settings,
  Grid
} from 'lucide-react';
import { PRODUCT_SIZES, type DrawingElement, type ProductSize } from '../editor-model';
import {
  type InternalPosition,
  type ZoneInternalLayout,
  type InternalLayoutMethod,
  type PositionStockStatus,
  getCategoryProfile,
  calculateZoneInternalPositions,
  applyVolumePresetToZone,
} from '../zone-internal-positions';

type ZoneInternalPositionsManagerProps = {
  element: DrawingElement;
  scaleRatio: number;
  onUpdateElement: (updated: DrawingElement) => void;
  selectedPositionId: string | null;
  onSelectPosition: (posId: string | null) => void;
  isDark?: boolean;
};

export function getPositionDimensions(
  pos: Partial<InternalPosition> | null | undefined,
  scaleRatio: number
): { widthMeters: number; depthMeters: number; areaMeters: number } {
  const ratio = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;
  if (!pos) {
    return { widthMeters: 1, depthMeters: 1, areaMeters: 1 };
  }
  const w =
    typeof pos.widthMeters === 'number' && Number.isFinite(pos.widthMeters) && pos.widthMeters > 0
      ? pos.widthMeters
      : typeof pos.relWidth === 'number' && Number.isFinite(pos.relWidth) && pos.relWidth > 0
      ? pos.relWidth / ratio
      : typeof (pos as any)?.width === 'number' && Number.isFinite((pos as any).width) && (pos as any).width > 0
      ? (pos as any).width / ratio
      : 1;

  const d =
    typeof pos.depthMeters === 'number' && Number.isFinite(pos.depthMeters) && pos.depthMeters > 0
      ? pos.depthMeters
      : typeof pos.relHeight === 'number' && Number.isFinite(pos.relHeight) && pos.relHeight > 0
      ? pos.relHeight / ratio
      : typeof (pos as any)?.height === 'number' && Number.isFinite((pos as any).height) && (pos as any).height > 0
      ? (pos as any).height / ratio
      : 1;

  return {
    widthMeters: w,
    depthMeters: d,
    areaMeters: w * d,
  };
}

export function ZoneInternalPositionsManager({
  element,
  scaleRatio,
  onUpdateElement,
  selectedPositionId,
  onSelectPosition,
  isDark = true,
}: ZoneInternalPositionsManagerProps) {
  const profile = getCategoryProfile(element.category);
  const safeScaleRatio = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;

  // Layout ativo ou padrão da categoria
  const currentLayout: ZoneInternalLayout = element.internalLayout || {
    method: profile.defaultMethod,
    rowDepthMeters: profile.rowDepthMeters,
    unitWidthMeters: profile.unitWidthMeters,
    unitDepthMeters: profile.unitDepthMeters,
    clearanceMeters: profile.clearanceMeters,
    marginMeters: profile.marginMeters,
    codePrefix: profile.codePrefix,
    sameCodePerRow: profile.sameCodePerRow,
  };

  const rawPositions = element.internalPositions || [];

  // Posições normalizadas garantindo propriedades válidas sempre
  const positions: InternalPosition[] = useMemo(() => {
    return rawPositions.map((p, idx) => {
      const dims = getPositionDimensions(p, safeScaleRatio);
      return {
        ...p,
        id: p.id || `pos-${idx + 1}`,
        code: p.code || `P${String(idx + 1).padStart(4, '0')}`,
        status: p.status || 'empty',
        relX: Number.isFinite(p.relX) ? p.relX : 0,
        relY: Number.isFinite(p.relY) ? p.relY : 0,
        relWidth: Number.isFinite(p.relWidth) && p.relWidth > 0 ? p.relWidth : dims.widthMeters * safeScaleRatio,
        relHeight: Number.isFinite(p.relHeight) && p.relHeight > 0 ? p.relHeight : dims.depthMeters * safeScaleRatio,
        widthMeters:
          typeof p.widthMeters === 'number' && Number.isFinite(p.widthMeters) && p.widthMeters > 0
            ? p.widthMeters
            : Number(dims.widthMeters.toFixed(2)),
        depthMeters:
          typeof p.depthMeters === 'number' && Number.isFinite(p.depthMeters) && p.depthMeters > 0
            ? p.depthMeters
            : Number(dims.depthMeters.toFixed(2)),
      };
    });
  }, [rawPositions, safeScaleRatio]);

  // Posição atualmente selecionada para edição individual
  const activePositionIndex = positions.findIndex((p) => p.id === selectedPositionId);
  const activePosition: InternalPosition | null = activePositionIndex >= 0 ? positions[activePositionIndex] : null;

  // Estado das Duas Abas Principais:
  // 'zone' (1. Configurações da Zona) ou 'cell' (2. Célula / Fileira de Células)
  const [activeTab, setActiveTab] = useState<'zone' | 'cell'>('zone');

  // Alterna automaticamente para a Aba 2 (Célula / Fileira) quando uma célula é clicada no mapa
  useEffect(() => {
    if (selectedPositionId) {
      setActiveTab('cell');
    }
  }, [selectedPositionId]);

  // Células da mesma fileira que compartilham o mesmo código WMS (Códigos Iguais)
  const sameCodePositions = useMemo(() => {
    if (!activePosition) return [];
    return positions.filter((p) => p.code === activePosition.code);
  }, [positions, activePosition]);

  // Atualiza todas as células da mesma fileira (códigos iguais) de uma só vez
  const handleUpdateRowPositions = (targetCode: string, patch: Partial<InternalPosition>) => {
    const updated = positions.map((p) => {
      if (p.code !== targetCode) return p;
      return {
        ...p,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });

    onUpdateElement({
      ...element,
      internalPositions: updated,
    });
  };

  // Drafts para configurações da zona
  const [methodDraft, setMethodDraft] = useState<InternalLayoutMethod>(currentLayout.method);
  const [rowDepthDraft, setRowDepthDraft] = useState<number>(currentLayout.rowDepthMeters ?? profile.rowDepthMeters);
  const [unitWidthDraft, setUnitWidthDraft] = useState<number>(currentLayout.unitWidthMeters ?? profile.unitWidthMeters);
  const [unitDepthDraft, setUnitDepthDraft] = useState<number>(currentLayout.unitDepthMeters ?? profile.unitDepthMeters);
  const [clearanceDraft, setClearanceDraft] = useState<number>(currentLayout.clearanceMeters ?? profile.clearanceMeters);
  const [marginDraft, setMarginDraft] = useState<number>(currentLayout.marginMeters ?? profile.marginMeters);
  const [prefixDraft, setPrefixDraft] = useState<string>(currentLayout.codePrefix || profile.codePrefix);
  const [sameCodePerRowDraft, setSameCodePerRowDraft] = useState<boolean>(currentLayout.sameCodePerRow ?? profile.sameCodePerRow ?? true);
  const [customColsDraft, setCustomColsDraft] = useState<number>(currentLayout.columns || 4);
  const [customRowsDraft, setCustomRowsDraft] = useState<number>(currentLayout.rows || 3);

  // Aplicação instantânea de preset de porte com vínculo automático de divisões
  const handleApplyVolumePreset = (presetId: ProductSize) => {
    const updated = applyVolumePresetToZone(element, presetId, safeScaleRatio);
    onUpdateElement(updated);
    setMethodDraft(updated.internalLayout.method);
    setRowDepthDraft(updated.internalLayout.rowDepthMeters ?? 0.80);
    setUnitWidthDraft(updated.internalLayout.unitWidthMeters ?? 0.85);
    setUnitDepthDraft(updated.internalLayout.unitDepthMeters ?? 0.85);
    setClearanceDraft(updated.internalLayout.clearanceMeters ?? 0.05);
    setMarginDraft(updated.internalLayout.marginMeters ?? 0.05);
    setPrefixDraft(updated.internalLayout.codePrefix || 'GEL');
    setSameCodePerRowDraft(updated.internalLayout.sameCodePerRow ?? true);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PositionStockStatus>('all');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Estatísticas das posições
  const stats = useMemo(() => {
    let occupied = 0;
    let reserved = 0;
    let empty = 0;
    let totalItems = 0;

    for (const p of positions) {
      if (p.status === 'occupied') occupied++;
      else if (p.status === 'reserved') reserved++;
      else empty++;
      if (p.quantity) totalItems += p.quantity;
    }

    return {
      total: positions.length,
      occupied,
      reserved,
      empty,
      totalItems,
      occupancyRate: positions.length > 0 ? Math.round((occupied / positions.length) * 100) : 0,
    };
  }, [positions]);

  // Aplica cálculo de layout baseado nos rascunhos da zona
  const handleGenerateOrRecalculate = () => {
    const layout: ZoneInternalLayout = {
      method: methodDraft,
      rowDepthMeters: rowDepthDraft,
      unitWidthMeters: unitWidthDraft,
      unitDepthMeters: unitDepthDraft,
      clearanceMeters: clearanceDraft,
      marginMeters: marginDraft,
      codePrefix: prefixDraft || profile.codePrefix,
      sameCodePerRow: sameCodePerRowDraft,
      columns: methodDraft === 'custom' ? customColsDraft : undefined,
      rows: methodDraft === 'custom' ? customRowsDraft : undefined,
    };

    const newPositions = calculateZoneInternalPositions(
      {
        id: element.id,
        width: element.width,
        height: element.height,
        category: element.category,
      },
      safeScaleRatio,
      layout,
      element.internalPositions
    );

    if (newPositions.length === 0) {
      setWarningMessage('As dimensões da zona são pequenas demais para as medidas configuradas.');
      return;
    }

    setWarningMessage(null);
    onUpdateElement({
      ...element,
      internalLayout: layout,
      internalPositions: newPositions,
    });
  };

  // Atualização de uma posição interna específica
  const handleUpdatePosition = (posId: string, patch: Partial<InternalPosition>) => {
    const updated = positions.map((p) => {
      if (p.id !== posId) return p;
      return {
        ...p,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });

    onUpdateElement({
      ...element,
      internalPositions: updated,
    });
  };

  // Exclusão individual de uma posição específica
  const handleDeletePosition = (posId: string) => {
    const updated = positions.filter((p) => p.id !== posId);
    onUpdateElement({
      ...element,
      internalPositions: updated,
    });
    onSelectPosition(null);
  };

  // Limpar dados de estoque da posição
  const handleClearPosition = (posId: string) => {
    handleUpdatePosition(posId, {
      sku: '',
      description: '',
      quantity: 0,
      status: 'empty',
    });
  };

  // Copiar dados da zona-pai para a posição
  const handleCopyFromZone = (posId: string) => {
    handleUpdatePosition(posId, {
      sku: element.skuCode || '',
      description: element.notes || element.name,
      status: element.skuCode ? 'occupied' : 'empty',
      productSize: element.productSize,
      category: element.category,
    });
  };

  // Navegar para próxima/anterior posição
  const handleNavigateSibling = (delta: -1 | 1) => {
    if (activePositionIndex < 0) return;
    const nextIdx = (activePositionIndex + delta + positions.length) % positions.length;
    onSelectPosition(positions[nextIdx].id);
  };

  // Filtragem da lista
  const filteredPositions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return positions.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.label && p.label.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [positions, searchTerm, statusFilter]);

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800">
      {/* ------------------------------------------------------------- */}
      {/* SELETOR DE DUAS ABAS PRINCIPAIS (ORGANIZAÇÃO LIMPA E DIRETA)   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-800 p-1 bg-slate-950/80 rounded-t-xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('zone')}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'zone'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>1. Configurações da Zona</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cell')}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cell'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>2. Célula / Fileira</span>
          {activePosition && (
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-red-300 border border-red-500/30">
              {activePosition.code}
            </span>
          )}
        </button>
      </div>

      {/* ============================================================= */}
      {/* ABA 1: CONFIGURAÇÕES DA ZONA (PRESETS DE PORTE E GERADOR)    */}
      {/* ============================================================= */}
      {activeTab === 'zone' && (
        <div className="space-y-3">
          {/* SELEÇÃO DO PORTE DO VOLUME COM VÍNCULO DIRETO ÀS DIVISÕES AUTOMÁTICAS */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-red-500" />
                <span>Porte do Volume (Cria Divisões Automáticas)</span>
              </span>
              <span className="text-[10px] text-red-400 font-mono font-bold">
                {PRODUCT_SIZES.find((s) => s.id === (element.productSize || 'pallet'))?.short}
              </span>
            </div>

            <p className="text-[10px] text-slate-400">
              Clique no item para gerar instantaneamente as divisões internas em linha com replicação do código pela largura da zona.
            </p>

            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {PRODUCT_SIZES.map((size) => {
                const isSelected = (element.productSize || 'pallet') === size.id;
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => handleApplyVolumePreset(size.id)}
                    className={`p-2 rounded-lg text-left border transition-all flex items-start gap-1.5 ${
                      isSelected
                        ? 'border-red-500 bg-red-950/40 text-white font-bold ring-1 ring-red-500/30 shadow-xs'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <span className="text-base shrink-0">{size.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] truncate flex items-center justify-between">
                        <span className="truncate">{size.label}</span>
                        <span className="text-[9px] text-slate-500 font-mono ml-1">{size.short}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">{size.dimensions}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AJUSTES PARÂMETRICOS DO LAYOUT INTERNO DA ZONA */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-red-500" />
                <span>Parâmetros de Divisão da Zona</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">{positions.length} divisões</span>
            </div>

            {warningMessage && (
              <div className="p-2 rounded bg-amber-950/50 border border-amber-600/40 text-amber-200 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{warningMessage}</span>
              </div>
            )}

            {/* ESCOLHA DO MÉTODO DE ARMAZENAGEM */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Método de Divisão
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMethodDraft('horizontal_rows')}
                  className={`p-1.5 rounded-lg text-left border transition-all ${
                    methodDraft === 'horizontal_rows'
                      ? 'border-red-500 bg-red-950/30 text-white font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-[11px]">Fileiras Horizontais</div>
                  <div className="text-[9px] text-slate-400">Replicadas em linha</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodDraft('dimensioned_units')}
                  className={`p-1.5 rounded-lg text-left border transition-all ${
                    methodDraft === 'dimensioned_units'
                      ? 'border-red-500 bg-red-950/30 text-white font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-[11px]">Unidades Métricas</div>
                  <div className="text-[9px] text-slate-400">Módulos exatos (LxP)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodDraft('grid')}
                  className={`p-1.5 rounded-lg text-left border transition-all ${
                    methodDraft === 'grid'
                      ? 'border-red-500 bg-red-950/30 text-white font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-[11px]">Grade Modular</div>
                  <div className="text-[9px] text-slate-400">Paletes PBR padrão</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodDraft('custom')}
                  className={`p-1.5 rounded-lg text-left border transition-all ${
                    methodDraft === 'custom'
                      ? 'border-red-500 bg-red-950/30 text-white font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-[11px]">Manual (Colunas × Linhas)</div>
                  <div className="text-[9px] text-slate-400">Divisão proporcional</div>
                </button>
              </div>
            </div>

            {/* PARÂMETROS ESPECÍFICOS DO MÉTODO */}
            {methodDraft === 'horizontal_rows' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Profundidade da Fileira (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.30"
                    max="5.0"
                    value={rowDepthDraft}
                    onChange={(e) => setRowDepthDraft(parseFloat(e.target.value) || 0.80)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Recuo / Margem da Zona (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.0"
                    max="1.0"
                    value={marginDraft}
                    onChange={(e) => setMarginDraft(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
              </div>
            )}

            {(methodDraft === 'dimensioned_units' || methodDraft === 'grid') && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Largura da Posição (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.40"
                      max="6.0"
                      value={unitWidthDraft}
                      onChange={(e) => setUnitWidthDraft(parseFloat(e.target.value) || 1.0)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Profundidade da Posição (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.40"
                      max="6.0"
                      value={unitDepthDraft}
                      onChange={(e) => setUnitDepthDraft(parseFloat(e.target.value) || 1.0)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Folga Operacional (m)</label>
                    <input
                      type="number"
                      step="0.02"
                      min="0.0"
                      max="0.5"
                      value={clearanceDraft}
                      onChange={(e) => setClearanceDraft(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Recuo / Margem (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.0"
                      max="1.0"
                      value={marginDraft}
                      onChange={(e) => setMarginDraft(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {methodDraft === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Colunas</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={customColsDraft}
                    onChange={(e) => setCustomColsDraft(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Linhas</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={customRowsDraft}
                    onChange={(e) => setCustomRowsDraft(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* PREFIXO DE CÓDIGO E DUPLICAÇÃO DE CÓDIGO EM FILEIRA */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">
                  Prefixo dos Códigos (ex: GEL, FOG, TV, CS)
                </label>
                <input
                  type="text"
                  value={prefixDraft}
                  onChange={(e) => setPrefixDraft(e.target.value.toUpperCase())}
                  placeholder="Ex: GEL (Gera GEL-0001...)"
                  className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-700 bg-slate-950 text-red-400"
                />
              </div>

              <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameCodePerRowDraft}
                  onChange={(e) => setSameCodePerRowDraft(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Mesmo código para itens replicados na mesma linha (ex: GEL-0001 em toda a fileira)</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerateOrRecalculate}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recalcular Divisões da Zona</span>
            </button>
          </div>

          {/* INDICADORES DE OCUPAÇÃO DA ZONA */}
          {positions.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Ocupação da Zona:</span>
                <span className="font-mono font-bold text-slate-100">{stats.occupancyRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${stats.occupancyRate}%` }} />
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${positions.length > 0 ? (stats.reserved / positions.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{stats.occupied} Ocupadas</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{stats.reserved} Reservadas</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>{stats.empty} Livres</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* ABA 2: CONFIGURAÇÕES DA CÉLULA / FILEIRA DE CÉLULAS           */}
      {/* ============================================================= */}
      {activeTab === 'cell' && (
        <div className="space-y-3">
          {activePosition ? (
            <div className="rounded-xl border border-red-500/40 bg-slate-900/95 p-3 shadow-xl space-y-3">
              {/* Header da Célula Selecionada */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-red-600 text-white font-mono text-[10px] font-bold">
                    CÉLULA
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1 font-mono">
                    <Hash className="w-3.5 h-3.5 text-red-500" />
                    <span>{activePosition.code}</span>
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleNavigateSibling(-1)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Célula Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500 px-1">
                    {activePositionIndex + 1}/{positions.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigateSibling(1)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Próxima Célula"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPosition(null)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
                    title="Desmarcar Célula"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MEDIDAS DA CÉLULA */}
              {(() => {
                const dims = getPositionDimensions(activePosition, safeScaleRatio);
                return (
                  <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300">
                    <span>Medidas:</span>
                    <span className="font-bold text-red-400">
                      {dims.widthMeters.toFixed(2)}m × {dims.depthMeters.toFixed(2)}m
                    </span>
                    <span className="text-slate-400">
                      ({dims.areaMeters.toFixed(2)} m²)
                    </span>
                  </div>
                );
              })()}

              {/* ----------------------------------------------------------- */}
              {/* CONFIGURAÇÃO EM LOTE DA FILEIRA (CÓDIGOS IGUAIS)             */}
              {/* ----------------------------------------------------------- */}
              {sameCodePositions.length > 1 && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-950/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-200">
                        Fileira de Células (Código: {activePosition.code})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200 font-bold">
                      {sameCodePositions.length} células
                    </span>
                  </div>

                  <p className="text-[10px] text-amber-300/80">
                    Editar os campos abaixo atualizará <strong>todas as {sameCodePositions.length} células</strong> desta fileira simultaneamente.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                        SKU para Toda a Fileira
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: GEL-BRST-440"
                        value={activePosition.sku || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          handleUpdateRowPositions(activePosition.code, {
                            sku: val,
                            status: val ? 'occupied' : activePosition.status,
                          });
                        }}
                        className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                        Qtd / Célula
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="1"
                        value={activePosition.quantity ?? ''}
                        onChange={(e) => handleUpdateRowPositions(activePosition.code, { quantity: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                      Descrição para Toda a Fileira
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Refrigerador Frost Free Duplex"
                      value={activePosition.description || ''}
                      onChange={(e) => handleUpdateRowPositions(activePosition.code, { description: e.target.value })}
                      className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                      Status de Toda a Fileira
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateRowPositions(activePosition.code, { status: 'empty' })}
                        className={`py-1 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 ${
                          activePosition.status === 'empty'
                            ? 'bg-slate-800 border-slate-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>Livre</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateRowPositions(activePosition.code, { status: 'occupied' })}
                        className={`py-1 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 ${
                          activePosition.status === 'occupied'
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-emerald-400'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Ocupada</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateRowPositions(activePosition.code, { status: 'reserved' })}
                        className={`py-1 px-2 rounded text-xs font-semibold border flex items-center justify-center gap-1 ${
                          activePosition.status === 'reserved'
                            ? 'bg-amber-950 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-400'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Reservada</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* CONFIGURAÇÃO DA CÉLULA INDIVIDUAL                           */}
              {/* ----------------------------------------------------------- */}
              <div className="space-y-2.5 pt-1 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-200 block">
                  Ajustes da Célula Individual
                </span>

                {/* Código e Rótulo Individual */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      Código WMS Individual
                    </label>
                    <input
                      type="text"
                      value={activePosition.code}
                      onChange={(e) => handleUpdatePosition(activePosition.id, { code: e.target.value.toUpperCase() })}
                      placeholder="Ex: P0001, GEL-01"
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-red-400 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      Rótulo / Apelido
                    </label>
                    <input
                      type="text"
                      value={activePosition.label || ''}
                      onChange={(e) => handleUpdatePosition(activePosition.id, { label: e.target.value })}
                      placeholder="Ex: Palete Frontal"
                      className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Status Operacional Individual */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Status Individual
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdatePosition(activePosition.id, { status: 'empty' })}
                      className={`py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                        activePosition.status === 'empty'
                          ? 'bg-slate-800 border-slate-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Livre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePosition(activePosition.id, { status: 'occupied' })}
                      className={`py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                        activePosition.status === 'occupied'
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-emerald-400'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Ocupada</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePosition(activePosition.id, { status: 'reserved' })}
                      className={`py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                        activePosition.status === 'reserved'
                          ? 'bg-amber-950 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Reservada</span>
                    </button>
                  </div>
                </div>

                {/* Porte do Volume alocado na Célula */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                    Porte do Volume Alocado
                  </label>
                  <select
                    value={activePosition.productSize || element.productSize || 'pallet'}
                    onChange={(e) => handleUpdatePosition(activePosition.id, { productSize: e.target.value as ProductSize })}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 focus:border-red-500 focus:outline-none"
                  >
                    {PRODUCT_SIZES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {s.label} ({s.short})
                      </option>
                    ))}
                  </select>
                </div>

                {/* SKU e Descrição Individual */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      SKU Individual
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: GEL-BRST-440"
                      value={activePosition.sku || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleUpdatePosition(activePosition.id, {
                          sku: val,
                          status: val ? 'occupied' : activePosition.status,
                        });
                      }}
                      className="w-full px-2 py-1 text-xs font-mono rounded bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      Qtd
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={activePosition.quantity ?? ''}
                      onChange={(e) => handleUpdatePosition(activePosition.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-200 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                    Descrição do Item
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Refrigerador Frost Free Duplex"
                    value={activePosition.description || ''}
                    onChange={(e) => handleUpdatePosition(activePosition.id, { description: e.target.value })}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {/* Ações Rápidas da Célula */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyFromZone(activePosition.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 flex items-center gap-1 transition-colors"
                    title="Copiar dados da zona pai"
                  >
                    <Copy className="w-3 h-3 text-red-400" />
                    <span>Copiar da Zona</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearPosition(activePosition.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-400 flex items-center gap-1 transition-colors"
                    title="Liberar espaço da célula"
                  >
                    <PackageX className="w-3 h-3" />
                    <span>Liberar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePosition(activePosition.id)}
                    className="px-2 py-1 rounded bg-red-950/50 hover:bg-red-900/50 text-[11px] font-semibold text-red-300 border border-red-800/40 flex items-center gap-1 transition-colors"
                    title="Excluir divisão"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-2 text-xs">
              <Info className="w-5 h-5 text-red-500 mx-auto" />
              <p className="text-slate-300 font-semibold">Nenhuma célula selecionada</p>
              <p className="text-slate-400 text-[11px]">
                Clique em uma célula no mapa da zona para abrir as configurações individuais ou da fileira com códigos iguais.
              </p>
            </div>
          )}

          {/* LISTA E BUSCA DE POSIÇÕES DA ZONA */}
          {positions.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Buscar célula por código ou SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-medium"
                >
                  <option value="all">Todas ({positions.length})</option>
                  <option value="occupied">Ocupadas ({stats.occupied})</option>
                  <option value="empty">Livres ({stats.empty})</option>
                  <option value="reserved">Reservadas ({stats.reserved})</option>
                </select>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {filteredPositions.map((pos, idx) => {
                  const isSelected = selectedPositionId === pos.id;
                  const dims = getPositionDimensions(pos, safeScaleRatio);
                  const posKey = `${element.id}-${pos.id || 'pos'}-${idx}`;
                  return (
                    <div
                      key={posKey}
                      onClick={() => onSelectPosition(pos.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-red-950/40 border-red-500 ring-1 ring-red-400/40 shadow-xs'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-red-500/50 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-red-500" />
                          <span className="text-xs font-mono font-bold text-red-400">
                            {pos.code}
                          </span>
                          {pos.label && (
                            <span className="text-[10px] text-slate-300 truncate max-w-[100px]">
                              · {pos.label}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({dims.widthMeters.toFixed(1)}m × {dims.depthMeters.toFixed(1)}m)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              pos.status === 'occupied'
                                ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                                : pos.status === 'reserved'
                                ? 'bg-amber-950 border-amber-600 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {pos.status === 'occupied' ? 'OCUPADA' : pos.status === 'reserved' ? 'RESERVADA' : 'LIVRE'}
                          </span>
                          <Pencil className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" />
                        </div>
                      </div>

                      {pos.sku && (
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 pt-0.5">
                          <span className="text-slate-500">SKU:</span>
                          <span className="font-bold text-slate-200">{pos.sku}</span>
                          {pos.quantity ? <span className="text-slate-400">({pos.quantity} UN)</span> : null}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredPositions.length === 0 && (
                  <p className="text-center text-[11px] text-slate-500 py-3">Nenhuma posição encontrada.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


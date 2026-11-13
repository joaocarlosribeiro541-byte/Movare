import { useEffect, useState } from 'react';
import {
  X,
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Maximize2,
  Ruler,
} from 'lucide-react';
import {
  DEFAULT_HEIGHT_METERS,
  DEFAULT_SCALE_RATIO,
  DEFAULT_WIDTH_METERS,
  getAreaBounds,
  type FloorArea,
} from '../editor-model';
import {
  clampWarehouseHeight,
  clampWarehouseScale,
  clampWarehouseWidth,
} from '../warehouse-crud';

export type WarehouseManagerMode = 'list' | 'create' | 'edit';

type WarehouseManagerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  areas: FloorArea[];
  activeAreaId: string;
  initialMode?: WarehouseManagerMode;
  initialEditAreaId?: string | null;
  onSelectArea: (id: string) => void;
  onCreateArea: (input: {
    name: string;
    widthMeters: number;
    heightMeters: number;
    scaleRatio: number;
    activate: boolean;
  }) => void;
  onUpdateArea: (
    areaId: string,
    updates: {
      name: string;
      widthMeters: number;
      heightMeters: number;
      scaleRatio: number;
      scaleElements: boolean;
    }
  ) => void;
  onDeleteArea: (areaId: string) => void;
  isDark?: boolean;
};

const DIMENSION_PRESETS = [
  { label: 'Compacto', w: 50, h: 30, desc: '1.500 m²' },
  { label: 'Padrão', w: 80, h: 50, desc: '4.000 m²' },
  { label: 'Amplo', w: 120, h: 70, desc: '8.400 m²' },
  { label: 'Mega CD', w: 160, h: 100, desc: '16.000 m²' },
];

export function WarehouseManagerDialog({
  isOpen,
  onClose,
  areas,
  activeAreaId,
  initialMode = 'list',
  initialEditAreaId = null,
  onSelectArea,
  onCreateArea,
  onUpdateArea,
  onDeleteArea,
  isDark = true,
}: WarehouseManagerDialogProps) {
  const [mode, setMode] = useState<WarehouseManagerMode>(initialMode);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(initialEditAreaId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Campos de criação / edição
  const [nameDraft, setNameDraft] = useState('');
  const [widthDraft, setWidthDraft] = useState(DEFAULT_WIDTH_METERS);
  const [heightDraft, setHeightDraft] = useState(DEFAULT_HEIGHT_METERS);
  const [scaleDraft, setScaleDraft] = useState(DEFAULT_SCALE_RATIO);
  const [scaleElementsDraft, setScaleElementsDraft] = useState(true);
  const [activateOnCreate, setActivateOnCreate] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateForm = () => {
    setMode('create');
    setEditingAreaId(null);
    setConfirmDeleteId(null);
    setNameDraft(`Galpão ${areas.length + 1}`);
    setWidthDraft(DEFAULT_WIDTH_METERS);
    setHeightDraft(DEFAULT_HEIGHT_METERS);
    setScaleDraft(DEFAULT_SCALE_RATIO);
    setActivateOnCreate(true);
    setFormError(null);
  };

  const openEditForm = (area: FloorArea) => {
    const b = getAreaBounds(area);
    setMode('edit');
    setEditingAreaId(area.id);
    setConfirmDeleteId(null);
    setNameDraft(area.name);
    setWidthDraft(b.widthMeters);
    setHeightDraft(b.heightMeters);
    setScaleDraft(area.scaleRatio || DEFAULT_SCALE_RATIO);
    setScaleElementsDraft(true);
    setFormError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDeleteId(null);
    setFormError(null);
    if (initialMode === 'create') {
      openCreateForm();
      return;
    }
    if (initialMode === 'edit') {
      const target =
        areas.find((a) => a.id === (initialEditAreaId || activeAreaId)) ?? areas[0];
      if (target) {
        openEditForm(target);
        return;
      }
    }
    setMode('list');
    setEditingAreaId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode, initialEditAreaId]);

  if (!isOpen) return null;

  const editingArea = editingAreaId ? areas.find((a) => a.id === editingAreaId) ?? null : null;
  const editingAreaBounds = editingArea ? getAreaBounds(editingArea) : null;
  const dimensionsChangedInEdit = Boolean(
    editingAreaBounds &&
      (clampWarehouseWidth(widthDraft) !== editingAreaBounds.widthMeters ||
        clampWarehouseHeight(heightDraft) !== editingAreaBounds.heightMeters)
  );

  const canDeleteAny = areas.length > 1;
  const computedAreaM2 = (
    clampWarehouseWidth(widthDraft) * clampWarehouseHeight(heightDraft)
  ).toLocaleString('pt-BR');

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setFormError('Informe um nome para o galpão ou barracão.');
      return;
    }

    const safeWidth = clampWarehouseWidth(widthDraft);
    const safeHeight = clampWarehouseHeight(heightDraft);
    const safeScale = clampWarehouseScale(scaleDraft);

    if (mode === 'create') {
      onCreateArea({
        name: trimmed,
        widthMeters: safeWidth,
        heightMeters: safeHeight,
        scaleRatio: safeScale,
        activate: activateOnCreate,
      });
      onClose();
      return;
    }

    if (mode === 'edit' && editingArea) {
      onUpdateArea(editingArea.id, {
        name: trimmed,
        widthMeters: safeWidth,
        heightMeters: safeHeight,
        scaleRatio: safeScale,
        scaleElements: scaleElementsDraft,
      });
      setMode('list');
      setEditingAreaId(null);
    }
  };

  const panelClass = isDark
    ? 'bg-slate-900 border-slate-700/80 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const subtleBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark
    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
    : 'bg-slate-50 border-slate-200 hover:border-slate-300';
  const inputClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-orange-500'
    : 'border-slate-300 bg-white text-slate-900 focus:border-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl p-5 sm:p-6 ${panelClass}`}
      >
        {/* CABEÇALHO */}
        <div className={`flex items-center justify-between pb-3.5 border-b ${subtleBorder}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {mode !== 'list' && (
              <button
                type="button"
                onClick={() => {
                  setMode('list');
                  setEditingAreaId(null);
                  setFormError(null);
                }}
                title="Voltar para lista de galpões"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight truncate">
                {mode === 'create'
                  ? 'Novo Galpão / Barracão'
                  : mode === 'edit'
                  ? `Editar: ${editingArea?.name ?? 'Galpão'}`
                  : 'Gerenciar Galpões e Barracões'}
              </h3>
              <p className={`text-xs truncate ${mutedText}`}>
                {mode === 'create'
                  ? 'Configure nome, área útil em metros e escala CAD'
                  : mode === 'edit'
                  ? 'Atualize identificação, medidas e escala do espaço'
                  : `${areas.length} ${areas.length === 1 ? 'galpão cadastrado' : 'galpões cadastrados'} no mapa central`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerenciador de galpões"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODO LISTA */}
        {mode === 'list' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs ${mutedText}`}>
                Crie novos barracões, renomeie/redimensione ou exclua galpões obsoletos.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Galpão / Barracão</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-0.5">
              {areas.map((area) => {
                const areaBounds = getAreaBounds(area);
                const areaScale = area.scaleRatio || DEFAULT_SCALE_RATIO;
                const areaM2 = (areaBounds.widthMeters * areaBounds.heightMeters).toLocaleString('pt-BR');
                const isActive = area.id === activeAreaId;
                const isConfirmingDelete = confirmDeleteId === area.id;

                return (
                  <div
                    key={area.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isActive
                        ? isDark
                          ? 'border-orange-500/60 bg-orange-950/15'
                          : 'border-orange-400 bg-orange-50/70'
                        : cardBg
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{area.name}</span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              Em exibição
                            </span>
                          )}
                        </div>
                        <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono ${mutedText}`}>
                          <span className="inline-flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-orange-500" />
                            {areaBounds.widthMeters}m × {areaBounds.heightMeters}m ({areaM2} m²)
                          </span>
                          <span>• {area.elements.length} itens</span>
                          <span className="inline-flex items-center gap-1">
                            <Ruler className="w-3 h-3" />
                            1m = {areaScale}px
                          </span>
                        </div>
                      </div>

                      {!isConfirmingDelete && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectArea(area.id);
                                onClose();
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                isDark
                                  ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              Abrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditForm(area)}
                            title={`Editar ${area.name}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                              isDark
                                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <Pencil className="w-3 h-3 text-orange-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            disabled={!canDeleteAny}
                            onClick={() => setConfirmDeleteId(area.id)}
                            title={
                              canDeleteAny
                                ? `Excluir ${area.name}`
                                : 'O sistema exige pelo menos 1 galpão cadastrado'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              canDeleteAny
                                ? isDark
                                  ? 'border-rose-500/30 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 cursor-pointer'
                                  : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed border-slate-700/50 text-slate-500'
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CONFIRMAÇÃO INLINE DE EXCLUSÃO */}
                    {isConfirmingDelete && (
                      <div
                        className={`mt-3 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          isDark
                            ? 'border-rose-500/50 bg-rose-950/30 text-rose-100'
                            : 'border-rose-300 bg-rose-50 text-rose-950'
                        }`}
                      >
                        <div className="flex items-start gap-2 text-xs">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block">Excluir &ldquo;{area.name}&rdquo;?</strong>
                            <span className={isDark ? 'text-rose-200/80 text-[11px]' : 'text-rose-700 text-[11px]'}>
                              Remove o galpão e seus {area.elements.length} elementos do mapa central.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteArea(area.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                          >
                            Confirmar Exclusão
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!canDeleteAny && (
              <p className={`text-[11px] ${mutedText}`}>
                Nota: é necessário manter ao menos 1 galpão/barracão ativo no sistema.
              </p>
            )}

            <div className={`flex justify-end pt-3 border-t ${subtleBorder}`}>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Concluir
              </button>
            </div>
          </div>
        )}

        {/* MODO CRIAR / EDITAR */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
            {formError && (
              <div className="p-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                Nome do Galpão / Barracão
              </label>
              <input
                type="text"
                autoFocus
                maxLength={80}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setFormError(null);
                }}
                placeholder="Ex: Barracão B — Recebimento e Expedição"
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                  Largura (m)
                </label>
                <input
                  type="number"
                  min={20}
                  max={500}
                  value={widthDraft}
                  onChange={(e) => setWidthDraft(Number(e.target.value) || 20)}
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border focus:outline-none ${inputClass}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                  Comprimento (m)
                </label>
                <input
                  type="number"
                  min={15}
                  max={500}
                  value={heightDraft}
                  onChange={(e) => setHeightDraft(Number(e.target.value) || 15)}
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border focus:outline-none ${inputClass}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                  Escala (px por metro)
                </label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  step={0.5}
                  value={scaleDraft}
                  onChange={(e) => setScaleDraft(Number(e.target.value) || DEFAULT_SCALE_RATIO)}
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border focus:outline-none ${inputClass}`}
                />
              </div>
            </div>

            {/* Presets de tamanho */}
            <div>
              <label className={`block text-[11px] font-medium mb-1.5 ${mutedText}`}>
                Tamanhos Padrão Rápidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DIMENSION_PRESETS.map((p) => {
                  const selected = widthDraft === p.w && heightDraft === p.h;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setWidthDraft(p.w);
                        setHeightDraft(p.h);
                      }}
                      className={`p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                        selected
                          ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/80 hover:bg-slate-800 text-slate-300'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <strong className="block text-[11px]">{p.label}</strong>
                      <span className={`text-[10px] font-mono ${mutedText}`}>
                        {p.w}×{p.h}m ({p.desc})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumo m² */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className={mutedText}>Área Útil Resultante</span>
              <span className="font-mono font-bold text-sm text-orange-500">
                {clampWarehouseWidth(widthDraft)}m × {clampWarehouseHeight(heightDraft)}m · {computedAreaM2} m²
              </span>
            </div>

            {mode === 'create' && (
              <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activateOnCreate}
                  onChange={(e) => setActivateOnCreate(e.target.checked)}
                  className="rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <span>Abrir este galpão na tela imediatamente após criar</span>
              </label>
            )}

            {mode === 'edit' && dimensionsChangedInEdit && (
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer select-none ${
                  scaleElementsDraft
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : subtleBorder
                }`}
              >
                <input
                  type="checkbox"
                  checked={scaleElementsDraft}
                  onChange={(e) => setScaleElementsDraft(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>Ajustar zonas proporcionalmente sem deformar</span>
                  </span>
                  <p className={`text-[11px] leading-relaxed ${mutedText}`}>
                    Preserva posições relativas, produtos e SKUs internos dentro do novo perímetro.
                  </p>
                </div>
              </label>
            )}

            <div className={`flex items-center justify-end gap-2.5 pt-3 border-t ${subtleBorder}`}>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'edit') {
                    setMode('list');
                    setEditingAreaId(null);
                  } else {
                    onClose();
                  }
                }}
                className={`px-4 py-2 text-xs font-medium cursor-pointer ${mutedText}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{mode === 'create' ? 'Criar Galpão' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { X, Layers, Eye, EyeOff, Lock, Unlock, Target, Plus, Check, Trash2, Box, LayoutGrid } from 'lucide-react';
import {
  type DrawingElement,
  type WarehouseLayer,
  createId
} from '../editor-model';

type LayersManagerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  elements: DrawingElement[];
  focusedGroupId: string | null;
  onSetFocusedGroupId: (groupId: string | null) => void;
  onUpdateElements: (updated: DrawingElement[]) => void;
  isDark?: boolean;
};

export function LayersManagerDialog({
  isOpen,
  onClose,
  elements,
  focusedGroupId,
  onSetFocusedGroupId,
  onUpdateElements,
  isDark = true,
}: LayersManagerDialogProps) {
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState('#f97316');
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!isOpen) return null;

  // Agrupamento de elementos por Espaço / Grupo
  // As zonas (type === 'rectangle' com nome) ou grupos explícitos definem os espaços
  const zoneGroups = elements.filter((el) => el.type === 'rectangle');

  // Contagem de elementos filhos associados
  const getGroupStats = (zoneId: string, zone: DrawingElement) => {
    const insideItems = elements.filter((el) => {
      if (el.id === zoneId) return false;
      if (el.groupId === zoneId) return true;
      // Detecção geométrica se está dentro do espaço
      const isInside =
        el.x >= zone.x - 5 &&
        el.y >= zone.y - 5 &&
        el.x + el.width <= zone.x + zone.width + 5 &&
        el.y + el.height <= zone.y + zone.height + 5;
      return isInside;
    });

    const isAllLocked = zone.locked && insideItems.every((i) => i.locked);
    const isAllHidden = zone.hidden && insideItems.every((i) => i.hidden);

    return {
      insideItems,
      count: insideItems.length,
      isAllLocked,
      isAllHidden,
    };
  };

  // Alternar visibilidade de todo o espaço
  const toggleSpaceVisibility = (zone: DrawingElement) => {
    const { insideItems, isAllHidden } = getGroupStats(zone.id, zone);
    const newHidden = !isAllHidden;
    const targetIds = new Set([zone.id, ...insideItems.map((i) => i.id)]);

    const updated = elements.map((el) =>
      targetIds.has(el.id) ? { ...el, hidden: newHidden } : el
    );
    onUpdateElements(updated);
  };

  // Alternar trava de todo o espaço
  const toggleSpaceLock = (zone: DrawingElement) => {
    const { insideItems, isAllLocked } = getGroupStats(zone.id, zone);
    const newLocked = !isAllLocked;
    const targetIds = new Set([zone.id, ...insideItems.map((i) => i.id)]);

    const updated = elements.map((el) =>
      targetIds.has(el.id) ? { ...el, locked: newLocked } : el
    );
    onUpdateElements(updated);
  };

  // Entrar ou sair do modo de foco individual do espaço
  const handleToggleFocus = (zoneId: string) => {
    if (focusedGroupId === zoneId) {
      onSetFocusedGroupId(null);
    } else {
      onSetFocusedGroupId(zoneId);
      onClose();
    }
  };

  const handleCreateNewSpace = () => {
    if (!newLayerName.trim()) return;
    const newSpace: DrawingElement = {
      id: createId('space'),
      type: 'rectangle',
      name: newLayerName.trim(),
      color: newLayerColor,
      x: 100,
      y: 100,
      width: 400,
      height: 250,
      capacity: 100,
    };
    onUpdateElements([...elements, newSpace]);
    setNewLayerName('');
    setShowCreateForm(false);
    onSetFocusedGroupId(newSpace.id);
    onClose();
  };

  // Itens soltos (sem zona pai)
  const unassignedElements = elements.filter(
    (el) => el.type !== 'rectangle' && !el.groupId && !zoneGroups.some((z) =>
      el.x >= z.x - 5 && el.y >= z.y - 5 && el.x + el.width <= z.x + z.width + 5 && el.y + el.height <= z.y + z.height + 5
    )
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Camadas & Edição por Espaço</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Grupos WMS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Isole e edite cada espaço individualmente com suas próprias divisórias e produtos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status de Foco Atual se ativo */}
        {focusedGroupId && (
          <div className="bg-orange-500/15 border-b border-orange-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-orange-300">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-400 animate-pulse" />
              <span>
                Modo Foco Ativo: <strong>{zoneGroups.find((z) => z.id === focusedGroupId)?.name || 'Espaço Selecionado'}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSetFocusedGroupId(null)}
              className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px]"
            >
              Sair do Foco
            </button>
          </div>
        )}

        {/* Lista de Espaços e Camadas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Espaços Dedicados ({zoneGroups.length})
            </span>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Espaço</span>
            </button>
          </div>

          {showCreateForm && (
            <div className="p-3.5 rounded-xl border border-orange-500/40 bg-orange-500/5 space-y-3">
              <div className="text-xs font-bold text-slate-200">Criar Novo Espaço / Camada de Armazenagem:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  placeholder="Ex: Ala Fogões & Fornos"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
                />
                <input
                  type="color"
                  value={newLayerColor}
                  onChange={(e) => setNewLayerColor(e.target.value)}
                  className="w-9 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Cor do Espaço"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewSpace}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-orange-600 text-white shadow-xs"
                >
                  Criar e Focar
                </button>
              </div>
            </div>
          )}

          {zoneGroups.map((zone) => {
            const { count, isAllLocked, isAllHidden } = getGroupStats(zone.id, zone);
            const isFocused = focusedGroupId === zone.id;

            return (
              <div
                key={zone.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isFocused
                    ? 'border-orange-500 bg-orange-500/10 shadow-md ring-1 ring-orange-500/50'
                    : isDark
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: zone.color || '#f97316' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-sm font-bold text-slate-100 truncate">{zone.name}</strong>
                        {zone.skuCode && (
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-orange-400 font-bold">
                            {zone.skuCode}
                          </span>
                        )}
                        {isFocused && (
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider font-mono px-1.5 py-0.2 rounded bg-orange-500/20">
                            Em Foco
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Box className="w-3 h-3 text-slate-500" />
                        {count} {count === 1 ? 'item / divisória' : 'itens / divisórias'} dentro deste espaço
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão Visibilidade */}
                    <button
                      type="button"
                      onClick={() => toggleSpaceVisibility(zone)}
                      className={`p-2 rounded-lg text-xs transition-colors ${
                        isAllHidden
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title={isAllHidden ? 'Exibir espaço e itens' : 'Ocultar espaço'}
                    >
                      {isAllHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Botão Trava */}
                    <button
                      type="button"
                      onClick={() => toggleSpaceLock(zone)}
                      className={`p-2 rounded-lg text-xs transition-colors ${
                        isAllLocked
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title={isAllLocked ? 'Desbloquear espaço' : 'Travar espaço'}
                    >
                      {isAllLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>

                    {/* Botão Isolar / Modo Foco */}
                    <button
                      type="button"
                      onClick={() => handleToggleFocus(zone.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                        isFocused
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-orange-400 border border-orange-500/30'
                      }`}
                      title="Isolar este espaço para adicionar divisórias e produtos individualmente"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>{isFocused ? 'Em Edição' : 'Editar Espaço'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {unassignedElements.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
              <span>Outros elementos gerais soltos no mapa</span>
              <span className="font-mono text-slate-300 font-semibold">{unassignedElements.length} elementos</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

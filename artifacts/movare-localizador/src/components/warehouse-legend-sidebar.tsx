import { useState, useMemo } from 'react';
import {
  Layers, ChevronRight, ChevronLeft, MapPin, Box, Hash,
  CheckCircle2, Clock, Check
} from 'lucide-react';
import {
  PRODUCT_SIZES, PRODUCT_CATEGORIES,
  type DrawingElement
} from '../editor-model';

type WarehouseLegendSidebarProps = {
  elements: DrawingElement[];
  selectedId: string | null;
  onSelectZone: (zone: DrawingElement) => void;
  scaleRatio: number;
  isDark?: boolean;
  isDraggingCanvas?: boolean;
  defaultOpen?: boolean;
};

export function WarehouseLegendSidebar({
  elements,
  selectedId,
  onSelectZone,
  scaleRatio,
  isDark = true,
  isDraggingCanvas = false,
  defaultOpen = false,
}: WarehouseLegendSidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filtra apenas as zonas criadas (retângulos e porta-paletes)
  const zones = useMemo(() => {
    return elements.filter((el) => el.type === 'rectangle' || el.type === 'rack');
  }, [elements]);

  return (
    <aside
      aria-label="Legenda das Zonas do Armazém"
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed left-14 top-16 z-20 transition-all duration-300 flex items-start select-none ${
        isDraggingCanvas ? 'opacity-25 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Botão de Aba Flutuante para Abrir / Fechar Legenda */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-900/95 hover:bg-slate-850 text-slate-200 border-slate-700/80 shadow-black/60'
            : 'bg-white/95 hover:bg-slate-50 text-slate-800 border-slate-300 shadow-slate-400/20'
        } ${isOpen ? 'rounded-r-none border-r-0' : 'hover:scale-105'}`}
        title={isOpen ? 'Recolher Legenda' : 'Abrir Legenda das Zonas'}
      >
        <Layers className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="hidden sm:inline">Legenda</span>
        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
          {zones.length}
        </span>
        {isOpen ? (
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {/* Painel Expansível da Legenda (Fixo na Tela, Imune a Zoom/Pan) */}
      {isOpen && (
        <div
          className={`w-72 sm:w-80 max-h-[75vh] flex flex-col rounded-2xl rounded-tl-none border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${
            isDark
              ? 'bg-slate-950/95 border-slate-700/80 text-slate-100 shadow-black/80'
              : 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-400/30'
          }`}
        >
          {/* Header do Painel */}
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-orange-500/10 text-orange-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-bold leading-none text-slate-100">
                  Legenda de Zonas & Categorias
                </h2>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Cores, características e produtos alocados
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar Legenda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Lista de Zonas com Cores e Características */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin divide-y divide-slate-800/40">
            {zones.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <Box className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
                <p>Nenhuma zona criada neste galpão.</p>
                <p className="text-[10px]">Crie uma nova zona usando a ferramenta de desenho.</p>
              </div>
            ) : (
              zones.map((zone) => {
                const isSelected = selectedId === zone.id;
                const sizeDef = PRODUCT_SIZES.find((s) => s.id === zone.productSize);
                const catDef = PRODUCT_CATEGORIES.find((c) => c.id === zone.category);
                const zoneColor = zone.color || (zone.type === 'rack' ? '#f97316' : '#d97706');

                // Dimensões métricas reais
                const widthM = Math.round((zone.width / scaleRatio) * 10) / 10;
                const heightM = Math.round((zone.height / scaleRatio) * 10) / 10;
                const areaM2 = Math.round(widthM * heightM);

                // Contagem de posições internas e status
                const positions = zone.internalPositions || [];
                const occupiedCount = positions.filter((p) => p.status === 'occupied').length;
                const reservedCount = positions.filter((p) => p.status === 'reserved').length;
                const emptyCount = positions.filter((p) => p.status === 'empty' || !p.status).length;

                return (
                  <div
                    key={zone.id}
                    onClick={() => onSelectZone(zone)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-slate-900 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                        : isDark
                        ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {/* Linha 1: Amostra da Cor, Nome da Zona e Tipo */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Indicador de Cor da Zona com Borda */}
                        <div
                          className="w-3.5 h-3.5 rounded-md shrink-0 shadow-sm transition-transform group-hover:scale-110"
                          style={{
                            backgroundColor: zoneColor,
                            boxShadow: `0 0 8px ${zoneColor}60`,
                          }}
                        />
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {zone.name}
                        </span>
                      </div>

                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 shrink-0">
                        {zone.type === 'rack' ? 'PORTA-PALETE' : 'ZONA / CÉLULA'}
                      </span>
                    </div>

                    {/* Linha 2: Badges de Categoria & Porte do Produto */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {catDef && (
                        <span
                          className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1"
                          style={{
                            backgroundColor: `${catDef.color}15`,
                            borderColor: `${catDef.color}40`,
                            color: catDef.color,
                          }}
                        >
                          <span>●</span>
                          <span>{catDef.badge}</span>
                        </span>
                      )}

                      {sizeDef && (
                        <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1">
                          <span>{sizeDef.icon}</span>
                          <span>{sizeDef.label}</span>
                        </span>
                      )}
                    </div>

                    {/* Linha 3: Dimensões Reais & Estatísticas de Estoque */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/60">
                      <div>
                        <span className="text-slate-300 font-bold">{widthM}m × {heightM}m</span>
                        <span className="text-slate-500 ml-1">({areaM2}m²)</span>
                      </div>

                      {positions.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <span title="Total de Posições" className="text-slate-300 font-bold">
                            {positions.length} pos
                          </span>
                          {occupiedCount > 0 && (
                            <span title="Ocupadas" className="text-emerald-400 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              {occupiedCount}
                            </span>
                          )}
                          {reservedCount > 0 && (
                            <span title="Reservadas" className="text-amber-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {reservedCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Área contínua</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé da Legenda com Ação de Foco */}
          <div className="p-2 border-t border-slate-800/80 bg-slate-900/40 text-center text-[10px] text-slate-400">
            Clique em qualquer zona para enquadrar a câmera no mapa
          </div>
        </div>
      )}
    </aside>
  );
}

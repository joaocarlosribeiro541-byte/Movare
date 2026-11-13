import React, { useMemo } from 'react';
import { Compass, Box, Layers, Navigation, ExternalLink, X } from 'lucide-react';
import {
  PRODUCT_SIZES,
  PRODUCT_CATEGORIES,
  type DrawingElement,
} from '../editor-model';

interface GeographicLegendProps {
  elements: DrawingElement[];
  selectedId: string | null;
  onSelectZone: (zone: DrawingElement) => void;
  scaleRatio: number;
  worldWidth: number;
  worldHeight: number;
  isDark: boolean;
}

/**
 * Legenda Cartográfica Simples de Mapa Geográfico
 * Renderizada no próprio plano do mapa, fixada do lado de fora do perímetro do barracão.
 * Estilo clássico de mapa/atlas: moldura cartográfica, amostras de cor de cada zona
 * e suas respectivas características de mercadorias e infraestrutura.
 */
export function WarehouseGeographicLegendSVG({
  elements,
  selectedId,
  onSelectZone,
  scaleRatio,
  worldWidth,
  isDark,
}: GeographicLegendProps) {
  const safeScaleRatio = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;

  const zones = useMemo(() => {
    return elements.filter((el) => el.type === 'rectangle' || el.type === 'rack');
  }, [elements]);

  const corridors = useMemo(() => {
    return elements.filter((el) => el.type === 'corridor');
  }, [elements]);

  const dividers = useMemo(() => {
    return elements.filter((el) => el.type === 'divider');
  }, [elements]);

  const legendWidth = 280;
  // Altura dinâmica baseada na quantidade de zonas
  const itemHeight = 64;
  const headerHeight = 68;
  const infrastructureHeight = (corridors.length > 0 || dividers.length > 0 || zones.some((z) => z.type === 'rack')) ? 110 : 20;
  const totalHeight = Math.max(300, headerHeight + Math.max(zones.length, 1) * itemHeight + infrastructureHeight + 30);

  const posX = worldWidth + 32;
  const posY = 10;

  return (
    <g
      transform={`translate(${posX}, ${posY})`}
      className="warehouse-geographic-legend select-none pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <foreignObject
        x={0}
        y={0}
        width={legendWidth}
        height={totalHeight}
        className="overflow-visible"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className={`w-[280px] rounded-xl border-2 shadow-2xl p-3 text-xs transition-colors duration-200 select-none ${
            isDark
              ? 'bg-[#0b121e]/95 border-orange-500/70 text-slate-100 shadow-black/80'
              : 'bg-[#fffdfa] border-amber-800/80 text-amber-950 shadow-slate-400/50'
          }`}
          style={{
            boxShadow: isDark
              ? '0 12px 30px -4px rgba(0,0,0,0.8), 0 0 0 1px rgba(249,115,22,0.2)'
              : '0 12px 24px -4px rgba(180,83,9,0.2), 0 0 0 1px rgba(180,83,9,0.3)',
          }}
        >
          {/* CABEÇALHO CARTOGRÁFICO CLÁSSICO DE MAPA ESCOLAR/GEOGRÁFICO */}
          <div
            className={`pb-2 mb-2.5 border-b-2 flex items-center justify-between ${
              isDark ? 'border-orange-500/30' : 'border-amber-800/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shadow-xs ${
                  isDark ? 'bg-orange-600 text-white' : 'bg-amber-800 text-amber-50'
                }`}
              >
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className={`font-black tracking-widest text-xs uppercase font-mono leading-none ${
                    isDark ? 'text-orange-400' : 'text-amber-900'
                  }`}
                >
                  LEGENDA
                </h3>
                <span
                  className={`text-[9.5px] font-semibold tracking-tight uppercase ${
                    isDark ? 'text-slate-400' : 'text-amber-800/80'
                  }`}
                >
                  Convenções do Barracão
                </span>
              </div>
            </div>

            <span
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isDark
                  ? 'bg-slate-900 border border-slate-700 text-slate-300'
                  : 'bg-amber-100 border border-amber-300 text-amber-900'
              }`}
            >
              {zones.length} {zones.length === 1 ? 'Zona' : 'Zonas'}
            </span>
          </div>

          {/* LISTA DAS CORES DE CADA ZONA E SUAS MERCADORIAS */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-0.5 scrollbar-thin">
            {zones.length === 0 ? (
              <div
                className={`p-3 text-center rounded-lg border border-dashed ${
                  isDark
                    ? 'border-slate-800 bg-slate-900/40 text-slate-400'
                    : 'border-amber-300 bg-amber-50/60 text-amber-800'
                }`}
              >
                <Box className="w-5 h-5 mx-auto mb-1 opacity-50" />
                <p className="font-semibold text-[11px]">Nenhuma zona demarcada</p>
                <p className="text-[9.5px] opacity-75 mt-0.5">
                  Desenhe retângulos ou porta-paletes no mapa para gerar a legenda.
                </p>
              </div>
            ) : (
              zones.map((zone, idx) => {
                const isSelected = selectedId === zone.id;
                const zoneColor =
                  zone.color || (zone.type === 'rack' ? '#f97316' : '#d97706');
                const catDef = PRODUCT_CATEGORIES.find((c) => c.id === zone.category);
                const sizeDef = PRODUCT_SIZES.find((s) => s.id === zone.productSize);

                const wM = Math.round((zone.width / safeScaleRatio) * 10) / 10;
                const hM = Math.round((zone.height / safeScaleRatio) * 10) / 10;
                const areaM2 = Math.round(wM * hM);
                const posCount = zone.internalPositions?.length ?? 0;

                return (
                  <div
                    key={zone.id}
                    onClick={() => onSelectZone(zone)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer group select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-orange-950/60 border-orange-500 shadow-md ring-1 ring-orange-500'
                          : 'bg-amber-100/90 border-amber-700 shadow-md ring-1 ring-amber-700'
                        : isDark
                        ? 'bg-slate-900/70 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700'
                        : 'bg-white hover:bg-amber-50/80 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    {/* LINHA 1: AMOSTRA DA COR QUADRADA COM BORDA NITIDA, NOME DA ZONA E TIPO */}
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Amostra de cor clássica de mapa geográfico com borda preta sólida */}
                        <div
                          className="w-4 h-4 rounded-xs shrink-0 shadow-xs border border-black/80 flex items-center justify-center font-mono text-[8px] font-black text-white"
                          style={{ backgroundColor: zoneColor }}
                          title={`Cor: ${zoneColor}`}
                        >
                          {idx + 1}
                        </div>
                        <span
                          className={`font-bold text-xs truncate transition-colors ${
                            isSelected
                              ? isDark
                                ? 'text-orange-400'
                                : 'text-amber-900 font-extrabold'
                              : isDark
                              ? 'text-slate-100 group-hover:text-orange-300'
                              : 'text-slate-900 group-hover:text-amber-900'
                          }`}
                        >
                          {zone.name}
                        </span>
                      </div>

                      <span
                        className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded shrink-0 uppercase ${
                          isDark
                            ? 'bg-slate-950 text-slate-400 border border-slate-800'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {zone.type === 'rack' ? 'RACK' : 'ZONA'}
                      </span>
                    </div>

                    {/* LINHA 2: CARACTERÍSTICAS DE PRODUTOS / MERCADORIAS */}
                    <div className="pl-6 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Categoria do Produto */}
                        {catDef ? (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded border inline-flex items-center gap-1 leading-tight"
                            style={{
                              backgroundColor: `${catDef.color}20`,
                              borderColor: `${catDef.color}60`,
                              color: isDark ? catDef.color : '#78350f',
                            }}
                          >
                            <span>●</span>
                            <span className="truncate max-w-[130px]">{catDef.label}</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] italic ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Armazenagem Geral
                          </span>
                        )}

                        {/* Tamanho / Dimensão do Produto Padrão */}
                        {sizeDef && (
                          <span
                            className={`text-[8.5px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 ${
                              isDark
                                ? 'bg-slate-950 text-slate-300 border border-slate-800'
                                : 'bg-amber-50 text-amber-900 border border-amber-200'
                            }`}
                          >
                            <span>{sizeDef.icon}</span>
                            <span className="truncate max-w-[85px]">{sizeDef.short}</span>
                          </span>
                        )}
                      </div>

                      {/* Dimensões em metros e capacidade em posições */}
                      <div
                        className={`flex items-center justify-between text-[9px] font-mono pt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        <span>
                          {wM}m × {hM}m ({areaM2}m²)
                        </span>
                        <span className="font-semibold">
                          {posCount > 0 ? `${posCount} posições` : 'Vão livre'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* CONVENÇÕES DE INFRAESTRUTURA (SIMPLES, ESTILO MAPA) */}
          {(corridors.length > 0 || dividers.length > 0 || zones.some((z) => z.type === 'rack')) && (
            <div
              className={`mt-2.5 pt-2 border-t-2 text-[9.5px] font-mono ${
                isDark ? 'border-orange-500/20 text-slate-300' : 'border-amber-800/20 text-amber-950'
              }`}
            >
              <span
                className={`block font-bold uppercase tracking-wider text-[8.5px] mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-amber-800'
                }`}
              >
                INFRAESTRUTURA
              </span>

              <div className="grid grid-cols-1 gap-1">
                {corridors.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-1.5 border border-dashed border-sky-400 bg-sky-400/20 rounded-xs" />
                      <span>Rua / Corredor</span>
                    </div>
                    <span className="text-sky-400 font-bold">{corridors.length} vias</span>
                  </div>
                )}

                {zones.some((z) => z.type === 'rack') && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-1.5 border border-orange-500 bg-orange-500/30 rounded-xs flex items-center justify-center text-[6px] font-black text-orange-400">
                        ▤
                      </div>
                      <span>Porta-Paletes (Racks)</span>
                    </div>
                    <span className="text-orange-400 font-bold">
                      {zones.filter((z) => z.type === 'rack').length} un
                    </span>
                  </div>
                )}

                {dividers.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-0.5 bg-slate-400 rounded-full" />
                      <span>Parede / Divisória</span>
                    </div>
                    <span className="opacity-70 font-bold">{dividers.length} un</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RODAPÉ DO MAPA */}
          <div
            className={`mt-2 pt-1.5 border-t text-[8px] font-mono text-center uppercase tracking-wider ${
              isDark
                ? 'border-slate-800 text-slate-400'
                : 'border-amber-200 text-amber-800'
            }`}
          >
            Orientação: Norte ↑ · Escala 1m = {safeScaleRatio}px
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

/**
 * Botão flutuante + Card rápido de legenda
 * Sem divisão de menu (menu split), flutua sobre o canvas sem empurrar o layout.
 */
interface FloatingGeographicLegendProps {
  elements: DrawingElement[];
  selectedId: string | null;
  onSelectZone: (zone: DrawingElement) => void;
  scaleRatio: number;
  isDark: boolean;
  onFocusPerimeterLegend: () => void;
}

export function FloatingGeographicLegendButton({
  elements,
  selectedId,
  onSelectZone,
  scaleRatio,
  isDark,
  onFocusPerimeterLegend,
}: FloatingGeographicLegendProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const zones = useMemo(() => {
    return elements.filter((el) => el.type === 'rectangle' || el.type === 'rack');
  }, [elements]);

  return (
    <div className="relative select-none pointer-events-auto">
      {/* BOTÃO FLUTUANTE DE LEGENDA */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full border shadow-xl backdrop-blur-md transition-all cursor-pointer ${
          isOpen
            ? 'bg-orange-600 text-white border-orange-500 ring-2 ring-orange-500/40'
            : isDark
            ? 'bg-slate-900/95 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-orange-500'
            : 'bg-white/95 hover:bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500'
        }`}
        title="Abrir Legenda Rápida do Mapa"
      >
        <Compass className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-orange-500'}`} />
        <span className="text-xs font-bold font-mono">LEGENDA</span>
        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-black/30 font-bold">
          {zones.length}
        </span>
      </button>

      {/* POPUP FLUTUANTE (SEM SPLIT DE TELA) */}
      {isOpen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute bottom-full right-0 mb-2 w-72 max-h-[70vh] rounded-xl border-2 shadow-2xl p-3 z-50 flex flex-col select-none ${
            isDark
              ? 'bg-[#0b121e]/98 border-orange-500/80 text-slate-100 shadow-black/90'
              : 'bg-[#fffdfa]/98 border-amber-800 text-amber-950 shadow-slate-500/40'
          }`}
        >
          {/* TOPO DO POPUP */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-orange-500/30">
            <div className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-orange-500" />
              <span className="font-mono font-black text-xs uppercase tracking-wider text-orange-400">
                LEGENDA DO MAPA
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onFocusPerimeterLegend();
                  setIsOpen(false);
                }}
                className="p-1 rounded text-slate-400 hover:text-orange-400 hover:bg-slate-800 transition-colors"
                title="Enquadrar Legenda no Perímetro do Barracão"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* LISTA ROLÁVEL */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin max-h-[50vh]">
            {zones.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">Nenhuma zona desenhada</p>
            ) : (
              zones.map((zone, idx) => {
                const isSelected = selectedId === zone.id;
                const zoneColor =
                  zone.color || (zone.type === 'rack' ? '#f97316' : '#d97706');
                const catDef = PRODUCT_CATEGORIES.find((c) => c.id === zone.category);
                const sizeDef = PRODUCT_SIZES.find((s) => s.id === zone.productSize);
                const posCount = zone.internalPositions?.length ?? 0;

                return (
                  <div
                    key={zone.id}
                    onClick={() => {
                      onSelectZone(zone);
                      setIsOpen(false);
                    }}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-950/60 border-orange-500 shadow-md ring-1 ring-orange-500'
                        : isDark
                        ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-800'
                        : 'bg-white hover:bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3.5 h-3.5 rounded-xs shrink-0 border border-black/80 flex items-center justify-center font-mono text-[7px] font-black text-white"
                        style={{ backgroundColor: zoneColor }}
                      >
                        {idx + 1}
                      </div>
                      <span className="font-bold text-xs truncate flex-1">{zone.name}</span>
                      <span className="text-[8px] font-mono opacity-70">
                        {posCount > 0 ? `${posCount} pos` : 'Livre'}
                      </span>
                    </div>

                    <div className="pl-5 text-[9px] space-y-0.5">
                      {catDef && (
                        <div className="font-semibold truncate" style={{ color: catDef.color }}>
                          {catDef.label}
                        </div>
                      )}
                      {sizeDef && (
                        <div className="text-slate-400 font-mono text-[8.5px] truncate">
                          {sizeDef.icon} {sizeDef.label}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* BOTÃO PARA LOCALIZAR NO PERÍMETRO */}
          <button
            type="button"
            onClick={() => {
              onFocusPerimeterLegend();
              setIsOpen(false);
            }}
            className="mt-2.5 w-full py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-mono text-[10px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 shadow-md"
          >
            <Compass className="w-3 h-3" />
            <span>Focalizar no Mapa</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, type PointerEvent } from 'react';
import {
  MapPinned, ZoomIn, ZoomOut, Crosshair, ChevronDown, ChevronUp
} from 'lucide-react';
import type { DrawingElement } from '../editor-model';

export type MinimapProps = {
  elements: DrawingElement[];
  worldWidth: number;
  worldHeight: number;
  camera: { x: number; y: number; scale: number };
  canvasSize: { width: number; height: number };
  onNavigate: (worldX: number, worldY: number) => void;
  isDark?: boolean;
  highlightedPoint?: { x: number; y: number; name?: string } | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitPlan?: () => void;
  isDraggingCanvas?: boolean;
  areaName?: string;
  defaultCollapsed?: boolean;
};

export function Minimap({
  elements,
  worldWidth,
  worldHeight,
  camera,
  canvasSize,
  onNavigate,
  isDark = true,
  highlightedPoint,
  onZoomIn,
  onZoomOut,
  onFitPlan,
  isDraggingCanvas = false,
  defaultCollapsed = false,
}: MinimapProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const isInteractingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const safeW = Number.isFinite(worldWidth) && worldWidth > 0 ? worldWidth : 1700;
  const safeH = Number.isFinite(worldHeight) && worldHeight > 0 ? worldHeight : 1100;
  const safeScale = Number.isFinite(camera.scale) && camera.scale > 0 ? camera.scale : 1;
  const safeCamX = Number.isFinite(camera.x) ? camera.x : 0;
  const safeCamY = Number.isFinite(camera.y) ? camera.y : 0;

  // Dimensões compactas e proporcionais para fixação superior sem obstruir a tela
  const mapWidth = 184;
  const mapHeight = Math.max(45, Math.min(125, Math.round((mapWidth * safeH) / safeW)));
  const scaleFactor = mapWidth / safeW;

  // Viewport visível da câmera no espaço do mundo
  const viewportWorldLeft = -safeCamX / safeScale;
  const viewportWorldTop = -safeCamY / safeScale;
  const viewportWorldW = (canvasSize.width || 0) / safeScale;
  const viewportWorldH = (canvasSize.height || 0) / safeScale;

  // Retângulo do Viewport no Minimapa
  const miniViewX = viewportWorldLeft * scaleFactor;
  const miniViewY = viewportWorldTop * scaleFactor;
  const miniViewW = viewportWorldW * scaleFactor;
  const miniViewH = viewportWorldH * scaleFactor;

  // Centro do viewport no minimapa
  const viewCenterX = miniViewX + miniViewW / 2;
  const viewCenterY = miniViewY + miniViewH / 2;

  // Porcentagem de zoom calculada em tempo real
  const zoomPercent = Math.round(safeScale * 100);

  // Navegação interativa com suporte a clique e arrasto contínuo
  const navigateFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetWorldX = Math.max(0, Math.min(safeW, clickX / scaleFactor));
    const targetWorldY = Math.max(0, Math.min(safeH, clickY / scaleFactor));

    onNavigate(targetWorldX, targetWorldY);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    isInteractingRef.current = true;
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {}
    navigateFromPointer(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isInteractingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    navigateFromPointer(e);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // MODO RECOLHIDO: Pílula elegante e ultracompacta para não obstruir nada
  if (isCollapsed) {
    return (
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex items-center gap-1 p-1 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50'
            : 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-300/50'
        } ${isDraggingCanvas ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold hover:bg-slate-800/80 text-slate-200 transition-colors cursor-pointer"
          title="Expandir Minimapa"
        >
          <MapPinned className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="font-mono text-[11px] text-orange-400 font-bold">{zoomPercent}%</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {onFitPlan && (
          <button
            type="button"
            onClick={onFitPlan}
            className="p-1 rounded-lg hover:bg-slate-800/80 text-orange-400 transition-colors cursor-pointer"
            title="Ajustar à Tela"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        )}

        {onZoomIn && (
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded-lg hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Aproximar (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        )}

        {onZoomOut && (
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded-lg hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Afastar (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // MODO EXPANDIDO: Painel superior fixo com mapa interativo e controles integrados
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`flex flex-col rounded-xl border shadow-2xl backdrop-blur-md transition-all overflow-hidden ${
        isDark
          ? 'bg-slate-950/90 border-slate-700/80 shadow-black/60'
          : 'bg-white/95 border-slate-300 shadow-slate-400/25'
      } ${isDraggingCanvas ? 'opacity-35 pointer-events-none' : 'opacity-100 hover:opacity-100'}`}
      style={{ width: mapWidth + 12 }}
    >
      {/* Header Compacto com Ferramentas de Zoom & Controles */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/60 bg-slate-900/60 text-xs">
        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-300">
          <MapPinned className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="text-orange-400">{zoomPercent}%</span>
        </div>

        <div className="flex items-center gap-0.5">
          {onZoomIn && (
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Aproximar (+)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          )}
          {onZoomOut && (
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Afastar (-)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
          )}
          {onFitPlan && (
            <button
              type="button"
              onClick={onFitPlan}
              className="p-1 rounded-md text-orange-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Ajustar à Tela"
            >
              <Crosshair className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-0.5"
            title="Recolher Minimapa"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Canvas SVG do Minimapa Interativo com Suporte a Drag */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: mapWidth, height: mapHeight }}
        className="relative mx-auto my-1.5 rounded-lg overflow-hidden border border-slate-800/80 cursor-crosshair select-none"
        title="Arraste ou clique no minimapa para navegar no armazém"
      >
        <svg
          ref={svgRef}
          width={mapWidth}
          height={mapHeight}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Fundo do armazém */}
          <rect
            x={0}
            y={0}
            width={mapWidth}
            height={mapHeight}
            fill={isDark ? '#080d16' : '#f1f5f9'}
          />

          {/* Grade métrica sutil */}
          <line
            x1={mapWidth / 2}
            y1={0}
            x2={mapWidth / 2}
            y2={mapHeight}
            stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={mapHeight / 2}
            x2={mapWidth}
            y2={mapHeight / 2}
            stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
            strokeWidth={1}
          />

          {/* Elementos desenhados com suas cores reais */}
          {elements.map((item) => {
            const rawX = (Number.isFinite(item.x) ? item.x : 0) * scaleFactor;
            const rawY = (Number.isFinite(item.y) ? item.y : 0) * scaleFactor;
            const rawW = (Number.isFinite(item.width) ? item.width : 20) * scaleFactor;
            const rawH = (Number.isFinite(item.height) ? item.height : 20) * scaleFactor;

            const x = Number.isFinite(rawX) ? rawX : 0;
            const y = Number.isFinite(rawY) ? rawY : 0;
            const w = Number.isFinite(rawW) ? rawW : 2;
            const h = Number.isFinite(rawH) ? rawH : 2;
            const color = item.color || (item.type === 'rack' ? '#f97316' : '#d97706');

            if (item.type === 'divider') {
              return (
                <line
                  key={item.id}
                  x1={x}
                  y1={y}
                  x2={x + w}
                  y2={y + h}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="2 1"
                />
              );
            }

            if (item.type === 'corridor') {
              return (
                <rect
                  key={item.id}
                  x={x}
                  y={y}
                  width={Math.max(1.5, w)}
                  height={Math.max(1.5, h)}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.7}
                  strokeDasharray="2 1"
                  opacity={0.8}
                />
              );
            }

            return (
              <rect
                key={item.id}
                x={x}
                y={y}
                width={Math.max(1.5, w)}
                height={Math.max(1.5, h)}
                fill={color}
                opacity={item.type === 'rack' ? 0.9 : 0.7}
                rx={1}
              />
            );
          })}

          {/* Beacon Pulsante do Item Destacado da Busca */}
          {highlightedPoint && (
            <g>
              <circle
                cx={highlightedPoint.x * scaleFactor}
                cy={highlightedPoint.y * scaleFactor}
                r={6}
                fill="none"
                stroke="#f97316"
                strokeWidth={1.5}
                opacity="0.8"
              >
                <animate attributeName="r" from="2" to="10" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={highlightedPoint.x * scaleFactor}
                cy={highlightedPoint.y * scaleFactor}
                r={2.5}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth={0.8}
              />
            </g>
          )}

          {/* Retângulo do Viewport Visível (Acompanha navegação e zoom) */}
          <rect
            x={miniViewX}
            y={miniViewY}
            width={Math.max(3, miniViewW)}
            height={Math.max(3, miniViewH)}
            fill={isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(2, 132, 199, 0.15)'}
            stroke={isDark ? '#f97316' : '#0284c7'}
            strokeWidth={1.4}
            rx={1.5}
          />

          {/* Mira central do Viewport */}
          {miniViewW > 12 && miniViewH > 12 && (
            <g pointerEvents="none" opacity={0.65}>
              <line
                x1={viewCenterX - 3}
                y1={viewCenterY}
                x2={viewCenterX + 3}
                y2={viewCenterY}
                stroke={isDark ? '#f97316' : '#0284c7'}
                strokeWidth={1}
              />
              <line
                x1={viewCenterX}
                y1={viewCenterY - 3}
                x2={viewCenterX}
                y2={viewCenterY + 3}
                stroke={isDark ? '#f97316' : '#0284c7'}
                strokeWidth={1}
              />
            </g>
          )}
        </svg>

        {/* Dica de arraste discreta */}
        <div className="absolute bottom-0.5 right-1 pointer-events-none text-[7.5px] font-mono tracking-tighter uppercase text-slate-500 opacity-60">
          ARRASTE P/ NAVEGAR
        </div>
      </div>
    </div>
  );
}

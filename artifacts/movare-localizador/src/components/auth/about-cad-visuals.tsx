import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Magnet,
  Maximize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  getAreaBounds,
  PRODUCT_CATEGORIES,
  type DrawingElement,
  type FloorArea,
  type InternalPosition,
} from '../../editor-model';

export const SAMPLE_MOVARE_AREA: FloorArea = {
  id: 'demo-galpao-central',
  name: 'Galpão Central 01 (Demonstração)',
  scaleRatio: 20,
  widthMeters: 36,
  heightMeters: 22,
  elements: [
    {
      id: 'demo-corridor-a',
      type: 'corridor',
      name: 'Corredor Principal',
      corridorText: 'RUA A · LINHA BRANCA & EXPEDIÇÃO',
      color: '#38bdf8',
      x: 24,
      y: 206,
      width: 670,
      height: 36,
      fontSize: 12,
      fontWeight: 'bold',
    },
    {
      id: 'demo-divider-doca',
      type: 'divider',
      name: 'Divisória Docas',
      color: '#475569',
      x: 520,
      y: 26,
      width: 6,
      height: 172,
    },
    {
      id: 'demo-zona-geladeiras',
      type: 'rectangle',
      name: 'Zona A · Geladeiras',
      color: '#0284c7',
      category: 'refrigerators',
      productSize: 'refrigerators',
      x: 26,
      y: 34,
      width: 246,
      height: 158,
      internalPositions: [
        {
          id: 'pos-gel-01',
          code: 'GEL0001',
          relX: 8,
          relY: 10,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          sku: 'SKU-BRM56',
          description: 'Geladeira Frost Free 462L Inox',
          model: 'BRM56AK',
          supplier: 'Brastemp',
          volumesPerItem: 1,
          quantity: 10,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-gel-02',
          code: 'GEL0002',
          relX: 86,
          relY: 10,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          sku: 'SKU-DFX49',
          description: 'Geladeira Inverse 441L Frost Free',
          model: 'DFX49',
          supplier: 'Electrolux',
          volumesPerItem: 1,
          quantity: 8,
          unit: 'UN',
          status: 'reserved',
          reservedQuantity: 3,
          reservedStore: 'Loja Centro',
          reservedAt: '15/11/2026 09:40',
          reservedBy: 'Carlos (Assistência)',
        },
        {
          id: 'pos-gel-03',
          code: 'GEL0003',
          relX: 164,
          relY: 10,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          sku: 'SKU-CHA31',
          description: 'Freezer Horizontal 309L Dupla Ação',
          model: 'CHA31FB',
          supplier: 'Consul',
          volumesPerItem: 1,
          quantity: 6,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-gel-04',
          code: 'GEL0004',
          relX: 8,
          relY: 82,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          sku: 'SKU-CRE44',
          description: 'Refrigerador Duplex 386L Branco',
          model: 'CRE44AB',
          supplier: 'Consul',
          volumesPerItem: 1,
          quantity: 5,
          unit: 'UN',
          status: 'reserved',
          reservedQuantity: 5,
          reservedStore: 'Loja Norte',
          reservedAt: '15/11/2026 10:15',
          reservedBy: 'Marina (Assistência)',
        },
        {
          id: 'pos-gel-05',
          code: 'GEL0005',
          relX: 86,
          relY: 82,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          quantity: 0,
          unit: 'UN',
          status: 'empty',
        },
        {
          id: 'pos-gel-06',
          code: 'GEL0006',
          relX: 164,
          relY: 82,
          relWidth: 74,
          relHeight: 64,
          widthMeters: 1.5,
          depthMeters: 1.5,
          sku: 'SKU-TF56S',
          description: 'Geladeira Top Freezer 474L Prata',
          model: 'TF56S',
          supplier: 'Electrolux',
          volumesPerItem: 1,
          quantity: 4,
          unit: 'UN',
          status: 'occupied',
        },
      ],
    },
    {
      id: 'demo-zona-fogoes',
      type: 'rectangle',
      name: 'Zona B · Fogões & Micro',
      color: '#ea580c',
      category: 'stoves',
      productSize: 'stoves',
      x: 294,
      y: 34,
      width: 210,
      height: 158,
      internalPositions: [
        {
          id: 'pos-fog-01',
          code: 'FOG0001',
          relX: 8,
          relY: 10,
          relWidth: 94,
          relHeight: 64,
          widthMeters: 1.8,
          depthMeters: 1.5,
          sku: 'SKU-CFO4',
          description: 'Fogão 4 Bocas Acendimento Automático',
          model: 'CFO4NAR',
          supplier: 'Consul',
          volumesPerItem: 1,
          quantity: 12,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-fog-02',
          code: 'FOG0002',
          relX: 108,
          relY: 10,
          relWidth: 94,
          relHeight: 64,
          widthMeters: 1.8,
          depthMeters: 1.5,
          sku: 'SKU-BFS5',
          description: 'Fogão 5 Bocas Mesa de Vidro Inox',
          model: 'BFS5VCR',
          supplier: 'Brastemp',
          volumesPerItem: 1,
          quantity: 7,
          unit: 'UN',
          status: 'reserved',
          reservedQuantity: 2,
          reservedStore: 'Loja Filial 02',
          reservedAt: '15/11/2026 11:05',
          reservedBy: 'Carlos (Assistência)',
        },
        {
          id: 'pos-fog-03',
          code: 'MIC0001',
          relX: 8,
          relY: 82,
          relWidth: 94,
          relHeight: 64,
          widthMeters: 1.8,
          depthMeters: 1.5,
          sku: 'SKU-ME41',
          description: 'Micro-ondas 31L Espelhado Inox',
          model: 'ME41X',
          supplier: 'Electrolux',
          volumesPerItem: 1,
          quantity: 18,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-fog-04',
          code: 'FOG0003',
          relX: 108,
          relY: 82,
          relWidth: 94,
          relHeight: 64,
          widthMeters: 1.8,
          depthMeters: 1.5,
          quantity: 0,
          unit: 'UN',
          status: 'empty',
        },
      ],
    },
    {
      id: 'demo-zona-doca',
      type: 'rectangle',
      name: 'Zona E · Docas & Triagem',
      color: '#059669',
      category: 'docks',
      x: 540,
      y: 34,
      width: 154,
      height: 158,
      internalPositions: [
        {
          id: 'pos-doc-01',
          code: 'DOC0001',
          relX: 8,
          relY: 10,
          relWidth: 138,
          relHeight: 64,
          widthMeters: 3.2,
          depthMeters: 1.5,
          sku: 'EXP-ENT-14',
          description: 'Carga Separação Rota Centro',
          model: 'Expedição Manhã',
          supplier: 'Frota Movare',
          volumesPerItem: 1,
          quantity: 4,
          unit: 'PALETE',
          status: 'reserved',
          reservedQuantity: 4,
          reservedStore: 'Loja Centro',
          reservedAt: '15/11/2026 11:20',
          reservedBy: 'Conferência',
        },
        {
          id: 'pos-doc-02',
          code: 'DOC0002',
          relX: 8,
          relY: 82,
          relWidth: 138,
          relHeight: 64,
          widthMeters: 3.2,
          depthMeters: 1.5,
          quantity: 0,
          unit: 'PALETE',
          status: 'empty',
        },
      ],
    },
    {
      id: 'demo-zona-moveis',
      type: 'rectangle',
      name: 'Zona C · Móveis em Caixas',
      color: '#b45309',
      category: 'flat_pack_furniture',
      productSize: 'flat_pack_furniture',
      x: 26,
      y: 268,
      width: 320,
      height: 146,
      internalPositions: [
        {
          id: 'pos-mov-01',
          code: 'MOV0001',
          relX: 8,
          relY: 10,
          relWidth: 304,
          relHeight: 38,
          widthMeters: 6.4,
          depthMeters: 0.9,
          sku: 'SKU-GR6P',
          description: 'Guarda-Roupa Casal 6 Portas com Espelho',
          model: 'Dallas Plus',
          supplier: 'Santos Andirá',
          volumesPerItem: 3,
          quantity: 9,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-mov-02',
          code: 'MOV0002',
          relX: 8,
          relY: 54,
          relWidth: 304,
          relHeight: 38,
          widthMeters: 6.4,
          depthMeters: 0.9,
          sku: 'SKU-COZ8',
          description: 'Cozinha Compacta 8 Portas 2 Gavetas',
          model: 'Veneza',
          supplier: 'Itatiaia',
          volumesPerItem: 2,
          quantity: 6,
          unit: 'UN',
          status: 'reserved',
          reservedQuantity: 4,
          reservedStore: 'Loja Sul',
          reservedAt: '15/11/2026 08:50',
          reservedBy: 'Ana (Assistência)',
        },
        {
          id: 'pos-mov-03',
          code: 'MOV0003',
          relX: 8,
          relY: 98,
          relWidth: 304,
          relHeight: 38,
          widthMeters: 6.4,
          depthMeters: 0.9,
          quantity: 0,
          unit: 'UN',
          status: 'empty',
        },
      ],
    },
    {
      id: 'demo-zona-colchoes',
      type: 'rectangle',
      name: 'Zona D · Colchões & Estofados',
      color: '#7c3aed',
      category: 'double_mattress',
      productSize: 'double_mattress',
      x: 374,
      y: 268,
      width: 320,
      height: 146,
      internalPositions: [
        {
          id: 'pos-col-01',
          code: 'COL0001',
          relX: 8,
          relY: 10,
          relWidth: 146,
          relHeight: 60,
          widthMeters: 1.9,
          depthMeters: 1.4,
          sku: 'SKU-COL-Q',
          description: 'Colchão Queen Molas Ensacadas 158x198',
          model: 'Royal Sleep',
          supplier: 'Ortobom',
          volumesPerItem: 1,
          quantity: 11,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-sof-01',
          code: 'SOF0001',
          relX: 162,
          relY: 10,
          relWidth: 150,
          relHeight: 60,
          widthMeters: 2.2,
          depthMeters: 1.1,
          sku: 'SKU-SOF3',
          description: 'Sofá Retrátil 3 Lugares Linho Cinza',
          model: 'Confort 2,20m',
          supplier: 'Estofados Sul',
          volumesPerItem: 2,
          quantity: 5,
          unit: 'UN',
          status: 'occupied',
        },
        {
          id: 'pos-col-02',
          code: 'COL0002',
          relX: 8,
          relY: 76,
          relWidth: 146,
          relHeight: 60,
          widthMeters: 1.9,
          depthMeters: 1.4,
          quantity: 0,
          unit: 'UN',
          status: 'empty',
        },
        {
          id: 'pos-sof-02',
          code: 'SOF0002',
          relX: 162,
          relY: 76,
          relWidth: 150,
          relHeight: 60,
          widthMeters: 2.2,
          depthMeters: 1.1,
          quantity: 0,
          unit: 'UN',
          status: 'empty',
        },
      ],
    },
  ],
};

export type InteractiveMapViewportProps = {
  area: FloorArea;
  isDark: boolean;
  selectedPositionId: string | null;
  highlightedPositionIds: Set<string>;
  highlightedZoneIds?: Set<string>;
  focusTarget?: { x: number; y: number; zoom: number } | null;
  onSelectPosition: (zone: DrawingElement, pos: InternalPosition) => void;
};

export function InteractiveMapCADViewport({
  area,
  isDark,
  selectedPositionId,
  highlightedPositionIds,
  highlightedZoneIds,
  focusTarget,
  onSelectPosition,
}: InteractiveMapViewportProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const bounds = useMemo(() => getAreaBounds(area), [area]);
  const scaleRatio = area.scaleRatio || 20;

  // Calcula caixa delimitadora inteligente se o mapa carregado for muito grande
  const { vbX, vbY, vbW, vbH } = useMemo(() => {
    const padX = Math.max(32, Math.round(bounds.widthPx * 0.04));
    const padY = Math.max(36, Math.round(bounds.heightPx * 0.06));
    return {
      vbX: -padX,
      vbY: -padY,
      vbW: bounds.widthPx + padX * 2,
      vbH: bounds.heightPx + padY * 2,
    };
  }, [bounds.heightPx, bounds.widthPx]);

  useEffect(() => {
    if (!focusTarget) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const targetZoom = Math.max(1, Math.min(2.6, focusTarget.zoom));
    const worldCenterX = vbX + vbW / 2;
    const worldCenterY = vbY + vbH / 2;
    const dxPct = ((worldCenterX - focusTarget.x) / vbW) * 100 * targetZoom;
    const dyPct = ((worldCenterY - focusTarget.y) / vbH) * 100 * targetZoom;
    setZoom(targetZoom);
    setPan({ x: dxPct, y: dyPct });
  }, [focusTarget, vbH, vbW, vbX, vbY]);

  const metricTicksX = useMemo(() => {
    const stepM = bounds.widthMeters > 60 ? 10 : 5;
    const list: number[] = [];
    for (let m = 0; m <= bounds.widthMeters; m += stepM) list.push(m);
    return list;
  }, [bounds.widthMeters]);

  const metricTicksY = useMemo(() => {
    const stepM = bounds.heightMeters > 45 ? 10 : 5;
    const list: number[] = [];
    for (let m = 0; m <= bounds.heightMeters; m += stepM) list.push(m);
    return list;
  }, [bounds.heightMeters]);

  const gridId = `about-cad-grid-${area.id}`;

  return (
    <div
      className={`relative w-full h-[300px] sm:h-[340px] rounded-xl border overflow-hidden select-none ${
        isDark ? 'bg-[#070b12] border-slate-800' : 'bg-slate-50 border-slate-300'
      }`}
    >
      {/* Controles Flutuantes do Mapa CAD */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.8, Number((z + 0.3).toFixed(2))))}
          title="Aproximar zoom"
          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.3).toFixed(2))))}
          title="Afastar zoom"
          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Enquadrar galpão inteiro"
          className={`px-2 py-1 rounded-lg border text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Maximize2 className="w-3 h-3" />
          <span>Enquadrar</span>
        </button>
      </div>

      {/* Etiqueta de Escala no Canto Superior Esquerdo */}
      <div
        className={`absolute top-2.5 left-2.5 z-10 px-2 py-1 rounded-lg border text-[10px] font-mono tabular-nums pointer-events-none ${
          isDark
            ? 'bg-slate-950/90 border-slate-800 text-slate-300'
            : 'bg-white/95 border-slate-300 text-slate-700'
        }`}
      >
        {area.name} · {bounds.widthMeters}m × {bounds.heightMeters}m · 1m={scaleRatio}px
      </div>

      {/* Viewport Animado */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-demo-cell="true"]')) return;
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d?.active) return;
          const dx = ((e.clientX - d.startX) / 520) * 100;
          const dy = ((e.clientY - d.startY) / 320) * 100;
          setPan({ x: d.origX + dx, y: d.origY + dy });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          dragRef.current = null;
        }}
      >
        <div
          className="w-full h-full will-change-transform"
          style={{
            transform: `translate3d(${pan.x}%, ${pan.y}%, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragRef.current?.active
              ? 'none'
              : 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern
                id={`${gridId}-1m`}
                width={scaleRatio}
                height={scaleRatio}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${scaleRatio} 0 L 0 0 0 ${scaleRatio}`}
                  fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'}
                  strokeWidth={1}
                />
              </pattern>
              <pattern
                id={`${gridId}-5m`}
                width={scaleRatio * 5}
                height={scaleRatio * 5}
                patternUnits="userSpaceOnUse"
              >
                <rect width={scaleRatio * 5} height={scaleRatio * 5} fill={`url(#${gridId}-1m)`} />
                <path
                  d={`M ${scaleRatio * 5} 0 L 0 0 0 ${scaleRatio * 5}`}
                  fill="none"
                  stroke={isDark ? 'rgba(249,115,22,0.13)' : 'rgba(234,88,12,0.16)'}
                  strokeWidth={1.1}
                />
              </pattern>
            </defs>

            {/* Fundo do Armazém */}
            <rect
              x={0}
              y={0}
              width={bounds.widthPx}
              height={bounds.heightPx}
              fill={isDark ? '#0b111e' : '#ffffff'}
            />
            <rect
              x={0}
              y={0}
              width={bounds.widthPx}
              height={bounds.heightPx}
              fill={`url(#${gridId}-5m)`}
            />

            {/* Marca D'Água Movare Fiel ao Editor */}
            <image
              href="/movare-logo.png"
              x={bounds.widthPx * 0.1}
              y={bounds.heightPx * 0.1}
              width={bounds.widthPx * 0.8}
              height={bounds.heightPx * 0.8}
              preserveAspectRatio="xMidYMid meet"
              opacity={isDark ? 0.16 : 0.13}
              pointerEvents="none"
            />

            {/* Perímetro Tracejado Laranja + Réguas Métricas */}
            <rect
              x={0}
              y={0}
              width={bounds.widthPx}
              height={bounds.heightPx}
              fill="none"
              stroke={isDark ? '#f97316' : '#ea580c'}
              strokeWidth={2.2}
              strokeDasharray="9 5"
              pointerEvents="none"
            />

            {metricTicksX.map((m) => (
              <g key={`tx-${m}`} pointerEvents="none">
                <line
                  x1={m * scaleRatio}
                  y1={0}
                  x2={m * scaleRatio}
                  y2={-6}
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  strokeWidth={1}
                />
                <text
                  x={m * scaleRatio}
                  y={-9}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={isDark ? '#94a3b8' : '#64748b'}
                >
                  {m}m
                </text>
              </g>
            ))}

            {metricTicksY.map((m) => (
              <g key={`ty-${m}`} pointerEvents="none">
                <line
                  x1={0}
                  y1={m * scaleRatio}
                  x2={-6}
                  y2={m * scaleRatio}
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  strokeWidth={1}
                />
                <text
                  x={-8}
                  y={m * scaleRatio + 3}
                  textAnchor="end"
                  fontSize={8.5}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={isDark ? '#94a3b8' : '#64748b'}
                >
                  {m}m
                </text>
              </g>
            ))}

            {/* Elementos do Galpão (Corredores, Divisórias, Zonas & Células) */}
            {area.elements
              .filter((el) => !el.hidden)
              .map((el) => {
                const color = el.color || (el.type === 'rack' ? '#f97316' : '#d97706');

                if (el.type === 'corridor') {
                  const label = (el.corridorText || el.name || 'CORREDOR').toUpperCase();
                  const cx = el.x + el.width / 2;
                  const cy = el.y + el.height / 2;
                  return (
                    <g key={el.id} pointerEvents="none">
                      <rect
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        rx={3}
                        fill={isDark ? 'rgba(56,189,248,0.06)' : 'rgba(14,165,233,0.08)'}
                        stroke={isDark ? 'rgba(56,189,248,0.25)' : 'rgba(14,165,233,0.3)'}
                        strokeWidth={1}
                        strokeDasharray="6 4"
                      />
                      <text
                        x={cx}
                        y={cy + 4}
                        textAnchor="middle"
                        fontSize={Math.max(9, Math.min(13, el.fontSize || 11))}
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        letterSpacing={el.letterSpacing ?? 2}
                        fill={el.color === '#ffffff' && !isDark ? '#0284c7' : color}
                      >
                        {label}
                      </text>
                    </g>
                  );
                }

                if (el.type === 'divider') {
                  return (
                    <rect
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      width={Math.max(4, el.width)}
                      height={Math.max(4, el.height)}
                      rx={2}
                      fill={color}
                      pointerEvents="none"
                    />
                  );
                }

                const isZoneHighlighted = highlightedZoneIds?.has(el.id);
                const positions = el.internalPositions || [];
                const reservedCount = positions.filter((p) => p.status === 'reserved').length;
                const rawName = (el.name || 'Zona').trim();
                const resSuffix = reservedCount > 0 && el.width >= 110 ? ` · ${reservedCount} RES` : '';
                const maxChars = Math.max(6, Math.floor((el.width - 14 - resSuffix.length * 5.8) / 5.8));
                const clippedName =
                  rawName.length > maxChars ? `${rawName.slice(0, Math.max(3, maxChars - 1))}…` : rawName;
                const labelStr = `${clippedName}${resSuffix}`;
                const plateW = Math.min(Math.max(64, el.width), Math.max(54, labelStr.length * 5.8 + 14));
                const catDef = PRODUCT_CATEGORIES.find((c) => c.id === el.category);

                return (
                  <g key={el.id}>
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rx={4}
                      fill={`${color}22`}
                      stroke={isZoneHighlighted ? '#ef4444' : color}
                      strokeWidth={isZoneHighlighted ? 3 : 2}
                    />

                    {/* Células Internas Modulares */}
                    {positions.map((pos, idx) => {
                      const px = el.x + pos.relX;
                      const py = el.y + pos.relY;
                      const pw = pos.relWidth;
                      const ph = pos.relHeight;
                      const isSel = selectedPositionId === pos.id;
                      const isHl = highlightedPositionIds.has(pos.id);
                      const isRes = pos.status === 'reserved';
                      const isOcc = pos.status === 'occupied';

                      const fill = isHl
                        ? 'rgba(239,68,68,0.32)'
                        : isSel
                        ? 'rgba(56,189,248,0.28)'
                        : isRes
                        ? isDark
                          ? 'rgba(250,204,21,0.32)'
                          : 'rgba(250,204,21,0.42)'
                        : isOcc
                        ? 'rgba(34,197,94,0.22)'
                        : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(15,23,42,0.04)';

                      const stroke = isHl
                        ? '#ef4444'
                        : isSel
                        ? '#38bdf8'
                        : isRes
                        ? isDark
                          ? '#facc15'
                          : '#ca8a04'
                        : isOcc
                        ? '#22c55e'
                        : color;

                      return (
                        <g
                          key={`${el.id}-${pos.id}-${idx}`}
                          data-demo-cell="true"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPosition(el, pos);
                          }}
                        >
                          <rect
                            x={px}
                            y={py}
                            width={pw}
                            height={ph}
                            rx={2.5}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isHl ? 3 : isSel ? 2.4 : isRes ? 1.8 : 1}
                            strokeDasharray={pos.status === 'empty' && !isSel && !isHl ? '3 2' : undefined}
                            className={isHl ? 'movare-search-pulse' : undefined}
                          />

                          {/* Código da Posição */}
                          {pw >= 24 && ph >= 14 && (
                            <text
                              x={px + 4}
                              y={py + Math.min(13, Math.max(9, ph * 0.42))}
                              fontSize={Math.min(9.5, Math.max(7, ph * 0.28))}
                              fontFamily="'JetBrains Mono', monospace"
                              fontWeight="bold"
                              fill={
                                isSel
                                  ? '#38bdf8'
                                  : isOcc
                                  ? isDark
                                    ? '#4ade80'
                                    : '#15803d'
                                  : isRes
                                  ? isDark
                                    ? '#fef08a'
                                    : '#854d0e'
                                  : isDark
                                  ? '#94a3b8'
                                  : '#64748b'
                              }
                              pointerEvents="none"
                            >
                              {pos.code.slice(0, Math.max(3, Math.floor((pw - (isRes ? 28 : 8)) / 5.6)))}
                            </text>
                          )}

                          {/* Etiqueta RES */}
                          {isRes && pw >= 50 && ph >= 18 && (
                            <g transform={`translate(${px + pw - 25}, ${py + 3})`} pointerEvents="none">
                              <rect width={22} height={10} rx={2} fill="#eab308" />
                              <text
                                x={11}
                                y={7.5}
                                textAnchor="middle"
                                fontSize={6.2}
                                fontFamily="'JetBrains Mono', monospace"
                                fontWeight="900"
                                fill="#0f172a"
                              >
                                RES
                              </text>
                            </g>
                          )}

                          {/* Linha Secundária: Loja da Reserva ou SKU */}
                          {pos.status !== 'empty' && pw >= 38 && ph >= 28 && (() => {
                            const sub = isRes && pos.reservedStore
                              ? pos.reservedStore
                              : pos.sku || (pos.quantity ? `${pos.quantity} ${pos.unit || 'UN'}` : '');
                            if (!sub) return null;
                            const maxSub = Math.max(3, Math.floor((pw - 8) / 4.8));
                            const clippedSub =
                              sub.length > maxSub ? `${sub.slice(0, maxSub - 1)}…` : sub;
                            return (
                              <text
                                x={px + 4}
                                y={py + Math.min(ph - 5, 25)}
                                fontSize={7.3}
                                fontFamily="'JetBrains Mono', monospace"
                                fontWeight={isRes ? '700' : '500'}
                                fill={
                                  isRes
                                    ? isDark
                                      ? '#fde047'
                                      : '#854d0e'
                                    : isDark
                                    ? '#cbd5e1'
                                    : '#475569'
                                }
                                pointerEvents="none"
                              >
                                {clippedSub}
                              </text>
                            );
                          })()}

                          {/* Contorno Pulsante Extra quando Destacado na Busca */}
                          {isHl && (
                            <rect
                              x={px - 2}
                              y={py - 2}
                              width={pw + 4}
                              height={ph + 4}
                              rx={3.5}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={2.5}
                              className="movare-search-pulse"
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* Placa Limpa da Zona acima do Perímetro */}
                    {positions.length > 0 ? (
                      <g transform={`translate(${el.x}, ${el.y - 16})`} pointerEvents="none">
                        <rect
                          x={0}
                          y={0}
                          width={plateW}
                          height={14}
                          rx={3}
                          fill={
                            reservedCount > 0
                              ? isDark
                                ? 'rgba(66,32,6,0.96)'
                                : 'rgba(254,249,195,0.98)'
                              : isDark
                              ? 'rgba(15,23,42,0.95)'
                              : 'rgba(255,255,255,0.96)'
                          }
                          stroke={reservedCount > 0 ? '#eab308' : color}
                          strokeWidth={1}
                        />
                        <text
                          x={6}
                          y={10}
                          fontSize={8.5}
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          fill={
                            reservedCount > 0
                              ? isDark
                                ? '#fde047'
                                : '#854d0e'
                              : isDark
                              ? '#f8fafc'
                              : '#0f172a'
                          }
                        >
                          {labelStr}
                        </text>
                      </g>
                    ) : (
                      el.width >= 60 &&
                      el.height >= 36 && (
                        <g pointerEvents="none">
                          <text
                            x={el.x + 8}
                            y={el.y + 16}
                            fontSize={10}
                            fontWeight="bold"
                            fill={isDark ? '#f1f5f9' : '#1e293b'}
                          >
                            {clippedName}
                          </text>
                          {catDef && (
                            <text
                              x={el.x + 8}
                              y={el.y + 28}
                              fontSize={8}
                              fontWeight="600"
                              fill={catDef.color}
                            >
                              {catDef.badge}
                            </text>
                          )}
                        </g>
                      )
                    )}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Laboratório Animado & Arrastável de Física Anti-Sobreposição e Snap Métrico (100% PT-BR)
 */
export function InteractivePhysicsDemoSVG({ isDark }: { isDark: boolean }) {
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [movablePos, setMovablePos] = useState<{ x: number; y: number }>({ x: 280, y: 58 });
  const [isAnimating, setIsAnimating] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Zona fixa A (Geladeiras) em 20px = 1m
  const fixedA = { x: 40, y: 40, w: 120, h: 120, name: 'Zona Geladeiras (6m × 6m)' };
  const movableSize = { w: 100, h: 80 }; // 5m × 4m

  const resolveCoords = (rawX: number, rawY: number, usePhysics: boolean, useSnap: boolean) => {
    let nx = Math.max(10, Math.min(440 - movableSize.w, rawX));
    let ny = Math.max(24, Math.min(200 - movableSize.h, rawY));

    if (useSnap) {
      nx = Math.round(nx / 10) * 10; // snap 0.5m (10px)
      ny = Math.round(ny / 10) * 10;
    }

    if (usePhysics) {
      const overlapsX = nx < fixedA.x + fixedA.w && nx + movableSize.w > fixedA.x;
      const overlapsY = ny < fixedA.y + fixedA.h && ny + movableSize.h > fixedA.y;
      if (overlapsX && overlapsY) {
        const pushRight = fixedA.x + fixedA.w - nx;
        const pushLeft = nx + movableSize.w - fixedA.x;
        const pushDown = fixedA.y + fixedA.h - ny;
        const pushUp = ny + movableSize.h - fixedA.y;
        const minPush = Math.min(pushRight, pushLeft, pushDown, pushUp);
        if (minPush === pushRight) nx = fixedA.x + fixedA.w;
        else if (minPush === pushLeft) nx = fixedA.x - movableSize.w;
        else if (minPush === pushDown) ny = fixedA.y + fixedA.h;
        else ny = fixedA.y - movableSize.h;
      }
    }

    return { x: nx, y: ny };
  };

  const isTouching =
    Math.abs(movablePos.x - (fixedA.x + fixedA.w)) <= 1 &&
    movablePos.y < fixedA.y + fixedA.h &&
    movablePos.y + movableSize.h > fixedA.y;

  const isOverlapping =
    movablePos.x < fixedA.x + fixedA.w &&
    movablePos.x + movableSize.w > fixedA.x &&
    movablePos.y < fixedA.y + fixedA.h &&
    movablePos.y + movableSize.h > fixedA.y;

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handlePlayAnimation = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsAnimating(true);
    const start = performance.now();
    const duration = 2200;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Movimento contínuo tentando empurrar da direita para a esquerda e deslizando
      const rawX = 300 - t * 210;
      const rawY = 58 + Math.sin(t * Math.PI) * 28;
      setMovablePos(resolveCoords(rawX, rawY, physicsEnabled, snapEnabled));
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!dragOffsetRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 460;
    const svgY = ((clientY - rect.top) / rect.height) * 216;
    const targetX = svgX - dragOffsetRef.current.dx;
    const targetY = svgY - dragOffsetRef.current.dy;
    setMovablePos(resolveCoords(targetX, targetY, physicsEnabled, snapEnabled));
  };

  return (
    <div className="space-y-3">
      {/* Barra de Controles da Física */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !physicsEnabled;
              setPhysicsEnabled(next);
              setMovablePos((prev) => resolveCoords(prev.x, prev.y, next, snapEnabled));
            }}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              physicsEnabled
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/50 text-rose-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Física Anti-Sobreposição: {physicsEnabled ? 'Ativa' : 'Livre'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !snapEnabled;
              setSnapEnabled(next);
              setMovablePos((prev) => resolveCoords(prev.x, prev.y, physicsEnabled, next));
            }}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              snapEnabled
                ? isDark
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                  : 'bg-sky-50 border-sky-300 text-sky-800'
                : isDark
                ? 'bg-slate-900 border-slate-700 text-slate-400'
                : 'bg-white border-slate-300 text-slate-600'
            }`}
          >
            <Magnet className="w-3.5 h-3.5 shrink-0" />
            <span>Snap 0,5m: {snapEnabled ? 'Ligado' : 'Desligado'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isAnimating}
            onClick={handlePlayAnimation}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isAnimating ? 'Testando colisão...' : 'Animar Colisão'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              setIsAnimating(false);
              setMovablePos({ x: 280, y: 58 });
            }}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Reiniciar posição"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas SVG Interativo */}
      <div
        className={`relative rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#070b12] border-slate-800' : 'bg-white border-slate-300'
        }`}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 460 216"
          className="w-full h-56 sm:h-64 touch-none select-none"
          onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onPointerUp={() => {
            dragOffsetRef.current = null;
          }}
          onPointerLeave={() => {
            dragOffsetRef.current = null;
          }}
        >
          <defs>
            <pattern id="phys-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}
                strokeWidth="1"
              />
            </pattern>
            <pattern
              id="overlap-hatch"
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2.5" strokeOpacity="0.65" />
            </pattern>
          </defs>

          <rect width="460" height="216" fill="url(#phys-grid)" />
          <rect
            x="10"
            y="22"
            width="430"
            height="180"
            fill="none"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeDasharray="7 4"
          />

          {/* Régua superior em metros */}
          {[0, 5, 10, 15, 20].map((m) => (
            <text
              key={m}
              x={10 + m * 20}
              y={14}
              fontSize="8.5"
              fontFamily="'JetBrains Mono', monospace"
              fill={isDark ? '#94a3b8' : '#64748b'}
            >
              {m}m
            </text>
          ))}

          {/* Zona Fixa A */}
          <g>
            <rect
              x={fixedA.x}
              y={fixedA.y}
              width={fixedA.w}
              height={fixedA.h}
              rx={4}
              fill="rgba(2,132,199,0.18)"
              stroke="#0284c7"
              strokeWidth={2}
            />
            <rect
              x={fixedA.x}
              y={fixedA.y - 15}
              width={138}
              height={13}
              rx={2.5}
              fill={isDark ? '#0f172a' : '#ffffff'}
              stroke="#0284c7"
              strokeWidth={1}
            />
            <text
              x={fixedA.x + 5}
              y={fixedA.y - 6}
              fontSize="7.5"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="bold"
              fill={isDark ? '#f8fafc' : '#0f172a'}
            >
              ZONA GELADEIRAS (FIXA)
            </text>
            <text
              x={fixedA.x + fixedA.w / 2}
              y={fixedA.y + fixedA.h / 2}
              textAnchor="middle"
              fontSize="9"
              fontFamily="'JetBrains Mono', monospace"
              fill={isDark ? '#7dd3fc' : '#0369a1'}
            >
              6,0m × 6,0m
            </text>
          </g>

          {/* Zona Móvel B (Arrastável) */}
          <g
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              if (!svgRef.current) return;
              const rect = svgRef.current.getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * 460;
              const svgY = ((e.clientY - rect.top) / rect.height) * 216;
              dragOffsetRef.current = {
                dx: svgX - movablePos.x,
                dy: svgY - movablePos.y,
              };
            }}
          >
            <rect
              x={movablePos.x}
              y={movablePos.y}
              width={movableSize.w}
              height={movableSize.h}
              rx={4}
              fill={isOverlapping ? 'url(#overlap-hatch)' : 'rgba(180,83,9,0.22)'}
              stroke={isOverlapping ? '#ef4444' : isTouching ? '#f59e0b' : '#b45309'}
              strokeWidth={isTouching || isOverlapping ? 2.8 : 2}
            />
            <rect
              x={movablePos.x}
              y={movablePos.y - 15}
              width={116}
              height={13}
              rx={2.5}
              fill={isDark ? '#0f172a' : '#ffffff'}
              stroke={isOverlapping ? '#ef4444' : '#b45309'}
              strokeWidth={1}
            />
            <text
              x={movablePos.x + 5}
              y={movablePos.y - 6}
              fontSize="7.5"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="bold"
              fill={isDark ? '#f8fafc' : '#0f172a'}
            >
              ZONA MÓVEIS (ARRASTE)
            </text>
            <text
              x={movablePos.x + movableSize.w / 2}
              y={movablePos.y + movableSize.h / 2 - 2}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="bold"
              fill={isOverlapping ? '#ef4444' : isDark ? '#fcd34d' : '#92400e'}
            >
              5,0m × 4,0m
            </text>
            <text
              x={movablePos.x + movableSize.w / 2}
              y={movablePos.y + movableSize.h / 2 + 11}
              textAnchor="middle"
              fontSize="7"
              fontFamily="'JetBrains Mono', monospace"
              fill={isDark ? '#94a3b8' : '#64748b'}
            >
              X:{((movablePos.x - 10) / 20).toFixed(1)}m Y:{((movablePos.y - 22) / 20).toFixed(1)}m
            </text>
          </g>

          {/* Indicador Visual de Contato Físico na Borda */}
          {isTouching && (
            <g pointerEvents="none">
              <line
                x1={fixedA.x + fixedA.w}
                y1={Math.max(fixedA.y, movablePos.y)}
                x2={fixedA.x + fixedA.w}
                y2={Math.min(fixedA.y + fixedA.h, movablePos.y + movableSize.h)}
                stroke="#f59e0b"
                strokeWidth="4"
              />
              <rect
                x={fixedA.x + fixedA.w - 42}
                y={178}
                width={126}
                height={18}
                rx={4}
                fill="#f59e0b"
              />
              <text
                x={fixedA.x + fixedA.w + 21}
                y={190}
                textAnchor="middle"
                fontSize="8"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
                fill="#0f172a"
              >
                BLOQUEIO FÍSICO (0,0m)
              </text>
            </g>
          )}

          {isOverlapping && (
            <g pointerEvents="none">
              <rect x={140} y={178} width={165} height={18} rx={4} fill="#ef4444" />
              <text
                x={222}
                y={190}
                textAnchor="middle"
                fontSize="8"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
                fill="#ffffff"
              >
                ALERTA: ZONAS SOBREPOSTAS
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export type BlueprintId = 'scale-cad' | 'positions-search' | 'partial-reserve' | 'roles-cloud';

export function MovareBlueprintIllustration({
  id,
  isDark,
  compact = false,
}: {
  id: BlueprintId;
  isDark: boolean;
  compact?: boolean;
}) {
  const bg = isDark ? '#0b111e' : '#ffffff';
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
  const labelColor = isDark ? '#e2e8f0' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#475569';

  return (
    <svg
      viewBox="0 0 360 190"
      className={`w-full ${compact ? 'h-40 sm:h-44' : 'h-[62vh] max-h-[460px]'}`}
    >
      <rect width="360" height="190" fill={bg} />
      <defs>
        <pattern id={`bp-g-${id}`} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 18 0 L 0 0 0 18" fill="none" stroke={gridStroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="360" height="190" fill={`url(#bp-g-${id})`} />

      {id === 'scale-cad' && (
        <g>
          <rect
            x="16"
            y="18"
            width="328"
            height="156"
            fill="none"
            stroke="#f97316"
            strokeWidth="1.8"
            strokeDasharray="6 4"
          />
          <text x="180" y="13" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="#f97316" fontWeight="bold">
            LARGURA DO GALPÃO: 36m · ESCALA: 1m = 20px
          </text>

          {/* Zona Geladeiras */}
          <rect x="28" y="34" width="132" height="58" rx="3" fill="rgba(2,132,199,0.18)" stroke="#0284c7" strokeWidth="1.6" />
          <rect x="28" y="22" width="102" height="11" rx="2" fill={isDark ? '#0f172a' : '#fff'} stroke="#0284c7" strokeWidth="0.9" />
          <text x="33" y="30" fontSize="6.8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill={labelColor}>
            ZONA GELADEIRAS
          </text>
          <text x="94" y="66" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="#38bdf8" fontWeight="bold">
            12,0m × 6,0m
          </text>

          {/* Zona Fogões */}
          <rect x="178" y="34" width="154" height="58" rx="3" fill="rgba(234,88,12,0.18)" stroke="#ea580c" strokeWidth="1.6" />
          <rect x="178" y="22" width="96" height="11" rx="2" fill={isDark ? '#0f172a' : '#fff'} stroke="#ea580c" strokeWidth="0.9" />
          <text x="183" y="30" fontSize="6.8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill={labelColor}>
            ZONA FOGÕES
          </text>
          <text x="255" y="66" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="#fb923c" fontWeight="bold">
            14,0m × 6,0m
          </text>

          {/* Corredor Central */}
          <rect x="28" y="102" width="304" height="22" rx="2" fill="rgba(56,189,248,0.08)" stroke="#38bdf8" strokeDasharray="5 3" strokeWidth="1" />
          <text x="180" y="116" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#38bdf8">
            RUA A · CIRCULAÇÃO (3,0m LARGURA)
          </text>

          {/* Zona Móveis */}
          <rect x="28" y="132" width="304" height="32" rx="3" fill="rgba(180,83,9,0.18)" stroke="#b45309" strokeWidth="1.6" />
          <text x="180" y="151" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#f59e0b">
            ZONA MÓVEIS EM CAIXAS · BLOQUEIO FÍSICO ANTI-COLISÃO
          </text>
        </g>
      )}

      {id === 'positions-search' && (
        <g>
          {/* Barra Ctrl+K */}
          <rect x="24" y="14" width="312" height="22" rx="5" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1.2" />
          <text x="34" y="28" fontSize="8.5" fontFamily="'JetBrains Mono', monospace" fill={labelColor}>
            Buscar: "GEL0002" ou "SKU-DFX49" ou "Loja Centro"
          </text>
          <rect x="288" y="18" width="42" height="14" rx="3" fill="#dc2626" />
          <text x="309" y="27.5" textAnchor="middle" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#fff">
            CTRL+K
          </text>

          {/* Zona com Nome Acima */}
          <rect x="24" y="60" width="312" height="110" rx="4" fill="rgba(2,132,199,0.15)" stroke="#0284c7" strokeWidth="1.8" />
          <rect x="24" y="45" width="150" height="13" rx="2.5" fill={isDark ? '#0f172a' : '#fff'} stroke="#0284c7" strokeWidth="1" />
          <text x="30" y="54" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill={labelColor}>
            ZONA A · GELADEIRAS (SEM COBRIR CÓDIGOS)
          </text>

          {/* Célula Ocupada */}
          <rect x="34" y="70" width="90" height="90" rx="3" fill="rgba(34,197,94,0.22)" stroke="#22c55e" strokeWidth="1.6" />
          <text x="42" y="86" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#22c55e">
            GEL0001
          </text>
          <text x="42" y="102" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={labelColor}>
            SKU-BRM56
          </text>
          <text x="42" y="148" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill="#4ade80" fontWeight="bold">
            OCUPADO · 10 UN
          </text>

          {/* Célula Destacada na Busca */}
          <rect x="135" y="70" width="90" height="90" rx="3" fill="rgba(239,68,68,0.28)" stroke="#ef4444" strokeWidth="2.8" />
          <text x="143" y="86" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#fde047">
            GEL0002
          </text>
          <rect x="195" y="76" width="24" height="11" rx="2" fill="#eab308" />
          <text x="207" y="84" textAnchor="middle" fontSize="6.5" fontFamily="'JetBrains Mono', monospace" fontWeight="900" fill="#0f172a">
            RES
          </text>
          <text x="143" y="102" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={labelColor}>
            Loja Centro
          </text>
          <text x="143" y="148" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill="#f87171" fontWeight="bold">
            MIRA PULSANTE
          </text>

          {/* Célula Livre */}
          <rect x="236" y="70" width="90" height="90" rx="3" fill="rgba(148,163,184,0.08)" stroke="#64748b" strokeDasharray="4 2" strokeWidth="1.3" />
          <text x="244" y="86" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill={subColor}>
            GEL0003
          </text>
          <text x="244" y="148" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={subColor}>
            LIVRE · 0 UN
          </text>
        </g>
      )}

      {id === 'partial-reserve' && (
        <g>
          {/* Card Fiel de Produto */}
          <rect x="20" y="16" width="320" height="158" rx="8" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1.5" />
          <text x="34" y="36" fontSize="10" fontWeight="bold" fill={labelColor}>
            GEL0002 · Geladeira Inverse 441L
          </text>
          <text x="34" y="49" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={subColor}>
            Zona A · Geladeiras · SKU-DFX49 · Electrolux
          </text>

          {/* Barra Proporcional */}
          <text x="34" y="70" fontSize="8" fontWeight="bold" fill={labelColor}>
            EM ESTOQUE TOTAL: 8 UN (NÃO É SOBRESCRITO)
          </text>
          <rect x="34" y="78" width="292" height="18" rx="4" fill={isDark ? '#1e293b' : '#e2e8f0'} />
          <rect x="34" y="78" width="110" height="18" rx="4" fill="#eab308" />
          <rect x="146" y="78" width="180" height="18" rx="4" fill="#22c55e" />
          <text x="89" y="90" textAnchor="middle" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#0f172a">
            3 UN RESERVADO
          </text>
          <text x="236" y="90" textAnchor="middle" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fill="#052e16">
            5 UN DISPONÍVEL
          </text>

          {/* Caixa Auditável */}
          <rect x="34" y="108" width="292" height="54" rx="5" fill="rgba(234,179,8,0.12)" stroke="#eab308" strokeWidth="1.2" />
          <text x="44" y="124" fontSize="8" fontWeight="bold" fill={isDark ? '#fde047' : '#854d0e'}>
            REGISTRO COMPLETO DA RESERVA
          </text>
          <text x="44" y="138" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={labelColor}>
            Loja: Loja Centro · Qtd: 3 UN de 8 UN em estoque
          </text>
          <text x="44" y="152" fontSize="7.5" fontFamily="'JetBrains Mono', monospace" fill={subColor}>
            Data: 15/11/2026 09:40 · Responsável: Carlos (Assistência)
          </text>
        </g>
      )}

      {id === 'roles-cloud' && (
        <g>
          {/* Nuvem Central */}
          <rect x="115" y="14" width="130" height="34" rx="7" fill="rgba(14,165,233,0.16)" stroke="#0ea5e9" strokeWidth="1.6" />
          <text x="180" y="29" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
            NUVEM SUPABASE REALTIME
          </text>
          <text x="180" y="41" textAnchor="middle" fontSize="7" fontFamily="'JetBrains Mono', monospace" fill={subColor}>
            Cargos + Reservas + Mapa v42
          </text>

          {/* Linhas de conexão */}
          <path d="M 180 48 L 62 84 M 180 48 L 180 84 M 180 48 L 298 84" stroke="#38bdf8" strokeWidth="1.3" strokeDasharray="4 3" />

          {/* Admin */}
          <rect x="16" y="84" width="96" height="88" rx="6" fill={isDark ? '#0f172a' : '#f8fafc'} stroke="#10b981" strokeWidth="1.6" />
          <text x="64" y="102" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#10b981">
            ADMINISTRADOR
          </text>
          <text x="24" y="120" fontSize="7" fill={labelColor}>• Edita Mapa CAD</text>
          <text x="24" y="134" fontSize="7" fill={labelColor}>• Cria/Atribui Cargos</text>
          <text x="24" y="148" fontSize="7" fill={labelColor}>• Reserva &amp; Publica</text>

          {/* Assistência */}
          <rect x="132" y="84" width="96" height="88" rx="6" fill={isDark ? '#0f172a' : '#f8fafc'} stroke="#f59e0b" strokeWidth="1.6" />
          <text x="180" y="102" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#f59e0b">
            ASSISTÊNCIA
          </text>
          <text x="140" y="120" fontSize="7" fill={labelColor}>• Busca Completa</text>
          <text x="140" y="134" fontSize="7" fill={labelColor}>• Reserva por Loja</text>
          <text x="140" y="148" fontSize="7" fill={labelColor}>• Exporta PNG</text>

          {/* Conferente */}
          <rect x="248" y="84" width="96" height="88" rx="6" fill={isDark ? '#0f172a' : '#f8fafc'} stroke="#38bdf8" strokeWidth="1.6" />
          <text x="296" y="102" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
            CONFERENTE
          </text>
          <text x="256" y="120" fontSize="7" fill={labelColor}>• Painel de Docas</text>
          <text x="256" y="134" fontSize="7" fill={labelColor}>• Foco com Mira</text>
          <text x="256" y="148" fontSize="7" fill={labelColor}>• Modo Seguro</text>
        </g>
      )}
    </svg>
  );
}

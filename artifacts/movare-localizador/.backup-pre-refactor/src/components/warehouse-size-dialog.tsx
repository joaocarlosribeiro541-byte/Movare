import { useState } from 'react';
import { X, Maximize2, Check, ShieldCheck } from 'lucide-react';
import { DEFAULT_WIDTH_METERS, DEFAULT_HEIGHT_METERS } from '../editor-model';

type WarehouseSizeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  currentWidthMeters?: number;
  currentHeightMeters?: number;
  onSaveDimensions: (widthMeters: number, heightMeters: number, scaleElements?: boolean) => void;
  isDark?: boolean;
};

export function WarehouseSizeDialog({
  isOpen,
  onClose,
  currentWidthMeters = DEFAULT_WIDTH_METERS,
  currentHeightMeters = DEFAULT_HEIGHT_METERS,
  onSaveDimensions,
  isDark = true,
}: WarehouseSizeDialogProps) {
  const [widthM, setWidthM] = useState(currentWidthMeters);
  const [heightM, setHeightM] = useState(currentHeightMeters);
  const [scaleElements, setScaleElements] = useState(true);

  if (!isOpen) return null;

  const totalAreaM2 = (widthM * heightM).toLocaleString('pt-BR');

  const presets = [
    { label: 'Compacto', w: 50, h: 30, desc: '1.500 m² (Pequeno porte / almoxarifado)' },
    { label: 'Padrão', w: 80, h: 50, desc: '4.000 m² (Galpão logístico médio)' },
    { label: 'Amplo', w: 120, h: 70, desc: '8.400 m² (Centro de distribuição)' },
    { label: 'Mega CD', w: 160, h: 100, desc: '16.000 m² (Grande operador logístico)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl p-5 sm:p-6 ${
          isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Dimensão Total do Galpão</h3>
              <p className="text-xs text-slate-400">Amplie ou reduza a área do armazém em metros</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 space-y-4">
          {/* Largura (Eixo X) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Largura do Galpão (Metros)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWidthM((v) => Math.max(20, v - 5))}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
              >
                -5
              </button>
              <input
                type="number"
                min={20}
                max={300}
                value={widthM}
                onChange={(e) => setWidthM(Math.max(20, parseInt(e.target.value) || 20))}
                className="flex-1 px-3 py-2 text-center text-sm font-mono font-bold rounded-lg border border-slate-700 bg-slate-950 text-orange-400 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setWidthM((v) => Math.min(300, v + 5))}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
              >
                +5
              </button>
            </div>
          </div>

          {/* Comprimento (Eixo Y) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Comprimento do Galpão (Metros)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHeightM((v) => Math.max(20, v - 5))}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
              >
                -5
              </button>
              <input
                type="number"
                min={20}
                max={300}
                value={heightM}
                onChange={(e) => setHeightM(Math.max(20, parseInt(e.target.value) || 20))}
                className="flex-1 px-3 py-2 text-center text-sm font-mono font-bold rounded-lg border border-slate-700 bg-slate-950 text-orange-400 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setHeightM((v) => Math.min(300, v + 5))}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
              >
                +5
              </button>
            </div>
          </div>

          {/* Presets Rápidos */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tamanhos Padrão de Mercado</label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setWidthM(p.w);
                    setHeightM(p.h);
                  }}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    widthM === p.w && heightM === p.h
                      ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                      : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <strong className="block text-slate-100">{p.label} ({p.w}m × {p.h}m)</strong>
                  <span className="text-[10px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resumo da Área Calculada */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Área de Armazenagem Resultante</span>
            <div className="flex items-center justify-between font-mono text-sm font-bold text-slate-100 mt-1">
              <span>{widthM}m × {heightM}m</span>
              <span className="text-orange-400">{totalAreaM2} m²</span>
            </div>
          </div>

          {/* Opção de Preservação Proporcional das Zonas */}
          <div
            onClick={() => setScaleElements((prev) => !prev)}
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              scaleElements
                ? 'border-orange-500/60 bg-orange-950/20 text-orange-200'
                : 'border-slate-800 bg-slate-950/60 text-slate-400'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={scaleElements}
                onChange={(e) => setScaleElements(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>Ajustar zonas proporcionalmente sem deformar</span>
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  As zonas diminuem proporcionalmente mantendo suas posições relativas e a quantidade total de produtos intacta, sem alterar o formato ou proporção das estruturas.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveDimensions(widthM, heightM, scaleElements);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Redimensionar Galpão</span>
          </button>
        </div>
      </div>
    </div>
  );
}

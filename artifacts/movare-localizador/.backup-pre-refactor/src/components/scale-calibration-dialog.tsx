import { useState } from 'react';
import { X, Ruler, Check } from 'lucide-react';
import { WORLD_WIDTH, WORLD_HEIGHT, DEFAULT_SCALE_RATIO } from '../editor-model';

type ScaleCalibrationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  currentScaleRatio: number;
  onSaveScaleRatio: (ratio: number) => void;
  isDark?: boolean;
};

export function ScaleCalibrationDialog({
  isOpen,
  onClose,
  currentScaleRatio = DEFAULT_SCALE_RATIO,
  onSaveScaleRatio,
  isDark = true,
}: ScaleCalibrationDialogProps) {
  const [ratio, setRatio] = useState(currentScaleRatio);

  if (!isOpen) return null;

  const widthM = (WORLD_WIDTH / ratio).toFixed(1);
  const heightM = (WORLD_HEIGHT / ratio).toFixed(1);
  const areaM2 = (Number(widthM) * Number(heightM)).toLocaleString('pt-BR');

  const presets = [
    { label: 'CD Gigante (140m × 90m)', ratio: 10, desc: '1m = 10 pixels' },
    { label: 'Armazém Padrão (70m × 45m)', ratio: 20, desc: '1m = 20 pixels (Recomendado)' },
    { label: 'Galpão Médio (46m × 30m)', ratio: 30, desc: '1m = 30 pixels' },
    { label: 'Depósito Compacto (35m × 22m)', ratio: 40, desc: '1m = 40 pixels' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        className={`w-full max-w-md rounded-xl border shadow-2xl p-6 transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/15 text-orange-500">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Calibração de Escala Métrica</h3>
              <p className="text-xs text-slate-400">Defina as proporções reais do armazém</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Fator de Escala (Pixels por Metro)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={100}
                value={ratio}
                onChange={(e) => setRatio(Math.max(5, parseInt(e.target.value) || 20))}
                className={`w-32 px-3 py-2 text-sm font-mono font-bold rounded-lg border ${
                  isDark ? 'bg-slate-950 border-slate-700 text-orange-400' : 'bg-slate-50 border-slate-300 text-orange-600'
                }`}
              />
              <span className="text-xs text-slate-400">pixels equivalem a 1 metro real</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Configurações Típicas</label>
            <div className="space-y-1.5">
              {presets.map((p) => (
                <button
                  key={p.ratio}
                  type="button"
                  onClick={() => setRatio(p.ratio)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                    ratio === p.ratio
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                      : isDark
                      ? 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div>
                    <strong className="block font-medium">{p.label}</strong>
                    <span className="text-[10px] text-slate-400">{p.desc}</span>
                  </div>
                  {ratio === p.ratio && <Check className="w-4 h-4 text-orange-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo da Área Total */}
          <div
            className={`p-3.5 rounded-lg border text-xs ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Dimensão Total da Planta</span>
            <div className="font-mono text-sm font-bold text-slate-100 flex items-center justify-between">
              <span>{widthM}m × {heightM}m</span>
              <span className="text-orange-400 font-semibold">{areaM2} m²</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveScaleRatio(ratio);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-all shadow-md shadow-orange-950/40"
          >
            Aplicar Escala
          </button>
        </div>
      </div>
    </div>
  );
}

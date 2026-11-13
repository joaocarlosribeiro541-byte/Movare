import { useState } from 'react';
import { CloudUpload, ArrowDownToLine, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { LocalExistingDataInspection } from '../../local-store';

type MigrationDialogProps = {
  isOpen: boolean;
  isDark: boolean;
  candidate: LocalExistingDataInspection | null;
  busy: boolean;
  onExportLocalJson: () => void;
  onConfirmMigrate: () => Promise<{ ok: boolean; error?: string }>;
  onStartClean: () => Promise<{ ok: boolean; error?: string }>;
  onDismiss: () => void;
};

export function MigrationDialog({
  isOpen,
  isDark,
  candidate,
  busy,
  onExportLocalJson,
  onConfirmMigrate,
  onStartClean,
  onDismiss,
}: MigrationDialogProps) {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !candidate || !candidate.found) return null;

  const handleMigrate = async () => {
    setError(null);
    const res = await onConfirmMigrate();
    if (!res.ok) {
      setError(res.error || 'Falha ao enviar mapa local para a nuvem.');
    }
  };

  const handleStartClean = async () => {
    setError(null);
    const res = await onStartClean();
    if (!res.ok) {
      setError(res.error || 'Falha ao inicializar mapa limpo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold">
              Migrar Mapa Local para a Nuvem Central
            </h3>
            <p className="text-[11px] text-slate-400">
              O banco Supabase ainda está vazio, mas encontramos um mapa salvo neste dispositivo.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Galpões</div>
              <div className="text-base font-mono font-bold text-orange-400">
                {candidate.summary.areasCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Elementos</div>
              <div className="text-base font-mono font-bold text-slate-100">
                {candidate.summary.elementsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Posições</div>
              <div className="text-base font-mono font-bold text-sky-400">
                {candidate.summary.totalPositions}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Ocupadas</div>
              <div className="text-base font-mono font-bold text-emerald-400">
                {candidate.summary.occupiedPositions}
              </div>
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Ao confirmar, todas as áreas, zonas, corredores, produtos, códigos WMS, camadas e dimensões serão publicados como a{' '}
            <strong className="text-orange-400">Versão 1 centralizada</strong> para todos os celulares e computadores.
          </p>

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleMigrate()}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              <span>Publicar Mapa Local na Nuvem (v1)</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onExportLocalJson}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                <span>Baixar Backup JSON Antes</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleStartClean()}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Iniciar Mapa Central Limpo</span>
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              className="w-full py-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Decidir depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

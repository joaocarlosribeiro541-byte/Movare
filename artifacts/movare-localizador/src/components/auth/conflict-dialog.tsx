import { useState } from 'react';
import { AlertTriangle, RefreshCw, ArrowDownToLine, UploadCloud, Loader2, X } from 'lucide-react';
import type { MapConflictState } from '../../hooks/use-shared-map';

type ConflictDialogProps = {
  conflict: MapConflictState | null;
  isDark: boolean;
  onExportLocalDraft: () => void;
  onReloadRemote: () => Promise<void>;
  onPublishLocalDraft: () => Promise<{ ok: boolean; error?: string }>;
  onDismiss?: () => void;
};

export function ConflictDialog({
  conflict,
  isDark,
  onExportLocalDraft,
  onReloadRemote,
  onPublishLocalDraft,
  onDismiss,
}: ConflictDialogProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!conflict) return null;

  const remote = conflict.remoteRecord;
  const formattedTime = remote?.updated_at
    ? new Date(remote.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={() => {
        if (!busy) onDismiss?.();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-amber-500/50 text-slate-100 shadow-black/80'
            : 'bg-white border-amber-400 text-slate-900'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-300">
                Nova Versão Encontrada na Nuvem
              </h3>
              <p className="text-[11px] text-slate-300">
                Suas edições locais permanecem preservadas. Escolha como prosseguir.
              </p>
            </div>
          </div>

          {onDismiss && (
            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
              title="Continuar editando localmente"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            {conflict.error}
          </p>

          {remote && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Versão mais recente na nuvem:</span>
                <span className="font-mono font-bold text-orange-400">v{remote.version}</span>
              </div>
              {remote.updated_by_email && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Atualizado por:</span>
                  <span className="font-mono text-slate-200">{remote.updated_by_email}</span>
                </div>
              )}
              {formattedTime && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Horário:</span>
                  <span className="font-mono text-slate-300">{formattedTime}</span>
                </div>
              )}
            </div>
          )}

          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300">
              {actionError}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setActionError(null);
                try {
                  const res = await onPublishLocalDraft();
                  if (!res.ok) setActionError(res.error || 'Falha ao publicar alterações.');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>Publicar Minhas Alterações na Nuvem</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError(null);
                  try {
                    await onReloadRemote();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Descartar e Baixar {remote ? `v${remote.version}` : 'Nuvem'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onExportLocalDraft}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Exportar Rascunho JSON</span>
              </button>
            </div>

            {onDismiss && (
              <button
                type="button"
                disabled={busy}
                onClick={onDismiss}
                className="w-full py-2 px-3 rounded-xl bg-transparent hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
              >
                Continuar editando localmente sem publicar agora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  X, ShieldCheck, Eye, Cloud, CloudOff, RefreshCw,
  LogOut, LogIn, ArrowDownToLine, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '../../lib/auth';
import type { RealtimeConnectionStatus } from '../../lib/map-service';
import type { CloudSyncStatus } from '../../hooks/use-shared-map';

type AdminPanelDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  isConfigured: boolean;
  configError: string | null;
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  connectionStatus: RealtimeConnectionStatus;
  syncStatus: CloudSyncStatus;
  syncError: string | null;
  mapVersion: number | null;
  lastUpdatedAt: string | null;
  lastUpdatedByEmail: string | null;
  hasUnsavedChanges: boolean;
  onOpenLogin: () => void;
  onLogout: () => Promise<unknown>;
  onForceSyncNow: () => Promise<void>;
  onReloadFromCloud: () => Promise<void>;
  onExportBackup: () => void;
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Ainda não sincronizado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export function AdminPanelDialog({
  isOpen,
  onClose,
  isDark,
  isConfigured,
  configError,
  user,
  isAdmin,
  connectionStatus,
  syncStatus,
  syncError,
  mapVersion,
  lastUpdatedAt,
  lastUpdatedByEmail,
  hasUnsavedChanges,
  onOpenLogin,
  onLogout,
  onForceSyncNow,
  onReloadFromCloud,
  onExportBackup,
}: AdminPanelDialogProps) {
  if (!isOpen) return null;

  const connLabel =
    connectionStatus === 'connected'
      ? 'Conectado em Tempo Real'
      : connectionStatus === 'connecting'
      ? 'Conectando...'
      : connectionStatus === 'unconfigured'
      ? 'Nuvem Não Configurada'
      : 'Desconectado';

  const syncLabel =
    syncStatus === 'saved'
      ? 'Sincronizado com Nuvem'
      : syncStatus === 'syncing'
      ? 'Sincronizando alterações...'
      : syncStatus === 'loading'
      ? 'Carregando mapa central...'
      : syncStatus === 'conflict'
      ? 'Conflito de Versão Pendente'
      : syncStatus === 'error'
      ? 'Erro na Sincronização'
      : syncStatus === 'unconfigured'
      ? 'Modo Local Auxiliar (Sem Supabase)'
      : 'Pronto';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
      >
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isAdmin
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Central de Acesso & Nuvem</h3>
              <p className="text-[11px] text-slate-400">
                Sincronização Multi-Dispositivo · Movare WMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Bloco de Identidade & Permissão */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Nível de Acesso Atual</span>
              <span
                className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] border ${
                  isAdmin
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-sky-500/15 text-sky-400 border-sky-500/40'
                }`}
              >
                {isAdmin ? 'ADMINISTRADOR (EDIÇÃO)' : 'VISITANTE (LEITURA)'}
              </span>
            </div>

            {user ? (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
                <span className="text-slate-400">Usuário autenticado</span>
                <span className="font-mono font-semibold text-slate-200 truncate max-w-[210px]">
                  {user.email}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/70">
                Visualização pública ativa. Visitantes podem pesquisar produtos, medir e exportar relatórios, sem alterar o mapa central.
              </p>
            )}
          </div>

          {/* Bloco de Conexão e Versão */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                {connectionStatus === 'connected' ? (
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Realtime</span>
              </span>
              <span
                className={`font-semibold ${
                  connectionStatus === 'connected'
                    ? 'text-emerald-400'
                    : connectionStatus === 'unconfigured'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {connLabel}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Estado</span>
              </span>
              <span className="font-medium text-slate-200">{syncLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Versão do Mapa Central</span>
              <span className="font-mono font-bold text-orange-400">
                {mapVersion && mapVersion > 0 ? `v${mapVersion}` : 'Não inicializado'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Última atualização</span>
              </span>
              <span className="font-mono text-[11px] text-slate-300">
                {formatTimestamp(lastUpdatedAt)}
              </span>
            </div>

            {lastUpdatedByEmail && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Responsável</span>
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-[200px]">
                  {lastUpdatedByEmail}
                </span>
              </div>
            )}
          </div>

          {!isConfigured && configError && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{configError}</span>
            </div>
          )}

          {syncError && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{syncError}</span>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-2 pt-1">
            {isAdmin && isConfigured && (
              <button
                type="button"
                onClick={() => void onForceSyncNow()}
                className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {hasUnsavedChanges ? 'Sincronizar Alterações Pendentes' : 'Forçar Sincronização Agora'}
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {isConfigured && (
                <button
                  type="button"
                  onClick={() => void onReloadFromCloud()}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Recarregar Nuvem</span>
                </button>
              )}

              <button
                type="button"
                onClick={onExportBackup}
                className={`py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isConfigured ? 'col-span-2' : ''
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                <span>Backup JSON</span>
              </button>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  void onLogout().then(() => onClose());
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair e Voltar ao Modo Visitante</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Fazer Login como Administrador</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

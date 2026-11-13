import { useState, type FormEvent } from 'react';
import {
  X, ShieldCheck, Mail, Lock, Loader2, ArrowLeft,
  KeyRound, CheckCircle2, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import type { UserRole } from '../../lib/auth';

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
  configError: string | null;
  isDark: boolean;
  passwordRecoveryPending: boolean;
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; role: UserRole; error?: string }>;
  onRequestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  onCompletePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onClearPasswordRecovery: () => void;
};

export function AuthDialog({
  isOpen,
  onClose,
  isConfigured,
  configError,
  isDark,
  passwordRecoveryPending,
  onLogin,
  onRequestPasswordReset,
  onCompletePasswordRecovery,
  onClearPasswordRecovery,
}: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'recovery'>(
    passwordRecoveryPending ? 'recovery' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isOpen && !passwordRecoveryPending) return null;

  const activeMode = passwordRecoveryPending ? 'recovery' : mode;

  const handleSubmitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await onLogin(email, password);
      if (!res.ok) {
        setErrorMsg(res.error || 'Falha ao autenticar.');
        return;
      }
      if (res.role !== 'admin') {
        setErrorMsg(
          'Conta autenticada sem privilégios administrativos. Seu acesso permanece em modo visitante (somente leitura).'
        );
        return;
      }
      setPassword('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await onRequestPasswordReset(email);
      if (!res.ok) {
        setErrorMsg(res.error || 'Não foi possível enviar o e-mail de recuperação.');
        return;
      }
      setInfoMsg(
        'Se o e-mail estiver cadastrado como administrador, você receberá um link de redefinição de senha em instantes.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await onCompletePasswordRecovery(newPassword);
      if (!res.ok) {
        setErrorMsg(res.error || 'Não foi possível atualizar a senha.');
        return;
      }
      setNewPassword('');
      setMode('login');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleReturnPublic = () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setMode('login');
    if (passwordRecoveryPending) onClearPasswordRecovery();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={handleReturnPublic}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
      >
        {/* Cabeçalho */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              {activeMode === 'login' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight">
                {activeMode === 'recovery'
                  ? 'Definir Nova Senha'
                  : activeMode === 'forgot'
                  ? 'Recuperar Acesso Admin'
                  : 'Acesso Administrativo'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Movare Localizador · Mapa Central Sincronizado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReturnPublic}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar e voltar ao mapa público"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!isConfigured && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block font-semibold">Supabase ainda não configurado</strong>
                <span className="text-[11px] opacity-90 block">
                  {configError ||
                    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para habilitar autenticação e nuvem centralizada.'}
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {activeMode === 'login' && (
            <form onSubmit={handleSubmitLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  E-mail do Administrador
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isConfigured || loading}
                    placeholder="admin@empresa.com.br"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:border-orange-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!isConfigured || loading}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-10 py-2 text-sm rounded-xl border focus:outline-none focus:border-orange-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2 p-0.5 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setMode('forgot');
                  }}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
                >
                  Esqueci minha senha
                </button>
                <span className="text-[10px] text-slate-500 font-mono">RLS Protegido</span>
              </div>

              <button
                type="submit"
                disabled={!isConfigured || loading}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando credenciais...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Entrar como Administrador</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeMode === 'forgot' && (
            <form onSubmit={handleSubmitForgot} className="space-y-3.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                Informe seu e-mail administrativo cadastrado no Supabase para receber o link de redefinição de senha.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isConfigured || loading}
                    placeholder="admin@empresa.com.br"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:border-orange-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setMode('login');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Voltar ao Login
                </button>
                <button
                  type="submit"
                  disabled={!isConfigured || loading}
                  className="flex-1 py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enviar Link de Recuperação</span>
                </button>
              </div>
            </form>
          )}

          {activeMode === 'recovery' && (
            <form onSubmit={handleSubmitRecovery} className="space-y-3.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                Link de recuperação validado. Digite abaixo a sua nova senha de acesso administrativo.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Nova senha segura"
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:border-orange-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Atualizar Senha</span>
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleReturnPublic}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar à Visualização Pública</span>
            </button>
            <span className="text-[10px] text-slate-500">Sem cadastro admin público</span>
          </div>
        </div>
      </div>
    </div>
  );
}

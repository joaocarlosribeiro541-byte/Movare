import { useState } from 'react';
import {
  Check,
  Info,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import type { FloorArea } from '../../editor-model';
import type { AuthSignUpResult, UserRole } from '../../lib/auth';
import { AuthCard } from './auth-dialog';
import { AboutAppTab } from './about-app-tab';

type MovareLoginScreenProps = {
  isDark: boolean;
  onToggleTheme: () => void;
  isConfigured: boolean;
  configError: string | null;
  passwordRecoveryPending: boolean;
  areas?: FloorArea[];
  activeAreaId?: string;
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; role: UserRole; error?: string }>;
  onSignUp?: (email: string, password: string, fullName?: string) => Promise<AuthSignUpResult>;
  onSignedUpCommonUser?: (needsEmailConfirmation: boolean) => void;
  onRequestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  onCompletePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onClearPasswordRecovery: () => void;
  onEnterAsVisitor: () => void;
  onAuthenticatedSuccess: () => void;
};

export function MovareLoginScreen({
  isDark,
  onToggleTheme,
  isConfigured,
  configError,
  passwordRecoveryPending,
  areas,
  activeAreaId,
  onLogin,
  onSignUp,
  onSignedUpCommonUser,
  onRequestPasswordReset,
  onCompletePasswordRecovery,
  onClearPasswordRecovery,
  onEnterAsVisitor,
  onAuthenticatedSuccess,
}: MovareLoginScreenProps) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      className={`fixed inset-0 z-[90] flex flex-col overflow-y-auto transition-colors duration-200 ${
        isDark ? 'bg-[#070a10] text-slate-100' : 'bg-[#f6f5f0] text-slate-900'
      }`}
    >
      {/* Malha arquitetônica de fundo */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)'
            : 'linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 25%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 25%, transparent 82%)',
        }}
      />

      {/* Iluminação ambiente Movare Crimson */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-24 right-1/4 w-[520px] h-[520px] rounded-full blur-[140px] ${
            isDark ? 'bg-red-600/14' : 'bg-red-500/10'
          }`}
        />
      </div>

      {/* Barra superior discreta */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="px-2 py-1 rounded-lg bg-white border border-slate-300 shadow-2xs shrink-0">
            <img
              src="/movare-logo.png"
              alt="MOVARE"
              className="h-6 w-auto object-contain"
            />
          </div>
          <span className="text-xs font-semibold tracking-tight whitespace-nowrap truncate">
            Localizador &amp; Gestão de Galpões
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>Sobre o App</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            title={isDark ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
            className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'bg-slate-900/90 border-slate-700 text-amber-400 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Conteúdo principal: apenas o Card de Login centralizado */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-5 py-6 sm:py-10 flex items-center justify-center">
        <AuthCard
          variant="screen"
          isConfigured={isConfigured}
          configError={configError}
          isDark={isDark}
          passwordRecoveryPending={passwordRecoveryPending}
          onLogin={onLogin}
          onSignUp={onSignUp}
          onSignedUpCommonUser={onSignedUpCommonUser}
          onRequestPasswordReset={onRequestPasswordReset}
          onCompletePasswordRecovery={onCompletePasswordRecovery}
          onClearPasswordRecovery={onClearPasswordRecovery}
          onSuccess={onAuthenticatedSuccess}
          onEnterAsVisitor={onEnterAsVisitor}
          onOpenAbout={() => setAboutOpen(true)}
        />
      </main>

      {/* Modal Página Sobre o App acessível diretamente da Tela de Login */}
      {aboutOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setAboutOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-5xl max-h-[90dvh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-slate-900/98 border-slate-700/80 text-slate-100 shadow-black/80'
                : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
            }`}
          >
            <div
              className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
                isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight truncate">
                    Sobre o App · Guia &amp; Demonstração
                  </h3>
                  <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Movare Localizador &amp; Gestão de Galpões
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Voltar ao Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  aria-label="Fechar página sobre"
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <AboutAppTab isDark={isDark} areas={areas} activeAreaId={activeAreaId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

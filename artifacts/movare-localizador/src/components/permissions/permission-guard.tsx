import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { UserRole } from '../../lib/auth';

type RequireAdminProps = {
  isAdmin: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireAdmin({ isAdmin, children, fallback = null }: RequireAdminProps) {
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

export function canUserEditMap(role: UserRole, isAdminFlag: boolean): boolean {
  return role === 'admin' && isAdminFlag;
}

export function ReadOnlyNoticeBanner({
  isDark,
  onRequestLogin,
}: {
  isDark: boolean;
  onRequestLogin?: () => void;
}) {
  return (
    <div
      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
        isDark
          ? 'bg-slate-950/70 border-slate-800 text-slate-300'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="truncate">Modo Visitante (somente leitura)</span>
      </div>
      {onRequestLogin && (
        <button
          type="button"
          onClick={onRequestLogin}
          className="px-2 py-0.5 rounded-md bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 font-semibold text-[11px] shrink-0 cursor-pointer"
        >
          Entrar como Admin
        </button>
      )}
    </div>
  );
}

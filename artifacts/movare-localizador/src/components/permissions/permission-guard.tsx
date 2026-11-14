import type { ReactNode } from 'react';
import { Lock, BookmarkCheck, ClipboardCheck, ShieldCheck, UserCheck } from 'lucide-react';
import type { UserPermissions, UserRole } from '../../lib/auth';

type RequireAdminProps = {
  isAdmin: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export const RESERVATION_CLOUD_INFO_MSG =
  'Reservas da Assistência Técnica são sincronizadas diretamente com a nuvem via RPC dedicada (toggle_position_reservation), mantendo o layout e os produtos protegidos.';

export function RequireAdmin({ isAdmin, children, fallback = null }: RequireAdminProps) {
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

export function canUserEditMap(
  role: UserRole,
  isAdminOrAuthenticatedFlag: boolean,
  permissions?: UserPermissions
): boolean {
  if (permissions) {
    return isAdminOrAuthenticatedFlag && permissions.canEditMap;
  }
  return role === 'admin' && isAdminOrAuthenticatedFlag;
}

/**
 * Indica se o perfil possui permissão para classificar posições como reservadas.
 * - Cargos com permissão canEditMap ou canReservePositions: alteram no editor ou via RPC toggle_position_reservation.
 * - Conferente, Usuário Comum sem cargo e Visitante: somente leitura.
 */
export function canUserPersistReservations(
  role: UserRole,
  isAdminFlag: boolean,
  _supabaseConfigured: boolean = true,
  permissions?: UserPermissions
): boolean {
  if (permissions) {
    return Boolean(permissions.canEditMap || permissions.canReservePositions);
  }
  if (role === 'admin' && isAdminFlag) return true;
  if (role === 'assistencia') return true;
  return false;
}

export function canUserSeeReservationAction(
  role: UserRole,
  permissions?: UserPermissions
): boolean {
  if (permissions) {
    return Boolean(permissions.canEditMap || permissions.canReservePositions);
  }
  return role === 'admin' || role === 'assistencia';
}

export function canUserUseConferenteWorkspace(
  role: UserRole,
  permissions?: UserPermissions
): boolean {
  if (permissions) {
    return Boolean(permissions.canUseConferentePanel);
  }
  return role === 'conferente';
}

export function ReadOnlyNoticeBanner({
  isDark,
  role = 'visitor',
  isAuthenticated = false,
  cargoName = null,
  onRequestLogin,
}: {
  isDark: boolean;
  role?: UserRole;
  isAuthenticated?: boolean;
  cargoName?: string | null;
  onRequestLogin?: () => void;
}) {
  const noticeConfig = (() => {
    if (role === 'conferente') {
      return {
        label: `Modo ${cargoName || 'Conferente'} (consulta operacional)`,
        icon: <ClipboardCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      };
    }
    if (role === 'assistencia') {
      return {
        label: `Modo ${cargoName || 'Assistência Técnica'} (consulta & reservas)`,
        icon: <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      };
    }
    if (role === 'admin') {
      return {
        label: cargoName ? `${cargoName} conectado` : 'Administrador conectado',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      };
    }
    if (isAuthenticated) {
      return {
        label: cargoName ? `Cargo: ${cargoName} (consulta)` : 'Usuário Comum (aguardando cargo)',
        icon: <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      };
    }
    return {
      label: 'Modo Visitante (somente leitura)',
      icon: <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
    };
  })();

  return (
    <div
      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
        isDark
          ? 'bg-slate-950/75 border-slate-800 text-slate-300'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {noticeConfig.icon}
        <span className="truncate">{noticeConfig.label}</span>
      </div>
      {onRequestLogin && role === 'visitor' && !isAuthenticated && (
        <button
          type="button"
          onClick={onRequestLogin}
          className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 font-semibold text-[11px] shrink-0 cursor-pointer transition-colors"
        >
          Entrar
        </button>
      )}
    </div>
  );
}

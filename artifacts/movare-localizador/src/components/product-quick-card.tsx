import {
  X,
  Crosshair,
  Pencil,
  Package,
  Building2,
  Layers,
  Tag,
  Eye,
  Box,
  BookmarkCheck,
  BookmarkMinus,
  Loader2,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  type DrawingElement,
  type InternalPosition,
} from '../editor-model';

type ProductQuickCardProps = {
  element: DrawingElement;
  position: InternalPosition | null;
  areaName: string;
  isDark: boolean;
  isAdmin: boolean;
  canSeeReservationAction?: boolean;
  canPersistReservation?: boolean;
  reservationBusy?: boolean;
  shiftRightForPanel?: boolean;
  isDragging?: boolean;
  onClose: () => void;
  onCenter: () => void;
  onSwitchToEdit?: () => void;
  onToggleReservePosition?: (elementId: string, positionId: string) => void;
};

export function ProductQuickCard({
  element,
  position,
  areaName,
  isDark,
  isAdmin,
  canSeeReservationAction = false,
  canPersistReservation = false,
  reservationBusy = false,
  shiftRightForPanel = false,
  isDragging = false,
  onClose,
  onCenter,
  onSwitchToEdit,
  onToggleReservePosition,
}: ProductQuickCardProps) {
  const codeValue = position
    ? position.code || position.sku || '—'
    : element.skuCode || element.corridorText || element.street || element.name || '—';

  const skuValue = position?.sku || (!position ? element.skuCode : undefined);
  const modelValue =
    position?.model ||
    element.model ||
    position?.description ||
    position?.label ||
    element.notes ||
    'Não informado';
  const supplierValue = position?.supplier || element.supplier || 'Não informado';
  const volumesPerItem =
    typeof position?.volumesPerItem === 'number'
      ? position.volumesPerItem
      : typeof element.volumesPerItem === 'number'
      ? element.volumesPerItem
      : undefined;

  const sizeDef = PRODUCT_SIZES.find(
    (s) => s.id === (position?.productSize || element.productSize)
  );
  const catDef = PRODUCT_CATEGORIES.find(
    (c) => c.id === (position?.category || element.category)
  );

  const isReserved = position?.status === 'reserved';

  const statusMeta = (() => {
    if (!position) {
      if (element.type === 'rack') return { label: 'Porta-Paletes', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
      if (element.type === 'corridor') return { label: 'Corredor / Rua', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
      if (element.type === 'divider') return { label: 'Divisória', badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
      return { label: catDef?.badge || 'Zona WMS', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    }
    if (position.status === 'reserved') {
      return { label: 'RESERVADO', badge: 'bg-amber-400/20 text-amber-400 border-amber-400/60' };
    }
    if (position.status === 'occupied') {
      return { label: 'Ocupado', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    }
    return { label: 'Livre', badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  })();

  const qty = position?.quantity ?? 0;
  const totalPositions = element.internalPositions?.length ?? 0;
  const occupiedPositions =
    element.internalPositions?.filter((p) => p.status === 'occupied').length ?? 0;
  const reservedPositions =
    element.internalPositions?.filter((p) => p.status === 'reserved').length ?? 0;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`fixed sm:absolute bottom-20 left-3 right-3 sm:right-auto sm:bottom-4 ${
        shiftRightForPanel ? 'sm:left-4 md:left-[380px]' : 'sm:left-4'
      } sm:w-[340px] z-30 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-150 select-none ${
        isReserved
          ? isDark
            ? 'bg-slate-950/95 border-amber-400/75 text-slate-100 shadow-amber-950/40'
            : 'bg-white/98 border-amber-400 text-slate-900 shadow-amber-500/20'
          : isDark
          ? 'bg-slate-950/92 border-slate-700/85 text-slate-100 shadow-black/70'
          : 'bg-white/95 border-slate-200/95 text-slate-900 shadow-slate-500/20'
      } ${isDragging ? 'opacity-25 pointer-events-none' : 'opacity-100'}`}
    >
      {/* CABEÇALHO COMPACTO */}
      <div
        className={`flex items-start justify-between gap-2 px-3.5 py-2.5 border-b ${
          isReserved
            ? isDark
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-amber-200 bg-amber-50/70'
            : isDark
            ? 'border-slate-800/90'
            : 'border-slate-200'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-500">
              <Eye className="w-3 h-3" />
              <span>Visualização</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${statusMeta.badge}`}
            >
              {isReserved && <BookmarkCheck className="w-3 h-3" />}
              <span>{statusMeta.label}</span>
            </span>
          </div>
          <h4 className="mt-0.5 text-sm font-bold truncate">
            {position ? `${element.name} · ${codeValue}` : element.name}
          </h4>
          <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {areaName}
            {sizeDef ? ` · ${sizeDef.short}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Fechar card"
          aria-label="Fechar resumo do item"
          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* DADOS SIMPLIFICADOS DO PRODUTO */}
      <div className="p-3.5 space-y-2.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`p-2 rounded-xl border ${
              isDark ? 'bg-slate-900/75 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Tag className="w-3 h-3 text-orange-500 shrink-0" />
              <span>Código</span>
            </span>
            <strong className="block mt-0.5 font-mono text-xs truncate text-orange-400">
              {codeValue}
            </strong>
            {skuValue && skuValue !== codeValue && (
              <span className={`block text-[10px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                SKU: {skuValue}
              </span>
            )}
          </div>

          <div
            className={`p-2 rounded-xl border ${
              isDark ? 'bg-slate-900/75 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Layers className="w-3 h-3 text-sky-400 shrink-0" />
              <span>Vol. / Item</span>
            </span>
            <strong className="block mt-0.5 font-mono text-xs truncate">
              {volumesPerItem !== undefined
                ? `${volumesPerItem} ${volumesPerItem === 1 ? 'volume' : 'volumes'}`
                : 'Não informado'}
            </strong>
            {position && qty > 0 && (
              <span className={`block text-[10px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Estoque: {qty} {position.unit || 'UN'}
              </span>
            )}
            {!position && totalPositions > 0 && (
              <span className={`block text-[10px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {occupiedPositions}/{totalPositions} ocup.
                {reservedPositions > 0 ? ` · ${reservedPositions} res.` : ''}
              </span>
            )}
          </div>
        </div>

        <div
          className={`p-2.5 rounded-xl border space-y-1.5 ${
            isDark ? 'bg-slate-900/75 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`flex items-center gap-1 text-[10px] shrink-0 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Package className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Modelo</span>
            </span>
            <span className="font-semibold text-right text-xs leading-snug break-words max-w-[205px]">
              {modelValue}
            </span>
          </div>

          <div
            className={`flex items-start justify-between gap-2 pt-1.5 border-t ${
              isDark ? 'border-slate-800/80' : 'border-slate-200/80'
            }`}
          >
            <span className={`flex items-center gap-1 text-[10px] shrink-0 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Fornecedor</span>
            </span>
            <span className="font-semibold text-right text-xs leading-snug break-words max-w-[205px]">
              {supplierValue}
            </span>
          </div>

          {position?.description &&
            position?.model &&
            position.description !== position.model && (
              <div
                className={`flex items-start justify-between gap-2 pt-1.5 border-t ${
                  isDark ? 'border-slate-800/80' : 'border-slate-200/80'
                }`}
              >
                <span className={`flex items-center gap-1 text-[10px] shrink-0 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Box className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Descrição</span>
                </span>
                <span className={`text-right text-[11px] leading-snug break-words max-w-[205px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {position.description}
                </span>
              </div>
            )}
        </div>

        {/* RODAPÉ DE AÇÕES RÁPIDAS */}
        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          {position && canSeeReservationAction && onToggleReservePosition ? (
            <button
              type="button"
              disabled={!canPersistReservation || reservationBusy}
              onClick={() => onToggleReservePosition(element.id, position.id)}
              title={
                reservationBusy
                  ? 'Sincronizando reserva na nuvem...'
                  : !canPersistReservation
                  ? 'Apenas Administrador ou Assistência Técnica podem alterar reservas.'
                  : isReserved
                  ? 'Remover marcação de reserva desta posição'
                  : 'Marcar posição como RESERVADO'
              }
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition-colors ${
                !canPersistReservation || reservationBusy
                  ? 'opacity-60 cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : isReserved
                  ? 'cursor-pointer border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                  : 'cursor-pointer border-amber-500 bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {reservationBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : isReserved ? (
                <>
                  <BookmarkMinus className="w-3.5 h-3.5" />
                  <span>Remover Reserva</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Reservar</span>
                </>
              )}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onCenter}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${
                isDark
                  ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-400'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-sky-600'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>Centralizar</span>
            </button>

            {isAdmin && onSwitchToEdit && (
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Editar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  Store,
  CalendarClock,
  UserCheck,
  Check,
  Boxes,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  type DrawingElement,
  type InternalPosition,
} from '../editor-model';
import { formatReservationDateTime } from '../wms-operations';

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
  onToggleReservePosition?: (
    elementId: string,
    positionId: string,
    reservationStore?: string,
    reservationQuantity?: number
  ) => void;
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
  const [reservePromptOpen, setReservePromptOpen] = useState(false);
  const [storeDraft, setStoreDraft] = useState('');
  const [qtyDraft, setQtyDraft] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const storeInputRef = useRef<HTMLInputElement>(null);

  const hasPositionStockQty = typeof position?.quantity === 'number' && Number.isFinite(position.quantity);
  const qty = hasPositionStockQty ? (position!.quantity as number) : 0;
  const unitLabel = position?.unit || 'UN';

  useEffect(() => {
    setReservePromptOpen(false);
    setStoreDraft(position?.reservedStore || '');
    const defaultReserveQty =
      typeof position?.reservedQuantity === 'number' && position.reservedQuantity > 0
        ? position.reservedQuantity
        : qty > 0
        ? qty
        : 1;
    setQtyDraft(String(defaultReserveQty));
    setFormError(null);
  }, [element.id, position?.id, position?.status, position?.reservedStore, position?.reservedQuantity, qty]);

  useEffect(() => {
    if (reservePromptOpen) {
      setTimeout(() => storeInputRef.current?.focus(), 40);
    }
  }, [reservePromptOpen]);

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

  const totalPositions = element.internalPositions?.length ?? 0;
  const occupiedPositions =
    element.internalPositions?.filter((p) => p.status === 'occupied').length ?? 0;
  const reservedPositions =
    element.internalPositions?.filter((p) => p.status === 'reserved').length ?? 0;
  const zoneTotalStock =
    element.internalPositions?.reduce(
      (sum, p) => sum + (typeof p.quantity === 'number' && p.quantity > 0 ? p.quantity : 0),
      0
    ) ?? 0;
  const zoneReservedStock =
    element.internalPositions?.reduce((sum, p) => {
      if (p.status !== 'reserved') return sum;
      const rQty =
        typeof p.reservedQuantity === 'number' && p.reservedQuantity > 0
          ? p.reservedQuantity
          : typeof p.quantity === 'number' && p.quantity > 0
          ? p.quantity
          : 0;
      return sum + rQty;
    }, 0) ?? 0;

  const effectiveReservedQty = isReserved
    ? typeof position?.reservedQuantity === 'number' && position.reservedQuantity > 0
      ? position.reservedQuantity
      : qty > 0
      ? qty
      : undefined
    : undefined;

  const availableQty =
    position && hasPositionStockQty && effectiveReservedQty !== undefined
      ? Math.max(0, qty - effectiveReservedQty)
      : hasPositionStockQty
      ? qty
      : undefined;

  const reservedDateLabel = formatReservationDateTime(position?.reservedAt || position?.updatedAt);
  const reservedResponsible =
    position?.reservedBy?.trim() ||
    position?.reservedByEmail?.trim() ||
    'Responsável não informado';

  const handleConfirmReservation = (e: FormEvent) => {
    e.preventDefault();
    if (!position || !onToggleReservePosition) return;
    const trimmedStore = storeDraft.trim();
    if (trimmedStore.length < 2) {
      setFormError('Informe a loja de destino da reserva.');
      storeInputRef.current?.focus();
      return;
    }

    const parsedQty = Number(qtyDraft.replace(',', '.'));
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setFormError('Informe uma quantidade válida para reservar.');
      return;
    }
    if (qty > 0 && parsedQty > qty) {
      setFormError(`Máximo disponível em estoque: ${qty} ${unitLabel}.`);
      return;
    }

    setFormError(null);
    setReservePromptOpen(false);
    onToggleReservePosition(element.id, position.id, trimmedStore, parsedQty);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`fixed sm:absolute bottom-20 left-3 right-3 sm:right-auto sm:bottom-4 ${
        shiftRightForPanel ? 'sm:left-4 md:left-[380px]' : 'sm:left-4'
      } sm:w-[356px] z-30 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-150 select-none ${
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

      {/* DADOS DO PRODUTO, ESTOQUE E DETALHES DA RESERVA */}
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
              <Boxes className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Em Estoque</span>
            </span>
            {position ? (
              <>
                <strong className="block mt-0.5 font-mono tabular-nums text-xs truncate">
                  {hasPositionStockQty ? `${qty} ${unitLabel}` : 'Não informado'}
                </strong>
                {isReserved && hasPositionStockQty && effectiveReservedQty !== undefined ? (
                  <span
                    className={`block text-[10px] font-mono tabular-nums truncate ${
                      availableQty === 0
                        ? isDark
                          ? 'text-amber-300'
                          : 'text-amber-700'
                        : isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-700'
                    }`}
                  >
                    {availableQty === 0
                      ? 'Total em reserva'
                      : `${availableQty} ${unitLabel} disp.`}
                  </span>
                ) : (
                  volumesPerItem !== undefined && (
                    <span className={`block text-[10px] font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {volumesPerItem} {volumesPerItem === 1 ? 'vol/item' : 'vols/item'}
                    </span>
                  )
                )}
              </>
            ) : (
              <>
                <strong className="block mt-0.5 font-mono tabular-nums text-xs truncate">
                  {zoneTotalStock > 0
                    ? `${zoneTotalStock} UN`
                    : totalPositions > 0
                    ? `${occupiedPositions}/${totalPositions} ocup.`
                    : 'Não informado'}
                </strong>
                {totalPositions > 0 && (
                  <span className={`block text-[10px] font-mono tabular-nums truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {occupiedPositions}/{totalPositions} pos.
                    {zoneReservedStock > 0
                      ? ` · ${zoneReservedStock} UN res.`
                      : reservedPositions > 0
                      ? ` · ${reservedPositions} res.`
                      : ''}
                  </span>
                )}
              </>
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

          <div
            className={`flex items-center justify-between gap-2 pt-1.5 border-t ${
              isDark ? 'border-slate-800/80' : 'border-slate-200/80'
            }`}
          >
            <span className={`flex items-center gap-1 text-[10px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Layers className="w-3 h-3 text-sky-400 shrink-0" />
              <span>Vol. / Item</span>
            </span>
            <span className="font-mono tabular-nums font-semibold text-right text-xs">
              {volumesPerItem !== undefined
                ? `${volumesPerItem} ${volumesPerItem === 1 ? 'volume' : 'volumes'}`
                : 'Não informado'}
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

        {/* DETALHES COMPLETOS DA RESERVA QUANDO RESERVADO */}
        {position && isReserved && (
          <div
            className={`p-2.5 rounded-xl border space-y-1.5 ${
              isDark
                ? 'bg-amber-950/35 border-amber-500/45 text-amber-50'
                : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isDark ? 'text-amber-300' : 'text-amber-800'
                }`}
              >
                <BookmarkCheck className="w-3 h-3 shrink-0" />
                <span>Dados da Reserva</span>
              </span>
            </div>

            <div
              className={`flex items-start justify-between gap-2 pt-1 border-t ${
                isDark ? 'border-amber-500/20' : 'border-amber-200/90'
              }`}
            >
              <span
                className={`flex items-center gap-1 text-[10px] shrink-0 mt-0.5 ${
                  isDark ? 'text-amber-200/80' : 'text-amber-800/80'
                }`}
              >
                <Store className="w-3 h-3 shrink-0" />
                <span>Loja</span>
              </span>
              <span className="font-bold text-right text-xs leading-snug break-words max-w-[210px]">
                {position.reservedStore?.trim() || 'Não informada'}
              </span>
            </div>

            <div
              className={`flex items-center justify-between gap-2 pt-1 border-t ${
                isDark ? 'border-amber-500/20' : 'border-amber-200/90'
              }`}
            >
              <span
                className={`flex items-center gap-1 text-[10px] shrink-0 ${
                  isDark ? 'text-amber-200/80' : 'text-amber-800/80'
                }`}
              >
                <Boxes className="w-3 h-3 shrink-0" />
                <span>Qtd. Reservada</span>
              </span>
              <div className="text-right font-mono tabular-nums">
                <span className="font-bold text-xs">
                  {effectiveReservedQty !== undefined
                    ? `${effectiveReservedQty} ${unitLabel}`
                    : 'Não informada'}
                </span>
                {hasPositionStockQty && effectiveReservedQty !== undefined && (
                  <span
                    className={`block text-[10px] ${
                      isDark ? 'text-amber-200/75' : 'text-amber-800/80'
                    }`}
                  >
                    {effectiveReservedQty < qty
                      ? `de ${qty} ${unitLabel} (${availableQty} ${unitLabel} disp.)`
                      : `Total em estoque (${qty} ${unitLabel})`}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`flex items-center justify-between gap-2 pt-1 border-t ${
                isDark ? 'border-amber-500/20' : 'border-amber-200/90'
              }`}
            >
              <span
                className={`flex items-center gap-1 text-[10px] shrink-0 ${
                  isDark ? 'text-amber-200/80' : 'text-amber-800/80'
                }`}
              >
                <CalendarClock className="w-3 h-3 shrink-0" />
                <span>Data</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] font-semibold text-right">
                {reservedDateLabel}
              </span>
            </div>

            <div
              className={`flex items-start justify-between gap-2 pt-1 border-t ${
                isDark ? 'border-amber-500/20' : 'border-amber-200/90'
              }`}
            >
              <span
                className={`flex items-center gap-1 text-[10px] shrink-0 mt-0.5 ${
                  isDark ? 'text-amber-200/80' : 'text-amber-800/80'
                }`}
              >
                <UserCheck className="w-3 h-3 shrink-0" />
                <span>Responsável</span>
              </span>
              <div className="text-right max-w-[210px]">
                <span className="block font-semibold text-[11px] leading-snug break-words">
                  {reservedResponsible}
                </span>
                {position.reservedBy &&
                  position.reservedByEmail &&
                  position.reservedBy.toLowerCase() !== position.reservedByEmail.toLowerCase() && (
                    <span
                      className={`block text-[10px] truncate ${
                        isDark ? 'text-amber-200/70' : 'text-amber-800/75'
                      }`}
                    >
                      {position.reservedByEmail}
                    </span>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* FORMULÁRIO INLINE PARA DEFINIR A LOJA E QUANTIDADE AO RESERVAR */}
        {position && reservePromptOpen && !isReserved && (
          <form
            onSubmit={handleConfirmReservation}
            className={`p-2.5 rounded-xl border space-y-2 ${
              isDark
                ? 'bg-slate-900 border-amber-500/50 text-slate-100'
                : 'bg-amber-50/70 border-amber-300 text-slate-900'
            }`}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label
                  htmlFor="quick-card-reserve-store"
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isDark ? 'text-amber-300' : 'text-amber-800'
                  }`}
                >
                  Loja de destino
                </label>
                <input
                  ref={storeInputRef}
                  id="quick-card-reserve-store"
                  type="text"
                  value={storeDraft}
                  onChange={(e) => {
                    setStoreDraft(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Ex: Loja Centro..."
                  maxLength={80}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-amber-400'
                      : 'bg-white border-amber-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="quick-card-reserve-qty"
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isDark ? 'text-amber-300' : 'text-amber-800'
                  }`}
                >
                  Qtd ({unitLabel})
                </label>
                <input
                  id="quick-card-reserve-qty"
                  type="number"
                  min={1}
                  max={qty > 0 ? qty : undefined}
                  step={1}
                  value={qtyDraft}
                  onChange={(e) => {
                    setQtyDraft(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono tabular-nums font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-400'
                      : 'bg-white border-amber-300 text-slate-900 focus:border-amber-500'
                  }`}
                />
              </div>
            </div>

            {qty > 0 && (
              <p className={`text-[10px] font-mono tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Disponível em estoque: <strong>{qty} {unitLabel}</strong>
              </p>
            )}

            {formError && (
              <p className="text-[10px] font-semibold text-rose-400">{formError}</p>
            )}

            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setReservePromptOpen(false);
                  setFormError(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={reservationBusy}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                <Check className="w-3 h-3" />
                <span>Confirmar Reserva</span>
              </button>
            </div>
          </form>
        )}

        {/* RODAPÉ DE AÇÕES RÁPIDAS */}
        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          {position && canSeeReservationAction && onToggleReservePosition ? (
            <button
              type="button"
              disabled={!canPersistReservation || reservationBusy}
              onClick={() => {
                if (isReserved) {
                  onToggleReservePosition(element.id, position.id);
                } else {
                  setFormError(null);
                  setQtyDraft(String(qty > 0 ? qty : 1));
                  setReservePromptOpen((prev) => !prev);
                }
              }}
              title={
                reservationBusy
                  ? 'Sincronizando reserva na nuvem...'
                  : !canPersistReservation
                  ? 'Apenas Administrador ou cargos autorizados podem alterar reservas.'
                  : isReserved
                  ? 'Remover marcação de reserva desta posição'
                  : 'Reservar posição informando loja e quantidade'
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

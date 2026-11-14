import type { DrawingElement, FloorArea, ProductSize } from './editor-model';
import type { InternalPosition, PositionStockStatus } from './zone-internal-positions';

export type SearchCatalogItem = {
  areaId: string;
  areaName: string;
  elementId: string;
  elementName: string;
  type: DrawingElement['type'];
  positionId?: string;
  positionCode?: string;
  address?: string;
  sku?: string;
  productName: string;
  description?: string;
  model?: string;
  supplier?: string;
  volumesPerItem?: number;
  quantity?: number;
  unit?: string;
  status?: PositionStockStatus;
  productSize?: ProductSize;
  category?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPosition: boolean;
};

/**
 * Alterna o estado de reserva de uma posição interna preservando todos os demais dados WMS.
 * Ao remover uma reserva, restaura 'occupied' se houver SKU/quantidade, ou 'empty' caso contrário.
 */
export function resolveStatusAfterUnreserve(pos: InternalPosition): PositionStockStatus {
  const hasSku = Boolean(pos.sku && pos.sku.trim().length > 0);
  const hasQty = typeof pos.quantity === 'number' && pos.quantity > 0;
  return hasSku || hasQty ? 'occupied' : 'empty';
}

export function togglePositionReservationInElement(
  element: DrawingElement,
  positionId: string,
  nextReserved?: boolean
): DrawingElement {
  if (!element.internalPositions?.length) return element;
  const nowIso = new Date().toISOString();
  let changed = false;

  const updatedPositions = element.internalPositions.map((pos) => {
    if (pos.id !== positionId) return pos;
    const shouldReserve = nextReserved ?? pos.status !== 'reserved';
    const nextStatus: PositionStockStatus = shouldReserve
      ? 'reserved'
      : resolveStatusAfterUnreserve(pos);
    if (pos.status === nextStatus) return pos;
    changed = true;
    return {
      ...pos,
      status: nextStatus,
      updatedAt: nowIso,
    };
  });

  if (!changed) return element;

  return {
    ...element,
    internalPositions: updatedPositions,
  };
}

export function countReservedPositionsInAreas(areas: FloorArea[]): number {
  let total = 0;
  for (const area of areas) {
    for (const el of area.elements) {
      if (!el.internalPositions?.length) continue;
      for (const pos of el.internalPositions) {
        if (pos.status === 'reserved') total += 1;
      }
    }
  }
  return total;
}

export function buildSearchCatalog(areas: FloorArea[]): SearchCatalogItem[] {
  const list: SearchCatalogItem[] = [];

  for (const area of areas) {
    for (const el of area.elements) {
      if (el.type === 'divider') continue;

      const zoneProductName =
        el.notes?.trim() ||
        el.model?.trim() ||
        el.name;

      list.push({
        areaId: area.id,
        areaName: area.name,
        elementId: el.id,
        elementName: el.name,
        type: el.type,
        positionCode: el.skuCode || el.corridorText || el.street || el.name,
        sku: el.skuCode,
        productName: zoneProductName,
        description: el.notes,
        model: el.model,
        supplier: el.supplier,
        volumesPerItem: el.volumesPerItem,
        productSize: el.productSize,
        category: el.category,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        isPosition: false,
      });

      if (el.internalPositions && el.internalPositions.length > 0) {
        for (const pos of el.internalPositions) {
          const relX = Number.isFinite(pos.relX) ? pos.relX : 0;
          const relY = Number.isFinite(pos.relY) ? pos.relY : 0;
          const relWidth = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : 25;
          const relHeight = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : 25;

          const productName =
            pos.description?.trim() ||
            pos.label?.trim() ||
            pos.model?.trim() ||
            el.model?.trim() ||
            el.name;

          list.push({
            areaId: area.id,
            areaName: area.name,
            elementId: el.id,
            elementName: el.name,
            type: el.type,
            positionId: pos.id,
            positionCode: pos.code,
            address: `${el.name} · ${pos.code}`,
            sku: pos.sku || el.skuCode,
            productName,
            description: pos.description || pos.label,
            model: pos.model || el.model,
            supplier: pos.supplier || el.supplier,
            volumesPerItem: pos.volumesPerItem ?? el.volumesPerItem,
            quantity: pos.quantity,
            unit: pos.unit || 'UN',
            status: pos.status,
            productSize: pos.productSize || el.productSize,
            category: pos.category || el.category,
            x: el.x + relX,
            y: el.y + relY,
            width: relWidth,
            height: relHeight,
            isPosition: true,
          });
        }
      }

      if (el.type === 'rack' && el.slots) {
        for (const [, slot] of Object.entries(el.slots)) {
          list.push({
            areaId: area.id,
            areaName: area.name,
            elementId: el.id,
            elementName: el.name,
            type: 'rack',
            positionCode: slot.id,
            address: `${el.name} · ${slot.id}`,
            sku: slot.sku,
            productName: slot.description?.trim() || el.name,
            description: slot.description,
            model: el.model,
            supplier: el.supplier,
            volumesPerItem: el.volumesPerItem,
            quantity: slot.quantity,
            status: slot.status,
            productSize: slot.productSize || el.productSize,
            category: slot.category || el.category,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            isPosition: true,
          });
        }
      }
    }
  }

  return list;
}

export function filterSearchCatalog(
  items: SearchCatalogItem[],
  params: {
    query?: string;
    filterType?: 'all' | 'codes' | 'zones' | 'products' | 'reserved';
    category?: string;
    areaId?: string;
    onlyPositionsFirst?: boolean;
    limit?: number;
  }
): SearchCatalogItem[] {
  const q = (params.query || '').trim().toLowerCase();
  const filterType = params.filterType || 'all';
  const category = params.category && params.category !== 'all' ? params.category : null;
  const areaId = params.areaId && params.areaId !== 'all' ? params.areaId : null;

  const filtered = items.filter((item) => {
    if (areaId && item.areaId !== areaId) return false;
    if (category && item.category !== category) return false;

    if (filterType === 'codes' && !item.positionCode) return false;
    if (filterType === 'zones' && item.isPosition) return false;
    if (filterType === 'products' && !item.sku && !item.description && !item.model && !item.supplier) {
      return false;
    }
    if (filterType === 'reserved' && item.status !== 'reserved') return false;

    if (!q) return true;

    return (
      item.positionCode?.toLowerCase().includes(q) ||
      item.elementName.toLowerCase().includes(q) ||
      item.areaName.toLowerCase().includes(q) ||
      item.address?.toLowerCase().includes(q) ||
      item.sku?.toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.supplier?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  if (params.onlyPositionsFirst) {
    filtered.sort((a, b) => {
      if (a.isPosition !== b.isPosition) return a.isPosition ? -1 : 1;
      const aHasSku = a.sku || a.model || a.description ? 1 : 0;
      const bHasSku = b.sku || b.model || b.description ? 1 : 0;
      return bHasSku - aHasSku;
    });
  }

  return typeof params.limit === 'number' ? filtered.slice(0, params.limit) : filtered;
}

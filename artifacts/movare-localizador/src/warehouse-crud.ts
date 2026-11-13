import {
  DEFAULT_HEIGHT_METERS,
  DEFAULT_SCALE_RATIO,
  DEFAULT_WIDTH_METERS,
  createId,
  getAreaBounds,
  type FloorArea,
} from './editor-model';

export type CreateWarehouseInput = {
  name?: string;
  widthMeters?: number;
  heightMeters?: number;
  scaleRatio?: number;
};

export type UpdateWarehouseInput = {
  name: string;
  widthMeters: number;
  heightMeters: number;
  scaleRatio: number;
  scaleElements?: boolean;
};

export function clampWarehouseWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WIDTH_METERS;
  return Math.max(20, Math.min(500, Math.round(value)));
}

export function clampWarehouseHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HEIGHT_METERS;
  return Math.max(15, Math.min(500, Math.round(value)));
}

export function clampWarehouseScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE_RATIO;
  return Math.max(5, Math.min(100, Math.round(value * 10) / 10));
}

export function buildNewWarehouse(areas: FloorArea[], input: CreateWarehouseInput = {}): FloorArea {
  const trimmedName = input.name?.trim();
  return {
    id: createId('wh'),
    name: trimmedName && trimmedName.length > 0 ? trimmedName : `Galpão ${areas.length + 1}`,
    widthMeters: clampWarehouseWidth(input.widthMeters ?? DEFAULT_WIDTH_METERS),
    heightMeters: clampWarehouseHeight(input.heightMeters ?? DEFAULT_HEIGHT_METERS),
    scaleRatio: clampWarehouseScale(input.scaleRatio ?? DEFAULT_SCALE_RATIO),
    elements: [],
  };
}

export function updateWarehouseArea(area: FloorArea, updates: UpdateWarehouseInput): FloorArea {
  const nextName = updates.name.trim() || area.name;
  const oldBounds = getAreaBounds(area);
  const oldScale = area.scaleRatio || DEFAULT_SCALE_RATIO;
  const nextScale = clampWarehouseScale(updates.scaleRatio);
  const nextWMeters = clampWarehouseWidth(updates.widthMeters);
  const nextHMeters = clampWarehouseHeight(updates.heightMeters);

  const dimensionsChanged =
    nextWMeters !== oldBounds.widthMeters || nextHMeters !== oldBounds.heightMeters;

  if (!dimensionsChanged) {
    return {
      ...area,
      name: nextName,
      scaleRatio: nextScale,
      widthMeters: nextWMeters,
      heightMeters: nextHMeters,
    };
  }

  const oldWPx = oldBounds.widthPx;
  const oldHPx = oldBounds.heightPx;
  const newWPx = Math.round(nextWMeters * oldScale);
  const newHPx = Math.round(nextHMeters * oldScale);

  const scaleFactorX = newWPx / Math.max(1, oldWPx);
  const scaleFactorY = newHPx / Math.max(1, oldHPx);
  const isShrinking = scaleFactorX < 1 || scaleFactorY < 1;
  const uniformScale =
    updates.scaleElements !== false && isShrinking ? Math.min(scaleFactorX, scaleFactorY) : 1;

  const updatedElements = area.elements.map((el) => {
    const newWidth = Math.max(12, Math.round(el.width * uniformScale));
    const newHeight = Math.max(12, Math.round(el.height * uniformScale));

    const relCenterX = (el.x + el.width / 2) / Math.max(1, oldWPx);
    const relCenterY = (el.y + el.height / 2) / Math.max(1, oldHPx);

    const targetCenterX = relCenterX * newWPx;
    const targetCenterY = relCenterY * newHPx;

    let newX = Math.round(targetCenterX - newWidth / 2);
    let newY = Math.round(targetCenterY - newHeight / 2);

    newX = Math.max(0, Math.min(Math.max(0, newWPx - newWidth), newX));
    newY = Math.max(0, Math.min(Math.max(0, newHPx - newHeight), newY));

    if (el.type === 'corridor') {
      return {
        ...el,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        fontSize: el.fontSize ? Math.max(7, Math.round(el.fontSize * uniformScale)) : undefined,
      };
    }

    const updatedInternalPositions = el.internalPositions?.map((pos) => {
      const newRelX = Math.round(pos.relX * uniformScale * 10) / 10;
      const newRelY = Math.round(pos.relY * uniformScale * 10) / 10;
      const newRelW = Math.max(4, Math.round(pos.relWidth * uniformScale * 10) / 10);
      const newRelH = Math.max(4, Math.round(pos.relHeight * uniformScale * 10) / 10);

      return {
        ...pos,
        relX: newRelX,
        relY: newRelY,
        relWidth: newRelW,
        relHeight: newRelH,
        widthMeters: Math.round((newRelW / oldScale) * 100) / 100,
        depthMeters: Math.round((newRelH / oldScale) * 100) / 100,
      };
    });

    const updatedInternalLayout = el.internalLayout
      ? {
          ...el.internalLayout,
          unitWidthMeters: el.internalLayout.unitWidthMeters
            ? Math.round(el.internalLayout.unitWidthMeters * uniformScale * 100) / 100
            : undefined,
          unitDepthMeters: el.internalLayout.unitDepthMeters
            ? Math.round(el.internalLayout.unitDepthMeters * uniformScale * 100) / 100
            : undefined,
          rowDepthMeters: el.internalLayout.rowDepthMeters
            ? Math.round(el.internalLayout.rowDepthMeters * uniformScale * 100) / 100
            : undefined,
          clearanceMeters: el.internalLayout.clearanceMeters
            ? Math.round(el.internalLayout.clearanceMeters * uniformScale * 100) / 100
            : undefined,
          marginMeters: el.internalLayout.marginMeters
            ? Math.round(el.internalLayout.marginMeters * uniformScale * 100) / 100
            : undefined,
        }
      : undefined;

    return {
      ...el,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      internalPositions: updatedInternalPositions,
      internalLayout: updatedInternalLayout,
    };
  });

  return {
    ...area,
    name: nextName,
    scaleRatio: nextScale,
    widthMeters: nextWMeters,
    heightMeters: nextHMeters,
    elements: updatedElements,
  };
}

export function deleteWarehouseArea(
  areas: FloorArea[],
  targetId: string,
  currentActiveId: string
): { areas: FloorArea[]; nextActiveId: string; deletedArea: FloorArea } | null {
  if (areas.length <= 1) return null;
  const deletedArea = areas.find((a) => a.id === targetId);
  if (!deletedArea) return null;

  const nextAreas = areas.filter((a) => a.id !== targetId);
  if (nextAreas.length === 0) return null;

  const nextActiveId =
    currentActiveId === targetId
      ? nextAreas[0].id
      : nextAreas.some((a) => a.id === currentActiveId)
      ? currentActiveId
      : nextAreas[0].id;

  return {
    areas: nextAreas,
    nextActiveId,
    deletedArea,
  };
}

// =============================================================
// MOVARE — SISTEMA DE POSIÇÕES E DIVISÕES INTERNAS DAS ZONAS
// Módulos internos pertencentes à zona mãe (sem elementos avulsos)
// =============================================================

export type InternalLayoutMethod = 'horizontal_rows' | 'dimensioned_units' | 'grid' | 'custom';

export type PositionStockStatus = 'empty' | 'occupied' | 'reserved';

export type InternalPosition = {
  id: string; // Identificador estável (ex: "pos-0001-xyz")
  code: string; // Código de localização WMS editável (ex: "P0001", "P0002")
  relX: number; // Coordenada X relativa ao canto superior esquerdo da zona (px)
  relY: number; // Coordenada Y relativa ao canto superior esquerdo da zona (px)
  relWidth: number; // Largura relativa da posição (px)
  relHeight: number; // Profundidade/altura relativa da posição (px)
  // Medidas reais em metros
  widthMeters: number;
  depthMeters: number;
  // Dados de estoque WMS individuais
  sku?: string;
  description?: string;
  quantity?: number;
  unit?: string; // 'UN' | 'CX' | 'PALETE'
  status: PositionStockStatus;
  updatedAt?: string;
};

export type ZoneInternalLayout = {
  method: InternalLayoutMethod;
  // Método A — Fileiras
  rowDepthMeters?: number; // Padrão 0.80m para caixas de móveis
  // Método B & C — Dimensionado e Grade
  unitWidthMeters?: number;
  unitDepthMeters?: number;
  clearanceMeters?: number; // Folga operacional entre posições
  marginMeters?: number; // Recuo da borda externa da zona
  // Nomenclatura e numeração
  codePrefix?: string; // Prefixo para os códigos (ex: "P", "GEL", "FOG")
  sameCodePerRow?: boolean; // Se true, posições da mesma linha replicada usam o mesmo código (ex: GEL-0001)
  // Método D & Personalizado
  columns?: number;
  rows?: number;
  // Notas e especificações
  notes?: string;
};

export type StorageCategoryProfile = {
  category: string;
  label: string;
  defaultMethod: InternalLayoutMethod;
  rowDepthMeters: number;
  unitWidthMeters: number;
  unitDepthMeters: number;
  clearanceMeters: number;
  marginMeters: number;
  codePrefix: string;
  defaultUnit: string;
  sameCodePerRow?: boolean;
  description: string;
};

export const STORAGE_PROFILES: Record<string, StorageCategoryProfile> = {
  refrigerators: {
    category: 'refrigerators',
    label: 'Geladeiras & Freezers',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 0.85,
    unitWidthMeters: 0.85,
    unitDepthMeters: 0.85,
    clearanceMeters: 0.05,
    marginMeters: 0.05,
    codePrefix: 'GEL',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Módulos replicados em linha ocupando a largura da zona (0.85m × 0.85m) com o mesmo código por linha.',
  },
  stoves: {
    category: 'stoves',
    label: 'Fogões & Fornos',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 0.65,
    unitWidthMeters: 0.65,
    unitDepthMeters: 0.65,
    clearanceMeters: 0.05,
    marginMeters: 0.05,
    codePrefix: 'FOG',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Módulos replicados em linha ocupando a largura da zona (0.65m × 0.65m) com o mesmo código por linha.',
  },
  microwaves: {
    category: 'microwaves',
    label: 'Micro-ondas & Eletros',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 0.45,
    unitWidthMeters: 0.55,
    unitDepthMeters: 0.45,
    clearanceMeters: 0.05,
    marginMeters: 0.05,
    codePrefix: 'MIC',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Módulos compactos replicados em linha (0.55m × 0.45m) com mesmo código por linha.',
  },
  televisions: {
    category: 'televisions',
    label: 'Televisão & Smart TVs',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 0.40,
    unitWidthMeters: 0.80,
    unitDepthMeters: 0.40,
    clearanceMeters: 0.05,
    marginMeters: 0.05,
    codePrefix: 'TV',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Módulos estreitos replicados em linha para TVs (0.80m × 0.40m) com mesmo código por linha.',
  },
  single_mattress: {
    category: 'single_mattress',
    label: 'Colchão Solteiro',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 1.88,
    unitWidthMeters: 0.88,
    unitDepthMeters: 1.88,
    clearanceMeters: 0.08,
    marginMeters: 0.08,
    codePrefix: 'CS',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Espaço padrão para colchão solteiro (0.88m × 1.88m) replicado em linha com mesmo código.',
  },
  double_mattress: {
    category: 'double_mattress',
    label: 'Colchão Casal / Queen',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 1.88,
    unitWidthMeters: 1.38,
    unitDepthMeters: 1.88,
    clearanceMeters: 0.08,
    marginMeters: 0.08,
    codePrefix: 'CC',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Espaço padrão para colchão casal (1.38m × 1.88m) replicado em linha com mesmo código.',
  },
  single_box_base: {
    category: 'single_box_base',
    label: 'Base Box Solteiro',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 1.88,
    unitWidthMeters: 0.88,
    unitDepthMeters: 1.88,
    clearanceMeters: 0.08,
    marginMeters: 0.08,
    codePrefix: 'BS',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Espaço para base box solteiro (0.88m × 1.88m) replicado em linha com mesmo código.',
  },
  double_box_base: {
    category: 'double_box_base',
    label: 'Base Box Casal',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 1.88,
    unitWidthMeters: 1.38,
    unitDepthMeters: 1.88,
    clearanceMeters: 0.08,
    marginMeters: 0.08,
    codePrefix: 'BC',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Espaço para base box casal (1.38m × 1.88m) replicado em linha com mesmo código.',
  },
  flat_pack_furniture: {
    category: 'flat_pack_furniture',
    label: 'Móveis em Caixas (Desmontados)',
    defaultMethod: 'horizontal_rows', // Fileiras contínuas de largura total
    rowDepthMeters: 0.80,
    unitWidthMeters: 0,
    unitDepthMeters: 0.80,
    clearanceMeters: 0,
    marginMeters: 0.10,
    codePrefix: 'MOV',
    defaultUnit: 'CX',
    sameCodePerRow: false,
    description: 'Fileiras horizontais contínuas de 80 cm para caixas pesadas de MDF/MDP.',
  },
  sofas: {
    category: 'sofas',
    label: 'Sofás & Estofados',
    defaultMethod: 'dimensioned_units',
    rowDepthMeters: 1.10,
    unitWidthMeters: 2.20,
    unitDepthMeters: 1.10,
    clearanceMeters: 0.12,
    marginMeters: 0.15,
    codePrefix: 'SOF',
    defaultUnit: 'UN',
    sameCodePerRow: true,
    description: 'Posições de 2.20m × 1.10m replicadas em linha com mesmo código.',
  },
  pallet: {
    category: 'pallet',
    label: 'Palete PBR / Caixa Master',
    defaultMethod: 'grid',
    rowDepthMeters: 1.00,
    unitWidthMeters: 1.20,
    unitDepthMeters: 1.00,
    clearanceMeters: 0.10,
    marginMeters: 0.10,
    codePrefix: 'P',
    defaultUnit: 'PALETE',
    sameCodePerRow: false,
    description: 'Grade padronizada de paletes PBR (1.20m × 1.00m).',
  },
  general: {
    category: 'general',
    label: 'Armazenagem Geral CD',
    defaultMethod: 'grid',
    rowDepthMeters: 1.00,
    unitWidthMeters: 1.20,
    unitDepthMeters: 1.00,
    clearanceMeters: 0.10,
    marginMeters: 0.10,
    codePrefix: 'P',
    defaultUnit: 'UN',
    sameCodePerRow: false,
    description: 'Grade de posições padrão PBR (1.20m × 1.00m).',
  },
};

export function getCategoryProfile(category?: string): StorageCategoryProfile {
  if (category && STORAGE_PROFILES[category]) {
    return STORAGE_PROFILES[category];
  }
  return STORAGE_PROFILES.general;
}

export function getDefaultLayoutForCategory(category?: string): ZoneInternalLayout {
  const profile = getCategoryProfile(category);
  return {
    method: profile.defaultMethod,
    rowDepthMeters: profile.rowDepthMeters,
    unitWidthMeters: profile.unitWidthMeters,
    unitDepthMeters: profile.unitDepthMeters,
    clearanceMeters: profile.clearanceMeters,
    marginMeters: profile.marginMeters,
    codePrefix: profile.codePrefix,
    sameCodePerRow: profile.sameCodePerRow,
  };
}

export function formatPositionCode(prefix: string, index: number): string {
  const cleanPrefix = (prefix || 'P').trim().toUpperCase();
  return `${cleanPrefix}${String(index).padStart(4, '0')}`;
}

export function generateStablePositionId(zoneId: string, index: number): string {
  return `${zoneId}-pos-${String(index).padStart(4, '0')}`;
}

export function sanitizeZonePositions(zoneId: string, positions?: InternalPosition[]): InternalPosition[] {
  if (!Array.isArray(positions) || positions.length === 0) return [];
  const seenIds = new Set<string>();
  const sanitized: InternalPosition[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (!pos) continue;
    let safeId = pos.id;
    if (!safeId || typeof safeId !== 'string' || seenIds.has(safeId)) {
      safeId = generateStablePositionId(zoneId, i + 1);
      if (seenIds.has(safeId)) {
        safeId = `${zoneId}-pos-${String(i + 1).padStart(4, '0')}-${i + 1}`;
      }
    }
    seenIds.add(safeId);
    sanitized.push({
      ...pos,
      id: safeId,
    });
  }
  return sanitized;
}

// -------------------------------------------------------------
// MOTOR DE CÁLCULO DE POSIÇÕES INTERNAS
// -------------------------------------------------------------
export function calculateZoneInternalPositions(
  zone: { id: string; width: number; height: number; category?: string },
  scaleRatio: number,
  customLayout?: Partial<ZoneInternalLayout>,
  existingPositions?: InternalPosition[]
): InternalPosition[] {
  const profile = getCategoryProfile(zone.category);
  const safeScale = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;

  const layout: ZoneInternalLayout = {
    method: customLayout?.method ?? profile.defaultMethod,
    rowDepthMeters: customLayout?.rowDepthMeters ?? profile.rowDepthMeters,
    unitWidthMeters: customLayout?.unitWidthMeters ?? profile.unitWidthMeters,
    unitDepthMeters: customLayout?.unitDepthMeters ?? profile.unitDepthMeters,
    clearanceMeters: customLayout?.clearanceMeters ?? profile.clearanceMeters,
    marginMeters: customLayout?.marginMeters ?? profile.marginMeters,
    codePrefix: customLayout?.codePrefix ?? profile.codePrefix,
    sameCodePerRow: customLayout?.sameCodePerRow ?? profile.sameCodePerRow ?? false,
    columns: customLayout?.columns,
    rows: customLayout?.rows,
  };

  const positions: InternalPosition[] = [];
  const existingMap = new Map<string, InternalPosition>();
  const existingList = existingPositions || [];
  existingList.forEach((pos, idx) => {
    existingMap.set(pos.id, pos);
    // mapear também por índice para reaproveitamento
    existingMap.set(`idx-${idx}`, pos);
  });

  const prefix = layout.codePrefix || 'P';

  if (layout.method === 'horizontal_rows') {
    // -------------------------------------------------------------
    // MÉTODO A: FILEIRAS HORIZONTAIS DE LARGURA TOTAL
    // Usado para móveis desmontados (flat_pack_furniture)
    // Cada posição ocupa toda a largura útil da zona.
    // -------------------------------------------------------------
    const marginPx = Math.max(2, Math.round((layout.marginMeters ?? 0.10) * safeScale));
    const usefulWidthPx = Math.max(20, zone.width - marginPx * 2);
    const usefulHeightPx = Math.max(20, zone.height - marginPx * 2);

    const rowDepthMeters = Math.max(0.3, layout.rowDepthMeters ?? 0.80);
    const rowDepthPx = Math.max(12, Math.round(rowDepthMeters * safeScale));

    const rowCount = Math.max(1, Math.floor(usefulHeightPx / rowDepthPx));

    for (let i = 0; i < rowCount; i++) {
      const relX = marginPx;
      const relY = marginPx + i * rowDepthPx;
      const relWidth = usefulWidthPx;
      const relHeight = rowDepthPx;
      const currentIndex = i + 1;
      const stableId = generateStablePositionId(zone.id, currentIndex);

      // Reutiliza dados existentes se houver, removendo da fila para evitar duplicidade
      let existing = existingMap.get(stableId);
      if (existing) {
        existingMap.delete(stableId);
      } else {
        existing = existingMap.get(`idx-${i}`);
        if (existing) {
          existingMap.delete(`idx-${i}`);
          existingMap.delete(existing.id);
        }
      }

      positions.push({
        id: stableId,
        code: existing?.code || formatPositionCode(prefix, currentIndex),
        relX,
        relY,
        relWidth,
        relHeight,
        widthMeters: Number((relWidth / safeScale).toFixed(2)),
        depthMeters: Number((relHeight / safeScale).toFixed(2)),
        sku: existing?.sku,
        description: existing?.description,
        quantity: existing?.quantity,
        unit: existing?.unit || profile.defaultUnit,
        status: existing?.status || 'empty',
        updatedAt: existing?.updatedAt || new Date().toISOString(),
      });
    }
  } else if (layout.method === 'dimensioned_units' || layout.method === 'grid') {
    // -------------------------------------------------------------
    // MÉTODO B & C: POSIÇÕES DIMENSIONADAS / GRADE PADRÃO
    // Método B: eletrodomésticos com folgas operacionais
    // Método C: grade em linhas e colunas
    // -------------------------------------------------------------
    const marginPx = Math.max(2, Math.round((layout.marginMeters ?? 0.10) * safeScale));
    const clearancePx = Math.max(0, Math.round((layout.clearanceMeters ?? 0.10) * safeScale));
    const unitWidthMeters = Math.max(0.4, layout.unitWidthMeters ?? profile.unitWidthMeters ?? 1.0);
    const unitDepthMeters = Math.max(0.4, layout.unitDepthMeters ?? profile.unitDepthMeters ?? 1.0);

    const unitWPx = Math.max(16, Math.round(unitWidthMeters * safeScale));
    const unitHPx = Math.max(16, Math.round(unitDepthMeters * safeScale));

    const availableWidthPx = Math.max(unitWPx, zone.width - marginPx * 2);
    const availableHeightPx = Math.max(unitHPx, zone.height - marginPx * 2);

    const cols = Math.max(1, Math.floor((availableWidthPx + clearancePx) / (unitWPx + clearancePx)));
    const rows = Math.max(1, Math.floor((availableHeightPx + clearancePx) / (unitHPx + clearancePx)));

    const sameCodePerRow = layout.sameCodePerRow ?? profile.sameCodePerRow ?? false;

    let currentIndex = 0;
    for (let r = 0; r < rows; r++) {
      const lineCode = formatPositionCode(prefix, r + 1);
      for (let c = 0; c < cols; c++) {
        currentIndex++;
        const relX = marginPx + c * (unitWPx + clearancePx);
        const relY = marginPx + r * (unitHPx + clearancePx);
        const relWidth = unitWPx;
        const relHeight = unitHPx;
        const stableId = generateStablePositionId(zone.id, currentIndex);

        let existing = existingMap.get(stableId);
        if (existing) {
          existingMap.delete(stableId);
        } else {
          existing = existingMap.get(`idx-${currentIndex - 1}`);
          if (existing) {
            existingMap.delete(`idx-${currentIndex - 1}`);
            existingMap.delete(existing.id);
          }
        }
        const autoCode = sameCodePerRow ? lineCode : formatPositionCode(prefix, currentIndex);

        positions.push({
          id: stableId,
          code: existing?.code || autoCode,
          label: existing?.label || (sameCodePerRow && cols > 1 ? `Posição ${c + 1} de ${cols}` : undefined),
          relX,
          relY,
          relWidth,
          relHeight,
          widthMeters: Number((relWidth / safeScale).toFixed(2)),
          depthMeters: Number((relHeight / safeScale).toFixed(2)),
          sku: existing?.sku,
          description: existing?.description,
          quantity: existing?.quantity,
          unit: existing?.unit || profile.defaultUnit,
          status: existing?.status || 'empty',
          updatedAt: existing?.updatedAt || new Date().toISOString(),
        });
      }
    }
  } else if (layout.method === 'custom') {
    // -------------------------------------------------------------
    // MÉTODO D: LAYOUT PERSONALIZADO
    // Divisão manual em número exato de colunas e linhas
    // -------------------------------------------------------------
    const cols = Math.max(1, layout.columns || 2);
    const rows = Math.max(1, layout.rows || 2);
    const marginPx = Math.max(2, Math.round((layout.marginMeters ?? 0.10) * safeScale));
    const clearancePx = Math.max(0, Math.round((layout.clearanceMeters ?? 0.05) * safeScale));

    const usefulWidth = zone.width - marginPx * 2 - (cols - 1) * clearancePx;
    const usefulHeight = zone.height - marginPx * 2 - (rows - 1) * clearancePx;

    const cellW = Math.max(16, usefulWidth / cols);
    const cellH = Math.max(16, usefulHeight / rows);

    let currentIndex = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        currentIndex++;
        const relX = marginPx + c * (cellW + clearancePx);
        const relY = marginPx + r * (cellH + clearancePx);
        const stableId = generateStablePositionId(zone.id, currentIndex);

        let existing = existingMap.get(stableId);
        if (existing) {
          existingMap.delete(stableId);
        } else {
          existing = existingMap.get(`idx-${currentIndex - 1}`);
          if (existing) {
            existingMap.delete(`idx-${currentIndex - 1}`);
            existingMap.delete(existing.id);
          }
        }

        positions.push({
          id: stableId,
          code: existing?.code || formatPositionCode(prefix, currentIndex),
          relX,
          relY,
          relWidth: cellW,
          relHeight: cellH,
          widthMeters: Number((cellW / safeScale).toFixed(2)),
          depthMeters: Number((cellH / safeScale).toFixed(2)),
          sku: existing?.sku,
          description: existing?.description,
          quantity: existing?.quantity,
          unit: existing?.unit || profile.defaultUnit,
          status: existing?.status || 'empty',
          updatedAt: existing?.updatedAt || new Date().toISOString(),
        });
      }
    }
  }

  return sanitizeZonePositions(zone.id, positions);
}

// -------------------------------------------------------------
// VERIFICAÇÃO DE ESPAÇO E REDIMENSIONAMENTO SEGURO
// Informa o usuário caso posições com estoque sofram corte
// -------------------------------------------------------------
export type ResizeRecalculationResult = {
  positions: InternalPosition[];
  hasLossWarning: boolean;
  overflowOccupiedPositions: InternalPosition[];
  totalPreviousPositions: number;
  totalNewPositions: number;
};

export function recalculatePositionsOnZoneResize(
  zone: { id: string; width: number; height: number; category?: string },
  scaleRatio: number,
  layout: ZoneInternalLayout | undefined,
  currentPositions: InternalPosition[]
): ResizeRecalculationResult {
  const safeScale = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;
  const newPositions = calculateZoneInternalPositions(zone, safeScale, layout, currentPositions);

  const newCount = newPositions.length;
  const prevCount = currentPositions.length;

  const overflowOccupiedPositions: InternalPosition[] = [];

  if (prevCount > newCount) {
    const dropped = currentPositions.slice(newCount);
    for (const p of dropped) {
      if (p.status !== 'empty' || (p.sku && p.sku.trim().length > 0) || (p.quantity && p.quantity > 0)) {
        overflowOccupiedPositions.push(p);
      }
    }
  }

  return {
    positions: newPositions,
    hasLossWarning: overflowOccupiedPositions.length > 0,
    overflowOccupiedPositions,
    totalPreviousPositions: prevCount,
    totalNewPositions: newCount,
  };
}

// -------------------------------------------------------------
// CRIAR ZONA COM POSIÇÕES INTERNAS INICIAIS
// Usado na inserção de zonas prontas temáticas
// -------------------------------------------------------------
export function createZoneWithInternalLayout(params: {
  zoneId: string;
  category?: string;
  widthPx: number;
  heightPx: number;
  scaleRatio: number;
  sampleSku?: string;
  sampleDescription?: string;
  layoutOverride?: Partial<ZoneInternalLayout>;
}): { internalLayout: ZoneInternalLayout; internalPositions: InternalPosition[] } {
  const profile = getCategoryProfile(params.category);
  const safeScale = Number.isFinite(params.scaleRatio) && params.scaleRatio > 0 ? params.scaleRatio : 25;

  const layout: ZoneInternalLayout = {
    method: params.layoutOverride?.method ?? profile.defaultMethod,
    rowDepthMeters: params.layoutOverride?.rowDepthMeters ?? profile.rowDepthMeters,
    unitWidthMeters: params.layoutOverride?.unitWidthMeters ?? profile.unitWidthMeters,
    unitDepthMeters: params.layoutOverride?.unitDepthMeters ?? profile.unitDepthMeters,
    clearanceMeters: params.layoutOverride?.clearanceMeters ?? profile.clearanceMeters,
    marginMeters: params.layoutOverride?.marginMeters ?? profile.marginMeters,
    codePrefix: params.layoutOverride?.codePrefix ?? profile.codePrefix,
    columns: params.layoutOverride?.columns,
    rows: params.layoutOverride?.rows,
  };

  const positions = calculateZoneInternalPositions(
    {
      id: params.zoneId,
      width: params.widthPx,
      height: params.heightPx,
      category: params.category,
    },
    safeScale,
    layout
  );

  // Se houver amostra de SKU, povoar a primeira ou segunda posição com dados de exemplo
  if (params.sampleSku && positions.length > 0) {
    positions[0] = {
      ...positions[0],
      sku: params.sampleSku,
      description: params.sampleDescription || `${profile.label} — Amostra`,
      quantity: 12,
      unit: profile.defaultUnit,
      status: 'occupied',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    internalLayout: layout,
    internalPositions: positions,
  };
}

// -------------------------------------------------------------
// APLICAR PRESET DE PORTE DE VOLUME A UMA ZONA
// Recalcula automaticamente as posições internas para o produto
// -------------------------------------------------------------
export function applyVolumePresetToZone(
  element: any,
  presetId: string,
  scaleRatio: number
): any {
  const profile = getCategoryProfile(presetId);
  const safeScale = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 25;

  const layout: ZoneInternalLayout = {
    method: profile.defaultMethod,
    rowDepthMeters: profile.rowDepthMeters,
    unitWidthMeters: profile.unitWidthMeters,
    unitDepthMeters: profile.unitDepthMeters,
    clearanceMeters: profile.clearanceMeters,
    marginMeters: profile.marginMeters,
    codePrefix: profile.codePrefix,
    sameCodePerRow: profile.sameCodePerRow,
  };

  const newPositions = calculateZoneInternalPositions(
    {
      id: element.id,
      width: element.width,
      height: element.height,
      category: profile.category,
    },
    safeScale,
    layout
  );

  return {
    ...element,
    productSize: presetId,
    category: profile.category,
    internalLayout: layout,
    internalPositions: newPositions,
  };
}


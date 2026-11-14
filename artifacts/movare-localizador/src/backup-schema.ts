import { z } from 'zod';
import type {
  FloorArea,
  DrawingElement,
  RackSlot,
  WarehouseLayer,
  InternalPosition,
  ZoneInternalLayout,
  PositionStockStatus,
  ProductSize,
} from './editor-model';
import {
  DEFAULT_SCALE_RATIO,
  DEFAULT_WIDTH_METERS,
  DEFAULT_HEIGHT_METERS,
  createId,
} from './warehouse-constants';

// -------------------------------------------------------------
// ESQUEMAS ZOD PARA DADOS INTERNOS WMS
// -------------------------------------------------------------

export const PositionStockStatusSchema = z.enum(['empty', 'occupied', 'reserved']);

export const InternalPositionSchema = z.object({
  id: z.string().min(1, 'ID da posição é obrigatório'),
  code: z.string().default(''),
  label: z.string().optional(),
  relX: z.number().finite('relX deve ser um número finito').default(0),
  relY: z.number().finite('relY deve ser um número finito').default(0),
  relWidth: z.number().finite().nonnegative('relWidth não pode ser negativo').default(25),
  relHeight: z.number().finite().nonnegative('relHeight não pode ser negativo').default(25),
  widthMeters: z.number().finite().nonnegative('widthMeters não pode ser negativo').default(0),
  depthMeters: z.number().finite().nonnegative('depthMeters não pode ser negativo').default(0),
  sku: z.string().optional(),
  description: z.string().optional(),
  model: z.string().optional(),
  supplier: z.string().optional(),
  volumesPerItem: z.number().finite().nonnegative().optional(),
  quantity: z.number().finite().nonnegative().optional(),
  unit: z.string().optional(),
  status: PositionStockStatusSchema.default('empty'),
  updatedAt: z.string().optional(),
  notes: z.string().optional(),
  reservedStore: z.string().optional(),
  reservedQuantity: z.number().finite().nonnegative().optional(),
  reservedAt: z.string().optional(),
  reservedBy: z.string().optional(),
  reservedByEmail: z.string().optional(),
});

export const ZoneInternalLayoutSchema = z.object({
  method: z.enum(['horizontal_rows', 'dimensioned_units', 'grid', 'custom']).default('grid'),
  rowDepthMeters: z.number().nonnegative().optional(),
  unitWidthMeters: z.number().nonnegative().optional(),
  unitDepthMeters: z.number().nonnegative().optional(),
  clearanceMeters: z.number().nonnegative().optional(),
  marginMeters: z.number().nonnegative().optional(),
  codePrefix: z.string().optional(),
  sameCodePerRow: z.boolean().optional(),
  columns: z.number().int().nonnegative().optional(),
  rows: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const RackSlotSchema = z.object({
  id: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  status: z.enum(['empty', 'occupied', 'reserved']).default('empty'),
  productSize: z.string().optional() as z.ZodType<ProductSize | undefined>,
  category: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const HexColorSchema = z.string().regex(
  /^#([\da-fA-F]{3}|[\da-fA-F]{6}|[\da-fA-F]{8})$/,
  'Cor deve estar no formato hexadecimal (#RRGGBB)'
);

export const DrawingElementSchema = z.object({
  id: z.string().min(1, 'ID do elemento é obrigatório'),
  type: z.enum(['rectangle', 'divider', 'rack', 'corridor']),
  name: z.string(),
  color: HexColorSchema.optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
  corridorText: z.string().optional(),
  fontSize: z.number().nonnegative().optional(),
  letterSpacing: z.number().optional(),
  fontWeight: z.enum(['normal', 'bold', 'extrabold']).optional(),
  street: z.string().optional(),
  modules: z.number().int().nonnegative().optional(),
  levels: z.number().int().nonnegative().optional(),
  baysPerLevel: z.number().int().nonnegative().optional(),
  slots: z.record(z.string(), RackSlotSchema).optional(),
  productSize: z.string().optional() as z.ZodType<ProductSize | undefined>,
  category: z.string().optional(),
  skuCode: z.string().optional(),
  model: z.string().optional(),
  supplier: z.string().optional(),
  volumesPerItem: z.number().finite().nonnegative().optional(),
  capacity: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  rotation: z.number().finite().optional(),
  locked: z.boolean().optional(),
  internalLayout: ZoneInternalLayoutSchema.optional(),
  internalPositions: z.array(InternalPositionSchema).optional(),
  overflowPositions: z.array(InternalPositionSchema).optional(),
  groupId: z.string().optional(),
  hidden: z.boolean().optional(),
}).refine(
  (el) => {
    if (el.type === 'rectangle' || el.type === 'rack' || el.type === 'corridor') {
      return el.width >= 1 && el.height >= 1;
    }
    return Math.hypot(el.width, el.height) >= 1;
  },
  { message: 'Dimensões do elemento devem ser de pelo menos 1 unidade' }
);

export const WarehouseLayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: HexColorSchema,
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  description: z.string().optional(),
});

export const FloorAreaSchema = z.object({
  id: z.string().min(1, 'ID da área é obrigatório'),
  name: z.string().min(1, 'Nome da área é obrigatório'),
  scaleRatio: z.number().positive().default(DEFAULT_SCALE_RATIO),
  widthMeters: z.number().positive().default(DEFAULT_WIDTH_METERS),
  heightMeters: z.number().positive().default(DEFAULT_HEIGHT_METERS),
  elements: z.array(DrawingElementSchema),
  layers: z.array(WarehouseLayerSchema).optional(),
});

// -------------------------------------------------------------
// ESQUEMAS DE BACKUP VERSIONADO
// -------------------------------------------------------------

export const BackupV3Schema = z.object({
  format: z.literal('movare-localizador-backup'),
  version: z.union([z.literal(3), z.literal(2), z.literal(1)]),
  exportedAt: z.string().refine((val) => Number.isFinite(Date.parse(val)), 'Data de exportação inválida'),
  areas: z.array(FloorAreaSchema).min(1, 'O backup deve conter ao menos uma área'),
});

export type BackupSummary = {
  version: number;
  exportedAt: string;
  areasCount: number;
  elementsCount: number;
  totalPositions: number;
  occupiedPositions: number;
  overflowPositionsCount: number;
  categories: string[];
};

/**
 * Validação profunda de unicidade de IDs e integridade relacional.
 */
export function validateAreasDeep(areas: FloorArea[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const areaIds = new Set<string>();

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    if (areaIds.has(area.id)) {
      errors.push(`Área com ID duplicado detectada: "${area.id}"`);
    }
    areaIds.add(area.id);

    const elementIds = new Set<string>();
    for (let j = 0; j < area.elements.length; j++) {
      const el = area.elements[j];
      if (elementIds.has(el.id)) {
        errors.push(`Elemento com ID duplicado detectado na área "${area.name}": "${el.id}"`);
      }
      elementIds.add(el.id);

      if (el.internalPositions && el.internalPositions.length > 0) {
        const posIds = new Set<string>();
        for (let k = 0; k < el.internalPositions.length; k++) {
          const pos = el.internalPositions[k];
          if (posIds.has(pos.id)) {
            // Corrige ou reporta duplicata de ID de posição
            errors.push(`Posição interna com ID duplicado na zona "${el.name}": "${pos.id}"`);
          }
          posIds.add(pos.id);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converte e migra qualquer backup (v1, v2 ou v3) para a versão v3 atual,
 * preservando integralmente dados, posições e configurações.
 */
export function migrateBackupData(raw: unknown): {
  success: boolean;
  areas: FloorArea[];
  summary: BackupSummary;
  errors: string[];
} {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      areas: [],
      summary: {
        version: 0,
        exportedAt: '',
        areasCount: 0,
        elementsCount: 0,
        totalPositions: 0,
        occupiedPositions: 0,
        overflowPositionsCount: 0,
        categories: [],
      },
      errors: ['O arquivo fornecido não é um objeto JSON válido.'],
    };
  }

  const rawObj = raw as Record<string, any>;
  const format = rawObj.format;
  const version = typeof rawObj.version === 'number' ? rawObj.version : 1;
  const exportedAt = typeof rawObj.exportedAt === 'string' && Number.isFinite(Date.parse(rawObj.exportedAt))
    ? rawObj.exportedAt
    : new Date().toISOString();

  if (format !== 'movare-localizador-backup') {
    return {
      success: false,
      areas: [],
      summary: {
        version,
        exportedAt,
        areasCount: 0,
        elementsCount: 0,
        totalPositions: 0,
        occupiedPositions: 0,
        overflowPositionsCount: 0,
        categories: [],
      },
      errors: [`Formato de arquivo incompatível: "${format}". Esperado: "movare-localizador-backup".`],
    };
  }

  const rawAreas = Array.isArray(rawObj.areas) ? rawObj.areas : [];
  if (rawAreas.length === 0) {
    return {
      success: false,
      areas: [],
      summary: {
        version,
        exportedAt,
        areasCount: 0,
        elementsCount: 0,
        totalPositions: 0,
        occupiedPositions: 0,
        overflowPositionsCount: 0,
        categories: [],
      },
      errors: ['O backup não contém nenhuma área de armazém cadastrada.'],
    };
  }

  const migratedAreas: FloorArea[] = [];
  const errors: string[] = [];
  const seenAreaIds = new Set<string>();

  for (let i = 0; i < rawAreas.length; i++) {
    const rawArea = rawAreas[i];
    if (!rawArea || typeof rawArea !== 'object') continue;

    let areaId = typeof rawArea.id === 'string' && rawArea.id.trim() ? rawArea.id.trim() : `area-${i + 1}`;
    if (seenAreaIds.has(areaId)) {
      areaId = `${areaId}-copy-${i + 1}`;
    }
    seenAreaIds.add(areaId);

    const scaleRatio = typeof rawArea.scaleRatio === 'number' && rawArea.scaleRatio > 0
      ? rawArea.scaleRatio
      : DEFAULT_SCALE_RATIO;

    const widthMeters = typeof rawArea.widthMeters === 'number' && rawArea.widthMeters > 0
      ? rawArea.widthMeters
      : DEFAULT_WIDTH_METERS;

    const heightMeters = typeof rawArea.heightMeters === 'number' && rawArea.heightMeters > 0
      ? rawArea.heightMeters
      : DEFAULT_HEIGHT_METERS;

    const rawElements = Array.isArray(rawArea.elements) ? rawArea.elements : [];
    const migratedElements: DrawingElement[] = [];
    const seenElementIds = new Set<string>();

    for (let j = 0; j < rawElements.length; j++) {
      const el = rawElements[j];
      if (!el || typeof el !== 'object') continue;

      let elId = typeof el.id === 'string' && el.id.trim() ? el.id.trim() : createId('el');
      if (seenElementIds.has(elId)) {
        elId = `${elId}-${j + 1}`;
      }
      seenElementIds.add(elId);

      const type = ['rectangle', 'divider', 'rack', 'corridor'].includes(el.type) ? el.type : 'rectangle';
      const name = typeof el.name === 'string' && el.name.trim() ? el.name.trim() : `Zona ${j + 1}`;
      const color = typeof el.color === 'string' && /^#[\da-fA-F]{6}$/.test(el.color)
        ? el.color
        : type === 'divider' ? '#475569' : type === 'rack' ? '#ea580c' : '#0284c7';

      // Sanitiza posições internas
      const rawPositions = Array.isArray(el.internalPositions) ? el.internalPositions : [];
      const migratedPositions: InternalPosition[] = [];
      const seenPosIds = new Set<string>();

      for (let k = 0; k < rawPositions.length; k++) {
        const p = rawPositions[k];
        if (!p || typeof p !== 'object') continue;

        let posId = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `${elId}-pos-${String(k + 1).padStart(4, '0')}`;
        if (seenPosIds.has(posId)) {
          posId = `${posId}-${k + 1}`;
        }
        seenPosIds.add(posId);

        const relW = typeof p.relWidth === 'number' && p.relWidth > 0 ? p.relWidth : 25;
        const relH = typeof p.relHeight === 'number' && p.relHeight > 0 ? p.relHeight : 25;
        const wMeters = typeof p.widthMeters === 'number' && p.widthMeters > 0 ? p.widthMeters : Number((relW / scaleRatio).toFixed(2));
        const dMeters = typeof p.depthMeters === 'number' && p.depthMeters > 0 ? p.depthMeters : Number((relH / scaleRatio).toFixed(2));

        migratedPositions.push({
          id: posId,
          code: typeof p.code === 'string' && p.code.trim() ? p.code.trim() : `P${String(k + 1).padStart(4, '0')}`,
          label: typeof p.label === 'string' ? p.label : undefined,
          relX: typeof p.relX === 'number' && Number.isFinite(p.relX) ? p.relX : 0,
          relY: typeof p.relY === 'number' && Number.isFinite(p.relY) ? p.relY : 0,
          relWidth: relW,
          relHeight: relH,
          widthMeters: wMeters,
          depthMeters: dMeters,
          sku: typeof p.sku === 'string' ? p.sku.trim() : undefined,
          description: typeof p.description === 'string' ? p.description.trim() : undefined,
          model: typeof p.model === 'string' ? p.model.trim() : undefined,
          supplier: typeof p.supplier === 'string' ? p.supplier.trim() : undefined,
          volumesPerItem: typeof p.volumesPerItem === 'number' && p.volumesPerItem >= 0 ? p.volumesPerItem : undefined,
          quantity: typeof p.quantity === 'number' && p.quantity >= 0 ? p.quantity : undefined,
          unit: typeof p.unit === 'string' ? p.unit : 'UN',
          status: ['empty', 'occupied', 'reserved'].includes(p.status) ? p.status : (p.sku ? 'occupied' : 'empty'),
          updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined,
          notes: typeof p.notes === 'string' ? p.notes : undefined,
          reservedStore: typeof p.reservedStore === 'string' ? p.reservedStore.trim() : undefined,
          reservedQuantity:
            typeof p.reservedQuantity === 'number' && Number.isFinite(p.reservedQuantity) && p.reservedQuantity >= 0
              ? p.reservedQuantity
              : undefined,
          reservedAt: typeof p.reservedAt === 'string' ? p.reservedAt : undefined,
          reservedBy: typeof p.reservedBy === 'string' ? p.reservedBy.trim() : undefined,
          reservedByEmail: typeof p.reservedByEmail === 'string' ? p.reservedByEmail.trim() : undefined,
        });
      }

      // Sanitiza posições em overflow se existirem
      const rawOverflow = Array.isArray(el.overflowPositions) ? el.overflowPositions : [];
      const migratedOverflow: InternalPosition[] = [];
      for (let m = 0; m < rawOverflow.length; m++) {
        const op = rawOverflow[m];
        if (!op || typeof op !== 'object') continue;
        migratedOverflow.push({
          id: typeof op.id === 'string' ? op.id : `${elId}-ovf-${m + 1}`,
          code: typeof op.code === 'string' ? op.code : `OVF-${m + 1}`,
          relX: 0,
          relY: 0,
          relWidth: 25,
          relHeight: 25,
          widthMeters: 1,
          depthMeters: 1,
          sku: typeof op.sku === 'string' ? op.sku : undefined,
          description: typeof op.description === 'string' ? op.description : undefined,
          quantity: typeof op.quantity === 'number' ? op.quantity : 1,
          unit: typeof op.unit === 'string' ? op.unit : 'UN',
          status: 'occupied',
          updatedAt: op.updatedAt,
          notes: op.notes || 'Retido por corte de dimensões da zona',
        });
      }

      migratedElements.push({
        id: elId,
        type,
        name,
        color,
        x: typeof el.x === 'number' && Number.isFinite(el.x) ? el.x : 0,
        y: typeof el.y === 'number' && Number.isFinite(el.y) ? el.y : 0,
        width: typeof el.width === 'number' && el.width > 0 ? el.width : 50,
        height: typeof el.height === 'number' && el.height > 0 ? el.height : 50,
        corridorText: el.corridorText,
        fontSize: el.fontSize,
        letterSpacing: el.letterSpacing,
        fontWeight: el.fontWeight,
        street: el.street,
        modules: el.modules,
        levels: el.levels,
        baysPerLevel: el.baysPerLevel,
        slots: el.slots,
        productSize: el.productSize,
        category: el.category || 'general',
        skuCode: el.skuCode,
        capacity: typeof el.capacity === 'number' ? el.capacity : undefined,
        notes: el.notes,
        rotation: el.rotation || 0,
        locked: !!el.locked,
        internalLayout: el.internalLayout,
        internalPositions: migratedPositions.length > 0 ? migratedPositions : undefined,
        overflowPositions: migratedOverflow.length > 0 ? migratedOverflow : undefined,
        groupId: el.groupId,
        hidden: !!el.hidden,
      });
    }

    migratedAreas.push({
      id: areaId,
      name: typeof rawArea.name === 'string' && rawArea.name.trim() ? rawArea.name.trim() : `Galpão ${i + 1}`,
      scaleRatio,
      widthMeters,
      heightMeters,
      elements: migratedElements,
      layers: Array.isArray(rawArea.layers) ? rawArea.layers : undefined,
    });
  }

  // Gera estatísticas do resumo
  let elementsCount = 0;
  let totalPositions = 0;
  let occupiedPositions = 0;
  let overflowPositionsCount = 0;
  const categoriesSet = new Set<string>();

  for (const a of migratedAreas) {
    elementsCount += a.elements.length;
    for (const el of a.elements) {
      if (el.category) categoriesSet.add(el.category);
      if (el.internalPositions) {
        totalPositions += el.internalPositions.length;
        for (const p of el.internalPositions) {
          if (p.status === 'occupied' || (p.sku && p.sku.trim().length > 0)) {
            occupiedPositions++;
          }
        }
      }
      if (el.overflowPositions) {
        overflowPositionsCount += el.overflowPositions.length;
      }
    }
  }

  const summary: BackupSummary = {
    version: 3, // Migrado para a versão mais recente
    exportedAt,
    areasCount: migratedAreas.length,
    elementsCount,
    totalPositions,
    occupiedPositions,
    overflowPositionsCount,
    categories: Array.from(categoriesSet),
  };

  return {
    success: true,
    areas: migratedAreas,
    summary,
    errors,
  };
}

/**
 * Validação rigorosa do arquivo de backup recebido pelo usuário.
 */
export function parseAndValidateBackup(rawJson: string): {
  success: boolean;
  areas: FloorArea[];
  summary?: BackupSummary;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    const result = migrateBackupData(parsed);
    if (!result.success) {
      return {
        success: false,
        areas: [],
        error: result.errors.join(' | '),
      };
    }

    return {
      success: true,
      areas: result.areas,
      summary: result.summary,
    };
  } catch (err: any) {
    return {
      success: false,
      areas: [],
      error: `Formato JSON inválido: ${err?.message || 'Arquivo corrompido'}`,
    };
  }
}

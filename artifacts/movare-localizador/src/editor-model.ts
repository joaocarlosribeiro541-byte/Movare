import type {
  InternalPosition,
  ZoneInternalLayout,
  InternalLayoutMethod,
  PositionStockStatus,
} from './zone-internal-positions';

export type {
  InternalPosition,
  ZoneInternalLayout,
  InternalLayoutMethod,
  PositionStockStatus,
};

export type ProductSize =
  | 'refrigerators'
  | 'stoves'
  | 'microwaves'
  | 'televisions'
  | 'single_mattress'
  | 'double_mattress'
  | 'single_box_base'
  | 'double_box_base'
  | 'flat_pack_furniture'
  | 'sofas'
  | 'pallet'
  | 'special';

export const PRODUCT_SIZES: { id: ProductSize; label: string; icon: string; short: string; desc: string; dimensions: string }[] = [
  { id: 'refrigerators', label: 'Geladeiras & Freezers', icon: '🧊', short: 'GEL', desc: 'Auto-replicação em linha (0.85m × 0.85m) com mesmo código', dimensions: '0.85m × 0.85m' },
  { id: 'stoves', label: 'Fogões & Fornos', icon: '🔥', short: 'FOG', desc: 'Auto-replicação em linha (0.65m × 0.65m) com mesmo código', dimensions: '0.65m × 0.65m' },
  { id: 'microwaves', label: 'Micro-ondas & Eletros', icon: '⚡', short: 'MIC', desc: 'Replicação modular compacta (0.55m × 0.45m) em linha', dimensions: '0.55m × 0.45m' },
  { id: 'televisions', label: 'Televisão & Smart TVs', icon: '📺', short: 'TV', desc: 'Replicação em linha para painéis/TVs (0.80m × 0.40m)', dimensions: '0.80m × 0.40m' },
  { id: 'single_mattress', label: 'Colchão Solteiro', icon: '🛏️', short: 'COL-S', desc: 'Espaço padrão solteiro (0.88m × 1.88m) em linha', dimensions: '0.88m × 1.88m' },
  { id: 'double_mattress', label: 'Colchão Casal / Queen', icon: '🛏️', short: 'COL-C', desc: 'Espaço padrão casal (1.38m × 1.88m) em linha', dimensions: '1.38m × 1.88m' },
  { id: 'single_box_base', label: 'Base Box Solteiro', icon: '📦', short: 'BOX-S', desc: 'Bases box solteiro (0.88m × 1.88m) em linha', dimensions: '0.88m × 1.88m' },
  { id: 'double_box_base', label: 'Base Box Casal', icon: '📦', short: 'BOX-C', desc: 'Bases box casal (1.38m × 1.88m) em linha', dimensions: '1.38m × 1.88m' },
  { id: 'flat_pack_furniture', label: 'Móveis em Caixas (Desmontados)', icon: '🪵', short: 'MÓV-CX', desc: 'Fileiras horizontais contínuas de 0.80m (largura total)', dimensions: '0.80m Fileira' },
  { id: 'sofas', label: 'Sofás & Estofados', icon: '🛋️', short: 'SOF', desc: 'Módulos para estofados embalados (2.20m × 1.10m)', dimensions: '2.20m × 1.10m' },
  { id: 'pallet', label: 'Palete PBR / Caixa Master', icon: '📦', short: 'PBR', desc: 'Grade padrão PBR 1.20m × 1.00m', dimensions: '1.20m × 1.00m' },
  { id: 'special', label: 'Carga Especial / Outros', icon: '⭐', short: 'ESP', desc: 'Dimensões e colunas customizadas', dimensions: 'Variável' },
];

export const PRODUCT_CATEGORIES = [
  { id: 'refrigerators', label: 'Geladeiras & Freezers', color: '#0284c7', badge: 'GELADEIRAS' },
  { id: 'stoves', label: 'Fogões & Fornos', color: '#ea580c', badge: 'FOGÕES' },
  { id: 'microwaves', label: 'Micro-ondas & Eletros', color: '#0284c7', badge: 'MICRO-ONDAS' },
  { id: 'televisions', label: 'Televisão & Smart TVs', color: '#2563eb', badge: 'TVs' },
  { id: 'single_mattress', label: 'Colchão Solteiro', color: '#7c3aed', badge: 'COLCHÃO SOLT' },
  { id: 'double_mattress', label: 'Colchão Casal', color: '#6d28d9', badge: 'COLCHÃO CASAL' },
  { id: 'single_box_base', label: 'Base Box Solteiro', color: '#8b5cf6', badge: 'BOX SOLT' },
  { id: 'double_box_base', label: 'Base Box Casal', color: '#7c3aed', badge: 'BOX CASAL' },
  { id: 'flat_pack_furniture', label: 'Móveis em Caixas (Desmontados)', color: '#b45309', badge: 'MÓVEIS CX' },
  { id: 'sofas', label: 'Sofás, Poltronas & Estofados', color: '#059669', badge: 'ESTOFADOS' },
  { id: 'pallet', label: 'Palete PBR Geral', color: '#64748b', badge: 'PALETE PBR' },
  { id: 'docks', label: 'Docas Inbound & Outbound', color: '#10b981', badge: 'DOCAS' },
  { id: 'staging', label: 'Triagem, Conferência & Pulmão', color: '#eab308', badge: 'TRIAGEM' },
  { id: 'technical_avarias', label: 'Avarias & Assistência Moveleira', color: '#e11d48', badge: 'AVARIAS' },
  { id: 'general', label: 'Armazenagem Geral CD', color: '#64748b', badge: 'GERAL' },
];

export type RackSlot = {
  id: string; // Ex: "A-01-02-1" (Rua-Módulo-Nível-Vão)
  sku?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  status: 'empty' | 'occupied' | 'reserved';
  productSize?: ProductSize;
  category?: string;
  updatedAt?: string;
};

export type DrawingElement = {
  id: string;
  type: 'rectangle' | 'divider' | 'rack' | 'corridor';
  name: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  corridorText?: string;
  fontSize?: number;
  letterSpacing?: number;
  fontWeight?: 'normal' | 'bold' | 'extrabold';
  street?: string;
  modules?: number;
  levels?: number;
  baysPerLevel?: number;
  slots?: Record<string, RackSlot>;
  productSize?: ProductSize;
  category?: string;
  skuCode?: string;
  capacity?: number;
  notes?: string;
  rotation?: number;
  locked?: boolean;
  internalLayout?: ZoneInternalLayout;
  internalPositions?: InternalPosition[];
  groupId?: string;
  hidden?: boolean;
};

export type WarehouseLayer = {
  id: string;
  name: string;
  color: string;
  locked?: boolean;
  visible?: boolean;
  description?: string;
};

export type FloorArea = {
  id: string;
  name: string;
  scaleRatio?: number; // Pixels por metro (default: 20px = 1 metro)
  widthMeters?: number; // Largura do armazém em metros reais (ex: 80m)
  heightMeters?: number; // Comprimento do armazém em metros reais (ex: 50m)
  elements: DrawingElement[];
  layers?: WarehouseLayer[];
};

export type Backup = {
  format: 'movare-localizador-backup';
  version: 3;
  exportedAt: string;
  areas: FloorArea[];
};

export const DEFAULT_SCALE_RATIO = 20; // 20px = 1 metro
export const DEFAULT_WIDTH_METERS = 85; // 85 metros de largura padrão (1700px)
export const DEFAULT_HEIGHT_METERS = 55; // 55 metros de comprimento padrão (1100px)

export const WORLD_WIDTH = 1700;
export const WORLD_HEIGHT = 1100;

export function getAreaBounds(area?: FloorArea) {
  const ratio = area?.scaleRatio || DEFAULT_SCALE_RATIO;
  const wMeters = Math.max(20, area?.widthMeters || DEFAULT_WIDTH_METERS);
  const hMeters = Math.max(15, area?.heightMeters || DEFAULT_HEIGHT_METERS);
  return {
    widthPx: Math.round(wMeters * ratio),
    heightPx: Math.round(hMeters * ratio),
    widthMeters: wMeters,
    heightMeters: hMeters,
    areaM2: wMeters * hMeters,
  };
}

export const WMS_COLOR_PALETTE = [
  { name: 'Geladeiras & Freezers (Azul Ciano)', value: '#0284c7' },
  { name: 'Fogões & Linha Branca (Laranja)', value: '#ea580c' },
  { name: 'Móveis Madeira em Caixas (Madeira)', value: '#b45309' },
  { name: 'Colchões & Camas Box (Roxo)', value: '#7c3aed' },
  { name: 'Sofás & Estofados (Esmeralda)', value: '#059669' },
  { name: 'Eletroportáteis & TVs (Azul Royal)', value: '#2563eb' },
  { name: 'Texto de Corredor Branco (Branco)', value: '#ffffff' },
  { name: 'Texto de Corredor Azul Sky (Sky)', value: '#38bdf8' },
  { name: 'Texto de Corredor Amarelo (Amber)', value: '#f59e0b' },
  { name: 'Paredes & Divisórias (Grafite)', value: '#475569' },
];

export function createId(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Áreas Iniciais Limpas para o Galpão do Usuário
export const initialAreas: FloorArea[] = [
  {
    id: 'armazem-cd-01',
    name: 'Armazém Central 01',
    scaleRatio: DEFAULT_SCALE_RATIO,
    widthMeters: DEFAULT_WIDTH_METERS,
    heightMeters: DEFAULT_HEIGHT_METERS,
    elements: [],
  },
];

export function validAreas(value: unknown): value is FloorArea[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();

  return value.every((area) => {
    if (!area || typeof area.id !== 'string' || typeof area.name !== 'string' || !Array.isArray(area.elements)) return false;
    if (ids.has(area.id) || !area.name.trim()) return false;
    ids.add(area.id);

    const elementIds = new Set<string>();
    return area.elements.every((item: DrawingElement) => {
      if (!item || typeof item.id !== 'string' || elementIds.has(item.id)) return false;
      if (!['rectangle', 'divider', 'rack', 'corridor'].includes(item.type)) return false;
      if (typeof item.name !== 'string' || !item.name.trim()) return false;
      elementIds.add(item.id);

      if (item.color !== undefined && (typeof item.color !== 'string' || !/^#[\da-f]{6}$/i.test(item.color))) return false;
      if (![item.x, item.y, item.width, item.height].every((n) => typeof n === 'number' && Number.isFinite(n))) return false;

      if (item.type === 'rectangle' || item.type === 'rack' || item.type === 'corridor') {
        return item.width >= 1 && item.height >= 1;
      }
      return Math.hypot(item.width, item.height) >= 1;
    });
  });
}

export function parseBackup(raw: string): FloorArea[] {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('O arquivo não contém um backup válido.');
  const backup = parsed as Partial<Backup>;
  if (
    backup.format !== 'movare-localizador-backup' ||
    typeof backup.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(backup.exportedAt)) ||
    !validAreas(backup.areas)
  ) {
    throw new Error('Backup inválido ou incompatível. Nenhum dado foi alterado.');
  }

  return backup.areas.map((area) => ({
    ...area,
    scaleRatio: area.scaleRatio ?? DEFAULT_SCALE_RATIO,
    widthMeters: area.widthMeters ?? DEFAULT_WIDTH_METERS,
    heightMeters: area.heightMeters ?? DEFAULT_HEIGHT_METERS,
    elements: area.elements.map((el) => ({
      ...el,
      color: el.color ?? (el.type === 'divider' ? '#475569' : el.type === 'rack' ? '#ea580c' : '#b45309'),
    })),
  }));
}

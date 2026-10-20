export type DrawingElement = {
  id: string;
  type: 'rectangle' | 'divider';
  name: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloorArea = {
  id: string;
  name: string;
  elements: DrawingElement[];
};

export type Backup = {
  format: 'movare-localizador-backup';
  version: 1;
  exportedAt: string;
  areas: FloorArea[];
};

export const initialAreas: FloorArea[] = [
  { id: 'main-ground', name: 'Depósito principal — térreo', elements: [] },
  { id: 'main-upper', name: 'Depósito principal — segundo andar', elements: [] },
  { id: 'shed-1', name: 'Galpão 1', elements: [] },
  { id: 'shed-2', name: 'Galpão 2', elements: [] },
  { id: 'shed-3', name: 'Galpão 3', elements: [] },
];

export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;

export function createId() {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validAreas(value: unknown): value is FloorArea[] {
  if (!Array.isArray(value) || value.length !== initialAreas.length) return false;
  const ids = new Set<string>();
  return value.every((area) => {
    if (!area || typeof area.id !== 'string' || typeof area.name !== 'string' || !Array.isArray(area.elements)) return false;
    if (ids.has(area.id) || !area.name.trim()) return false;
    ids.add(area.id);
    const elementIds = new Set<string>();
    return area.elements.every((item: DrawingElement) => {
      if (!item || typeof item.id !== 'string' || elementIds.has(item.id) ||
        !['rectangle', 'divider'].includes(item.type) || typeof item.name !== 'string' || !item.name.trim()) return false;
      elementIds.add(item.id);
      if (item.color !== undefined && (typeof item.color !== 'string' || !/^#[\da-f]{6}$/i.test(item.color))) return false;
      if (![item.x, item.y, item.width, item.height].every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
      if (item.type === 'rectangle') {
        return item.x >= 0 && item.y >= 0 && item.width >= 1 && item.height >= 1
          && item.x + item.width <= WORLD_WIDTH && item.y + item.height <= WORLD_HEIGHT;
      }
      const endX = item.x + item.width;
      const endY = item.y + item.height;
      return item.x >= 0 && item.y >= 0 && item.x <= WORLD_WIDTH && item.y <= WORLD_HEIGHT
        && endX >= 0 && endX <= WORLD_WIDTH && endY >= 0 && endY <= WORLD_HEIGHT
        && Math.hypot(item.width, item.height) >= 1;
    });
  });
}

export function parseBackup(raw: string): FloorArea[] {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('O arquivo não contém um backup válido.');
  const backup = parsed as Partial<Backup>;
  if (backup.format !== 'movare-localizador-backup' || backup.version !== 1 ||
    typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt)) ||
    !validAreas(backup.areas)) {
    throw new Error('Backup inválido ou incompatível. Nenhum dado foi alterado.');
  }
  return backup.areas;
}

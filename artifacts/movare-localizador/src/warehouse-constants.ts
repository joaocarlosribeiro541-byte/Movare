export const DEFAULT_SCALE_RATIO = 20; // 20px = 1 metro
export const DEFAULT_WIDTH_METERS = 85; // 85 metros de largura padrão (1700px)
export const DEFAULT_HEIGHT_METERS = 55; // 55 metros de comprimento padrão (1100px)
export const WORLD_WIDTH = 1700;
export const WORLD_HEIGHT = 1100;

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

export function createId(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}


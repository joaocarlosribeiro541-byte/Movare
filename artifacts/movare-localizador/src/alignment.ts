import { WORLD_HEIGHT, WORLD_WIDTH, type DrawingElement } from './editor-model';

export type AlignmentGuide = {
  axis: 'x' | 'y';
  value: number;
  start: number;
  end: number;
};

type Marker = { value: number; start: number; end: number };
type SnapMatch = { delta: number; guide: AlignmentGuide };
type MarkerSet = { x: Marker[]; y: Marker[] };

const SNAP_DISTANCE_PX = 10;
const GUIDE_PADDING_PX = 12;

function getMarkers(items: DrawingElement[], excludeId?: string): MarkerSet {
  const markers: MarkerSet = { x: [], y: [] };

  for (const item of items) {
    if (item.id === excludeId) continue;
    const left = Math.min(item.x, item.x + item.width);
    const right = Math.max(item.x, item.x + item.width);
    const top = Math.min(item.y, item.y + item.height);
    const bottom = Math.max(item.y, item.y + item.height);
    const middleX = (left + right) / 2;
    const middleY = (top + bottom) / 2;

    markers.x.push(
      { value: left, start: top, end: bottom },
      { value: middleX, start: top, end: bottom },
      { value: right, start: top, end: bottom },
    );
    markers.y.push(
      { value: top, start: left, end: right },
      { value: middleY, start: left, end: right },
      { value: bottom, start: left, end: right },
    );
  }

  return markers;
}

function findMatch(
  axis: 'x' | 'y',
  base: number,
  offsets: number[],
  movingSpan: [number, number],
  candidates: Marker[],
  scale: number,
): SnapMatch | null {
  let best: SnapMatch | null = null;
  let bestDistance = SNAP_DISTANCE_PX / scale;
  const padding = GUIDE_PADDING_PX / scale;
  const worldMax = axis === 'x' ? WORLD_HEIGHT : WORLD_WIDTH;

  for (const offset of offsets) {
    const feature = base + offset;
    for (const candidate of candidates) {
      const delta = candidate.value - feature;
      const distance = Math.abs(delta);
      if (distance > bestDistance) continue;
      bestDistance = distance;
      const low = Math.min(movingSpan[0], candidate.start) - padding;
      const high = Math.max(movingSpan[1], candidate.end) + padding;
      best = {
        delta,
        guide: {
          axis,
          value: candidate.value,
          start: Math.max(0, low),
          end: Math.min(worldMax, high),
        },
      };
    }
  }

  return best;
}

export function snapPointToElements(
  point: { x: number; y: number },
  elements: DrawingElement[],
  scale: number,
): { point: { x: number; y: number }; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements);
  const x = findMatch('x', point.x, [0], [point.y, point.y], markers.x, scale);
  const y = findMatch('y', point.y, [0], [point.x, point.x], markers.y, scale);
  return {
    point: { x: point.x + (x?.delta ?? 0), y: point.y + (y?.delta ?? 0) },
    guides: [x?.guide, y?.guide].filter((guide): guide is AlignmentGuide => guide !== undefined),
  };
}

export function snapMovedElement(
  item: DrawingElement,
  elements: DrawingElement[],
  scale: number,
): { item: DrawingElement; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements, item.id);
  const xEnd = item.x + item.width;
  const yEnd = item.y + item.height;
  const x = findMatch(
    'x', item.x, [0, item.width / 2, item.width],
    [Math.min(item.y, yEnd), Math.max(item.y, yEnd)], markers.x, scale,
  );
  const y = findMatch(
    'y', item.y, [0, item.height / 2, item.height],
    [Math.min(item.x, xEnd), Math.max(item.x, xEnd)], markers.y, scale,
  );

  const minX = item.type === 'divider' ? Math.max(0, -item.width) : 0;
  const minY = item.type === 'divider' ? Math.max(0, -item.height) : 0;
  const maxX = item.type === 'rectangle' ? WORLD_WIDTH - item.width : WORLD_WIDTH - Math.max(0, item.width);
  const maxY = item.type === 'rectangle' ? WORLD_HEIGHT - item.height : WORLD_HEIGHT - Math.max(0, item.height);
  const nextX = Math.max(minX, Math.min(maxX, item.x + (x?.delta ?? 0)));
  const nextY = Math.max(minY, Math.min(maxY, item.y + (y?.delta ?? 0)));
  const guides = [
    x && Math.abs(nextX - item.x - x.delta) < 0.001 ? x.guide : undefined,
    y && Math.abs(nextY - item.y - y.delta) < 0.001 ? y.guide : undefined,
  ].filter((guide): guide is AlignmentGuide => guide !== undefined);

  return { item: { ...item, x: nextX, y: nextY }, guides };
}

export function snapResizedRectangle(
  item: DrawingElement,
  corner: string,
  elements: DrawingElement[],
  scale: number,
): { item: DrawingElement; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements, item.id);
  const next = { ...item };
  const guides: AlignmentGuide[] = [];

  if (corner.includes('l') || corner.includes('r')) {
    const isLeft = corner.includes('l');
    const edge = isLeft ? item.x : item.x + item.width;
    const match = findMatch('x', edge, [0], [item.y, item.y + item.height], markers.x, scale);
    if (match) {
      const snappedEdge = edge + match.delta;
      const width = isLeft ? item.x + item.width - snappedEdge : snappedEdge - item.x;
      if (snappedEdge >= 0 && snappedEdge <= WORLD_WIDTH && width >= 2) {
        next.x = isLeft ? snappedEdge : item.x;
        next.width = width;
        guides.push(match.guide);
      }
    }
  }

  if (corner.includes('t') || corner.includes('b')) {
    const isTop = corner.includes('t');
    const edge = isTop ? item.y : item.y + item.height;
    const match = findMatch('y', edge, [0], [item.x, item.x + item.width], markers.y, scale);
    if (match) {
      const snappedEdge = edge + match.delta;
      const height = isTop ? item.y + item.height - snappedEdge : snappedEdge - item.y;
      if (snappedEdge >= 0 && snappedEdge <= WORLD_HEIGHT && height >= 2) {
        next.y = isTop ? snappedEdge : item.y;
        next.height = height;
        guides.push(match.guide);
      }
    }
  }

  return { item: next, guides };
}

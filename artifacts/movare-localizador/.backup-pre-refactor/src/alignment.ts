import { type DrawingElement } from './editor-model';

export type AlignmentGuide = {
  axis: 'x' | 'y'; // 'x' = guia vertical (linha X constante); 'y' = guia horizontal (linha Y constante)
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  type?: 'edge' | 'center' | 'bounds' | 'dimension' | 'adjacent';
  label?: string;
  anchorX?: number; // Posição X âncora para posicionar o badge perto do cursor/zona
  anchorY?: number; // Posição Y âncora para posicionar o badge perto do cursor/zona
};

type Marker = {
  value: number;
  start: number;
  end: number;
  type: 'edge' | 'center' | 'bounds' | 'adjacent';
  label?: string;
};

type SnapMatch = {
  delta: number;
  guide: AlignmentGuide;
};

type MarkerSet = {
  x: Marker[];
  y: Marker[];
};

// Limiar de atração magnética em pixels da tela (sensível, fluido e preciso)
const SNAP_THRESHOLD_PX = 13;
const GUIDE_EXTEND_PX = 40;

function getMarkers(
  items: DrawingElement[],
  excludeId?: string,
  worldWidth = 2400,
  worldHeight = 1600
): MarkerSet {
  const markers: MarkerSet = { x: [], y: [] };

  // Bordas do Armazém (Paredes externas com alinhamento prioritário)
  markers.x.push({ value: 0, start: 0, end: worldHeight, type: 'bounds', label: 'Parede Esquerda' });
  markers.x.push({ value: worldWidth, start: 0, end: worldHeight, type: 'bounds', label: 'Parede Direita' });
  markers.y.push({ value: 0, start: 0, end: worldWidth, type: 'bounds', label: 'Parede Superior' });
  markers.y.push({ value: worldHeight, start: 0, end: worldWidth, type: 'bounds', label: 'Parede Inferior' });

  for (const item of items) {
    if (item.id === excludeId || item.hidden) continue;
    const left = Math.min(item.x, item.x + item.width);
    const right = Math.max(item.x, item.x + item.width);
    const top = Math.min(item.y, item.y + item.height);
    const bottom = Math.max(item.y, item.y + item.height);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    const itemName = item.name ? ` (${item.name.slice(0, 14)})` : '';

    // Marcadores Verticais (Eixo X)
    markers.x.push(
      { value: left, start: top, end: bottom, type: 'edge', label: `Borda Esquerda${itemName}` },
      { value: centerX, start: top, end: bottom, type: 'center', label: `Centro X${itemName}` },
      { value: right, start: top, end: bottom, type: 'edge', label: `Borda Direita${itemName}` }
    );

    // Marcadores Horizontais (Eixo Y)
    markers.y.push(
      { value: top, start: left, end: right, type: 'edge', label: `Borda Superior${itemName}` },
      { value: centerY, start: left, end: right, type: 'center', label: `Centro Y${itemName}` },
      { value: bottom, start: left, end: right, type: 'edge', label: `Borda Inferior${itemName}` }
    );
  }

  return markers;
}

function findMatch(
  axis: 'x' | 'y',
  base: number,
  offsets: { offset: number; role: 'start' | 'center' | 'end' }[],
  movingSpan: [number, number],
  candidates: Marker[],
  scale: number,
  worldLimit = 2500,
  anchorCoord?: number
): SnapMatch | null {
  let best: SnapMatch | null = null;
  let bestDistance = SNAP_THRESHOLD_PX / scale;
  const padding = GUIDE_EXTEND_PX / scale;

  for (const { offset, role } of offsets) {
    const feature = base + offset;
    for (const candidate of candidates) {
      const delta = candidate.value - feature;
      const distance = Math.abs(delta);
      if (distance < bestDistance) {
        bestDistance = distance;
        const low = Math.min(movingSpan[0], candidate.start) - padding;
        const high = Math.max(movingSpan[1], candidate.end) + padding;

        let guideLabel = candidate.label || 'Alinhado';
        if (candidate.type === 'center' || role === 'center') {
          guideLabel = 'Centro Alinhado';
        } else if (candidate.type === 'bounds') {
          guideLabel = candidate.label || 'Parede';
        } else if (
          (role === 'start' && candidate.type === 'edge') ||
          (role === 'end' && candidate.type === 'edge')
        ) {
          guideLabel = candidate.label || 'Borda Alinhada';
        }

        const anchorPosition = anchorCoord !== undefined ? anchorCoord : (movingSpan[0] + movingSpan[1]) / 2;

        best = {
          delta,
          guide: {
            axis,
            orientation: axis === 'x' ? 'vertical' : 'horizontal',
            position: candidate.value,
            start: Math.max(0, low),
            end: Math.min(worldLimit, high),
            type: candidate.type,
            label: guideLabel,
            anchorX: axis === 'x' ? candidate.value : anchorPosition,
            anchorY: axis === 'x' ? anchorPosition : candidate.value,
          },
        };
      }
    }
  }

  return best;
}

export function snapPointToElements(
  point: { x: number; y: number },
  elements: DrawingElement[],
  scale: number,
  worldWidth = 2400,
  worldHeight = 1600
): { point: { x: number; y: number }; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements, undefined, worldWidth, worldHeight);
  const x = findMatch(
    'x',
    point.x,
    [{ offset: 0, role: 'start' }],
    [point.y, point.y],
    markers.x,
    scale,
    worldHeight,
    point.y
  );
  const y = findMatch(
    'y',
    point.y,
    [{ offset: 0, role: 'start' }],
    [point.x, point.x],
    markers.y,
    scale,
    worldWidth,
    point.x
  );
  return {
    point: { x: point.x + (x?.delta ?? 0), y: point.y + (y?.delta ?? 0) },
    guides: [x?.guide, y?.guide].filter((guide): guide is AlignmentGuide => guide !== undefined),
  };
}

export function snapMovedElement(
  item: DrawingElement,
  elements: DrawingElement[],
  scale: number,
  worldWidth = 2400,
  worldHeight = 1600
): { item: DrawingElement; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements, item.id, worldWidth, worldHeight);
  const xEnd = item.x + item.width;
  const yEnd = item.y + item.height;
  const centerY = item.y + item.height / 2;
  const centerX = item.x + item.width / 2;

  // Snapping de precisão no eixo X:
  // - borda esquerda com borda esquerda/direita de outros
  // - centro com centros de outros
  // - borda direita com borda esquerda/direita de outros
  const x = findMatch(
    'x',
    item.x,
    [
      { offset: 0, role: 'start' },
      { offset: item.width / 2, role: 'center' },
      { offset: item.width, role: 'end' },
    ],
    [Math.min(item.y, yEnd), Math.max(item.y, yEnd)],
    markers.x,
    scale,
    worldHeight,
    centerY
  );

  // Snapping de precisão no eixo Y:
  // - borda superior com borda superior/inferior de outros
  // - centro com centros de outros
  // - borda inferior com borda superior/inferior de outros
  const y = findMatch(
    'y',
    item.y,
    [
      { offset: 0, role: 'start' },
      { offset: item.height / 2, role: 'center' },
      { offset: item.height, role: 'end' },
    ],
    [Math.min(item.x, xEnd), Math.max(item.x, xEnd)],
    markers.y,
    scale,
    worldWidth,
    centerX
  );

  const minX = 0;
  const minY = 0;
  const isBox = item.type === 'rectangle' || item.type === 'rack';
  const maxX = isBox ? worldWidth - item.width : worldWidth;
  const maxY = isBox ? worldHeight - item.height : worldHeight;

  const nextX = Math.max(minX, Math.min(maxX, Math.round(item.x + (x?.delta ?? 0))));
  const nextY = Math.max(minY, Math.min(maxY, Math.round(item.y + (y?.delta ?? 0))));

  const guides = [
    x && Math.abs(nextX - item.x - x.delta) < 0.8 ? x.guide : undefined,
    y && Math.abs(nextY - item.y - y.delta) < 0.8 ? y.guide : undefined,
  ].filter((guide): guide is AlignmentGuide => guide !== undefined);

  return { item: { ...item, x: nextX, y: nextY }, guides };
}

export function snapResizedRectangle(
  item: DrawingElement,
  corner: string,
  elements: DrawingElement[],
  scale: number,
  worldWidth = 2400,
  worldHeight = 1600,
  scaleRatio = 20
): { item: DrawingElement; guides: AlignmentGuide[] } {
  const markers = getMarkers(elements, item.id, worldWidth, worldHeight);
  const next = { ...item };
  const guides: AlignmentGuide[] = [];
  const thresholdMeters = (SNAP_THRESHOLD_PX / scale) / scaleRatio;

  // 1. Alinhamento de Bordas e Centros durante Redimensionamento
  if (corner.includes('l') || corner.includes('r') || corner === 'left' || corner === 'right') {
    const isLeft = corner.includes('l') || corner === 'left';
    const edge = isLeft ? item.x : item.x + item.width;
    const match = findMatch(
      'x',
      edge,
      [{ offset: 0, role: isLeft ? 'start' : 'end' }],
      [item.y, item.y + item.height],
      markers.x,
      scale,
      worldHeight,
      item.y + item.height / 2
    );
    if (match) {
      const snappedEdge = Math.round(edge + match.delta);
      const width = isLeft ? item.x + item.width - snappedEdge : snappedEdge - item.x;
      if (snappedEdge >= 0 && snappedEdge <= worldWidth && width >= 4) {
        next.x = isLeft ? snappedEdge : item.x;
        next.width = width;
        guides.push(match.guide);
      }
    } else {
      // 2. Snapping de Igualdade de Largura com outras zonas (Same Dimension Snap)
      for (const other of elements) {
        if (other.id === item.id || other.hidden || other.type !== 'rectangle') continue;
        const widthDiff = Math.abs(item.width - other.width) / scaleRatio;
        if (widthDiff <= thresholdMeters) {
          const snappedW = Math.round(other.width);
          if (isLeft) {
            next.x = Math.round(item.x + item.width - snappedW);
            next.width = snappedW;
          } else {
            next.width = snappedW;
          }
          guides.push({
            axis: 'x',
            orientation: 'vertical',
            position: isLeft ? next.x : next.x + next.width,
            start: Math.min(item.y, other.y),
            end: Math.max(item.y + item.height, other.y + other.height),
            type: 'dimension',
            label: `Largura = ${(snappedW / scaleRatio).toFixed(1)}m`,
            anchorX: isLeft ? next.x : next.x + next.width,
            anchorY: item.y + item.height / 2,
          });
          break;
        }
      }
    }
  }

  if (corner.includes('t') || corner.includes('b') || corner === 'top' || corner === 'bottom') {
    const isTop = corner.includes('t') || corner === 'top';
    const edge = isTop ? item.y : item.y + item.height;
    const match = findMatch(
      'y',
      edge,
      [{ offset: 0, role: isTop ? 'start' : 'end' }],
      [item.x, item.x + item.width],
      markers.y,
      scale,
      worldWidth,
      item.x + item.width / 2
    );
    if (match) {
      const snappedEdge = Math.round(edge + match.delta);
      const height = isTop ? item.y + item.height - snappedEdge : snappedEdge - item.y;
      if (snappedEdge >= 0 && snappedEdge <= worldHeight && height >= 4) {
        next.y = isTop ? snappedEdge : item.y;
        next.height = height;
        guides.push(match.guide);
      }
    } else {
      // 3. Snapping de Igualdade de Altura/Comprimento com outras zonas
      for (const other of elements) {
        if (other.id === item.id || other.hidden || other.type !== 'rectangle') continue;
        const heightDiff = Math.abs(item.height - other.height) / scaleRatio;
        if (heightDiff <= thresholdMeters) {
          const snappedH = Math.round(other.height);
          if (isTop) {
            next.y = Math.round(item.y + item.height - snappedH);
            next.height = snappedH;
          } else {
            next.height = snappedH;
          }
          guides.push({
            axis: 'y',
            orientation: 'horizontal',
            position: isTop ? next.y : next.y + next.height,
            start: Math.min(item.x, other.x),
            end: Math.max(item.x + item.width, other.x + other.width),
            type: 'dimension',
            label: `Altura = ${(snappedH / scaleRatio).toFixed(1)}m`,
            anchorX: item.x + item.width / 2,
            anchorY: isTop ? next.y : next.y + next.height,
          });
          break;
        }
      }
    }
  }

  return { item: next, guides };
}

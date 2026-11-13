import type { DrawingElement } from './editor-model';

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Verifica se um elemento é um volume físico sólido (retângulo ou porta-paletes)
 */
export function isSolidSpace(el: DrawingElement): boolean {
  if (el.hidden) return false;
  return el.type === 'rectangle' || el.type === 'rack';
}

/**
 * Verifica se duas caixas AABB colidem (com tolerância mínima para permitir contato de borda)
 */
export function boxesOverlap(a: Box, b: Box, tolerance = 0.05): boolean {
  return (
    a.x < b.x + b.width - tolerance &&
    a.x + a.width > b.x + tolerance &&
    a.y < b.y + b.height - tolerance &&
    a.y + a.height > b.y + tolerance
  );
}

/**
 * Retorna os obstáculos sólidos do armazém, excluindo uma lista de IDs ignorados
 */
export function getSolidObstacles(elements: DrawingElement[], excludeIds: Set<string>): DrawingElement[] {
  return elements.filter((el) => isSolidSpace(el) && !excludeIds.has(el.id));
}

/**
 * Calcula a caixa delimitadora (bounding box) de uma lista de elementos
 */
export function getGroupBoundingBox(items: DrawingElement[]): Box | null {
  if (items.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const it of items) {
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.width);
    maxY = Math.max(maxY, it.y + it.height);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Resolução física para movimentação de um único elemento.
 * Impede sobreposição com outros espaços sólidos, permitindo deslizamento
 * fluído e contato rente de borda (flush contact).
 */
export function resolveSpacePhysics(
  item: DrawingElement,
  desired: { x: number; y: number },
  obstacles: DrawingElement[],
  worldWidth: number,
  worldHeight: number
): { x: number; y: number; collided: boolean; contactObstacleId?: string } {
  // Clampa primeiro aos limites do galpão
  const minX = 0;
  const minY = 0;
  const maxX = Math.max(0, worldWidth - item.width);
  const maxY = Math.max(0, worldHeight - item.height);

  let targetX = Math.max(minX, Math.min(maxX, desired.x));
  let targetY = Math.max(minY, Math.min(maxY, desired.y));
  const origX = item.x;
  const origY = item.y;

  const testBox: Box = { x: targetX, y: targetY, width: item.width, height: item.height };

  // Verifica se o alvo desejado colide com algum obstáculo
  let directCollision = false;
  let contactObs: DrawingElement | undefined;

  for (const obs of obstacles) {
    if (boxesOverlap(testBox, obs)) {
      directCollision = true;
      contactObs = obs;
      break;
    }
  }

  // Se não há colisão, o movimento desejado é 100% livre e limpo
  if (!directCollision) {
    return { x: targetX, y: targetY, collided: false };
  }

  // Se há colisão, aplicamos física de deslizamento por eixos separados (Axis-Separated Sliding Physics)
  // 1. Tenta deslizar no eixo X mantendo o Y original
  let resolvedX = targetX;
  const boxMovingX: Box = { x: targetX, y: origY, width: item.width, height: item.height };
  const dx = targetX - origX;

  for (const obs of obstacles) {
    if (boxesOverlap(boxMovingX, obs)) {
      if (dx > 0) {
        // Movendo para a direita: encosta rente na face esquerda do obstáculo
        const stopX = obs.x - item.width;
        if (stopX >= minX && stopX < resolvedX) {
          resolvedX = stopX;
        }
      } else if (dx < 0) {
        // Movendo para a esquerda: encosta rente na face direita do obstáculo
        const stopX = obs.x + obs.width;
        if (stopX <= maxX && stopX > resolvedX) {
          resolvedX = stopX;
        }
      } else {
        resolvedX = origX;
      }
    }
  }

  // 2. Tenta deslizar no eixo Y usando o X resolvido
  let resolvedY = targetY;
  const boxMovingY: Box = { x: resolvedX, y: targetY, width: item.width, height: item.height };
  const dy = targetY - origY;

  for (const obs of obstacles) {
    if (boxesOverlap(boxMovingY, obs)) {
      if (dy > 0) {
        // Movendo para baixo: encosta rente no topo do obstáculo
        const stopY = obs.y - item.height;
        if (stopY >= minY && stopY < resolvedY) {
          resolvedY = stopY;
        }
      } else if (dy < 0) {
        // Movendo para cima: encosta rente na base do obstáculo
        const stopY = obs.y + obs.height;
        if (stopY <= maxY && stopY > resolvedY) {
          resolvedY = stopY;
        }
      } else {
        resolvedY = origY;
      }
    }
  }

  // Validação final da caixa resolvida
  const finalBox: Box = { x: resolvedX, y: resolvedY, width: item.width, height: item.height };
  let stillColliding = false;
  for (const obs of obstacles) {
    if (boxesOverlap(finalBox, obs)) {
      stillColliding = true;
      contactObs = obs;
      break;
    }
  }

  // Se ainda colidir na diagonal, tenta a ordem reversa (Y primeiro, depois X)
  if (stillColliding) {
    let altY = targetY;
    const boxAltY: Box = { x: origX, y: targetY, width: item.width, height: item.height };
    for (const obs of obstacles) {
      if (boxesOverlap(boxAltY, obs)) {
        if (dy > 0) altY = Math.min(altY, obs.y - item.height);
        else if (dy < 0) altY = Math.max(altY, obs.y + obs.height);
        else altY = origY;
      }
    }

    let altX = targetX;
    const boxAltX: Box = { x: targetX, y: altY, width: item.width, height: item.height };
    for (const obs of obstacles) {
      if (boxesOverlap(boxAltX, obs)) {
        if (dx > 0) altX = Math.min(altX, obs.x - item.width);
        else if (dx < 0) altX = Math.max(altX, obs.x + obs.width);
        else altX = origX;
      }
    }

    const altFinal: Box = { x: altX, y: altY, width: item.width, height: item.height };
    let altColliding = false;
    for (const obs of obstacles) {
      if (boxesOverlap(altFinal, obs)) {
        altColliding = true;
        break;
      }
    }

    if (!altColliding) {
      return { x: altX, y: altY, collided: true, contactObstacleId: contactObs?.id };
    }

    // Se nenhum caminho evita sobreposição, permanece na posição válida original
    return { x: origX, y: origY, collided: true, contactObstacleId: contactObs?.id };
  }

  return { x: resolvedX, y: resolvedY, collided: true, contactObstacleId: contactObs?.id };
}

/**
 * Resolução física para movimentação de múltiplos elementos em GRUPO.
 * Garante que o grupo se mova como um corpo rígido, mantendo todos os parâmetros
 * de espaçamento e alinhamento interno, sem permitir penetração em outros espaços.
 */
export function resolveGroupPhysics(
  items: DrawingElement[],
  desiredDelta: { dx: number; dy: number },
  obstacles: DrawingElement[],
  worldWidth: number,
  worldHeight: number
): { dx: number; dy: number; collided: boolean } {
  if (items.length === 0) return { dx: 0, dy: 0, collided: false };

  // Clampa aos limites do armazém para todos os itens do grupo
  let minAllowedDx = -Infinity;
  let maxAllowedDx = Infinity;
  let minAllowedDy = -Infinity;
  let maxAllowedDy = Infinity;

  for (const it of items) {
    minAllowedDx = Math.max(minAllowedDx, -it.x);
    maxAllowedDx = Math.min(maxAllowedDx, worldWidth - (it.x + it.width));
    minAllowedDy = Math.max(minAllowedDy, -it.y);
    maxAllowedDy = Math.min(maxAllowedDy, worldHeight - (it.y + it.height));
  }

  let testDx = Math.max(minAllowedDx, Math.min(maxAllowedDx, desiredDelta.dx));
  let testDy = Math.max(minAllowedDy, Math.min(maxAllowedDy, desiredDelta.dy));

  // 1. Testa colisão no eixo X para o grupo
  let resolvedDx = testDx;
  let collidedX = false;

  if (testDx !== 0) {
    for (const it of items) {
      if (!isSolidSpace(it)) continue;
      const movedBoxX: Box = { x: it.x + resolvedDx, y: it.y, width: it.width, height: it.height };

      for (const obs of obstacles) {
        if (boxesOverlap(movedBoxX, obs)) {
          collidedX = true;
          if (testDx > 0) {
            const allowed = obs.x - (it.x + it.width);
            resolvedDx = Math.min(resolvedDx, Math.max(0, allowed));
          } else {
            const allowed = (obs.x + obs.width) - it.x;
            resolvedDx = Math.max(resolvedDx, Math.min(0, allowed));
          }
        }
      }
    }
  }

  // 2. Testa colisão no eixo Y para o grupo (usando resolvedDx)
  let resolvedDy = testDy;
  let collidedY = false;

  if (testDy !== 0) {
    for (const it of items) {
      if (!isSolidSpace(it)) continue;
      const movedBoxY: Box = { x: it.x + resolvedDx, y: it.y + resolvedDy, width: it.width, height: it.height };

      for (const obs of obstacles) {
        if (boxesOverlap(movedBoxY, obs)) {
          collidedY = true;
          if (testDy > 0) {
            const allowed = obs.y - (it.y + it.height);
            resolvedDy = Math.min(resolvedDy, Math.max(0, allowed));
          } else {
            const allowed = (obs.y + obs.height) - it.y;
            resolvedDy = Math.max(resolvedDy, Math.min(0, allowed));
          }
        }
      }
    }
  }

  // Verificação final do grupo na posição resolvida
  let finalCollision = false;
  for (const it of items) {
    if (!isSolidSpace(it)) continue;
    const finalBox: Box = { x: it.x + resolvedDx, y: it.y + resolvedDy, width: it.width, height: it.height };
    for (const obs of obstacles) {
      if (boxesOverlap(finalBox, obs)) {
        finalCollision = true;
        break;
      }
    }
    if (finalCollision) break;
  }

  if (finalCollision) {
    // Se ainda colidir, para o movimento do grupo para proteger a integridade dos espaços
    return { dx: 0, dy: 0, collided: true };
  }

  return {
    dx: resolvedDx,
    dy: resolvedDy,
    collided: collidedX || collidedY,
  };
}

/**
 * Operações de alinhamento para grupos de elementos selecionados
 */
export function alignGroupElements(
  items: DrawingElement[],
  alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'distribute-h' | 'distribute-v',
  worldWidth: number,
  worldHeight: number
): DrawingElement[] {
  if (items.length < 2) return items;
  const bbox = getGroupBoundingBox(items);
  if (!bbox) return items;

  switch (alignment) {
    case 'left':
      return items.map((it) => ({ ...it, x: bbox.x }));
    case 'center-x': {
      const centerX = bbox.x + bbox.width / 2;
      return items.map((it) => ({ ...it, x: Math.round(centerX - it.width / 2) }));
    }
    case 'right': {
      const rightX = bbox.x + bbox.width;
      return items.map((it) => ({ ...it, x: rightX - it.width }));
    }
    case 'top':
      return items.map((it) => ({ ...it, y: bbox.y }));
    case 'center-y': {
      const centerY = bbox.y + bbox.height / 2;
      return items.map((it) => ({ ...it, y: Math.round(centerY - it.height / 2) }));
    }
    case 'bottom': {
      const bottomY = bbox.y + bbox.height;
      return items.map((it) => ({ ...it, y: bottomY - it.height }));
    }
    case 'distribute-h': {
      const sorted = [...items].sort((a, b) => a.x - b.x);
      const totalWidths = sorted.reduce((sum, it) => sum + it.width, 0);
      const totalGap = bbox.width - totalWidths;
      const gap = sorted.length > 1 ? totalGap / (sorted.length - 1) : 0;
      let currX = bbox.x;
      const resultMap = new Map<string, number>();
      sorted.forEach((it) => {
        resultMap.set(it.id, Math.round(currX));
        currX += it.width + gap;
      });
      return items.map((it) => ({ ...it, x: resultMap.get(it.id) ?? it.x }));
    }
    case 'distribute-v': {
      const sorted = [...items].sort((a, b) => a.y - b.y);
      const totalHeights = sorted.reduce((sum, it) => sum + it.height, 0);
      const totalGap = bbox.height - totalHeights;
      const gap = sorted.length > 1 ? totalGap / (sorted.length - 1) : 0;
      let currY = bbox.y;
      const resultMap = new Map<string, number>();
      sorted.forEach((it) => {
        resultMap.set(it.id, Math.round(currY));
        currY += it.height + gap;
      });
      return items.map((it) => ({ ...it, y: resultMap.get(it.id) ?? it.y }));
    }
    default:
      return items;
  }
}

import { createId, type DrawingElement } from './editor-model';

const MAX_TRACKS = 12;

export function parseTrackProportions(value: string): number[] {
  const parts = value.split(';').map((part) => part.trim());
  const proportions = parts.map(Number);
  if (parts.length < 1 || parts.length > MAX_TRACKS ||
    parts.some((part) => !part) ||
    proportions.some((part) => !Number.isFinite(part) || part <= 0)) {
    throw new Error(`Informe de 1 a ${MAX_TRACKS} proporções positivas, separadas por ponto e vírgula.`);
  }
  return proportions;
}

function normalizedBoundaries(proportions: number[]) {
  const total = proportions.reduce((sum, part) => sum + part, 0);
  let cumulative = 0;
  return proportions.slice(0, -1).map((part) => {
    cumulative += part / total;
    return cumulative;
  });
}

export function createGridDividers(
  rectangle: DrawingElement,
  columnProportions: number[],
  rowProportions: number[],
): DrawingElement[] {
  if (rectangle.type !== 'rectangle') throw new Error('Selecione uma área retangular para aplicar a grade.');
  if (columnProportions.length === 1 && rowProportions.length === 1) {
    throw new Error('A grade precisa de pelo menos duas faixas entre linhas e colunas.');
  }

  const smallestColumn = rectangle.width * Math.min(...columnProportions) / columnProportions.reduce((sum, part) => sum + part, 0);
  const smallestRow = rectangle.height * Math.min(...rowProportions) / rowProportions.reduce((sum, part) => sum + part, 0);
  if ((columnProportions.length > 1 && smallestColumn < 1) ||
    (rowProportions.length > 1 && smallestRow < 1)) {
    throw new Error('Ajuste as proporções: cada faixa precisa ter ao menos 1 unidade na área selecionada.');
  }

  const dividers: DrawingElement[] = [];
  normalizedBoundaries(columnProportions).forEach((fraction, index) => {
    dividers.push({
      id: createId(),
      type: 'divider',
      name: `Coluna ${index + 1}`,
      x: rectangle.x + rectangle.width * fraction,
      y: rectangle.y,
      width: 0,
      height: rectangle.height,
    });
  });
  normalizedBoundaries(rowProportions).forEach((fraction, index) => {
    dividers.push({
      id: createId(),
      type: 'divider',
      name: `Linha ${index + 1}`,
      x: rectangle.x,
      y: rectangle.y + rectangle.height * fraction,
      width: rectangle.width,
      height: 0,
    });
  });
  return dividers;
}

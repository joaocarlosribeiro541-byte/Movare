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

/**
 * Divide uma área retangular em CÉLULAS INDIVIDUAIS para produtos.
 * Cada célula gerada é um DrawingElement independente com:
 * - Endereçamento WMS exclusivo (ex: Setor A · Vão A01)
 * - Slot de produto individual pronto para inventário/inspeção
 * - Associação de grupo (groupId) para permitir movimentação em grupo
 */
export function createGridCells(
  rectangle: DrawingElement,
  columnProportions: number[],
  rowProportions: number[]
): DrawingElement[] {
  if (rectangle.type !== 'rectangle') throw new Error('Selecione uma área retangular para aplicar a divisão.');
  if (columnProportions.length === 1 && rowProportions.length === 1) {
    throw new Error('A grade precisa de pelo menos duas células entre linhas e colunas.');
  }

  const colTotal = columnProportions.reduce((sum, part) => sum + part, 0);
  const rowTotal = rowProportions.reduce((sum, part) => sum + part, 0);
  if (colTotal <= 0 || rowTotal <= 0) throw new Error('Proporções inválidas.');

  const colCount = columnProportions.length;
  const rowCount = rowProportions.length;
  const totalCells = colCount * rowCount;
  const groupId = rectangle.groupId || rectangle.id;

  const cells: DrawingElement[] = [];
  let currentY = rectangle.y;

  for (let r = 0; r < rowCount; r++) {
    const isLastRow = r === rowCount - 1;
    const cellH = isLastRow
      ? (rectangle.y + rectangle.height) - currentY
      : Math.round(rectangle.height * (rowProportions[r] / rowTotal));

    let currentX = rectangle.x;
    for (let c = 0; c < colCount; c++) {
      const isLastCol = c === colCount - 1;
      const cellW = isLastCol
        ? (rectangle.x + rectangle.width) - currentX
        : Math.round(rectangle.width * (columnProportions[c] / colTotal));

      const colLetter = String.fromCharCode(65 + (c % 26));
      const rowNum = (r + 1).toString().padStart(2, '0');
      const cellAddress = `${colLetter}${rowNum}`;
      const cellName = `${rectangle.name} · Célula ${cellAddress}`;

      cells.push({
        id: createId('cell'),
        type: 'rectangle',
        name: cellName,
        x: currentX,
        y: currentY,
        width: Math.max(1, cellW),
        height: Math.max(1, cellH),
        color: rectangle.color || '#0284c7',
        category: rectangle.category || 'general',
        productSize: rectangle.productSize || 'pallet',
        skuCode: rectangle.skuCode ? `${rectangle.skuCode}-${cellAddress}` : '',
        capacity: Math.max(1, Math.round((rectangle.capacity || 10) / totalCells)),
        groupId: groupId,
        modules: 1,
        levels: 1,
        baysPerLevel: 1,
        // Célula dedicada para produtos com slots individuais
        slots: {
          '1-1-1': {
            id: `${rectangle.name}-${cellAddress}`,
            sku: rectangle.skuCode ? `${rectangle.skuCode}-${cellAddress}` : '',
            description: `Célula de Armazenagem ${cellAddress} (${rectangle.name})`,
            quantity: 1,
            unit: 'UN',
            status: rectangle.skuCode ? 'occupied' : 'empty',
            productSize: rectangle.productSize || 'pallet',
            category: rectangle.category || 'general',
            updatedAt: new Date().toISOString(),
          },
        },
      });

      currentX += cellW;
    }
    currentY += cellH;
  }

  return cells;
}

/**
 * Atalho para dividir uma área em grade regular de colunas x linhas
 */
export function divideAreaIntoCells(
  rectangle: DrawingElement,
  colsCount: number,
  rowsCount: number
): DrawingElement[] {
  const colProportions = Array(Math.max(1, colsCount)).fill(1);
  const rowProportions = Array(Math.max(1, rowsCount)).fill(1);
  return createGridCells(rectangle, colProportions, rowProportions);
}


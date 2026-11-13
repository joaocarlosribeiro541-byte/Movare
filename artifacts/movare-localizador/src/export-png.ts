/**
 * MOVARE LOCALIZADOR 4.0 — Módulo de Exportação PNG em Alta Resolução
 * Renderizador de planta baixa vetorial e matricial para relatórios técnicos,
 * apresentações, envio instantâneo em WhatsApp/Slack e documentação CAD/WMS.
 */

import type { FloorArea, DrawingElement } from './editor-model';
import { PRODUCT_CATEGORIES, PRODUCT_SIZES } from './editor-model';
import type { InternalPosition } from './zone-internal-positions';

export type ExportScope = 'full' | 'viewport';
export type ExportTheme = 'dark' | 'light' | 'transparent';
export type ExportResolution = 1 | 2 | 3 | 4;

export interface ExportOptions {
  scope: ExportScope;
  theme: ExportTheme;
  scaleFactor: ExportResolution;
  includeLegend: boolean;
  includeGrid: boolean;
  includeTitleBlock: boolean;
  includeWatermark: boolean;
  includeProductCodes?: boolean; // Se true, exibe SKUs e códigos nas células; se false, gera planta limpa sem códigos de mercadorias
  camera?: { x: number; y: number; scale: number };
  canvasSize?: { width: number; height: number };
}

export interface ExportDimensions {
  contentWidth: number;
  contentHeight: number;
  totalWidth: number;
  totalHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpi: number;
}

/**
 * Gera um nome de arquivo padronizado para exportação de plantas
 * Ex: movare-planta-galpao-principal-2026-11-11.png ou movare-planta-galpao-principal-sem-codigos-2026-11-11.png
 */
export function formatExportFileName(
  areaName: string,
  ext: 'png' | 'svg' = 'png',
  includeProductCodes = true
): string {
  const sanitized = areaName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'galpao';

  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix = includeProductCodes ? '' : '-sem-codigos';
  return `movare-planta-${sanitized}${suffix}-${dateStr}.${ext}`;
}

/**
 * Calcula dimensões lógicas e em pixels para a exportação
 */
export function calculateExportDimensions(
  worldWidth: number,
  worldHeight: number,
  options: Pick<ExportOptions, 'scope' | 'includeLegend' | 'includeTitleBlock' | 'scaleFactor' | 'canvasSize'>
): ExportDimensions {
  const marginX = 48;
  const marginY = 48;
  const legendWidth = options.includeLegend ? 320 : 0;
  const legendGap = options.includeLegend ? 32 : 0;
  const titleBlockHeight = options.includeTitleBlock ? 76 : 0;

  let contentWidth = worldWidth;
  let contentHeight = worldHeight;
  let totalWidth: number;
  let totalHeight: number;

  if (options.scope === 'viewport' && options.canvasSize && options.canvasSize.width > 0) {
    totalWidth = options.canvasSize.width;
    totalHeight = options.canvasSize.height + titleBlockHeight;
    contentWidth = options.canvasSize.width;
    contentHeight = options.canvasSize.height;
  } else {
    // Escopo Completo (Full Warehouse Layout)
    totalWidth = marginX + worldWidth + legendGap + legendWidth + marginX;
    totalHeight = marginY + worldHeight + marginY + titleBlockHeight;
    contentWidth = worldWidth + legendGap + legendWidth;
    contentHeight = worldHeight;
  }

  const factor = options.scaleFactor || 2;
  const dpi = factor === 1 ? 72 : factor === 2 ? 150 : factor === 3 ? 300 : 600;

  return {
    contentWidth,
    contentHeight,
    totalWidth,
    totalHeight,
    pixelWidth: Math.round(totalWidth * factor),
    pixelHeight: Math.round(totalHeight * factor),
    dpi,
  };
}

/**
 * Helper para carregar imagem de forma assíncrona
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Renderiza o layout da planta baixa em um elemento HTMLCanvasElement em alta resolução
 */
export async function renderWarehouseToCanvas(
  area: FloorArea,
  bounds: { widthMeters: number; heightMeters: number },
  scaleRatio: number,
  options: ExportOptions
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') {
    throw new Error('renderWarehouseToCanvas só pode ser executado em ambiente navegador');
  }

  const worldWidth = bounds.widthMeters * scaleRatio;
  const worldHeight = bounds.heightMeters * scaleRatio;
  const dim = calculateExportDimensions(worldWidth, worldHeight, options);

  const canvas = document.createElement('canvas');
  canvas.width = dim.pixelWidth;
  canvas.height = dim.pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao obter contexto 2D do Canvas');

  // Ajusta a escala do contexto para suporte a densidade de pixels (1x, 2x, 3x, 4x)
  ctx.scale(options.scaleFactor, options.scaleFactor);

  const isDark = options.theme === 'dark';
  const isTransparent = options.theme === 'transparent';

  // 1. FUNDO GERAL
  if (!isTransparent) {
    ctx.fillStyle = isDark ? '#080d15' : '#f8fafc';
    ctx.fillRect(0, 0, dim.totalWidth, dim.totalHeight);
  }

  const marginX = 48;
  const marginY = 48;
  const titleBlockHeight = options.includeTitleBlock ? 76 : 0;
  const originX = options.scope === 'full' ? marginX : 0;
  const originY = options.scope === 'full' ? marginY + (options.includeTitleBlock ? titleBlockHeight : 0) : (options.includeTitleBlock ? titleBlockHeight : 0);

  // 2. CARIMBO TÉCNICO / CABEÇALHO DE DOCUMENTAÇÃO (SE HABILITADO)
  if (options.includeTitleBlock) {
    drawTitleBlock(ctx, area, bounds, dim, isDark, options.scaleFactor);
  }

  // Se escopo for 'viewport', aplica a transformação da câmera
  ctx.save();
  if (options.scope === 'viewport' && options.camera) {
    ctx.translate(options.camera.x, options.camera.y + (options.includeTitleBlock ? titleBlockHeight : 0));
    ctx.scale(options.camera.scale, options.camera.scale);
  } else {
    ctx.translate(originX, originY);
  }

  // 3. FUNDO DO BARRACÃO & GRADE MÉTRICA
  ctx.fillStyle = isDark ? '#0b111e' : '#ffffff';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // Grade métrica (1m e 5m)
  if (options.includeGrid) {
    ctx.save();
    // 1m grid
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= worldWidth; x += scaleRatio) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= worldHeight; y += scaleRatio) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldWidth, y);
      ctx.stroke();
    }

    // 5m grid accent
    ctx.strokeStyle = isDark ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.16)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= worldWidth; x += scaleRatio * 5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= worldHeight; y += scaleRatio * 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Marca d'água Movare (se solicitada)
  if (options.includeWatermark) {
    const logoImg = await loadImage('/movare-logo.png');
    if (logoImg) {
      ctx.save();
      ctx.globalAlpha = isDark ? 0.16 : 0.12;
      const logoW = worldWidth * 0.7;
      const logoH = worldHeight * 0.7;
      const logoX = worldWidth * 0.15;
      const logoY = worldHeight * 0.15;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      ctx.restore();
    }
  }

  // 4. PERÍMETRO DO ARMAZÉM COM COTAS MÉTRICAS
  ctx.save();
  ctx.strokeStyle = isDark ? '#f97316' : '#ea580c';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(0, 0, worldWidth, worldHeight);
  ctx.setLineDash([]);

  // Cotas e anotações métricas nos cantos do perímetro
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = isDark ? 'rgba(249, 115, 22, 0.9)' : '#c2410c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`LARGURA: ${bounds.widthMeters}m (${worldWidth}px)`, worldWidth / 2, -10);

  ctx.save();
  ctx.translate(-10, worldHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`COMPRIMENTO: ${bounds.heightMeters}m (${worldHeight}px)`, 0, 0);
  ctx.restore();
  ctx.restore();

  // 5. ELEMENTOS DA PLANTA BAIXA (DIVISÓRIAS, CORREDORES, ZONAS, POSIÇÕES)
  drawWarehouseElements(ctx, area.elements, scaleRatio, isDark);

  ctx.restore(); // Restaura transform da planta

  // 6. LEGENDA GEOGRÁFICA DO PERÍMETRO (SE SOLICITADA E NO MODO COMPLETO)
  if (options.includeLegend && options.scope === 'full') {
    const legendX = originX + worldWidth + 32;
    const legendY = originY;
    drawGeographicLegendCanvas(ctx, area.elements, legendX, legendY, scaleRatio, isDark);
  }

  return canvas;
}

/**
 * Desenha o carimbo técnico de engenharia (Title Block) no topo
 */
function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  area: FloorArea,
  bounds: { widthMeters: number; heightMeters: number },
  dim: ExportDimensions,
  isDark: boolean,
  scaleFactor: number
) {
  const blockH = 68;
  const bg = isDark ? '#0c1424' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const accent = '#f97316';

  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, dim.totalWidth, blockH);

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, blockH);
  ctx.lineTo(dim.totalWidth, blockH);
  ctx.stroke();

  // Bloco 1: Logotipo / Título
  ctx.fillStyle = accent;
  ctx.font = '900 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MOVARE LOCALIZADOR 4.0', 24, 16);

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`PLANTA BAIXA · ${area.name.toUpperCase()}`, 24, 34);

  // Bloco 2: Métricas do Galpão
  const areaM2 = (bounds.widthMeters * bounds.heightMeters).toLocaleString('pt-BR');
  const zonesCount = area.elements.filter((el) => el.type === 'rectangle' || el.type === 'rack').length;
  let totalPositions = 0;
  let occupiedPositions = 0;
  area.elements.forEach((el) => {
    if (el.internalPositions) {
      totalPositions += el.internalPositions.length;
      occupiedPositions += el.internalPositions.filter((p) => p.status === 'occupied').length;
    }
  });

  const col2X = Math.max(380, dim.totalWidth * 0.38);
  ctx.fillStyle = textSecondary;
  ctx.font = '10px monospace';
  ctx.fillText('DIMENSÕES GERAIS', col2X, 16);
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${bounds.widthMeters}m × ${bounds.heightMeters}m (${areaM2} m²)`, col2X, 32);

  const col3X = Math.max(620, dim.totalWidth * 0.62);
  ctx.fillStyle = textSecondary;
  ctx.font = '10px monospace';
  ctx.fillText('CAPACIDADE & OCUPAÇÃO', col3X, 16);
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 12px monospace';
  const occupancyPercent = totalPositions > 0 ? Math.round((occupiedPositions / totalPositions) * 100) : 0;
  ctx.fillText(`${zonesCount} zonas · ${totalPositions} posições (${occupancyPercent}% ocupado)`, col3X, 32);

  // Bloco 4: Emissão & Resolução
  const col4X = dim.totalWidth - 24;
  ctx.textAlign = 'right';
  ctx.fillStyle = textSecondary;
  ctx.font = '10px monospace';
  ctx.fillText(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, col4X, 16);
  ctx.fillStyle = accent;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`PNG ALTA DEFINIÇÃO (${dim.pixelWidth}×${dim.pixelHeight}px · ${dim.dpi} DPI)`, col4X, 32);

  ctx.restore();
}

/**
 * Renderiza elementos da planta no canvas 2D
 */
function drawWarehouseElements(
  ctx: CanvasRenderingContext2D,
  elements: DrawingElement[],
  scaleRatio: number,
  isDark: boolean
) {
  // Ordena para que divisórias e corredores fiquem na camada correta
  const sorted = [...elements].sort((a, b) => {
    const order: Record<string, number> = { corridor: 1, divider: 2, rectangle: 3, rack: 4 };
    return (order[a.type] || 0) - (order[b.type] || 0);
  });

  for (const item of sorted) {
    if (item.type === 'divider') {
      // PAREDE / DIVISÓRIA
      ctx.save();
      ctx.strokeStyle = item.color || (isDark ? '#94a3b8' : '#475569');
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(item.x, item.y);
      ctx.lineTo(item.x + item.width, item.y + item.height);
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'corridor') {
      // CORREDOR / RUA
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(2, 132, 199, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(item.x, item.y, item.width, item.height);
      ctx.setLineDash([]);

      const text = item.corridorText || item.name || 'CORREDOR';
      const fontSize = item.fontSize || 18;
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;

      // Stroke em volta do texto para alta legibilidade
      ctx.strokeStyle = isDark ? '#000000' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeText(text, cx, cy);
      ctx.fillStyle = item.color || (isDark ? '#ffffff' : '#0f172a');
      ctx.fillText(text, cx, cy);
      ctx.restore();
    } else {
      // ZONA OU RACK (RECTANGLE / RACK)
      ctx.save();
      const zoneColor = item.color || (item.type === 'rack' ? '#f97316' : '#0284c7');
      const isRack = item.type === 'rack';

      // Desenha o corpo da zona com cantos arredondados
      drawRoundedRect(ctx, item.x, item.y, item.width, item.height, 6);
      ctx.fillStyle = isRack ? (isDark ? '#1c1917' : '#fff7ed') : (isDark ? '#0f172a' : '#f8fafc');
      ctx.fill();
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = isRack ? 2.5 : 2;
      ctx.stroke();

      // Se tiver posições internas detalhadas (células), renderiza cada célula
      if (item.internalPositions && item.internalPositions.length > 0) {
        drawInternalCells(ctx, item, item.internalPositions, isDark);
      } else {
        // Exibição simplificada de zona sem células divididas
        const wM = Math.round((item.width / scaleRatio) * 10) / 10;
        const hM = Math.round((item.height / scaleRatio) * 10) / 10;

        // Cabeçalho da zona
        ctx.fillStyle = zoneColor;
        ctx.fillRect(item.x, item.y, item.width, Math.min(24, item.height * 0.4));

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.name.slice(0, 20), item.x + 8, item.y + 12);

        if (item.height >= 40) {
          ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
          ctx.font = '10px monospace';
          ctx.fillText(`${wM}m × ${hM}m (${Math.round(wM * hM)}m²)`, item.x + 8, item.y + 32);
        }
      }

      // Indicador de Bloqueio se aplicável
      if (item.locked) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('🔒', item.x + item.width - 6, item.y + 6);
      }

      ctx.restore();
    }
  }
}

/**
 * Desenha células de posições internas da zona
 */
function drawInternalCells(
  ctx: CanvasRenderingContext2D,
  zone: DrawingElement,
  positions: InternalPosition[],
  isDark: boolean
) {
  for (const pos of positions) {
    const cellX = zone.x + (pos.relX ?? 0);
    const cellY = zone.y + (pos.relY ?? 0);
    const cellW = pos.relWidth ?? 25;
    const cellH = pos.relHeight ?? 25;

    // Cores de status
    let cellBg = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.9)';
    let cellBorder = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.8)';
    let textColor = isDark ? '#e2e8f0' : '#1e293b';

    if (pos.status === 'occupied') {
      cellBg = isDark ? 'rgba(5, 150, 105, 0.35)' : 'rgba(16, 185, 129, 0.25)';
      cellBorder = '#10b981';
      textColor = isDark ? '#34d399' : '#047857';
    } else if (pos.status === 'reserved') {
      cellBg = isDark ? 'rgba(217, 119, 6, 0.35)' : 'rgba(245, 158, 11, 0.25)';
      cellBorder = '#f59e0b';
      textColor = isDark ? '#fbbf24' : '#b45309';
    }

    ctx.fillStyle = cellBg;
    ctx.fillRect(cellX, cellY, cellW, cellH);

    ctx.strokeStyle = cellBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(cellX, cellY, cellW, cellH);

    // Texto de código da célula se couber
    if (cellW >= 22 && cellH >= 14) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pos.code.slice(0, 6), cellX + cellW / 2, cellY + cellH / 2);
    }
  }
}

/**
 * Renderiza a Legenda Cartográfica Geográfica ao lado do armazém
 */
function drawGeographicLegendCanvas(
  ctx: CanvasRenderingContext2D,
  elements: DrawingElement[],
  posX: number,
  posY: number,
  scaleRatio: number,
  isDark: boolean
) {
  const zones = elements.filter((el) => el.type === 'rectangle' || el.type === 'rack');
  const corridors = elements.filter((el) => el.type === 'corridor');
  const dividers = elements.filter((el) => el.type === 'divider');

  const legendW = 280;
  const headerH = 56;
  const itemH = 46;
  const infraH = (corridors.length > 0 || dividers.length > 0) ? 70 : 0;
  const totalH = headerH + Math.max(zones.length, 1) * itemH + infraH + 24;

  ctx.save();

  // Fundo da Moldura da Legenda
  drawRoundedRect(ctx, posX, posY, legendW, totalH, 12);
  ctx.fillStyle = isDark ? '#0b121e' : '#fffdfa';
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(249, 115, 22, 0.6)' : 'rgba(180, 83, 9, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cabeçalho da Legenda
  ctx.font = '900 12px monospace';
  ctx.fillStyle = isDark ? '#f97316' : '#92400e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LEGENDA GEOGRÁFICA', posX + 16, posY + 16);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = isDark ? '#94a3b8' : '#78350f';
  ctx.fillText('Convenções e Zonas do Barracão', posX + 16, posY + 32);

  // Contador de Zonas
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = isDark ? '#e2e8f0' : '#451a03';
  ctx.fillText(`${zones.length} ${zones.length === 1 ? 'Zona' : 'Zonas'}`, posX + legendW - 16, posY + 16);

  // Linha separadora
  ctx.strokeStyle = isDark ? 'rgba(249, 115, 22, 0.25)' : 'rgba(180, 83, 9, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(posX + 16, posY + headerH);
  ctx.lineTo(posX + legendW - 16, posY + headerH);
  ctx.stroke();

  // Lista de Zonas
  let currentY = posY + headerH + 12;

  if (zones.length === 0) {
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = isDark ? '#64748b' : '#a16207';
    ctx.fillText('Nenhuma zona demarcada', posX + legendW / 2, currentY + 16);
    currentY += 40;
  } else {
    zones.forEach((zone, idx) => {
      const zoneColor = zone.color || (zone.type === 'rack' ? '#f97316' : '#0284c7');
      const catDef = PRODUCT_CATEGORIES.find((c) => c.id === zone.category);
      const wM = Math.round((zone.width / scaleRatio) * 10) / 10;
      const hM = Math.round((zone.height / scaleRatio) * 10) / 10;
      const posCount = zone.internalPositions?.length ?? 0;

      // Amostra de cor quadrada numerada
      ctx.fillStyle = zoneColor;
      ctx.fillRect(posX + 16, currentY, 16, 16);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(posX + 16, currentY, 16, 16);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), posX + 24, currentY + 8);

      // Nome da Zona
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(zone.name.slice(0, 22), posX + 40, currentY);

      // Subtítulo: Categoria & Dimensões
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '9.5px monospace';
      const catName = catDef?.label || 'Geral';
      const detailStr = `${catName} · ${wM}×${hM}m · ${posCount} pos`;
      ctx.fillText(detailStr, posX + 40, currentY + 16);

      currentY += itemH;
    });
  }

  // Bloco de Infraestrutura
  if (infraH > 0) {
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(posX + 16, currentY);
    ctx.lineTo(posX + legendW - 16, currentY);
    ctx.stroke();

    currentY += 10;
    ctx.fillStyle = isDark ? '#94a3b8' : '#78350f';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('INFRAESTRUTURA', posX + 16, currentY);
    currentY += 16;

    if (corridors.length > 0) {
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(posX + 16, currentY + 2, 14, 8);
      ctx.setLineDash([]);

      ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
      ctx.font = '9.5px sans-serif';
      ctx.fillText(`${corridors.length} Corredores / Ruas de Trânsito`, posX + 36, currentY);
      currentY += 18;
    }

    if (dividers.length > 0) {
      ctx.strokeStyle = isDark ? '#94a3b8' : '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(posX + 16, currentY + 6);
      ctx.lineTo(posX + 30, currentY + 6);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
      ctx.font = '9.5px sans-serif';
      ctx.fillText(`${dividers.length} Paredes / Divisórias Físicas`, posX + 36, currentY);
    }
  }

  ctx.restore();
}

/**
 * Utilitário para desenhar retângulos com cantos arredondados no canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Copia uma imagem de canvas para a área de transferência do usuário
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    throw new Error('A API ClipboardItem não é suportada neste navegador.');
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Falha ao gerar blob PNG a partir do canvas.'));
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}

/**
 * Executa o download de um Blob no navegador
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

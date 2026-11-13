import { describe, it, expect } from 'vitest';
import {
  formatExportFileName,
  calculateExportDimensions,
  type ExportOptions,
} from '../export-png';

describe('MOVARE LOCALIZADOR 4.0 — TESTES DO MOTOR DE EXPORTAÇÃO PNG', () => {
  it('1. Deve sanitizar e formatar nomes de arquivos para exportação com data ISO', () => {
    const filename1 = formatExportFileName('Galpão Principal São Paulo', 'png');
    expect(filename1).toMatch(/^movare-planta-galpao-principal-sao-paulo-\d{4}-\d{2}-\d{2}\.png$/);

    const filename2 = formatExportFileName('Setor B / Almoxarifado #01', 'png');
    expect(filename2).toMatch(/^movare-planta-setor-b-almoxarifado-01-\d{4}-\d{2}-\d{2}\.png$/);

    const filenameSvg = formatExportFileName('Centro de Distribuição', 'svg');
    expect(filenameSvg).toMatch(/^movare-planta-centro-de-distribuicao-\d{4}-\d{2}-\d{2}\.svg$/);
  });

  it('2. Deve calcular corretamente as dimensões de exportação para planta completa em 1x e 2x HD', () => {
    const worldW = 1500;
    const worldH = 1000;

    const opts1x: Pick<ExportOptions, 'scope' | 'includeLegend' | 'includeTitleBlock' | 'scaleFactor' | 'canvasSize'> = {
      scope: 'full',
      includeLegend: true,
      includeTitleBlock: true,
      scaleFactor: 1,
    };

    const dim1x = calculateExportDimensions(worldW, worldH, opts1x);
    expect(dim1x.dpi).toBe(72);
    // Margens: 48 + 1500 + 32 (gap) + 320 (legend) + 48 = 1948
    expect(dim1x.totalWidth).toBe(1948);
    // Altura: 48 + 1000 + 48 + 76 (title block) = 1172
    expect(dim1x.totalHeight).toBe(1172);
    expect(dim1x.pixelWidth).toBe(1948);
    expect(dim1x.pixelHeight).toBe(1172);

    // Em 2x (HD)
    const opts2x = { ...opts1x, scaleFactor: 2 as const };
    const dim2x = calculateExportDimensions(worldW, worldH, opts2x);
    expect(dim2x.dpi).toBe(150);
    expect(dim2x.pixelWidth).toBe(1948 * 2);
    expect(dim2x.pixelHeight).toBe(1172 * 2);
  });

  it('3. Deve calcular corretamente resolução ultra-alta em 3x (300 DPI) e 4x (600 DPI)', () => {
    const worldW = 2000;
    const worldH = 1200;

    const opts3x: Pick<ExportOptions, 'scope' | 'includeLegend' | 'includeTitleBlock' | 'scaleFactor' | 'canvasSize'> = {
      scope: 'full',
      includeLegend: false,
      includeTitleBlock: false,
      scaleFactor: 3,
    };

    const dim3x = calculateExportDimensions(worldW, worldH, opts3x);
    expect(dim3x.dpi).toBe(300);
    // Sem legenda e sem carimbo: 48 + 2000 + 48 = 2096 width, 48 + 1200 + 48 = 1296 height
    expect(dim3x.totalWidth).toBe(2096);
    expect(dim3x.totalHeight).toBe(1296);
    expect(dim3x.pixelWidth).toBe(2096 * 3);
    expect(dim3x.pixelHeight).toBe(1296 * 3);

    const opts4x = { ...opts3x, scaleFactor: 4 as const };
    const dim4x = calculateExportDimensions(worldW, worldH, opts4x);
    expect(dim4x.dpi).toBe(600);
    expect(dim4x.pixelWidth).toBe(2096 * 4);
    expect(dim4x.pixelHeight).toBe(1296 * 4);
  });

  it('4. Deve calcular dimensões no modo viewport baseado no tamanho atual da tela do usuário', () => {
    const optsViewport: Pick<ExportOptions, 'scope' | 'includeLegend' | 'includeTitleBlock' | 'scaleFactor' | 'canvasSize'> = {
      scope: 'viewport',
      includeLegend: false,
      includeTitleBlock: true,
      scaleFactor: 2,
      canvasSize: { width: 1280, height: 720 },
    };

    const dim = calculateExportDimensions(1500, 1000, optsViewport);
    expect(dim.totalWidth).toBe(1280);
    expect(dim.totalHeight).toBe(720 + 76);
    expect(dim.pixelWidth).toBe(1280 * 2);
    expect(dim.pixelHeight).toBe((720 + 76) * 2);
  });
});

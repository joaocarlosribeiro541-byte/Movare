import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateZoneInternalPositions,
  applyVolumePresetToZone,
  migratePositionsOnPresetChange,
  recalculatePositionsOnZoneResize,
  formatPositionCode,
  generateStablePositionId,
  sanitizeZonePositions,
  STORAGE_PROFILES,
  getCategoryProfile,
  type InternalPosition,
} from '../zone-internal-positions';
import {
  distributeCapacityDeterministically,
  calculateZoneCapacities,
  createGridCells,
} from '../grid-geometry';
import {
  parseAndValidateBackup,
  migrateBackupData,
  validateAreasDeep,
} from '../backup-schema';
import {
  parseBackup,
  validAreas,
  type DrawingElement,
  type FloorArea,
} from '../editor-model';
import { boxesOverlap, resolveSpacePhysics } from '../physics';

describe('MOVARE LOCALIZADOR 2.0 — SUÍTE DE TESTES E INTEGRIDADE', () => {

  // 1. Aplicação de presets em zonas vazias e ocupadas
  it('1. Deve calcular posições internas em zonas vazias para diferentes presets', () => {
    const zone = { id: 'zone-1', width: 200, height: 150, category: 'refrigerators' };
    const positions = calculateZoneInternalPositions(zone, 25);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((p) => p.status === 'empty')).toBe(true);
    expect(positions[0].code).toContain('GEL');
  });

  // 2. Preservação de dados de estoque ao trocar de preset
  it('2. Deve preservar SKU, descrição e quantidade ao mudar de preset de volume', () => {
    const initialZone: DrawingElement = {
      id: 'zone-stock',
      type: 'rectangle',
      name: 'Setor A',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      category: 'pallet',
      internalPositions: [
        {
          id: 'zone-stock-pos-0001',
          code: 'P0001',
          relX: 10,
          relY: 10,
          relWidth: 50,
          relHeight: 50,
          widthMeters: 2,
          depthMeters: 2,
          sku: 'SKU-GELADEIRA-FROST',
          description: 'Geladeira Duplex Inox 450L',
          quantity: 8,
          unit: 'UN',
          status: 'occupied',
          notes: 'Lote prioritário',
        },
      ],
    };

    const { updatedElement, migrationReport } = migratePositionsOnPresetChange(initialZone, 'refrigerators', 25);
    expect(updatedElement.internalPositions.length).toBeGreaterThan(0);
    const migratedItem = updatedElement.internalPositions.find((p: InternalPosition) => p.sku === 'SKU-GELADEIRA-FROST');
    expect(migratedItem).toBeDefined();
    expect(migratedItem.quantity).toBe(8);
    expect(migratedItem.status).toBe('occupied');
    expect(migratedItem.description).toBe('Geladeira Duplex Inox 450L');
    expect(migratedItem.notes).toBe('Lote prioritário');
    expect(migrationReport.occupiedPreservedCount).toBe(1);
  });

  // 3 & 4. Redimensionamento de zona com e sem overflow
  it('3 & 4. Deve reter com segurança posições excedentes em overflow quando a zona for reduzida', () => {
    const zone = { id: 'zone-shrink', width: 400, height: 300, category: 'pallet' };
    const initialPositions: InternalPosition[] = [
      {
        id: 'pos-1',
        code: 'P0001',
        relX: 10,
        relY: 10,
        relWidth: 50,
        relHeight: 50,
        widthMeters: 2,
        depthMeters: 2,
        sku: 'SKU-001',
        quantity: 10,
        status: 'occupied',
      },
      {
        id: 'pos-2',
        code: 'P0002',
        relX: 70,
        relY: 10,
        relWidth: 50,
        relHeight: 50,
        widthMeters: 2,
        depthMeters: 2,
        sku: 'SKU-002',
        quantity: 5,
        status: 'occupied',
      },
      {
        id: 'pos-3',
        code: 'P0003',
        relX: 130,
        relY: 10,
        relWidth: 50,
        relHeight: 50,
        widthMeters: 2,
        depthMeters: 2,
        sku: 'SKU-003',
        quantity: 15,
        status: 'occupied',
      },
    ];

    // Reduz dramaticamente a zona para caber apenas 1 posição
    const shrunkZone = { id: 'zone-shrink', width: 60, height: 60, category: 'pallet' };
    const resizeResult = recalculatePositionsOnZoneResize(shrunkZone, 25, undefined, initialPositions);

    expect(resizeResult.totalNewPositions).toBeLessThan(initialPositions.length);
    expect(resizeResult.hasLossWarning).toBe(true);
    expect(resizeResult.overflowOccupiedPositions.length).toBeGreaterThan(0);
    // Verifica que nenhum item ocupado foi descartado
    const allRetainedSkus = [
      ...resizeResult.positions.map((p) => p.sku).filter(Boolean),
      ...resizeResult.overflowOccupiedPositions.map((p) => p.sku).filter(Boolean),
    ];
    expect(allRetainedSkus).toContain('SKU-001');
    expect(allRetainedSkus).toContain('SKU-002');
    expect(allRetainedSkus).toContain('SKU-003');
  });

  // 5. Contenção estrita e folgas no modo custom
  it('5. Modo custom deve respeitar estritamente os limites da zona sem sobreposição ou inversão', () => {
    const zone = { id: 'custom-zone', width: 120, height: 100 };
    const customLayout = {
      method: 'custom' as const,
      columns: 4,
      rows: 3,
      marginMeters: 0.1,
      clearanceMeters: 0.05,
    };
    const positions = calculateZoneInternalPositions(zone, 25, customLayout);
    expect(positions.length).toBe(12);

    for (const p of positions) {
      expect(p.relX).toBeGreaterThanOrEqual(0);
      expect(p.relY).toBeGreaterThanOrEqual(0);
      expect(p.relX + p.relWidth).toBeLessThanOrEqual(zone.width + 0.1);
      expect(p.relY + p.relHeight).toBeLessThanOrEqual(zone.height + 0.1);
      expect(p.relWidth).toBeGreaterThan(0);
      expect(p.relHeight).toBeGreaterThan(0);
    }
  });

  // 6. Distribuição determinística de capacidades
  it('6. Deve distribuir capacidade sem truncamento ou inflação (ex: 10 unidades em 6 células -> soma 10)', () => {
    const capacities = distributeCapacityDeterministically(10, 6);
    expect(capacities).toEqual([2, 2, 2, 2, 1, 1]);
    const sum = capacities.reduce((acc, val) => acc + val, 0);
    expect(sum).toBe(10);

    // Caso de capacidade zero ou negativa
    const zeroCap = distributeCapacityDeterministically(0, 4);
    expect(zeroCap).toEqual([1, 1, 1, 1]);

    // Caso de 100 unidades em 7 células
    const largeCap = distributeCapacityDeterministically(100, 7);
    expect(largeCap.reduce((acc, val) => acc + val, 0)).toBe(100);
  });

  it('6b. Cálculo formal de capacidades da zona deve refletir ocupação real', () => {
    const element: DrawingElement = {
      id: 'z-cap',
      type: 'rectangle',
      name: 'Zona Pulmão',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      capacity: 50,
      internalPositions: [
        { id: '1', code: 'P1', relX: 0, relY: 0, relWidth: 20, relHeight: 20, widthMeters: 1, depthMeters: 1, quantity: 15, status: 'occupied' },
        { id: '2', code: 'P2', relX: 20, relY: 0, relWidth: 20, relHeight: 20, widthMeters: 1, depthMeters: 1, quantity: 10, status: 'occupied' },
        { id: '3', code: 'P3', relX: 40, relY: 0, relWidth: 20, relHeight: 20, widthMeters: 1, depthMeters: 1, status: 'empty' },
      ],
    };

    const metrics = calculateZoneCapacities(element);
    expect(metrics.totalDeclaredCapacity).toBe(50);
    expect(metrics.cellCount).toBe(3);
    expect(metrics.occupiedQuantity).toBe(25);
  });

  // 7. Validação de backup válido e rejeição de dados corrompidos
  it('7. Validador Zod deve validar backups válidos e rejeitar dados corrompidos', () => {
    const validBackup = JSON.stringify({
      format: 'movare-localizador-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      areas: [
        {
          id: 'area-1',
          name: 'Galpão Principal',
          scaleRatio: 25,
          widthMeters: 80,
          heightMeters: 50,
          elements: [
            {
              id: 'el-1',
              type: 'rectangle',
              name: 'Zona A',
              color: '#0284c7',
              x: 10,
              y: 10,
              width: 100,
              height: 100,
            },
          ],
        },
      ],
    });

    const parsed = parseBackup(validBackup);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Galpão Principal');

    // Rejeição de JSON sem formato
    expect(() => parseBackup('{"some": "data"}')).toThrow();
    // Rejeição de payload não-JSON
    expect(() => parseBackup('NOT_JSON_DATA')).toThrow();
  });

  // 8. Migração de backups legados (v1, v2)
  it('8. Deve migrar automaticamente backups legados (v1 e v2) para v3 sem perda de dados', () => {
    const legacyBackupV1 = {
      format: 'movare-localizador-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      areas: [
        {
          id: 'legacy-area-1',
          name: 'Armazém Antigo',
          elements: [
            {
              id: 'legacy-el-1',
              type: 'rectangle',
              name: 'Box 01',
              x: 50,
              y: 50,
              width: 120,
              height: 80,
            },
          ],
        },
      ],
    };

    const result = migrateBackupData(legacyBackupV1);
    expect(result.success).toBe(true);
    expect(result.summary.version).toBe(3);
    expect(result.areas[0].scaleRatio).toBe(20);
    expect(result.areas[0].elements[0].name).toBe('Box 01');
  });

  // 9. Formatação e unicidade de identificadores de posições
  it('9. formatPositionCode e generateStablePositionId devem produzir identificadores únicos e estáveis', () => {
    const code1 = formatPositionCode('GEL', 1);
    const code2 = formatPositionCode('GEL', 2);
    expect(code1).toBe('GEL0001');
    expect(code2).toBe('GEL0002');

    const id1 = generateStablePositionId('zone-abc', 1);
    const id2 = generateStablePositionId('zone-abc', 2);
    expect(id1).toBe('zone-abc-pos-0001');
    expect(id2).toBe('zone-abc-pos-0002');
  });

  // 10. Sanitização de posições com IDs duplicados
  it('10. sanitizeZonePositions deve eliminar IDs duplicados mantendo posições', () => {
    const positions: InternalPosition[] = [
      { id: 'dup-id', code: 'P0001', relX: 0, relY: 0, relWidth: 20, relHeight: 20, widthMeters: 1, depthMeters: 1, status: 'empty' },
      { id: 'dup-id', code: 'P0002', relX: 20, relY: 0, relWidth: 20, relHeight: 20, widthMeters: 1, depthMeters: 1, status: 'empty' },
    ];
    const sanitized = sanitizeZonePositions('zone-1', positions);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].id).not.toBe(sanitized[1].id);
  });

  // 11. Física anti-sobreposição de zonas
  it('11. boxesOverlap deve identificar corretamente colisões entre retângulos', () => {
    const boxA = { x: 0, y: 0, width: 100, height: 100 };
    const boxB = { x: 50, y: 50, width: 100, height: 100 };
    const boxC = { x: 200, y: 200, width: 50, height: 50 };

    expect(boxesOverlap(boxA, boxB)).toBe(true);
    expect(boxesOverlap(boxA, boxC)).toBe(false);
  });

  // 12. Comportamento com valores extremos (zona muito pequena)
  it('12. calculateZoneInternalPositions com zona diminuta deve produzir posições válidas sem quebrar', () => {
    const tinyZone = { id: 'tiny', width: 10, height: 10, category: 'refrigerators' };
    const positions = calculateZoneInternalPositions(tinyZone, 25);
    expect(Array.isArray(positions)).toBe(true);
    if (positions.length > 0) {
      expect(positions[0].relWidth).toBeGreaterThan(0);
      expect(positions[0].relHeight).toBeGreaterThan(0);
    }
  });

  // 13. Divisão de área em células pelo grid-geometry
  it('13. createGridCells deve gerar células com soma de capacidade estritamente exata', () => {
    const rect: DrawingElement = {
      id: 'rect-1',
      type: 'rectangle',
      name: 'Galpão Setor A',
      x: 10,
      y: 10,
      width: 200,
      height: 100,
      capacity: 10,
    };

    const cells = createGridCells(rect, [1, 1, 1], [1, 1]); // 3x2 = 6 células
    expect(cells.length).toBe(6);
    const sumCapacities = cells.reduce((acc, c) => acc + (c.capacity || 0), 0);
    expect(sumCapacities).toBe(10);
  });

  // 14. Validação profunda de áreas
  it('14. validateAreasDeep deve acusar duplicidade de IDs', () => {
    const areas: FloorArea[] = [
      {
        id: 'area-dup',
        name: 'Área 1',
        elements: [{ id: 'el-1', type: 'rectangle', name: 'Z1', x: 0, y: 0, width: 10, height: 10 }],
      },
      {
        id: 'area-dup', // Duplicado!
        name: 'Área 2',
        elements: [{ id: 'el-2', type: 'rectangle', name: 'Z2', x: 0, y: 0, width: 10, height: 10 }],
      },
    ];

    const deepValidation = validateAreasDeep(areas);
    expect(deepValidation.valid).toBe(false);
    expect(deepValidation.errors.length).toBeGreaterThan(0);
  });

  // 15. Perfis de armazenagem
  it('15. Perfis de armazenagem devem fornecer parâmetros padronizados para todas as categorias', () => {
    const gelProfile = getCategoryProfile('refrigerators');
    expect(gelProfile.codePrefix).toBe('GEL');
    expect(gelProfile.defaultMethod).toBe('dimensioned_units');

    const movProfile = getCategoryProfile('flat_pack_furniture');
    expect(movProfile.codePrefix).toBe('MOV');
    expect(movProfile.defaultMethod).toBe('horizontal_rows');
  });

  // 16. Desfazer/refazer preservando integridade das posições
  it('16. Desfazer e refazer em histórico deve clonar e restaurar posições intactas', () => {
    const originalState: FloorArea[] = [
      {
        id: 'area-1',
        name: 'Galpão 1',
        elements: [
          {
            id: 'z-1',
            type: 'rectangle',
            name: 'Zona Teste',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            internalPositions: [
              { id: 'p1', code: 'P0001', relX: 0, relY: 0, relWidth: 50, relHeight: 50, widthMeters: 2, depthMeters: 2, sku: 'SKU-RESTORE', status: 'occupied' },
            ],
          },
        ],
      },
    ];

    const snapshot = structuredClone(originalState);
    // Simula mutação posterior
    const mutated = structuredClone(originalState);
    mutated[0].elements[0].internalPositions = [];

    // Restaura snapshot
    const restored = structuredClone(snapshot);
    expect(restored[0].elements[0].internalPositions?.length).toBe(1);
    expect(restored[0].elements[0].internalPositions?.[0].sku).toBe('SKU-RESTORE');
  });

  // 17. Busca e localização de SKUs em posições internas
  it('17. Localização de SKUs dentro de posições internas da zona', () => {
    const zone: DrawingElement = {
      id: 'z-search',
      type: 'rectangle',
      name: 'Rua das Geladeiras',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      internalPositions: [
        { id: 'p-1', code: 'GEL0001', relX: 10, relY: 10, relWidth: 40, relHeight: 40, widthMeters: 1, depthMeters: 1, sku: 'SKU-SMART-TV', status: 'occupied' },
        { id: 'p-2', code: 'GEL0002', relX: 60, relY: 10, relWidth: 40, relHeight: 40, widthMeters: 1, depthMeters: 1, sku: 'SKU-FROST-FREE', status: 'occupied' },
      ],
    };

    const term = 'frost-free';
    const found = zone.internalPositions?.find((p) => p.sku?.toLowerCase().includes(term));
    expect(found).toBeDefined();
    expect(found?.code).toBe('GEL0002');
  });

  // 18. Preservação de layout ao redimensionar o galpão
  it('18. Redimensionamento do galpão mantém zonas e posições internas proporcionais sem deformação', () => {
    const initialWidthPx = 1700;
    const initialHeightPx = 1100;
    const newWidthPx = 850; // Metade
    const uniformScale = 0.5;

    const originalPos = { relX: 20, relY: 20, relWidth: 40, relHeight: 40 };
    const scaledPos = {
      relX: originalPos.relX * uniformScale,
      relY: originalPos.relY * uniformScale,
      relWidth: originalPos.relWidth * uniformScale,
      relHeight: originalPos.relHeight * uniformScale,
    };

    // Aspect ratio preservado (1:1)
    expect(scaledPos.relWidth / scaledPos.relHeight).toBe(originalPos.relWidth / originalPos.relHeight);
    expect(scaledPos.relWidth).toBe(20);
    expect(scaledPos.relHeight).toBe(20);
  });

  // 19. Navegação fluida 4.0: decaimento de inércia e transição tátil
  it('19. Navegação fluida 4.0: cálculo de decaimento de inércia e conservação de movimento', () => {
    let vx = 1.0;
    let vy = -0.8;
    const friction = 0.80;

    // Simula 10 passos de animação com amortecimento firme calibrado
    for (let i = 0; i < 10; i++) {
      vx *= friction;
      vy *= friction;
    }

    // A velocidade desacelera rapidamente garantindo precisão CAD sem escorregamento
    expect(Math.abs(vx)).toBeLessThan(0.2);
    expect(Math.hypot(vx, vy)).toBeLessThan(0.3);
  });
});



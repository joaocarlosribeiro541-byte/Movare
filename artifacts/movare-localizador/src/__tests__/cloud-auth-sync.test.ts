import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  extractRoleFromAppMetadata,
  resolveUserRole,
  signInWithEmail,
  formatAuthErrorMessage,
} from '../lib/auth';
import {
  CENTRAL_MAP_ID,
  validateCentralMapPayload,
  parseRemoteSharedMapRecord,
  fetchCentralMap,
  saveCentralMap,
  subscribeToCentralMap,
} from '../lib/map-service';
import { canUserEditMap } from '../components/permissions/permission-guard';
import {
  hasSubstantiveLocalMap,
  summarizeAreasForMigration,
} from '../local-store';
import { initialAreas, type FloorArea } from '../editor-model';

function createRichSampleAreas(): FloorArea[] {
  return [
    {
      id: 'wh-central',
      name: 'CD Central — Armazém 01',
      scaleRatio: 25,
      widthMeters: 60,
      heightMeters: 40,
      elements: [
        {
          id: 'zone-gel',
          type: 'rectangle',
          name: 'ZONA GELADEIRAS A',
          color: '#0284c7',
          x: 100,
          y: 120,
          width: 300,
          height: 200,
          rotation: 0,
          locked: false,
          skuCode: 'GEL-PRO-900',
          productSize: 'refrigerator',
          category: 'refrigerators',
          groupId: 'grp-linhas-frias',
          internalLayout: {
            method: 'grid',
            columns: 2,
            rows: 1,
            unitWidthMeters: 1.5,
            unitDepthMeters: 1.5,
          },
          internalPositions: [
            {
              id: 'zone-gel::pos::1',
              code: '0058',
              label: 'Box 0058',
              relX: 10,
              relY: 10,
              relWidth: 130,
              relHeight: 180,
              widthMeters: 5.2,
              depthMeters: 7.2,
              status: 'occupied',
              sku: 'SKU-0058',
              quantity: 14,
              capacity: 20,
            },
            {
              id: 'zone-gel::pos::2',
              code: '0059',
              relX: 150,
              relY: 10,
              relWidth: 130,
              relHeight: 180,
              widthMeters: 5.2,
              depthMeters: 7.2,
              status: 'empty',
            },
          ],
          overflowPositions: [
            {
              id: 'zone-gel::pos::99',
              code: '9001',
              relX: 0,
              relY: 0,
              relWidth: 50,
              relHeight: 50,
              widthMeters: 2,
              depthMeters: 2,
              status: 'reserved',
              sku: 'SKU-RES',
              quantity: 2,
            },
          ],
        },
        {
          id: 'corridor-1',
          type: 'corridor',
          name: 'RUA PRINCIPAL A',
          corridorText: 'RUA PRINCIPAL A',
          color: '#38bdf8',
          x: 450,
          y: 80,
          width: 240,
          height: 40,
          fontSize: 22,
          letterSpacing: 4,
          fontWeight: 'extrabold',
          rotation: 90,
        },
      ],
    },
  ];
}

function makeFakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email: 'operador@movare.com.br',
    ...overrides,
  } as User;
}

describe('MOVARE NUVEM — AUTENTICAÇÃO, PERMISSÕES E SINCRONIZAÇÃO', () => {
  it('1. Deve extrair papel admin exclusivamente de app_metadata e rejeitar user_metadata', () => {
    const spoofedUser = makeFakeUser({
      app_metadata: {},
      user_metadata: { role: 'admin', isAdmin: true },
    });
    expect(extractRoleFromAppMetadata(spoofedUser)).toBe('visitor');

    const trustedAdmin = makeFakeUser({
      app_metadata: { role: 'admin' },
      user_metadata: {},
    });
    expect(extractRoleFromAppMetadata(trustedAdmin)).toBe('admin');

    expect(extractRoleFromAppMetadata(null)).toBe('visitor');
  });

  it('2. Deve resolver papel via tabela protegida admin_users e aplicar fail-closed em erros', async () => {
    const userWithoutClaim = makeFakeUser({ app_metadata: {} });

    const adminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      }),
    } as unknown as SupabaseClient;

    await expect(resolveUserRole(userWithoutClaim, adminClient)).resolves.toBe('admin');

    const errorClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
      }),
    } as unknown as SupabaseClient;

    await expect(resolveUserRole(userWithoutClaim, errorClient)).resolves.toBe('visitor');
    await expect(resolveUserRole(null, adminClient)).resolves.toBe('visitor');
  });

  it('3. Deve bloquear edição para visitantes em permission-guard e signInWithEmail sem credenciais válidas', async () => {
    expect(canUserEditMap('visitor', false)).toBe(false);
    expect(canUserEditMap('visitor', true)).toBe(false);
    expect(canUserEditMap('admin', false)).toBe(false);
    expect(canUserEditMap('admin', true)).toBe(true);

    const mockClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
    } as unknown as SupabaseClient;

    const loginFail = await signInWithEmail('admin@movare.com', 'wrong', mockClient);
    expect(loginFail.ok).toBe(false);
    expect(loginFail.role).toBe('visitor');
    expect(loginFail.error).toContain('E-mail ou senha incorretos');

    expect(formatAuthErrorMessage('Too many requests')).toContain('Muitas tentativas');
  });

  it('4. Deve validar payload preservando integralmente FloorArea[], posições numéricas (0058) e overflow', () => {
    const richAreas = createRichSampleAreas();
    const validation = validateCentralMapPayload(richAreas);
    expect(validation.valid).toBe(true);
    expect(validation.areas).toHaveLength(1);
    expect(validation.areas?.[0].elements[0].internalPositions?.[0].code).toBe('0058');
    expect(validation.areas?.[0].elements[0].overflowPositions).toHaveLength(1);
    expect(validation.areas?.[0].elements[1].corridorText).toBe('RUA PRINCIPAL A');

    // Rejeita dados inválidos/corrompidos
    expect(validateCentralMapPayload([]).valid).toBe(false);
    expect(validateCentralMapPayload([{ id: 'x', name: 'A', elements: [{ id: 'e1', x: NaN }] }]).valid).toBe(false);
  });

  it('5. Deve converter registro remoto do Supabase preservando versão, responsável e todas as propriedades', () => {
    const richAreas = createRichSampleAreas();
    const parsed = parseRemoteSharedMapRecord({
      id: CENTRAL_MAP_ID,
      data: richAreas,
      version: 7,
      updated_at: '2026-11-13T12:00:00.000Z',
      updated_by: 'admin-uuid-1',
      updated_by_email: 'admin@movare.com.br',
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(7);
    expect(parsed?.updated_by_email).toBe('admin@movare.com.br');
    expect(parsed?.data[0].elements[0].skuCode).toBe('GEL-PRO-900');
    expect(parsed?.data[0].elements[0].internalPositions?.[0].code).toBe('0058');
  });

  it('6. Deve salvar via RPC save_shared_map com concorrência otimista e detectar conflito ou bloqueio RLS', async () => {
    const richAreas = createRichSampleAreas();

    // Sem cliente configurado
    const unconfigured = await saveCentralMap(richAreas, 1, null);
    expect(unconfigured.ok).toBe(false);
    if (!unconfigured.ok) expect(unconfigured.reason).toBe('unconfigured');

    // Gravação bem-sucedida
    const okRpc = vi.fn().mockResolvedValue({
      data: {
        status: 'ok',
        id: CENTRAL_MAP_ID,
        version: 4,
        data: richAreas,
        updated_at: '2026-11-13T12:10:00.000Z',
        updated_by: 'admin-1',
        updated_by_email: 'admin@movare.com',
      },
      error: null,
    });
    const okClient = { rpc: okRpc } as unknown as SupabaseClient;

    const okResult = await saveCentralMap(richAreas, 3, okClient);
    expect(okRpc).toHaveBeenCalledWith('save_shared_map', {
      p_map_id: CENTRAL_MAP_ID,
      p_data: expect.any(Array),
      p_expected_version: 3,
    });
    expect(okResult.ok).toBe(true);
    if (okResult.ok) expect(okResult.record.version).toBe(4);

    // Conflito simultâneo (versão avançou no servidor)
    const conflictClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'conflict',
          id: CENTRAL_MAP_ID,
          version: 5,
          data: richAreas,
          updated_at: '2026-11-13T12:11:00.000Z',
          updated_by: 'admin-2',
          updated_by_email: 'outro.admin@movare.com',
          error: 'Conflito de versão detectado.',
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const conflictResult = await saveCentralMap(richAreas, 3, conflictClient);
    expect(conflictResult.ok).toBe(false);
    if (!conflictResult.ok) {
      expect(conflictResult.reason).toBe('conflict');
      expect(conflictResult.remoteRecord?.version).toBe(5);
      expect(conflictResult.remoteRecord?.updated_by_email).toBe('outro.admin@movare.com');
    }

    // Visitante / não autorizado rejeitado pelo banco
    const forbiddenClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { status: 'forbidden', error: 'Acesso negado.' },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const forbiddenResult = await saveCentralMap(richAreas, 3, forbiddenClient);
    expect(forbiddenResult.ok).toBe(false);
    if (!forbiddenResult.ok) expect(forbiddenResult.reason).toBe('forbidden');
  });

  it('7. Deve buscar mapa central e assinar atualizações em tempo real (Realtime postgres_changes)', async () => {
    const richAreas = createRichSampleAreas();

    const emptyFetchClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as SupabaseClient;

    expect((await fetchCentralMap(emptyFetchClient)).status).toBe('empty');

    const foundFetchClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: CENTRAL_MAP_ID,
            data: richAreas,
            version: 2,
            updated_at: '2026-11-13T12:00:00.000Z',
            updated_by: 'admin-1',
            updated_by_email: 'admin@movare.com',
          },
          error: null,
        }),
      }),
    } as unknown as SupabaseClient;

    const found = await fetchCentralMap(foundFetchClient);
    expect(found.status).toBe('found');
    if (found.status === 'found') {
      expect(found.record.version).toBe(2);
    }

    // Simula assinatura Realtime
    let changeHandler: ((payload: any) => void) | null = null;
    let subscribeStatusHandler: ((status: string) => void) | null = null;

    const fakeChannel = {
      on: vi.fn((_event, _filter, cb) => {
        changeHandler = cb;
        return fakeChannel;
      }),
      subscribe: vi.fn((cb) => {
        subscribeStatusHandler = cb;
        cb('SUBSCRIBED');
        return fakeChannel;
      }),
    };

    const realtimeClient = {
      channel: vi.fn().mockReturnValue(fakeChannel),
      removeChannel: vi.fn(),
    } as unknown as SupabaseClient;

    const receivedRecords: number[] = [];
    const statuses: string[] = [];

    const unsubscribe = subscribeToCentralMap(
      {
        onRemoteRecord: (rec) => receivedRecords.push(rec.version),
        onStatusChange: (st) => statuses.push(st),
      },
      realtimeClient
    );

    expect(statuses).toContain('connected');
    expect(subscribeStatusHandler).not.toBeNull();

    changeHandler?.({
      eventType: 'UPDATE',
      new: {
        id: CENTRAL_MAP_ID,
        data: richAreas,
        version: 9,
        updated_at: '2026-11-13T12:30:00.000Z',
        updated_by: 'admin-1',
        updated_by_email: 'admin@movare.com',
      },
    });

    expect(receivedRecords).toEqual([9]);

    unsubscribe();
    expect(realtimeClient.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('8. Deve detectar mapa local pré-existente para migração inicial e sumarizar posições corretamente', () => {
    expect(hasSubstantiveLocalMap(initialAreas)).toBe(false);

    const customizedEmptyMap: FloorArea[] = [
      { id: 'wh-custom', name: 'Galpão Customizado', scaleRatio: 25, widthMeters: 50, heightMeters: 35, elements: [] },
    ];
    expect(hasSubstantiveLocalMap(customizedEmptyMap)).toBe(true);

    const richMap = createRichSampleAreas();
    expect(hasSubstantiveLocalMap(richMap)).toBe(true);

    const summary = summarizeAreasForMigration(richMap);
    expect(summary).toEqual({
      areasCount: 1,
      elementsCount: 2,
      totalPositions: 2,
      occupiedPositions: 1,
    });
  });
});

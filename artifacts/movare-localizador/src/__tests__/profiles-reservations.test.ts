import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  assignOperationalUserRole,
  deleteCargo,
  extractRoleFromAppMetadata,
  listCargos,
  listOperationalUsers,
  normalizeTrustedRole,
  removeOperationalUserRole,
  resolveUserAccess,
  resolveUserRole,
  saveCargo,
  signUpCommonUser,
  updateMemberProfile,
  updateMyProfile,
  type UserPermissions,
} from '../lib/auth';
import {
  canUserEditMap,
  canUserPersistReservations,
  canUserSeeReservationAction,
  canUserUseConferenteWorkspace,
} from '../components/permissions/permission-guard';
import {
  buildSearchCatalog,
  countReservedPositionsInAreas,
  filterSearchCatalog,
  resolveStatusAfterUnreserve,
  togglePositionReservationInElement,
} from '../wms-operations';
import { CENTRAL_MAP_ID, toggleRemotePositionReservation } from '../lib/map-service';
import type { DrawingElement, FloorArea } from '../editor-model';

function makeFakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-profile-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email: 'operador@movare.com.br',
    ...overrides,
  } as User;
}

function createSampleWarehouseAreas(): FloorArea[] {
  return [
    {
      id: 'wh-1',
      name: 'Galpão A — Linha Branca',
      scaleRatio: 25,
      widthMeters: 60,
      heightMeters: 40,
      elements: [
        {
          id: 'zone-gel',
          type: 'rectangle',
          name: 'ZONA GELADEIRAS',
          color: '#0284c7',
          x: 100,
          y: 120,
          width: 300,
          height: 200,
          category: 'refrigerators',
          productSize: 'refrigerator',
          internalPositions: [
            {
              id: 'pos-1',
              code: 'GEL0001',
              relX: 10,
              relY: 10,
              relWidth: 60,
              relHeight: 60,
              widthMeters: 1.5,
              depthMeters: 1.5,
              status: 'occupied',
              sku: 'SKU-BRM56',
              description: 'Geladeira Frost Free 462L',
              model: 'BRM56AK',
              supplier: 'Brastemp',
              volumesPerItem: 2,
              quantity: 4,
            },
            {
              id: 'pos-2',
              code: 'GEL0002',
              relX: 80,
              relY: 10,
              relWidth: 60,
              relHeight: 60,
              widthMeters: 1.5,
              depthMeters: 1.5,
              status: 'empty',
              model: 'DFN41',
              supplier: 'Electrolux',
            },
            {
              id: 'pos-3',
              code: 'GEL0003',
              relX: 150,
              relY: 10,
              relWidth: 60,
              relHeight: 60,
              widthMeters: 1.5,
              depthMeters: 1.5,
              status: 'reserved',
              sku: 'SKU-RESERVADO-03',
              description: 'Freezer Horizontal 309L',
              model: 'CHA31',
              supplier: 'Consul',
              volumesPerItem: 1,
              quantity: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'wh-2',
      name: 'Galpão B — Móveis',
      scaleRatio: 25,
      widthMeters: 50,
      heightMeters: 30,
      elements: [
        {
          id: 'zone-mov',
          type: 'rectangle',
          name: 'ZONA ROUPEIROS',
          color: '#7c3aed',
          x: 50,
          y: 60,
          width: 240,
          height: 160,
          category: 'flat_pack_furniture',
          productSize: 'flat_pack_furniture',
          internalPositions: [
            {
              id: 'pos-4',
              code: 'MOV0010',
              relX: 15,
              relY: 15,
              relWidth: 80,
              relHeight: 50,
              widthMeters: 2,
              depthMeters: 1,
              status: 'occupied',
              sku: 'SKU-ROUP-6P',
              description: 'Guarda-Roupa Casal 6 Portas',
              model: 'Dallas Plus',
              supplier: 'Santos Andirá',
              volumesPerItem: 4,
              quantity: 6,
            },
          ],
        },
      ],
    },
  ];
}

describe('MOVARE — PERFIS DE ACESSO, RESERVAS E BUSCA OPERACIONAL', () => {
  it('1. Deve normalizar e extrair os 4 perfis confiáveis exclusivamente via app_metadata', () => {
    expect(normalizeTrustedRole('admin')).toBe('admin');
    expect(normalizeTrustedRole('ASSISTENCIA')).toBe('assistencia');
    expect(normalizeTrustedRole('Assistência')).toBe('assistencia');
    expect(normalizeTrustedRole('conferente')).toBe('conferente');
    expect(normalizeTrustedRole('superadmin')).toBe('visitor');
    expect(normalizeTrustedRole(null)).toBe('visitor');

    const assistenciaUser = makeFakeUser({
      app_metadata: { role: 'assistencia' },
      user_metadata: { role: 'admin' },
    });
    expect(extractRoleFromAppMetadata(assistenciaUser)).toBe('assistencia');

    const conferenteUser = makeFakeUser({
      app_metadata: { role: 'conferente' },
      user_metadata: { role: 'admin' },
    });
    expect(extractRoleFromAppMetadata(conferenteUser)).toBe('conferente');

    const spoofedVisitor = makeFakeUser({
      app_metadata: {},
      user_metadata: { role: 'assistencia', isAdmin: true },
    });
    expect(extractRoleFromAppMetadata(spoofedVisitor)).toBe('visitor');
  });

  it('2. Deve resolver app_metadata antes de admin_users e aplicar fail-closed para conferente/assistencia/visitor', async () => {
    const assistenciaUser = makeFakeUser({ app_metadata: { role: 'assistencia' } });
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as SupabaseClient;

    await expect(resolveUserRole(assistenciaUser, mockClient)).resolves.toBe('assistencia');
    expect(mockClient.from).not.toHaveBeenCalled();

    const conferenteUser = makeFakeUser({ app_metadata: { role: 'conferente' } });
    await expect(resolveUserRole(conferenteUser, mockClient)).resolves.toBe('conferente');

    const visitorWithoutClaims = makeFakeUser({ app_metadata: {} });
    await expect(resolveUserRole(visitorWithoutClaims, mockClient)).resolves.toBe('visitor');

    // Fallback para tabela public.admin_users para todos os perfis operacionais
    const mockAssistenciaDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'assistencia' }, error: null }),
      }),
    } as unknown as SupabaseClient;
    await expect(resolveUserRole(visitorWithoutClaims, mockAssistenciaDb)).resolves.toBe('assistencia');

    const mockConferenteDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'conferente' }, error: null }),
      }),
    } as unknown as SupabaseClient;
    await expect(resolveUserRole(visitorWithoutClaims, mockConferenteDb)).resolves.toBe('conferente');
  });

  it('3. Deve aplicar matriz de permissões correta para Admin, Assistência, Conferente e Visitante', () => {
    // Edição completa do mapa: apenas Admin autenticado
    expect(canUserEditMap('admin', true)).toBe(true);
    expect(canUserEditMap('admin', false)).toBe(false);
    expect(canUserEditMap('assistencia', false)).toBe(false);
    expect(canUserEditMap('conferente', false)).toBe(false);
    expect(canUserEditMap('visitor', false)).toBe(false);

    // Visibilidade da ação de reserva: Admin e Assistência
    expect(canUserSeeReservationAction('admin')).toBe(true);
    expect(canUserSeeReservationAction('assistencia')).toBe(true);
    expect(canUserSeeReservationAction('conferente')).toBe(false);
    expect(canUserSeeReservationAction('visitor')).toBe(false);

    // Persistência de reservas:
    // - Admin persiste localmente e na nuvem (Supabase)
    // - Assistência persiste localmente e na nuvem via RPC dedicada toggle_position_reservation
    // - Conferente e Visitante nunca persistem reservas
    expect(canUserPersistReservations('admin', true, true)).toBe(true);
    expect(canUserPersistReservations('admin', true, false)).toBe(true);
    expect(canUserPersistReservations('assistencia', false, false)).toBe(true);
    expect(canUserPersistReservations('assistencia', false, true)).toBe(true);
    expect(canUserPersistReservations('conferente', false, false)).toBe(false);
    expect(canUserPersistReservations('conferente', false, true)).toBe(false);
    expect(canUserPersistReservations('visitor', false, false)).toBe(false);

    // Workspace dedicado do Conferente
    expect(canUserUseConferenteWorkspace('conferente')).toBe(true);
    expect(canUserUseConferenteWorkspace('admin')).toBe(false);
    expect(canUserUseConferenteWorkspace('assistencia')).toBe(false);
    expect(canUserUseConferenteWorkspace('visitor')).toBe(false);
  });

  it('4. Deve reservar e remover reserva exatamente na posição alvo preservando SKU, código, modelo, fornecedor e volumes', () => {
    const areas = createSampleWarehouseAreas();
    const zone = areas[0].elements[0] as DrawingElement;

    // Reserva pos-1 (estava occupied) sem afetar pos-2 (empty) nem pos-3 (reserved)
    const afterReserve = togglePositionReservationInElement(zone, 'pos-1', true);
    expect(afterReserve.internalPositions?.[0].status).toBe('reserved');
    expect(afterReserve.internalPositions?.[0].sku).toBe('SKU-BRM56');
    expect(afterReserve.internalPositions?.[0].code).toBe('GEL0001');
    expect(afterReserve.internalPositions?.[0].model).toBe('BRM56AK');
    expect(afterReserve.internalPositions?.[0].supplier).toBe('Brastemp');
    expect(afterReserve.internalPositions?.[0].volumesPerItem).toBe(2);
    expect(afterReserve.internalPositions?.[1].status).toBe('empty');
    expect(afterReserve.internalPositions?.[2].status).toBe('reserved');

    // Remove reserva de pos-1 -> volta para 'occupied' pois possui SKU/quantidade
    const afterUnreserveOccupied = togglePositionReservationInElement(afterReserve, 'pos-1', false);
    expect(afterUnreserveOccupied.internalPositions?.[0].status).toBe('occupied');
    expect(afterUnreserveOccupied.internalPositions?.[0].sku).toBe('SKU-BRM56');

    // Reserva e remove reserva de pos-2 (vazia, sem SKU/quantidade) -> volta para 'empty'
    const afterReserveEmpty = togglePositionReservationInElement(afterUnreserveOccupied, 'pos-2', true);
    expect(afterReserveEmpty.internalPositions?.[1].status).toBe('reserved');
    const afterUnreserveEmpty = togglePositionReservationInElement(afterReserveEmpty, 'pos-2', false);
    expect(afterUnreserveEmpty.internalPositions?.[1].status).toBe('empty');
    expect(afterUnreserveEmpty.internalPositions?.[1].model).toBe('DFN41');
    expect(afterUnreserveEmpty.internalPositions?.[1].supplier).toBe('Electrolux');

    expect(
      resolveStatusAfterUnreserve({
        id: 'x',
        code: 'X1',
        relX: 0,
        relY: 0,
        relWidth: 10,
        relHeight: 10,
        widthMeters: 1,
        depthMeters: 1,
        status: 'reserved',
      })
    ).toBe('empty');

    expect(countReservedPositionsInAreas(areas)).toBe(1);
  });

  it('5. Deve buscar por código, SKU, nome, modelo, fornecedor, galpão, categoria e filtro de reservados preservando coordenadas', () => {
    const areas = createSampleWarehouseAreas();
    const catalog = buildSearchCatalog(areas);

    // Busca por SKU
    const bySku = filterSearchCatalog(catalog, { query: 'SKU-ROUP-6P', onlyPositionsFirst: true });
    expect(bySku).toHaveLength(1);
    expect(bySku[0].areaName).toBe('Galpão B — Móveis');
    expect(bySku[0].positionCode).toBe('MOV0010');
    expect(bySku[0].x).toBe(50 + 15);
    expect(bySku[0].y).toBe(60 + 15);

    // Busca por modelo e fornecedor
    expect(filterSearchCatalog(catalog, { query: 'Dallas Plus' })[0].positionId).toBe('pos-4');
    expect(filterSearchCatalog(catalog, { query: 'Electrolux' })[0].positionId).toBe('pos-2');

    // Busca apenas reservados
    const reservedOnly = filterSearchCatalog(catalog, { filterType: 'reserved' });
    expect(reservedOnly).toHaveLength(1);
    expect(reservedOnly[0].positionCode).toBe('GEL0003');
    expect(reservedOnly[0].status).toBe('reserved');

    // Filtro por galpão específico
    const scopedToWh1 = filterSearchCatalog(catalog, {
      areaId: 'wh-1',
      filterType: 'products',
    });
    expect(scopedToWh1.every((item) => item.areaId === 'wh-1')).toBe(true);
    expect(scopedToWh1.some((item) => item.positionCode === 'GEL0001')).toBe(true);
    expect(scopedToWh1.some((item) => item.positionCode === 'MOV0010')).toBe(false);
  });

  it('6. Deve sincronizar reservas da Assistência na nuvem via RPC dedicada toggle_position_reservation', async () => {
    const sampleAreas = createSampleWarehouseAreas();
    // Garante que cada posição tenha o status reservado aplicado no registro retornado pela RPC
    const reservedAreas = structuredClone(sampleAreas);
    reservedAreas[0].elements[0].internalPositions![0].status = 'reserved';

    const unconfigured = await toggleRemotePositionReservation(
      { areaId: 'wh-1', elementId: 'zone-gel', positionId: 'pos-1', reserved: true },
      null
    );
    expect(unconfigured).toMatchObject({ ok: false, reason: 'unconfigured' });

    const rpcSuccessClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          next_status: 'reserved',
          id: CENTRAL_MAP_ID,
          data: reservedAreas,
          version: 7,
          updated_at: '2026-06-01T12:00:00.000Z',
          updated_by: 'assist-user-1',
          updated_by_email: 'assistencia@movare.com.br',
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const okResult = await toggleRemotePositionReservation(
      { areaId: 'wh-1', elementId: 'zone-gel', positionId: 'pos-1', reserved: true },
      rpcSuccessClient
    );
    expect(rpcSuccessClient.rpc).toHaveBeenCalledWith('toggle_position_reservation', {
      p_map_id: CENTRAL_MAP_ID,
      p_area_id: 'wh-1',
      p_element_id: 'zone-gel',
      p_position_id: 'pos-1',
      p_reserved: true,
    });
    expect(okResult.ok).toBe(true);
    if (okResult.ok) {
      expect(okResult.nextStatus).toBe('reserved');
      expect(okResult.record.version).toBe(7);
      expect(okResult.record.updated_by_email).toBe('assistencia@movare.com.br');
    }

    const rpcForbiddenClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { status: 'forbidden', error: 'Permissão negada pelo servidor.' },
        error: null,
      }),
    } as unknown as SupabaseClient;
    const forbiddenRes = await toggleRemotePositionReservation(
      { areaId: 'wh-1', elementId: 'zone-gel', positionId: 'pos-1', reserved: true },
      rpcForbiddenClient
    );
    expect(forbiddenRes).toMatchObject({ ok: false, reason: 'forbidden' });

    const rpcNotFoundClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { status: 'not_found', error: 'Posição não encontrada.' },
        error: null,
      }),
    } as unknown as SupabaseClient;
    const notFoundRes = await toggleRemotePositionReservation(
      { areaId: 'wh-1', elementId: 'zone-gel', positionId: 'inexistente', reserved: true },
      rpcNotFoundClient
    );
    expect(notFoundRes).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('7. Deve listar, atribuir e remover cargos de Assistência e Conferente via RPCs administrativas', async () => {
    const listClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          users: [
            { user_id: 'u-1', email: 'admin@movare.com.br', role: 'admin' },
            { user_id: 'u-2', email: 'assistencia@movare.com.br', role: 'assistencia' },
            { user_id: 'u-3', email: 'conferente@movare.com.br', role: 'conferente' },
          ],
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const listRes = await listOperationalUsers(listClient);
    expect(listClient.rpc).toHaveBeenCalledWith('list_movare_users');
    expect(listRes.ok).toBe(true);
    expect(listRes.users).toHaveLength(3);
    expect(listRes.users[1].role).toBe('assistencia');
    expect(listRes.users[2].role).toBe('conferente');

    const assignClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          user: { user_id: 'u-3', email: 'conferente@movare.com.br', role: 'conferente' },
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const assignRes = await assignOperationalUserRole('Conferente@Movare.com.br ', 'conferente', assignClient);
    expect(assignClient.rpc).toHaveBeenCalledWith('assign_movare_user_role', {
      p_email: 'conferente@movare.com.br',
      p_role: 'conferente',
    });
    expect(assignRes).toMatchObject({
      ok: true,
      user: { user_id: 'u-3', email: 'conferente@movare.com.br', role: 'conferente' },
    });

    const removeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { status: 'ok' },
        error: null,
      }),
    } as unknown as SupabaseClient;
    const removeRes = await removeOperationalUserRole('u-2', removeClient);
    expect(removeClient.rpc).toHaveBeenCalledWith('remove_movare_user_role', { p_user_id: 'u-2' });
    expect(removeRes).toEqual({ ok: true });
  });

  it('8. Deve resolver cargo personalizado e permissões granulares automaticamente via resolveUserAccess', async () => {
    const loggedUser = makeFakeUser({ id: 'u-custom-1', app_metadata: {} });

    const customAccessClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          role: 'assistencia',
          cargo_id: 'supervisor-expedicao',
          cargo_name: 'Supervisor de Expedição',
          cargo_color: 'violet',
          permissions: {
            can_edit_map: false,
            can_reserve_positions: true,
            can_use_conferente_panel: true,
            can_manage_roles: false,
          },
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const access = await resolveUserAccess(loggedUser, customAccessClient);
    expect(customAccessClient.rpc).toHaveBeenCalledWith('get_my_movare_access');
    expect(access).toEqual({
      role: 'assistencia',
      cargoId: 'supervisor-expedicao',
      cargoName: 'Supervisor de Expedição',
      cargoColor: 'violet',
      permissions: {
        canEditMap: false,
        canReservePositions: true,
        canUseConferentePanel: true,
        canManageRoles: false,
      },
    });

    // Permissões do cargo aplicam automaticamente nos guards
    const perms: UserPermissions = access.permissions;
    expect(canUserEditMap(access.role, true, perms)).toBe(false);
    expect(canUserSeeReservationAction(access.role, perms)).toBe(true);
    expect(canUserPersistReservations(access.role, false, true, perms)).toBe(true);
    expect(canUserUseConferenteWorkspace(access.role, perms)).toBe(true);

    // Usuário comum recém-cadastrado (sem cargo) recebe somente leitura
    const commonClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          role: 'visitor',
          cargo_id: null,
          cargo_name: null,
          cargo_color: null,
          permissions: {
            can_edit_map: false,
            can_reserve_positions: false,
            can_use_conferente_panel: false,
            can_manage_roles: false,
          },
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const commonAccess = await resolveUserAccess(loggedUser, commonClient);
    expect(commonAccess.role).toBe('visitor');
    expect(commonAccess.cargoId).toBeNull();
    expect(canUserEditMap(commonAccess.role, true, commonAccess.permissions)).toBe(false);
    expect(canUserPersistReservations(commonAccess.role, false, true, commonAccess.permissions)).toBe(false);
    expect(canUserUseConferenteWorkspace(commonAccess.role, commonAccess.permissions)).toBe(false);
  });

  it('9. Deve permitir autocadastro de Usuário Comum sem privilégios e validar entradas', async () => {
    const invalidPwd = await signUpCommonUser('novo@movare.com.br', '123', 'Maria', {} as SupabaseClient);
    expect(invalidPwd.ok).toBe(false);
    expect(invalidPwd.error).toContain('6 caracteres');

    const rpcMock = vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null });
    const signUpMock = vi.fn().mockResolvedValue({
      data: {
        user: makeFakeUser({ id: 'u-new-1', email: 'novo@movare.com.br' }),
        session: { access_token: 'tok-123' },
      },
      error: null,
    });
    const signUpClient = {
      auth: { signUp: signUpMock },
      rpc: rpcMock,
    } as unknown as SupabaseClient;

    const res = await signUpCommonUser('Novo@Movare.com.br ', 'segredo123', 'Maria Silva', signUpClient);
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'novo@movare.com.br',
        password: 'segredo123',
        options: expect.objectContaining({ data: { full_name: 'Maria Silva' } }),
      })
    );
    expect(rpcMock).toHaveBeenCalledWith('sync_my_profile', { p_full_name: 'Maria Silva' });
    expect(res.ok).toBe(true);
    expect(res.role).toBe('visitor');
    expect(res.needsEmailConfirmation).toBe(false);

    // Fluxo com confirmação de e-mail exigida pelo Supabase
    const confirmClient = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: makeFakeUser({ id: 'u-new-2', email: 'confirma@movare.com.br' }),
            session: null,
          },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    const confirmRes = await signUpCommonUser('confirma@movare.com.br', 'segredo123', 'João', confirmClient);
    expect(confirmRes.ok).toBe(true);
    expect(confirmRes.role).toBe('visitor');
    expect(confirmRes.needsEmailConfirmation).toBe(true);
  });

  it('10. Deve criar, listar e excluir cargos personalizados e listar usuários comuns aguardando cargo', async () => {
    const cargoClient = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            status: 'ok',
            cargos: [
              {
                id: 'lider-logistica',
                name: 'Líder de Logística',
                description: 'Reserva e conferência',
                color: 'violet',
                base_profile: 'assistencia',
                can_edit_map: false,
                can_reserve_positions: true,
                can_use_conferente_panel: true,
                can_manage_roles: false,
                is_system: false,
              },
            ],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            status: 'ok',
            cargo: {
              id: 'lider-logistica',
              name: 'Líder de Logística',
              description: 'Reserva e conferência',
              color: 'violet',
              base_profile: 'assistencia',
              can_edit_map: false,
              can_reserve_positions: true,
              can_use_conferente_panel: true,
              can_manage_roles: false,
              is_system: false,
            },
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { status: 'ok' }, error: null }),
    } as unknown as SupabaseClient;

    const listed = await listCargos(cargoClient);
    expect(listed.ok).toBe(true);
    expect(listed.cargos).toHaveLength(1);
    expect(listed.cargos[0].name).toBe('Líder de Logística');

    const saved = await saveCargo(
      {
        name: 'Líder de Logística',
        description: 'Reserva e conferência',
        color: 'violet',
        canEditMap: false,
        canReservePositions: true,
        canUseConferentePanel: true,
        canManageRoles: false,
      },
      cargoClient
    );
    expect(saved.ok).toBe(true);
    expect(saved.cargo?.id).toBe('lider-logistica');

    const deleted = await deleteCargo('lider-logistica', cargoClient);
    expect(deleted).toEqual({ ok: true });

    // Lista inclui usuários comuns sem cargo atribuído
    const usersWithCommonClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          users: [
            {
              user_id: 'u-comum-1',
              email: 'comum@movare.com.br',
              full_name: 'Maria Comum',
              role: 'visitor',
              cargo_id: null,
              cargo_name: null,
              cargo_color: null,
            },
          ],
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const usersRes = await listOperationalUsers(usersWithCommonClient);
    expect(usersRes.ok).toBe(true);
    expect(usersRes.users[0]).toMatchObject({
      user_id: 'u-comum-1',
      email: 'comum@movare.com.br',
      full_name: 'Maria Comum',
      role: 'visitor',
      cargo_id: null,
    });
  });

  it('11. Deve resolver perfil em get_my_movare_access, atualizar próprio perfil e atualizar perfil de membro via Admin', async () => {
    const loggedUser = makeFakeUser({ id: 'u-admin-1', email: 'admin@movare.com.br' });

    const accessWithProfileClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          role: 'admin',
          cargo_id: 'admin',
          cargo_name: 'Administrador',
          cargo_color: 'emerald',
          profile: {
            user_id: 'u-admin-1',
            email: 'admin@movare.com.br',
            full_name: 'Carlos Gerente',
            phone: '(11) 99999-1234',
            department: 'Logística Central',
            created_at: '2026-01-10T10:00:00.000Z',
            updated_at: '2026-05-01T14:00:00.000Z',
          },
          permissions: {
            can_edit_map: true,
            can_reserve_positions: true,
            can_use_conferente_panel: false,
            can_manage_roles: true,
          },
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const access = await resolveUserAccess(loggedUser, accessWithProfileClient);
    expect(access.profile).toEqual({
      userId: 'u-admin-1',
      email: 'admin@movare.com.br',
      fullName: 'Carlos Gerente',
      phone: '(11) 99999-1234',
      department: 'Logística Central',
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-05-01T14:00:00.000Z',
    });

    const updateUserMock = vi.fn().mockResolvedValue({ error: null });
    const myProfileClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          profile: {
            user_id: 'u-admin-1',
            email: 'admin@movare.com.br',
            full_name: 'Carlos Eduardo',
            phone: 'Ramal 204',
            department: 'Operações WMS',
          },
        },
        error: null,
      }),
      auth: { updateUser: updateUserMock },
    } as unknown as SupabaseClient;

    const myProfileRes = await updateMyProfile(
      { fullName: 'Carlos Eduardo', phone: 'Ramal 204', department: 'Operações WMS' },
      myProfileClient
    );
    expect(myProfileClient.rpc).toHaveBeenCalledWith('sync_my_profile', {
      p_full_name: 'Carlos Eduardo',
      p_phone: 'Ramal 204',
      p_department: 'Operações WMS',
    });
    expect(updateUserMock).toHaveBeenCalledWith({ data: { full_name: 'Carlos Eduardo' } });
    expect(myProfileRes.ok).toBe(true);
    expect(myProfileRes.profile?.fullName).toBe('Carlos Eduardo');
    expect(myProfileRes.profile?.department).toBe('Operações WMS');

    const memberProfileClient = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'ok',
          profile: {
            user_id: 'u-membro-2',
            email: 'conferente@movare.com.br',
            full_name: 'Ana Conferente',
            phone: 'Ramal 310',
            department: 'Doca 2',
          },
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const memberRes = await updateMemberProfile(
      'u-membro-2',
      { fullName: 'Ana Conferente', phone: 'Ramal 310', department: 'Doca 2' },
      memberProfileClient
    );
    expect(memberProfileClient.rpc).toHaveBeenCalledWith('update_movare_member_profile', {
      p_user_id: 'u-membro-2',
      p_full_name: 'Ana Conferente',
      p_phone: 'Ramal 310',
      p_department: 'Doca 2',
    });
    expect(memberRes.ok).toBe(true);
    expect(memberRes.profile?.department).toBe('Doca 2');

    // listCargos com member_count e listOperationalUsers com metadados de membro
    const richListClient = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            status: 'ok',
            cargos: [
              {
                id: 'conferente',
                name: 'Conferente',
                description: 'Conferência',
                color: 'sky',
                base_profile: 'conferente',
                can_edit_map: false,
                can_reserve_positions: false,
                can_use_conferente_panel: true,
                can_manage_roles: false,
                is_system: true,
                member_count: 3,
              },
            ],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            status: 'ok',
            users: [
              {
                user_id: 'u-membro-2',
                email: 'conferente@movare.com.br',
                full_name: 'Ana Conferente',
                phone: 'Ramal 310',
                department: 'Doca 2',
                role: 'conferente',
                cargo_id: 'conferente',
                cargo_name: 'Conferente',
                cargo_color: 'sky',
                email_confirmed: true,
                last_sign_in_at: '2026-05-01T14:00:00.000Z',
              },
            ],
          },
          error: null,
        }),
    } as unknown as SupabaseClient;

    const richCargos = await listCargos(richListClient);
    expect(richCargos.cargos[0].member_count).toBe(3);

    const richUsers = await listOperationalUsers(richListClient);
    expect(richUsers.users[0]).toMatchObject({
      phone: 'Ramal 310',
      department: 'Doca 2',
      email_confirmed: true,
      last_sign_in_at: '2026-05-01T14:00:00.000Z',
    });
  });
});

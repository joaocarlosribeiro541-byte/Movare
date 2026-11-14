import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { validAreas, type FloorArea } from '../editor-model';
import { FloorAreaSchema, migrateBackupData, validateAreasDeep } from '../backup-schema';
import { sanitizeZonePositions } from '../zone-internal-positions';
import { isSupabaseConfigured, supabase } from './supabase';

export const CENTRAL_MAP_ID = 'central-warehouse-map';

export type SharedMapRecord = {
  id: string;
  data: FloorArea[];
  version: number;
  updated_at: string;
  updated_by: string | null;
  updated_by_email: string | null;
};

export type FetchCentralMapResult =
  | { status: 'found'; record: SharedMapRecord }
  | { status: 'empty' }
  | { status: 'unconfigured'; error: string }
  | { status: 'error'; error: string };

export type SaveCentralMapResult =
  | { ok: true; record: SharedMapRecord }
  | {
      ok: false;
      reason: 'unconfigured' | 'forbidden' | 'invalid' | 'conflict' | 'network';
      error: string;
      remoteRecord?: SharedMapRecord;
    };

export type RealtimeConnectionStatus = 'unconfigured' | 'connecting' | 'connected' | 'disconnected';

const AreasArraySchema = z.array(FloorAreaSchema).min(1, 'O mapa deve conter ao menos uma área.');

/**
 * Sanitiza posições garantindo IDs estáveis sem descartar dados ou códigos existentes.
 */
export function sanitizeAreasForRender(areas: FloorArea[]): FloorArea[] {
  return areas.map((area) => ({
    ...area,
    elements: area.elements.map((el) => {
      if (el.type === 'rectangle' && el.internalPositions?.length) {
        return {
          ...el,
          internalPositions: sanitizeZonePositions(el.id, el.internalPositions),
        };
      }
      return el;
    }),
  }));
}

function stripNullObjectFields<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripNullObjectFields(item)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      if (k === 'color' && v === '') continue;
      out[k] = stripNullObjectFields(v);
    }
    return out as T;
  }
  return input;
}

/**
 * Validação rigorosa antes de persistir no PostgreSQL central.
 * Preserva integralmente áreas, dimensões, escalas, elementos, produtos, SKUs e posições internas.
 */
export function validateCentralMapPayload(raw: unknown): {
  valid: boolean;
  areas?: FloorArea[];
  errors: string[];
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { valid: false, errors: ['O mapa precisa conter ao menos uma área válida.'] };
  }

  const normalized = stripNullObjectFields(raw).map((area: any) => {
    if (!area || typeof area !== 'object' || !Array.isArray(area.elements)) return area;
    return {
      ...area,
      elements: area.elements.map((el: any) => {
        if (!el || typeof el !== 'object') return el;
        if (Array.isArray(el.internalPositions) && el.internalPositions.length > 0) {
          return {
            ...el,
            internalPositions: sanitizeZonePositions(typeof el.id === 'string' ? el.id : 'zone', el.internalPositions),
          };
        }
        return el;
      }),
    };
  });

  const schemaParsed = AreasArraySchema.safeParse(normalized);
  if (!schemaParsed.success) {
    const issueMessages = schemaParsed.error.issues
      .slice(0, 4)
      .map((iss) => `${iss.path.join('.') || 'dados'}: ${iss.message}`);
    return { valid: false, errors: issueMessages };
  }

  const areas = normalized as FloorArea[];
  if (!validAreas(areas)) {
    return { valid: false, errors: ['Estrutura de áreas ou coordenadas inválida para gravação.'] };
  }

  const deepCheck = validateAreasDeep(areas);
  if (!deepCheck.valid) {
    return { valid: false, errors: deepCheck.errors };
  }

  return { valid: true, areas, errors: [] };
}

/**
 * Converte registro remoto do Supabase (tabela shared_map ou retorno RPC)
 * para o formato estruturado validado do Movare.
 */
export function parseRemoteSharedMapRecord(row: unknown): SharedMapRecord | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const rawData = r.data;
  if (!Array.isArray(rawData) || rawData.length === 0) return null;

  let areas: FloorArea[] | null = null;
  const directCheck = validateCentralMapPayload(rawData);
  if (directCheck.valid && directCheck.areas) {
    areas = directCheck.areas;
  } else {
    const migrated = migrateBackupData({
      format: 'movare-localizador-backup',
      version: 3,
      exportedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
      areas: rawData,
    });
    if (migrated.success && migrated.areas.length > 0) {
      areas = migrated.areas;
    }
  }

  if (!areas) return null;

  const version = typeof r.version === 'number' && Number.isFinite(r.version) && r.version >= 1 ? r.version : 1;

  return {
    id: typeof r.id === 'string' ? r.id : CENTRAL_MAP_ID,
    data: sanitizeAreasForRender(areas),
    version,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
    updated_by: typeof r.updated_by === 'string' ? r.updated_by : null,
    updated_by_email: typeof r.updated_by_email === 'string' ? r.updated_by_email : null,
  };
}

export async function fetchCentralMap(client: SupabaseClient | null = supabase): Promise<FetchCentralMapResult> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return {
      status: 'unconfigured',
      error: 'Supabase não configurado neste ambiente.',
    };
  }

  try {
    const { data, error } = await client
      .from('shared_map')
      .select('id, data, version, updated_at, updated_by, updated_by_email')
      .eq('id', CENTRAL_MAP_ID)
      .maybeSingle();

    if (error) {
      return {
        status: 'error',
        error: `Falha ao buscar mapa central: ${error.message}`,
      };
    }

    if (!data) {
      return { status: 'empty' };
    }

    const parsed = parseRemoteSharedMapRecord(data);
    if (!parsed) {
      return {
        status: 'error',
        error: 'O registro remoto do mapa central contém formato incompatível ou corrompido.',
      };
    }

    return {
      status: 'found',
      record: parsed,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Erro de rede ao carregar o mapa central.',
    };
  }
}

export async function saveCentralMap(
  areas: FloorArea[],
  expectedVersion: number | null,
  client: SupabaseClient | null = supabase
): Promise<SaveCentralMapResult> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return {
      ok: false,
      reason: 'unconfigured',
      error: 'Supabase não configurado neste ambiente.',
    };
  }

  const validation = validateCentralMapPayload(areas);
  if (!validation.valid || !validation.areas) {
    return {
      ok: false,
      reason: 'invalid',
      error: validation.errors[0] || 'Os dados do mapa contêm informações incompletas ou inválidas.',
    };
  }

  try {
    const { data, error } = await client.rpc('save_shared_map', {
      p_map_id: CENTRAL_MAP_ID,
      p_data: validation.areas,
      p_expected_version: expectedVersion ?? 0,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('permission') || msg.includes('rls') || msg.includes('forbidden') || error.code === '42501') {
        return {
          ok: false,
          reason: 'forbidden',
          error: 'Permissão negada pelo banco de dados. Apenas administradores podem salvar alterações.',
        };
      }
      return {
        ok: false,
        reason: 'network',
        error: `Erro ao sincronizar mapa com a nuvem: ${error.message}`,
      };
    }

    const payload = (data || {}) as Record<string, unknown>;
    const status = payload.status;

    if (status === 'forbidden') {
      return {
        ok: false,
        reason: 'forbidden',
        error:
          (typeof payload.error === 'string' && payload.error) ||
          'Permissão negada: apenas administradores autenticados podem alterar o mapa.',
      };
    }

    if (status === 'invalid') {
      return {
        ok: false,
        reason: 'invalid',
        error: (typeof payload.error === 'string' && payload.error) || 'Dados rejeitados pela validação do servidor.',
      };
    }

    if (status === 'conflict') {
      const remoteRecord = parseRemoteSharedMapRecord(payload) || undefined;
      return {
        ok: false,
        reason: 'conflict',
        error:
          (typeof payload.error === 'string' && payload.error) ||
          'Outro administrador atualizou o mapa central enquanto você editava.',
        remoteRecord,
      };
    }

    if (status === 'ok') {
      const savedRecord = parseRemoteSharedMapRecord(payload);
      if (!savedRecord) {
        return {
          ok: false,
          reason: 'network',
          error: 'Resposta inesperada do servidor ao confirmar gravação.',
        };
      }
      return {
        ok: true,
        record: savedRecord,
      };
    }

    return {
      ok: false,
      reason: 'network',
      error: 'Resposta inválida da RPC save_shared_map.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      error: err instanceof Error ? err.message : 'Falha de rede ao salvar mapa na nuvem.',
    };
  }
}

export type ToggleReservationResult =
  | {
      ok: true;
      record: SharedMapRecord;
      nextStatus: 'reserved' | 'occupied' | 'empty';
    }
  | {
      ok: false;
      reason: 'unconfigured' | 'forbidden' | 'invalid' | 'not_found' | 'network';
      error: string;
    };

export async function toggleRemotePositionReservation(
  params: {
    areaId: string;
    elementId: string;
    positionId: string;
    reserved?: boolean;
    reservedStore?: string;
    reservedBy?: string;
    reservedQuantity?: number;
  },
  client: SupabaseClient | null = supabase
): Promise<ToggleReservationResult> {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    return {
      ok: false,
      reason: 'unconfigured',
      error: 'Supabase não configurado neste ambiente.',
    };
  }

  try {
    const rpcPayload: Record<string, unknown> = {
      p_map_id: CENTRAL_MAP_ID,
      p_area_id: params.areaId,
      p_element_id: params.elementId,
      p_position_id: params.positionId,
      p_reserved: params.reserved ?? null,
    };
    if (params.reservedStore && params.reservedStore.trim()) {
      rpcPayload.p_reserved_store = params.reservedStore.trim();
    }
    if (params.reservedBy && params.reservedBy.trim()) {
      rpcPayload.p_reserved_by = params.reservedBy.trim();
    }
    if (
      typeof params.reservedQuantity === 'number' &&
      Number.isFinite(params.reservedQuantity) &&
      params.reservedQuantity > 0
    ) {
      rpcPayload.p_reserved_quantity = params.reservedQuantity;
    }

    const { data, error } = await client.rpc('toggle_position_reservation', rpcPayload);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('permission') || msg.includes('rls') || msg.includes('forbidden') || error.code === '42501') {
        return {
          ok: false,
          reason: 'forbidden',
          error: 'Permissão negada: apenas Administrador ou Assistência Técnica podem reservar posições.',
        };
      }
      if (msg.includes('could not find the function') || msg.includes('toggle_position_reservation')) {
        return {
          ok: false,
          reason: 'invalid',
          error: 'Execute o script atualizado supabase/schema.sql no Supabase SQL Editor para habilitar reservas da Assistência na nuvem.',
        };
      }
      return {
        ok: false,
        reason: 'network',
        error: `Erro ao sincronizar reserva com a nuvem: ${error.message}`,
      };
    }

    const payload = (data || {}) as Record<string, unknown>;
    const status = payload.status;

    if (status === 'forbidden') {
      return {
        ok: false,
        reason: 'forbidden',
        error:
          (typeof payload.error === 'string' && payload.error) ||
          'Permissão negada para alterar reserva.',
      };
    }

    if (status === 'not_found') {
      return {
        ok: false,
        reason: 'not_found',
        error: (typeof payload.error === 'string' && payload.error) || 'Posição não encontrada no mapa central.',
      };
    }

    if (status === 'invalid') {
      return {
        ok: false,
        reason: 'invalid',
        error: (typeof payload.error === 'string' && payload.error) || 'Parâmetros inválidos para reserva.',
      };
    }

    if (status === 'ok') {
      const savedRecord = parseRemoteSharedMapRecord(payload);
      const nextStatusRaw = payload.next_status;
      const nextStatus: 'reserved' | 'occupied' | 'empty' =
        nextStatusRaw === 'reserved' || nextStatusRaw === 'occupied' || nextStatusRaw === 'empty'
          ? nextStatusRaw
          : 'reserved';

      if (!savedRecord) {
        return {
          ok: false,
          reason: 'network',
          error: 'Resposta inesperada do servidor ao confirmar reserva.',
        };
      }
      return {
        ok: true,
        record: savedRecord,
        nextStatus,
      };
    }

    return {
      ok: false,
      reason: 'network',
      error: 'Resposta inválida da RPC toggle_position_reservation.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      error: err instanceof Error ? err.message : 'Falha de rede ao sincronizar reserva.',
    };
  }
}

export function subscribeToCentralMap(
  handlers: {
    onRemoteRecord: (record: SharedMapRecord) => void;
    onStatusChange: (status: RealtimeConnectionStatus) => void;
  },
  client: SupabaseClient | null = supabase
): () => void {
  if ((!isSupabaseConfigured && client === supabase) || !client) {
    handlers.onStatusChange('unconfigured');
    return () => {};
  }

  handlers.onStatusChange('connecting');

  const channel: RealtimeChannel = client
    .channel(`movare-shared-map-${CENTRAL_MAP_ID}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_map',
        filter: `id=eq.${CENTRAL_MAP_ID}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const parsed = parseRemoteSharedMapRecord(payload.new);
          if (parsed) {
            handlers.onRemoteRecord(parsed);
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onStatusChange('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onStatusChange('disconnected');
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}

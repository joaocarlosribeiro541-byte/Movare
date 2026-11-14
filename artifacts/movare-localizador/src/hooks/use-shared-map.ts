import { useCallback, useEffect, useRef, useState } from 'react';
import { initialAreas, type FloorArea } from '../editor-model';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchCentralMap,
  sanitizeAreasForRender,
  saveCentralMap,
  subscribeToCentralMap,
  toggleRemotePositionReservation,
  validateCentralMapPayload,
  type RealtimeConnectionStatus,
  type SharedMapRecord,
} from '../lib/map-service';
import {
  inspectLocalExistingData,
  loadAreas,
  saveAreas,
  type LocalExistingDataInspection,
} from '../local-store';
import {
  togglePositionReservationInElement,
  type ReservationMetadata,
} from '../wms-operations';

export type CloudSyncStatus =
  | 'unconfigured'
  | 'loading'
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'saved'
  | 'error'
  | 'conflict';

export type MapConflictState = {
  localAreas: FloorArea[];
  remoteRecord?: SharedMapRecord;
  error: string;
};

export type RemoteUpdateNotice = {
  version: number;
  updated_at: string;
  updated_by_email: string | null;
};

export type RealtimeUpdateDecision =
  | { action: 'ignore_stale' }
  | { action: 'ignore_self_echo' }
  | { action: 'defer_remote_notice' }
  | { action: 'apply_immediately'; editedByOther: boolean };

export function classifyRealtimeUpdate(params: {
  recordVersion: number;
  currentVersion: number;
  recordUpdatedBy: string | null;
  currentUserId: string | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isAdmin: boolean;
}): RealtimeUpdateDecision {
  if (params.recordVersion <= params.currentVersion) {
    return { action: 'ignore_stale' };
  }
  if (
    params.isSaving &&
    params.recordUpdatedBy &&
    params.currentUserId &&
    params.recordUpdatedBy === params.currentUserId
  ) {
    return { action: 'ignore_self_echo' };
  }
  if (params.hasUnsavedChanges && params.isAdmin) {
    return { action: 'defer_remote_notice' };
  }
  return {
    action: 'apply_immediately',
    editedByOther: !params.currentUserId || params.recordUpdatedBy !== params.currentUserId,
  };
}

type UseSharedMapOptions = {
  isAdmin: boolean;
  userId?: string | null;
  activeId: string;
  onSyncActiveId: (nextActiveId: string) => void;
  onNotify?: (message: string) => void;
};

const clone = <T,>(value: T): T => structuredClone(value);

export function useSharedMap({
  isAdmin,
  userId,
  activeId,
  onSyncActiveId,
  onNotify,
}: UseSharedMapOptions) {
  const [areas, setAreas] = useState<FloorArea[]>(() => clone(initialAreas));
  const areasRef = useRef<FloorArea[]>(areas);
  areasRef.current = areas;

  const [history, setHistory] = useState<FloorArea[][]>([]);
  const historyRef = useRef<FloorArea[][]>([]);
  const [future, setFuture] = useState<FloorArea[][]>([]);
  const futureRef = useRef<FloorArea[][]>([]);

  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>(
    isSupabaseConfigured ? 'connecting' : 'unconfigured'
  );
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState<number | null>(null);
  const versionRef = useRef<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastUpdatedByEmail, setLastUpdatedByEmail] = useState<string | null>(null);

  const [centralEmpty, setCentralEmpty] = useState(false);
  const [localMigrationCandidate, setLocalMigrationCandidate] =
    useState<LocalExistingDataInspection | null>(null);
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [remoteUpdateNotice, setRemoteUpdateNotice] = useState<RemoteUpdateNotice | null>(null);
  const [conflictState, setConflictState] = useState<MapConflictState | null>(null);
  const [reservationSyncing, setReservationSyncing] = useState(false);

  const hasUnsavedChangesRef = useRef(false);
  const isSavingRef = useRef(false);
  const isReservationSavingRef = useRef(false);
  const mutationSeqRef = useRef(0);
  const prevConnRef = useRef<RealtimeConnectionStatus>(connectionStatus);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const applyAuthoritativeRemoteRecord = useCallback(
    (record: SharedMapRecord, options?: { resetHistory?: boolean; notifyText?: string }) => {
      const sanitized = sanitizeAreasForRender(record.data);
      areasRef.current = sanitized;
      setAreas(sanitized);

      versionRef.current = record.version;
      setMapVersion(record.version);
      setLastUpdatedAt(record.updated_at);
      setLastUpdatedByEmail(record.updated_by_email);
      setCentralEmpty(false);
      setLocalMigrationCandidate(null);
      setConflictState(null);
      setRemoteUpdateNotice(null);
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setPendingChangesCount(0);
      setSyncError(null);
      setSyncStatus('saved');

      if (options?.resetHistory) {
        historyRef.current = [];
        futureRef.current = [];
        setHistory([]);
        setFuture([]);
      }

      const currentActive = activeIdRef.current;
      if (sanitized.length > 0 && !sanitized.some((a) => a.id === currentActive)) {
        onSyncActiveId(sanitized[0].id);
      }

      void saveAreas(sanitized);

      if (options?.notifyText && onNotify) {
        onNotify(options.notifyText);
      }
    },
    [onNotify, onSyncActiveId]
  );

  // 1. Carga inicial do mapa central (ou fallback local se Supabase não estiver configurado)
  const reloadFromCloud = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isSupabaseConfigured) {
        setConnectionStatus('unconfigured');
        setSyncStatus('unconfigured');
        try {
          const localCached = await loadAreas();
          const sanitized = sanitizeAreasForRender(localCached);
          areasRef.current = sanitized;
          setAreas(sanitized);
          if (sanitized[0]?.id && !sanitized.some((a) => a.id === activeIdRef.current)) {
            onSyncActiveId(sanitized[0].id);
          }
        } catch {
          // Mantém initialAreas
        }
        return;
      }

      if (!opts?.silent) {
        setSyncStatus('loading');
      }

      const res = await fetchCentralMap();
      if (res.status === 'found') {
        applyAuthoritativeRemoteRecord(res.record, { resetHistory: true });
        return;
      }

      if (res.status === 'empty') {
        setCentralEmpty(true);
        versionRef.current = 0;
        setMapVersion(0);
        setLastUpdatedAt(null);
        setLastUpdatedByEmail(null);
        setRemoteUpdateNotice(null);
        hasUnsavedChangesRef.current = false;
        setHasUnsavedChanges(false);
        setPendingChangesCount(0);
        setSyncError(null);
        setSyncStatus('idle');

        // Inspeciona dados locais existentes apenas para possível migração explícita pelo admin
        const localInspection = await inspectLocalExistingData();
        setLocalMigrationCandidate(localInspection.found ? localInspection : null);

        // Mantém initialAreas limpo enquanto banco central não for inicializado
        const cleanInitial = sanitizeAreasForRender(clone(initialAreas));
        areasRef.current = cleanInitial;
        setAreas(cleanInitial);
        onSyncActiveId(cleanInitial[0].id);
        return;
      }

      // Erro de rede / Supabase indisponível: tenta cache auxiliar somente leitura sem fingir sincronização
      setSyncStatus('error');
      setSyncError(res.error);
      try {
        const fallback = await loadAreas();
        const sanitized = sanitizeAreasForRender(fallback);
        areasRef.current = sanitized;
        setAreas(sanitized);
        if (sanitized[0]?.id && !sanitized.some((a) => a.id === activeIdRef.current)) {
          onSyncActiveId(sanitized[0].id);
        }
      } catch {
        // Ignora
      }
      onNotify?.(res.error);
    },
    [applyAuthoritativeRemoteRecord, onNotify, onSyncActiveId]
  );

  useEffect(() => {
    void reloadFromCloud();
  }, [reloadFromCloud]);

  // Se o admin acabou de fazer login e o banco central ainda está vazio, re-inspeciona dados locais
  useEffect(() => {
    if (!isSupabaseConfigured || !isAdmin || !centralEmpty) return;
    let active = true;
    inspectLocalExistingData().then((insp) => {
      if (active) {
        setLocalMigrationCandidate(insp.found ? insp : null);
      }
    });
    return () => {
      active = false;
    };
  }, [isAdmin, centralEmpty]);

  // Se o usuário sair do modo admin, limpa estados pendentes de edição
  useEffect(() => {
    if (!isAdmin) {
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setPendingChangesCount(0);
      setRemoteUpdateNotice(null);
      setConflictState(null);
    }
  }, [isAdmin]);

  // 2. Assinatura Supabase Realtime (postgres_changes em public.shared_map)
  // IMPORTANTE: Nunca interrompe edições em andamento com popups de conflito automático.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConnectionStatus('unconfigured');
      return;
    }

    const unsubscribe = subscribeToCentralMap({
      onStatusChange: (nextStatus) => {
        const prev = prevConnRef.current;
        prevConnRef.current = nextStatus;
        setConnectionStatus(nextStatus);

        if (nextStatus === 'connected' && prev === 'disconnected' && !hasUnsavedChangesRef.current) {
          void reloadFromCloud({ silent: true });
        }
      },
      onRemoteRecord: (record) => {
        const decision = classifyRealtimeUpdate({
          recordVersion: record.version,
          currentVersion: versionRef.current ?? 0,
          recordUpdatedBy: record.updated_by,
          currentUserId: userId ?? null,
          isSaving: isSavingRef.current,
          hasUnsavedChanges: hasUnsavedChangesRef.current,
          isAdmin,
        });

        if (decision.action === 'ignore_stale' || decision.action === 'ignore_self_echo') {
          return;
        }

        if (decision.action === 'defer_remote_notice') {
          setRemoteUpdateNotice({
            version: record.version,
            updated_at: record.updated_at,
            updated_by_email: record.updated_by_email,
          });
          return;
        }

        applyAuthoritativeRemoteRecord(record, {
          resetHistory: true,
          notifyText: decision.editedByOther
            ? `Mapa atualizado na nuvem (v${record.version}${
                record.updated_by_email ? ` por ${record.updated_by_email}` : ''
              }).`
            : undefined,
        });
      },
    });

    const handleOnline = () => {
      if (!hasUnsavedChangesRef.current) {
        void reloadFromCloud({ silent: true });
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [applyAuthoritativeRemoteRecord, isAdmin, reloadFromCloud, userId]);

  // 3. Publicação explícita das alterações acumuladas para a nuvem (Admin apenas)
  const flushSaveToCloud = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isAdmin) {
      return { ok: false, error: 'Apenas administradores podem publicar alterações na nuvem.' };
    }
    if (!isSupabaseConfigured) {
      return { ok: false, error: 'Sincronização em nuvem não configurada neste ambiente.' };
    }
    if (isSavingRef.current) {
      return { ok: false, error: 'Envio para a nuvem já está em andamento.' };
    }

    const seqAtStart = mutationSeqRef.current;
    const snapshot = clone(areasRef.current);

    const validation = validateCentralMapPayload(snapshot);
    if (!validation.valid) {
      const errMsg = validation.errors[0] || 'Dados inválidos aguardando correção para sincronizar.';
      setSyncStatus('error');
      setSyncError(errMsg);
      onNotify?.(errMsg);
      return { ok: false, error: errMsg };
    }

    isSavingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const expectedVer = versionRef.current ?? 0;
      const res = await saveCentralMap(snapshot, expectedVer);

      if (res.ok) {
        versionRef.current = res.record.version;
        setMapVersion(res.record.version);
        setLastUpdatedAt(res.record.updated_at);
        setLastUpdatedByEmail(res.record.updated_by_email);
        setCentralEmpty(false);
        setLocalMigrationCandidate(null);
        setConflictState(null);
        setRemoteUpdateNotice(null);
        void saveAreas(res.record.data);

        if (mutationSeqRef.current === seqAtStart) {
          hasUnsavedChangesRef.current = false;
          setHasUnsavedChanges(false);
          setPendingChangesCount(0);
          setSyncStatus('saved');
          setSyncError(null);
          onNotify?.(`Alterações publicadas na nuvem (v${res.record.version})!`);
        } else {
          // Ocorreram novas edições enquanto o envio estava em voo; mantém lembrete pendente
          hasUnsavedChangesRef.current = true;
          setHasUnsavedChanges(true);
          setSyncStatus('pending');
          onNotify?.('Versão anterior enviada, mas há novas edições locais pendentes.');
        }
        return { ok: true };
      }

      if (res.reason === 'conflict') {
        setSyncStatus('conflict');
        setSyncError(res.error);
        setConflictState({
          localAreas: snapshot,
          remoteRecord: res.remoteRecord,
          error: res.error,
        });
        return { ok: false, error: res.error };
      }

      setSyncStatus('error');
      setSyncError(res.error);
      onNotify?.(res.error);
      return { ok: false, error: res.error };
    } finally {
      isSavingRef.current = false;
    }
  }, [isAdmin, onNotify]);

  // 4. Mutadores protegidos de estado (mantém rascunho local fluido e marca lembrete de envio pendente)
  const markLocalEditPending = useCallback((next: FloorArea[]) => {
    void saveAreas(next);
    if (isSupabaseConfigured) {
      hasUnsavedChangesRef.current = true;
      setHasUnsavedChanges(true);
      setPendingChangesCount((count) => count + 1);
      mutationSeqRef.current += 1;
      setSyncError(null);
      setSyncStatus('pending');
    }
  }, []);

  const recordAreas = useCallback(
    (next: FloorArea[]): boolean => {
      if (!isAdmin) {
        onNotify?.('Modo Visitante: somente leitura. Faça login como administrador para editar.');
        return false;
      }

      const before = clone(areasRef.current);
      historyRef.current = [...historyRef.current.slice(-59), before];
      futureRef.current = [];
      setHistory(historyRef.current);
      setFuture([]);
      areasRef.current = next;
      setAreas(next);

      markLocalEditPending(next);
      return true;
    },
    [isAdmin, markLocalEditPending, onNotify]
  );

  const patchActive = useCallback(
    (patcher: (area: FloorArea) => FloorArea): boolean => {
      return recordAreas(
        areasRef.current.map((area) => (area.id === activeIdRef.current ? patcher(area) : area))
      );
    },
    [recordAreas]
  );

  const togglePositionReservation = useCallback(
    async (
      elementId: string,
      positionId: string,
      allowed: boolean,
      reservationMeta?: ReservationMetadata
    ): Promise<{ changed: boolean; nextStatus?: 'reserved' | 'occupied' | 'empty'; synced?: boolean; error?: string }> => {
      if (!allowed) {
        return { changed: false };
      }
      if (isReservationSavingRef.current) {
        return { changed: false, error: 'Sincronização de reserva já está em andamento.' };
      }

      let nextStatus: 'reserved' | 'occupied' | 'empty' | undefined;
      let didChange = false;
      const targetAreaId = activeIdRef.current;
      const previousAreas = areasRef.current;

      const next = previousAreas.map((area) => {
        if (area.id !== targetAreaId) return area;
        return {
          ...area,
          elements: area.elements.map((el) => {
            if (el.id !== elementId) return el;
            const updatedEl = togglePositionReservationInElement(
              el,
              positionId,
              undefined,
              reservationMeta
            );
            if (updatedEl !== el) {
              didChange = true;
              nextStatus = updatedEl.internalPositions?.find((p) => p.id === positionId)?.status;
            }
            return updatedEl;
          }),
        };
      });

      if (!didChange || !nextStatus) {
        return { changed: false };
      }

      if (isAdmin) {
        recordAreas(next);
        return { changed: true, nextStatus, synced: !isSupabaseConfigured };
      }

      // Assistência Técnica sem Supabase ativo -> persiste no armazenamento local auxiliar
      if (!isSupabaseConfigured) {
        areasRef.current = next;
        setAreas(next);
        void saveAreas(next);
        return { changed: true, nextStatus, synced: true };
      }

      // Assistência Técnica com Supabase ativo -> aplica otimisticamente e grava atomicamente via RPC dedicada
      areasRef.current = next;
      setAreas(next);
      isReservationSavingRef.current = true;
      setReservationSyncing(true);

      try {
        const res = await toggleRemotePositionReservation({
          areaId: targetAreaId,
          elementId,
          positionId,
          reserved: nextStatus === 'reserved',
          reservedStore: nextStatus === 'reserved' ? reservationMeta?.store : undefined,
          reservedBy: nextStatus === 'reserved' ? reservationMeta?.reservedBy : undefined,
          reservedQuantity: nextStatus === 'reserved' ? reservationMeta?.quantity : undefined,
        });

        if (res.ok) {
          applyAuthoritativeRemoteRecord(res.record, { resetHistory: false });
          return { changed: true, nextStatus: res.nextStatus, synced: true };
        }

        // Em caso de falha na nuvem, reverte para o estado anterior confiável
        areasRef.current = previousAreas;
        setAreas(previousAreas);
        onNotify?.(res.error);
        return { changed: false, synced: false, error: res.error };
      } finally {
        isReservationSavingRef.current = false;
        setReservationSyncing(false);
      }
    },
    [applyAuthoritativeRemoteRecord, isAdmin, onNotify, recordAreas]
  );

  const undo = useCallback((): boolean => {
    if (!isAdmin) {
      onNotify?.('Modo Visitante: histórico de edição restrito a administradores.');
      return false;
    }
    if (!historyRef.current.length) return false;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [clone(areasRef.current), ...futureRef.current];
    setHistory(historyRef.current);
    setFuture(futureRef.current);
    areasRef.current = previous;
    setAreas(previous);

    markLocalEditPending(previous);
    return true;
  }, [isAdmin, markLocalEditPending, onNotify]);

  const redo = useCallback((): boolean => {
    if (!isAdmin) {
      onNotify?.('Modo Visitante: histórico de edição restrito a administradores.');
      return false;
    }
    if (!futureRef.current.length) return false;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [...historyRef.current, clone(areasRef.current)];
    setHistory(historyRef.current);
    setFuture(futureRef.current);
    areasRef.current = next;
    setAreas(next);

    markLocalEditPending(next);
    return true;
  }, [isAdmin, markLocalEditPending, onNotify]);

  // 5. Ações de Migração Inicial Local -> Nuvem (Admin apenas)
  const migrateLocalCandidateToCloud = useCallback(async () => {
    if (!isAdmin || !localMigrationCandidate?.found) return { ok: false, error: 'Acesso restrito.' };
    setMigrationBusy(true);
    try {
      const payload = sanitizeAreasForRender(localMigrationCandidate.areas);
      const res = await saveCentralMap(payload, 0);
      if (res.ok) {
        applyAuthoritativeRemoteRecord(res.record, {
          resetHistory: true,
          notifyText: 'Mapa local migrado para a nuvem central (v1) com sucesso!',
        });
        setMigrationDismissed(true);
        return { ok: true };
      }
      if (res.reason === 'conflict' && res.remoteRecord) {
        setCentralEmpty(false);
        setLocalMigrationCandidate(null);
        setConflictState({
          localAreas: payload,
          remoteRecord: res.remoteRecord,
          error: 'Um mapa central já foi inicializado na nuvem por outro administrador.',
        });
      }
      return { ok: false, error: res.error };
    } finally {
      setMigrationBusy(false);
    }
  }, [applyAuthoritativeRemoteRecord, isAdmin, localMigrationCandidate]);

  const initializeCleanCentralMap = useCallback(async () => {
    if (!isAdmin) return { ok: false, error: 'Acesso restrito.' };
    setMigrationBusy(true);
    try {
      const clean = sanitizeAreasForRender(clone(initialAreas));
      const res = await saveCentralMap(clean, 0);
      if (res.ok) {
        applyAuthoritativeRemoteRecord(res.record, {
          resetHistory: true,
          notifyText: 'Mapa central inicializado na nuvem (v1).',
        });
        setMigrationDismissed(true);
        return { ok: true };
      }
      return { ok: false, error: res.error };
    } finally {
      setMigrationBusy(false);
    }
  }, [applyAuthoritativeRemoteRecord, isAdmin]);

  // 6. Resolução e dispensa de conflitos (apenas sob ação explícita do administrador)
  const dismissConflict = useCallback(() => {
    setConflictState(null);
    if (hasUnsavedChangesRef.current) {
      setSyncStatus('pending');
    } else {
      setSyncStatus(isSupabaseConfigured ? 'saved' : 'unconfigured');
    }
  }, []);

  const resolveConflictReloadRemote = useCallback(async () => {
    if (conflictState?.remoteRecord) {
      applyAuthoritativeRemoteRecord(conflictState.remoteRecord, {
        resetHistory: true,
        notifyText: `Versão central v${conflictState.remoteRecord.version} recarregada.`,
      });
      return;
    }
    setConflictState(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setPendingChangesCount(0);
    await reloadFromCloud();
  }, [applyAuthoritativeRemoteRecord, conflictState, reloadFromCloud]);

  const resolveConflictPublishLocalDraft = useCallback(async () => {
    if (!isAdmin || !conflictState) return { ok: false, error: 'Sem conflito ativo.' };
    const targetVersion = conflictState.remoteRecord?.version ?? versionRef.current ?? 0;
    setSyncStatus('syncing');
    const res = await saveCentralMap(conflictState.localAreas, targetVersion);
    if (res.ok) {
      applyAuthoritativeRemoteRecord(res.record, {
        resetHistory: false,
        notifyText: `Alterações publicadas como nova versão central v${res.record.version}.`,
      });
      return { ok: true };
    }
    if (res.reason === 'conflict' && res.remoteRecord) {
      setConflictState({
        localAreas: conflictState.localAreas,
        remoteRecord: res.remoteRecord,
        error: res.error,
      });
    }
    setSyncStatus('error');
    setSyncError(res.error);
    return { ok: false, error: res.error };
  }, [applyAuthoritativeRemoteRecord, conflictState, isAdmin]);

  const shouldShowMigrationPrompt =
    isSupabaseConfigured &&
    isAdmin &&
    centralEmpty &&
    !migrationDismissed &&
    Boolean(localMigrationCandidate?.found);

  return {
    areas,
    areasRef,
    history,
    future,
    recordAreas,
    patchActive,
    togglePositionReservation,
    undo,
    redo,
    connectionStatus,
    syncStatus,
    syncError,
    mapVersion,
    lastUpdatedAt,
    lastUpdatedByEmail,
    centralEmpty,
    hasUnsavedChanges,
    pendingChangesCount,
    remoteUpdateNotice,
    reloadFromCloud,
    flushSaveToCloud,
    shouldShowMigrationPrompt,
    localMigrationCandidate,
    migrationBusy,
    migrateLocalCandidateToCloud,
    initializeCleanCentralMap,
    dismissMigrationPrompt: () => setMigrationDismissed(true),
    conflictState,
    dismissConflict,
    resolveConflictReloadRemote,
    resolveConflictPublishLocalDraft,
    reservationSyncing,
  };
}

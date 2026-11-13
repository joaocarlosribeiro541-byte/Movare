import { useCallback, useEffect, useRef, useState } from 'react';
import { initialAreas, type FloorArea } from '../editor-model';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchCentralMap,
  sanitizeAreasForRender,
  saveCentralMap,
  subscribeToCentralMap,
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

export type CloudSyncStatus =
  | 'unconfigured'
  | 'loading'
  | 'idle'
  | 'syncing'
  | 'saved'
  | 'error'
  | 'conflict';

export type MapConflictState = {
  localAreas: FloorArea[];
  remoteRecord?: SharedMapRecord;
  error: string;
};

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
  const [conflictState, setConflictState] = useState<MapConflictState | null>(null);

  const hasUnsavedChangesRef = useRef(false);
  const mutationSeqRef = useRef(0);
  const [saveTick, setSaveTick] = useState(0);
  const debounceTimerRef = useRef<number | null>(null);
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
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
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

  // Se o usuário sair do modo admin, cancela imediatamente gravações pendentes
  useEffect(() => {
    if (!isAdmin) {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setConflictState(null);
    }
  }, [isAdmin]);

  // 2. Assinatura Supabase Realtime (postgres_changes em public.shared_map)
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
        const currentVersion = versionRef.current ?? 0;
        if (record.version <= currentVersion) {
          return;
        }

        if (hasUnsavedChangesRef.current && isAdmin) {
          setSyncStatus('conflict');
          setConflictState({
            localAreas: clone(areasRef.current),
            remoteRecord: record,
            error:
              'Outro administrador publicou uma nova versão do mapa enquanto havia edições locais não sincronizadas.',
          });
          return;
        }

        const editedByOther = !userId || record.updated_by !== userId;
        applyAuthoritativeRemoteRecord(record, {
          resetHistory: true,
          notifyText: editedByOther
            ? `Mapa atualizado em tempo real (v${record.version}${
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

  // 3. Execução da persistência centralizada (Admin apenas)
  const flushSaveToCloud = useCallback(async () => {
    if (!isAdmin || !isSupabaseConfigured) return;
    if (conflictState) return;

    const seqAtStart = mutationSeqRef.current;
    const snapshot = clone(areasRef.current);

    const validation = validateCentralMapPayload(snapshot);
    if (!validation.valid) {
      setSyncStatus('error');
      setSyncError(validation.errors[0] || 'Dados inválidos aguardando correção para sincronizar.');
      return;
    }

    setSyncStatus('syncing');
    setSyncError(null);

    const expectedVer = versionRef.current ?? 0;
    const res = await saveCentralMap(snapshot, expectedVer);

    if (res.ok) {
      versionRef.current = res.record.version;
      setMapVersion(res.record.version);
      setLastUpdatedAt(res.record.updated_at);
      setLastUpdatedByEmail(res.record.updated_by_email);
      setCentralEmpty(false);
      setLocalMigrationCandidate(null);
      void saveAreas(res.record.data);

      if (mutationSeqRef.current === seqAtStart) {
        hasUnsavedChangesRef.current = false;
        setHasUnsavedChanges(false);
        setSyncStatus('saved');
        setSyncError(null);
      } else {
        // Novas alterações ocorreram enquanto a requisição estava em voo
        setSaveTick((t) => t + 1);
      }
      return;
    }

    if (res.reason === 'conflict') {
      setSyncStatus('conflict');
      setSyncError(res.error);
      setConflictState({
        localAreas: snapshot,
        remoteRecord: res.remoteRecord,
        error: res.error,
      });
      return;
    }

    setSyncStatus('error');
    setSyncError(res.error);
    onNotify?.(res.error);
  }, [conflictState, isAdmin, onNotify]);

  // Debounce automático exclusivo para alterações de administradores autenticados
  useEffect(() => {
    if (!isAdmin || !isSupabaseConfigured || saveTick === 0 || conflictState) return;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void flushSaveToCloud();
    }, 650);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [conflictState, flushSaveToCloud, isAdmin, saveTick]);

  // 4. Mutadores protegidos de estado
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

      if (isSupabaseConfigured) {
        hasUnsavedChangesRef.current = true;
        setHasUnsavedChanges(true);
        mutationSeqRef.current += 1;
        setSyncStatus('syncing');
        setSaveTick((t) => t + 1);
      } else {
        void saveAreas(next);
      }
      return true;
    },
    [isAdmin, onNotify]
  );

  const patchActive = useCallback(
    (patcher: (area: FloorArea) => FloorArea): boolean => {
      return recordAreas(
        areasRef.current.map((area) => (area.id === activeIdRef.current ? patcher(area) : area))
      );
    },
    [recordAreas]
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

    if (isSupabaseConfigured) {
      hasUnsavedChangesRef.current = true;
      setHasUnsavedChanges(true);
      mutationSeqRef.current += 1;
      setSyncStatus('syncing');
      setSaveTick((t) => t + 1);
    } else {
      void saveAreas(previous);
    }
    return true;
  }, [isAdmin, onNotify]);

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

    if (isSupabaseConfigured) {
      hasUnsavedChangesRef.current = true;
      setHasUnsavedChanges(true);
      mutationSeqRef.current += 1;
      setSyncStatus('syncing');
      setSaveTick((t) => t + 1);
    } else {
      void saveAreas(next);
    }
    return true;
  }, [isAdmin, onNotify]);

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

  // 6. Resolução de Conflitos
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
        notifyText: `Rascunho publicado como nova versão central v${res.record.version}.`,
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
    reloadFromCloud,
    flushSaveToCloud,
    shouldShowMigrationPrompt,
    localMigrationCandidate,
    migrationBusy,
    migrateLocalCandidateToCloud,
    initializeCleanCentralMap,
    dismissMigrationPrompt: () => setMigrationDismissed(true),
    conflictState,
    resolveConflictReloadRemote,
    resolveConflictPublishLocalDraft,
  };
}

import { initialAreas, type FloorArea, validAreas, DEFAULT_SCALE_RATIO } from './editor-model';
import { migrateBackupData } from './backup-schema';

const DB_NAME = 'movare-localizador';
const STORE_NAME = 'workspace';
const KEY_V2 = 'areas-v2';
const KEY_V1 = 'areas-v1';
const KEY_BACKUP_SNAPSHOT = 'movare-hot-snapshot';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'));
  });
}

function sanitizeAndMigrateData(raw: unknown): FloorArea[] | null {
  if (!raw) return null;
  // Se já for FloorArea[] válido
  if (validAreas(raw)) {
    return raw;
  }
  // Tenta migração estruturada
  const migration = migrateBackupData({
    format: 'movare-localizador-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    areas: Array.isArray(raw) ? raw : [raw],
  });
  if (migration.success && migration.areas.length > 0) {
    return migration.areas;
  }
  return null;
}

export async function loadAreas(): Promise<FloorArea[]> {
  // Tenta carregar do IndexedDB primeiro
  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openDatabase();
      const dbAreas = await new Promise<FloorArea[] | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const reqV2 = store.get(KEY_V2);

        reqV2.onsuccess = () => {
          const sanitized = sanitizeAndMigrateData(reqV2.result);
          if (sanitized && sanitized.length > 0) {
            db.close();
            resolve(sanitized);
            return;
          }

          // Fallback para V1 no IndexedDB
          const reqV1 = store.get(KEY_V1);
          reqV1.onsuccess = () => {
            const sanV1 = sanitizeAndMigrateData(reqV1.result);
            db.close();
            resolve(sanV1);
          };
          reqV1.onerror = () => {
            db.close();
            resolve(null);
          };
        };

        reqV2.onerror = () => {
          db.close();
          resolve(null);
        };
      });

      if (dbAreas && dbAreas.length > 0) {
        // Mantém cópia quente atualizada no localStorage
        saveLocalStorageAreas(dbAreas);
        return dbAreas;
      }
    } catch {
      // Se falhar ao abrir IndexedDB, prossegue para localStorage
    }
  }

  // Fallback resiliente para localStorage
  const localAreas = loadLocalStorageAreas();
  if (localAreas && localAreas.length > 0) {
    // Tenta re-popular o IndexedDB em background
    if (typeof indexedDB !== 'undefined') {
      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(localAreas, KEY_V2);
        tx.oncomplete = () => db.close();
      } catch {
        // Ignora
      }
    }
    return localAreas;
  }

  return structuredClone(initialAreas);
}

export async function saveAreas(areas: FloorArea[]): Promise<void> {
  // Salva no localStorage como réplica síncrona instantânea à prova de falha
  saveLocalStorageAreas(areas);

  if (typeof indexedDB === 'undefined') {
    return;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(areas, KEY_V2);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch {
    // Se o IndexedDB falhar temporariamente, a réplica no localStorage já foi garantida
  }
}

function loadLocalStorageAreas(): FloorArea[] {
  // 1. Tenta KEY_V2
  const savedV2 = localStorage.getItem(KEY_V2);
  if (savedV2) {
    try {
      const parsed = JSON.parse(savedV2);
      const sanitized = sanitizeAndMigrateData(parsed);
      if (sanitized && sanitized.length > 0) return sanitized;
    } catch {
      // Falha no parse, tenta próximo
    }
  }

  // 2. Tenta hot snapshot
  const hotSnap = localStorage.getItem(KEY_BACKUP_SNAPSHOT);
  if (hotSnap) {
    try {
      const parsed = JSON.parse(hotSnap);
      const sanitized = sanitizeAndMigrateData(parsed);
      if (sanitized && sanitized.length > 0) return sanitized;
    } catch {
      // Falha no parse, tenta próximo
    }
  }

  // 3. Tenta KEY_V1 legado
  const savedV1 = localStorage.getItem(KEY_V1);
  if (savedV1) {
    try {
      const parsed = JSON.parse(savedV1);
      const sanitized = sanitizeAndMigrateData(parsed);
      if (sanitized && sanitized.length > 0) return sanitized;
    } catch {
      // Falha
    }
  }

  return structuredClone(initialAreas);
}

function saveLocalStorageAreas(areas: FloorArea[]) {
  try {
    const serialized = JSON.stringify(areas);
    localStorage.setItem(KEY_V2, serialized);
    localStorage.setItem(KEY_BACKUP_SNAPSHOT, serialized);
  } catch {
    // QuotaExceededError fallback
  }
}

export type LocalExistingDataInspection = {
  found: boolean;
  source: 'indexeddb' | 'localstorage' | 'none';
  areas: FloorArea[];
  summary: {
    areasCount: number;
    elementsCount: number;
    totalPositions: number;
    occupiedPositions: number;
  };
};

/**
 * Verifica se um array FloorArea[] representa trabalho real do usuário
 * (não apenas o template vazio initialAreas).
 */
export function hasSubstantiveLocalMap(areas: FloorArea[] | null | undefined): boolean {
  if (!areas || areas.length === 0) return false;
  if (areas.length > 1) return true;
  const first = areas[0];
  if (!first) return false;
  if (first.elements && first.elements.length > 0) return true;
  if (first.id !== initialAreas[0].id || first.name !== initialAreas[0].name) return true;
  if (
    first.widthMeters !== initialAreas[0].widthMeters ||
    first.heightMeters !== initialAreas[0].heightMeters ||
    first.scaleRatio !== initialAreas[0].scaleRatio
  ) {
    return true;
  }
  return false;
}

export function summarizeAreasForMigration(areas: FloorArea[]) {
  let elementsCount = 0;
  let totalPositions = 0;
  let occupiedPositions = 0;
  for (const area of areas) {
    elementsCount += area.elements.length;
    for (const el of area.elements) {
      if (el.internalPositions) {
        totalPositions += el.internalPositions.length;
        for (const p of el.internalPositions) {
          if (p.status === 'occupied' || (p.sku && p.sku.trim().length > 0)) {
            occupiedPositions++;
          }
        }
      }
    }
  }
  return {
    areasCount: areas.length,
    elementsCount,
    totalPositions,
    occupiedPositions,
  };
}

/**
 * Inspeciona IndexedDB e localStorage para detectar mapa local pré-existente
 * pronto para migração inicial quando o banco Supabase ainda estiver vazio.
 */
export async function inspectLocalExistingData(): Promise<LocalExistingDataInspection> {
  let candidate: FloorArea[] | null = null;
  let source: 'indexeddb' | 'localstorage' | 'none' = 'none';

  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openDatabase();
      const dbAreas = await new Promise<FloorArea[] | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const reqV2 = store.get(KEY_V2);
        reqV2.onsuccess = () => {
          const sanV2 = sanitizeAndMigrateData(reqV2.result);
          if (sanV2 && sanV2.length > 0) {
            db.close();
            resolve(sanV2);
            return;
          }
          const reqV1 = store.get(KEY_V1);
          reqV1.onsuccess = () => {
            const sanV1 = sanitizeAndMigrateData(reqV1.result);
            db.close();
            resolve(sanV1);
          };
          reqV1.onerror = () => {
            db.close();
            resolve(null);
          };
        };
        reqV2.onerror = () => {
          db.close();
          resolve(null);
        };
      });

      if (dbAreas && hasSubstantiveLocalMap(dbAreas)) {
        candidate = dbAreas;
        source = 'indexeddb';
      }
    } catch {
      // prossegue para localStorage
    }
  }

  if (!candidate && typeof localStorage !== 'undefined') {
    for (const key of [KEY_V2, KEY_BACKUP_SNAPSHOT, KEY_V1]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeAndMigrateData(parsed);
        if (sanitized && hasSubstantiveLocalMap(sanitized)) {
          candidate = sanitized;
          source = 'localstorage';
          break;
        }
      } catch {
        // continua
      }
    }
  }

  if (!candidate) {
    return {
      found: false,
      source: 'none',
      areas: [],
      summary: { areasCount: 0, elementsCount: 0, totalPositions: 0, occupiedPositions: 0 },
    };
  }

  return {
    found: true,
    source,
    areas: candidate,
    summary: summarizeAreasForMigration(candidate),
  };
}


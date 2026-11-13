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

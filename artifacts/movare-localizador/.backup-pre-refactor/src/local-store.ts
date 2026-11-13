import { initialAreas, type FloorArea, validAreas, DEFAULT_SCALE_RATIO } from './editor-model';

const DB_NAME = 'movare-localizador';
const STORE_NAME = 'workspace';
const KEY_V2 = 'areas-v2';
const KEY_V1 = 'areas-v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'));
  });
}

export async function loadAreas(): Promise<FloorArea[]> {
  if (typeof indexedDB === 'undefined') {
    return loadLocalStorageAreas();
  }
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return loadLocalStorageAreas();
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const reqV2 = store.get(KEY_V2);

    reqV2.onsuccess = () => {
      if (validAreas(reqV2.result)) {
        db.close();
        resolve(reqV2.result);
        return;
      }

      // Tenta fallback para V1
      const reqV1 = store.get(KEY_V1);
      reqV1.onsuccess = () => {
        const val1 = reqV1.result;
        db.close();
        if (validAreas(val1) && val1.some((a) => a.elements.length > 0)) {
          const migrated = val1.map((a) => ({
            ...a,
            scaleRatio: a.scaleRatio ?? DEFAULT_SCALE_RATIO,
          }));
          resolve(migrated);
        } else {
          resolve(structuredClone(initialAreas));
        }
      };
      reqV1.onerror = () => {
        db.close();
        resolve(structuredClone(initialAreas));
      };
    };
    reqV2.onerror = () => {
      db.close();
      resolve(structuredClone(initialAreas));
    };
  });
}

export async function saveAreas(areas: FloorArea[]): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    saveLocalStorageAreas(areas);
    return;
  }
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    saveLocalStorageAreas(areas);
    return;
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(areas, KEY_V2);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

function loadLocalStorageAreas(): FloorArea[] {
  const savedV2 = localStorage.getItem(KEY_V2);
  if (savedV2) {
    try {
      const parsed = JSON.parse(savedV2);
      if (validAreas(parsed)) return parsed;
    } catch {
      // Ignora e tenta v1
    }
  }

  const savedV1 = localStorage.getItem(KEY_V1);
  if (savedV1) {
    try {
      const parsed = JSON.parse(savedV1);
      if (validAreas(parsed) && parsed.some((a) => a.elements.length > 0)) {
        return parsed.map((a) => ({ ...a, scaleRatio: a.scaleRatio ?? DEFAULT_SCALE_RATIO }));
      }
    } catch {
      // Falha
    }
  }

  return structuredClone(initialAreas);
}

function saveLocalStorageAreas(areas: FloorArea[]) {
  localStorage.setItem(KEY_V2, JSON.stringify(areas));
}

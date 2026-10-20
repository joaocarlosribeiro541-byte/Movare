import { initialAreas, type FloorArea, validAreas } from './editor-model';

const DB_NAME = 'movare-localizador';
const STORE_NAME = 'workspace';
const KEY = 'areas-v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
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
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => {
      const value: unknown = request.result;
      resolve(validAreas(value) ? value : structuredClone(initialAreas));
      db.close();
    };
    request.onerror = () => { db.close(); reject(request.error); };
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
    transaction.objectStore(STORE_NAME).put(areas, KEY);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

function loadLocalStorageAreas(): FloorArea[] {
  const saved = localStorage.getItem(KEY);
  if (!saved) return structuredClone(initialAreas);
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw new Error('Os dados locais estão inválidos. Nenhuma alteração foi salva.');
  }
  if (!validAreas(value)) throw new Error('Os dados locais não passaram na validação. Nenhuma alteração foi salva.');
  return value;
}

function saveLocalStorageAreas(areas: FloorArea[]) {
  localStorage.setItem(KEY, JSON.stringify(areas));
}

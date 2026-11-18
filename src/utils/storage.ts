import { ClaimFormData } from '../types/claim';

const DB_NAME = 'coupang-compensation-db';
const DB_VERSION = 1;
const STORE_CLAIMS = 'claims';
const STORE_DRAFT = 'draft';
const CURRENT_DRAFT_KEY = 'active-draft';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CLAIMS)) {
        db.createObjectStore(STORE_CLAIMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open database'));
  });
}

export async function saveActiveDraft(claim: ClaimFormData): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFT, 'readwrite');
      tx.objectStore(STORE_DRAFT).put(claim, CURRENT_DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback ignored if storage is restricted
  }
}

export async function loadActiveDraft(): Promise<ClaimFormData | null> {
  try {
    const db = await openDb();
    const result = await new Promise<ClaimFormData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFT, 'readonly');
      const req = tx.objectStore(STORE_DRAFT).get(CURRENT_DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as ClaimFormData) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function saveClaimRecord(claim: ClaimFormData): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CLAIMS, 'readwrite');
    tx.objectStore(STORE_CLAIMS).put(claim);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listClaimRecords(): Promise<ClaimFormData[]> {
  try {
    const db = await openDb();
    const records = await new Promise<ClaimFormData[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CLAIMS, 'readonly');
      const req = tx.objectStore(STORE_CLAIMS).getAll();
      req.onsuccess = () => resolve((req.result as ClaimFormData[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteClaimRecord(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CLAIMS, 'readwrite');
    tx.objectStore(STORE_CLAIMS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

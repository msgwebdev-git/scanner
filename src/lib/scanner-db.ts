import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

export interface Ticket {
  qrData: string;
  ticketCode: string;
  customerName: string;
  ticketName: string;
  optionName: string | null;
  orderNumber: string;
  isInvitation: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
}

interface ScannerDB extends DBSchema {
  tickets: {
    key: string;
    value: Ticket;
  };
  pendingCheckins: {
    key: number;
    value: {
      id?: number;
      qrData: string;
      scannedBy: string;
      scannedAt: string;
      synced: number;        // 0 = not synced, 1 = synced (boolean not valid IDB key)
    };
    indexes: {
      'by-synced': number;
    };
  };
}

const DB_NAME = 'festival-scanner';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ScannerDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ScannerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tickets')) {
          db.createObjectStore('tickets', { keyPath: 'qrData' });
        }
        if (!db.objectStoreNames.contains('pendingCheckins')) {
          const store = db.createObjectStore('pendingCheckins', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-synced', 'synced');
        }
      },
    });
  }
  return dbPromise;
}

export async function upsertTickets(tickets: ScannerDB['tickets']['value'][]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tickets', 'readwrite');
  await Promise.all([
    ...tickets.map((t) => tx.store.put(t)),
    tx.done,
  ]);
}

export async function getTicket(qrData: string): Promise<ScannerDB['tickets']['value'] | undefined> {
  const db = await getDB();
  return db.get('tickets', qrData);
}

export async function localCheckIn(qrData: string, scannedBy: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  // Update ticket in tickets store
  const ticket = await db.get('tickets', qrData);
  if (ticket) {
    ticket.checkedInAt = now;
    ticket.checkedInBy = scannedBy;
    await db.put('tickets', ticket);
  }

  // Add to pending checkins
  await db.add('pendingCheckins', {
    qrData,
    scannedBy,
    scannedAt: now,
    synced: 0,
  });
}

export async function getPendingCheckins(): Promise<ScannerDB['pendingCheckins']['value'][]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingCheckins', 'by-synced', 0);
}

export async function markSynced(ids: number[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pendingCheckins', 'readwrite');
  await Promise.all([
    ...ids.map(async (id) => {
      const item = await tx.store.get(id);
      if (item) {
        item.synced = 1;
        await tx.store.put(item);
      }
    }),
    tx.done,
  ]);
}

export async function getTicketCount(): Promise<number> {
  const db = await getDB();
  return db.count('tickets');
}

export async function getCheckedInCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('tickets');
  return all.filter((t) => t.checkedInAt !== null).length;
}

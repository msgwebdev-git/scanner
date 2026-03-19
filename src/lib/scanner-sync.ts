import { scannerFetch } from './api';
import { upsertTickets, getPendingCheckins, markSynced } from './scanner-db';

let manifestTimer: ReturnType<typeof setInterval> | null = null;
let checkinTimer: ReturnType<typeof setInterval> | null = null;
let _isOnline = false;

export function isOnline(): boolean {
  return _isOnline;
}

export async function syncManifest(): Promise<{ count: number } | null> {
  try {
    const res = await scannerFetch('/api/scan/manifest');
    if (!res.ok) {
      _isOnline = false;
      return null;
    }
    _isOnline = true;
    const json = await res.json();
    const tickets = json.data;
    await upsertTickets(tickets);
    return { count: tickets.length };
  } catch {
    _isOnline = false;
    return null;
  }
}

export async function syncCheckins(): Promise<{ synced: number } | null> {
  try {
    const pending = await getPendingCheckins();
    if (pending.length === 0) return { synced: 0 };

    const batch = pending.slice(0, 50);
    const res = await scannerFetch('/api/scan/batch', {
      method: 'POST',
      body: JSON.stringify({
        checkins: batch.map((c) => ({
          qrData: c.qrData,
          scannedBy: c.scannedBy,
          scannedAt: c.scannedAt,
        })),
      }),
    });

    if (!res.ok) {
      _isOnline = false;
      return null;
    }

    _isOnline = true;
    const json = await res.json();
    const results: Array<{ qrData: string; status: string }> = json.data.results;

    // Mark ok + already_checked_in as synced
    const syncedIds: number[] = [];
    for (let i = 0; i < results.length; i++) {
      const status = results[i].status;
      if (status === 'ok' || status === 'already_checked_in') {
        const id = batch[i].id;
        if (id !== undefined) syncedIds.push(id);
      }
    }

    if (syncedIds.length > 0) {
      await markSynced(syncedIds);
    }

    return { synced: syncedIds.length };
  } catch {
    _isOnline = false;
    return null;
  }
}

export function startSync(): void {
  stopSync();
  // Manifest sync every 5 minutes
  syncManifest();
  manifestTimer = setInterval(syncManifest, 5 * 60 * 1000);
  // Checkin sync every 10 seconds
  syncCheckins();
  checkinTimer = setInterval(syncCheckins, 10 * 1000);
}

export function stopSync(): void {
  if (manifestTimer) { clearInterval(manifestTimer); manifestTimer = null; }
  if (checkinTimer) { clearInterval(checkinTimer); checkinTimer = null; }
}

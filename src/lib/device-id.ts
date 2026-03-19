const STORAGE_KEY = 'scanner_device_id';

/**
 * Get or create a permanent device ID.
 * Generated once on first visit, stored in localStorage forever.
 * Format: SCAN-XXXX (4 uppercase hex chars from crypto.randomUUID)
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    const uuid = crypto.randomUUID();
    id = 'SCAN-' + uuid.slice(0, 4).toUpperCase();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

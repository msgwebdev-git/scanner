import { API_URL } from './config';

export async function scannerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('scanner_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('scanner_token');
    window.dispatchEvent(new Event('scanner-auth-expired'));
  }
  return res;
}

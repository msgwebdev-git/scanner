import { useState } from 'react';
import { scannerFetch } from '../lib/api';
import { getDeviceId } from '../lib/device-id';

interface Props {
  onAuth: () => void;
}

export default function PinScreen({ onAuth }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deviceId = getDeviceId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Введите PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await scannerFetch('/api/scan/auth', {
        method: 'POST',
        body: JSON.stringify({ pin, deviceId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error || 'Неверный PIN');
        setLoading(false);
        return;
      }

      const json = await res.json();
      localStorage.setItem('scanner_token', json.data.token);
      onAuth();
    } catch {
      setError('Нет связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Logo area */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Festival Scanner</h1>
        <p className="text-gray-500 text-sm mt-1">Сканер билетов</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5"
      >
        {/* PIN */}
        <div>
          <input
            type="number"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN-код"
            maxLength={6}
            className="w-full text-center text-3xl font-mono tracking-[0.3em] bg-gray-900 border-2 border-gray-800 rounded-2xl px-6 py-5 focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-lg"
            autoFocus
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-5 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl text-xl font-bold transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Подключение...
            </span>
          ) : 'Войти'}
        </button>

        {/* Device ID */}
        <div className="text-center pt-2">
          <span className="text-xs text-gray-600 font-mono">{deviceId}</span>
        </div>
      </form>
    </div>
  );
}

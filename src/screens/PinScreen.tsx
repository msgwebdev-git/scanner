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
    <div className="flex-1 flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 space-y-6"
      >
        <h1 className="text-2xl font-bold text-center">Festival Scanner</h1>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">PIN-код</label>
          <input
            type="number"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="0000"
            maxLength={6}
            className="w-full text-center text-3xl font-mono tracking-widest bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Устройство</label>
          <div className="w-full text-center text-xl font-mono bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-4 text-gray-300">
            {deviceId}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-center text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-lg font-semibold transition-colors"
        >
          {loading ? 'Подключение...' : 'Активировать'}
        </button>
      </form>
    </div>
  );
}

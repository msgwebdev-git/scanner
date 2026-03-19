import { useState, useEffect } from 'react';
import { startSync, isOnline } from '../lib/scanner-sync';
import {
  getTicketCount,
  getCheckedInCount,
  getPendingCheckins,
} from '../lib/scanner-db';

interface Props {
  deviceId: string;
  onScan: () => void;
  onLogout: () => void;
}

export default function DashboardScreen({ deviceId, onScan, onLogout }: Props) {
  const [ticketCount, setTicketCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(false);
  const [lastSync, setLastSync] = useState<string>('—');

  useEffect(() => {
    startSync();

    const refresh = async () => {
      try {
        const [tickets, checkedIn, pending] = await Promise.all([
          getTicketCount(),
          getCheckedInCount(),
          getPendingCheckins(),
        ]);
        setTicketCount(tickets);
        setCheckedInCount(checkedIn);
        setPendingCount(pending.length);
        const nowOnline = isOnline();
        setOnline(nowOnline);
        if (nowOnline) {
          setLastSync(
            new Date().toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Chisinau',
            })
          );
        }
      } catch {
        // ignore
      }
    };

    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold truncate mr-4">{deviceId}</h1>
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 hover:text-white shrink-0 py-2 px-3 rounded-lg bg-gray-800"
        >
          Выйти
        </button>
      </div>

      {/* Online indicator */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className={`w-3 h-3 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-sm text-gray-300">
          {online ? 'Онлайн' : 'Офлайн'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-2xl font-bold">{ticketCount}</div>
          <div className="text-sm text-gray-400 mt-1">Билетов в базе</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-2xl font-bold">{checkedInCount}</div>
          <div className="text-sm text-gray-400 mt-1">Check-in</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-2xl font-bold">{pendingCount}</div>
          <div className="text-sm text-gray-400 mt-1">Ожидает sync</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-2xl font-bold">{lastSync}</div>
          <div className="text-sm text-gray-400 mt-1">Последний sync</div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Scan button */}
      <button
        onClick={onScan}
        className="w-full py-6 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-2xl text-2xl font-bold tracking-wide transition-colors"
      >
        СКАНИРОВАТЬ
      </button>
    </div>
  );
}

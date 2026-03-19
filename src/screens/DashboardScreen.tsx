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
  onVolunteer: () => void;
  onLogout: () => void;
}

export default function DashboardScreen({ deviceId, onScan, onVolunteer, onLogout }: Props) {
  const [ticketCount, setTicketCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(false);

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
        setOnline(isOnline());
      } catch {
        // ignore
      }
    };

    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-mono text-gray-400">{deviceId}</span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Выйти
        </button>
      </div>

      {/* Stats */}
      <div className="px-5 pt-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={ticketCount} label="В базе" />
          <StatCard value={checkedInCount} label="Прошли" accent />
          <StatCard
            value={pendingCount}
            label="Ожидает"
            warning={pendingCount > 0}
          />
        </div>
      </div>

      {/* Main area — scan button takes most of the screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
        <button
          onClick={onScan}
          className="w-full max-w-sm aspect-square rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 active:scale-95 transition-all flex flex-col items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.3)]"
        >
          {/* Scan icon */}
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
          <span className="text-white text-xl font-bold mt-3">СКАНИРОВАТЬ</span>
        </button>

        <button
          onClick={onVolunteer}
          className="mt-4 w-full max-w-sm py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl text-base font-medium text-gray-300 transition-colors"
        >
          Монитор волонтёра
        </button>
      </div>
    </div>
  );
}

function StatCard({ value, label, accent, warning }: {
  value: number;
  label: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-gray-900/80 rounded-xl px-3 py-3 text-center">
      <div className={`text-2xl font-bold ${
        warning ? 'text-amber-400' : accent ? 'text-green-400' : 'text-white'
      }`}>
        {value.toLocaleString('ru-RU')}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { scannerFetch } from '../lib/api';

interface LiveEvent {
  deviceId: string;
  type: 'valid' | 'duplicate' | 'invalid';
  customerName?: string;
  ticketName?: string;
  optionName?: string | null;
  braceletColor?: string;
  braceletLabel?: string;
  isInvitation?: boolean;
  checkedInAt?: string;
  checkedInBy?: string | null;
  scannedAt: string;
}

interface Props {
  onBack: () => void;
}

export default function VolunteerScreen({ onBack }: Props) {
  const [targetDevice, setTargetDevice] = useState(() =>
    localStorage.getItem('volunteer_target_device') || ''
  );
  const [connected, setConnected] = useState(false);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = (deviceId: string) => {
    localStorage.setItem('volunteer_target_device', deviceId);
    setConnected(true);

    const poll = async () => {
      try {
        const res = await scannerFetch(`/api/scan/live/${deviceId}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data as LiveEvent | null;
        if (data && data.scannedAt !== lastEventTime) {
          setEvent(data);
          setLastEventTime(data.scannedAt);
        }
      } catch { /* offline */ }
    };

    poll();
    pollRef.current = setInterval(poll, 1000);
  };

  // Track lastEventTime with ref to avoid stale closure
  const lastEventTimeRef = useRef(lastEventTime);
  lastEventTimeRef.current = lastEventTime;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // If not connected — show device ID input
  if (!connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Монитор волонтёра</h1>
          <p className="text-gray-500 text-sm mt-1">Введите ID сканера для подключения</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            value={targetDevice}
            onChange={(e) => setTargetDevice(e.target.value.toUpperCase())}
            placeholder="SCAN-XXXX"
            className="w-full text-center text-2xl font-mono tracking-widest bg-gray-900 border-2 border-gray-800 rounded-2xl px-6 py-5 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600 placeholder:text-lg placeholder:tracking-normal"
            autoFocus
          />

          <button
            onClick={() => {
              if (targetDevice.trim()) startPolling(targetDevice.trim());
            }}
            disabled={!targetDevice.trim()}
            className="w-full py-5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl text-xl font-bold transition-colors"
          >
            Подключиться
          </button>

          <button
            onClick={onBack}
            className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  // Connected — show live feed
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <button
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setConnected(false);
            setEvent(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Отключиться
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 pulse-ring" />
          <span className="text-xs font-mono text-gray-400">{targetDevice}</span>
        </div>
      </div>

      {/* Result area */}
      <div className="flex-1 flex items-center justify-center">
        {!event ? (
          <WaitingState />
        ) : event.type === 'valid' ? (
          <ValidDisplay event={event} />
        ) : event.type === 'duplicate' ? (
          <DuplicateDisplay event={event} />
        ) : (
          <InvalidDisplay />
        )}
      </div>
    </div>
  );
}

// ─── Display States ─────────────────────────────────────

function WaitingState() {
  return (
    <div className="text-center p-8">
      <div className="w-20 h-20 rounded-full border-2 border-gray-800 flex items-center justify-center mx-auto mb-6">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        </svg>
      </div>
      <p className="text-gray-600 text-lg">Ожидание сканирования...</p>
    </div>
  );
}

function ValidDisplay({ event }: { event: LiveEvent }) {
  return (
    <div className="fixed inset-0 bg-green-500 flex flex-col items-center justify-center p-6 text-center">
      {/* Bracelet color — HUGE, most important for volunteer */}
      {event.braceletColor && (
        <div
          className="w-32 h-32 rounded-full border-4 border-white/30 mb-6 shadow-lg"
          style={{ backgroundColor: event.braceletColor }}
        />
      )}

      <h1 className="text-4xl font-black mb-2 tracking-tight">ПРОХОДИ</h1>

      {event.braceletLabel && (
        <p className="text-2xl font-bold uppercase tracking-widest mb-4 text-white/90">
          {event.braceletLabel} браслет
        </p>
      )}

      <p className="text-xl font-semibold text-white/80 mb-1">
        {event.customerName}
      </p>
      <p className="text-base text-white/60">
        {event.ticketName}
        {event.optionName ? ` \u2022 ${event.optionName}` : ''}
      </p>

      {event.isInvitation && (
        <div className="mt-4 bg-white/20 rounded-full px-5 py-2">
          <span className="text-sm font-bold uppercase tracking-widest">Приглашение</span>
        </div>
      )}
    </div>
  );
}

function DuplicateDisplay({ event }: { event: LiveEvent }) {
  const time = event.checkedInAt
    ? new Date(event.checkedInAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Chisinau',
      })
    : '—';

  return (
    <div className="fixed inset-0 bg-amber-500 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1 className="text-4xl font-black mb-3 tracking-tight">НЕ ПУСКАТЬ</h1>
      <p className="text-xl text-white/80 mb-1">{event.customerName}</p>
      <p className="text-base text-white/60">Вход в {time}</p>
    </div>
  );
}

function InvalidDisplay() {
  return (
    <div className="fixed inset-0 bg-red-500 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h1 className="text-4xl font-black tracking-tight">НЕ ПУСКАТЬ</h1>
    </div>
  );
}

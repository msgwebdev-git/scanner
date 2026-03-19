import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../lib/config';

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
  const [sseStatus, setSseStatus] = useState<'connecting' | 'open' | 'error'>('connecting');
  const esRef = useRef<EventSource | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connectError, setConnectError] = useState('');
  const errorCountRef = useRef(0);

  const connect = (deviceId: string) => {
    setConnectError('');

    const token = localStorage.getItem('scanner_token');
    if (!token) {
      window.dispatchEvent(new Event('scanner-auth-expired'));
      return;
    }

    localStorage.setItem('volunteer_target_device', deviceId);
    setConnected(true);
    setSseStatus('connecting');
    errorCountRef.current = 0;

    const url = `${API_URL}/api/scan/live/stream/${deviceId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setSseStatus('open');
      errorCountRef.current = 0;
    };

    es.onmessage = (e) => {
      errorCountRef.current = 0;
      try {
        const data = JSON.parse(e.data) as LiveEvent;
        setEvent(data);

        // Auto-clear after 8 seconds — back to "waiting"
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setEvent(null), 8000);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      errorCountRef.current++;
      setSseStatus('error');

      // After 5 consecutive errors — likely auth failure, disconnect
      if (errorCountRef.current >= 5) {
        es.close();
        setConnected(false);
        setConnectError('Не удалось подключиться. Проверьте PIN и попробуйте снова.');
      }
    };
  };

  const disconnect = () => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
    setEvent(null);
    setSseStatus('connecting');
  };

  useEffect(() => {
    return () => {
      esRef.current?.close();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // ─── Connection Screen ────────────────────────────────
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

          {connectError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-red-400 text-sm">{connectError}</p>
            </div>
          )}

          <button
            onClick={() => { if (targetDevice.trim()) connect(targetDevice.trim()); }}
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

  // ─── Live Feed Screen ─────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50 shrink-0 z-10">
        <button
          onClick={disconnect}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Отключиться
        </button>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            sseStatus === 'open' ? 'bg-green-500' :
            sseStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
          }`} />
          <span className="text-xs font-mono text-gray-400">{targetDevice}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {!event ? (
          <div className="h-full flex items-center justify-center">
            <WaitingState />
          </div>
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

// ─── Display Components ─────────────────────────────────

function WaitingState() {
  return (
    <div className="text-center p-8">
      <div className="w-24 h-24 rounded-full border-2 border-gray-800 flex items-center justify-center mx-auto mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        </svg>
      </div>
      <p className="text-gray-600 text-xl font-medium">Ожидание сканирования</p>
      <p className="text-gray-700 text-sm mt-2">Результат появится мгновенно</p>
    </div>
  );
}

function ValidDisplay({ event }: { event: LiveEvent }) {
  return (
    <div className="h-full bg-green-500 flex flex-col text-center">
      {/* Top — PASS signal */}
      <div className="flex-1 flex items-end justify-center pb-4 px-6">
        <h1 className="text-5xl sm:text-6xl font-black text-white drop-shadow-lg">ПРОХОДИ</h1>
      </div>

      {/* Middle — bracelet color band (looks like a wristband) */}
      {event.braceletColor && (
        <div
          className="w-full py-6 flex items-center justify-center shadow-lg"
          style={{ backgroundColor: event.braceletColor }}
        >
          <span className="text-4xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md">
            {event.braceletLabel}
          </span>
        </div>
      )}

      {/* Bottom — ticket info */}
      <div className="flex-1 flex flex-col items-center justify-start pt-4 px-6">
        <p className="text-xl font-bold text-white">{event.customerName}</p>
        <p className="text-base text-white/70 mt-1">
          {event.ticketName}
          {event.optionName ? ` \u2022 ${event.optionName}` : ''}
        </p>
        {event.isInvitation && (
          <div className="mt-3 bg-white/20 rounded-full px-5 py-1.5">
            <span className="text-sm font-bold uppercase tracking-widest">Приглашение</span>
          </div>
        )}
      </div>
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
    <div className="h-full bg-amber-500 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl sm:text-8xl font-black mb-4 tracking-tight text-white drop-shadow-lg">СТОП</h1>

      <div className="bg-black/25 backdrop-blur-sm rounded-2xl px-6 py-4 max-w-sm w-full">
        <p className="text-xl font-bold text-white mb-1">{event.customerName}</p>
        <p className="text-base text-white/80 mb-2">
          {event.ticketName}
          {event.optionName ? ` \u2022 ${event.optionName}` : ''}
        </p>

        {event.braceletColor && (
          <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-white/20">
            <div className="w-5 h-5 rounded-full border-2 border-white/50" style={{ backgroundColor: event.braceletColor }} />
            <span className="text-sm font-bold text-white/80 uppercase">{event.braceletLabel}</span>
          </div>
        )}
      </div>

      <p className="text-lg text-white/70 mt-4">Уже прошёл в {time}</p>
    </div>
  );
}

function InvalidDisplay() {
  return (
    <div className="h-full bg-red-600 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl sm:text-8xl font-black tracking-tight text-white drop-shadow-lg">СТОП</h1>
      <p className="text-xl text-white/70 mt-4">Билет недействителен</p>
    </div>
  );
}

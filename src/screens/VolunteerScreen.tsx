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

  const [connectError, setConnectError] = useState('');

  const connect = async (deviceId: string) => {
    setConnectError('');

    // Validate token before opening SSE (EventSource can't detect 401)
    const token = localStorage.getItem('scanner_token') || '';
    try {
      const checkRes = await fetch(`${API_URL}/api/scan/cache/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (checkRes.status === 401) {
        localStorage.removeItem('scanner_token');
        window.dispatchEvent(new Event('scanner-auth-expired'));
        return;
      }
    } catch {
      setConnectError('Нет связи с сервером');
      return;
    }

    localStorage.setItem('volunteer_target_device', deviceId);
    setConnected(true);
    setSseStatus('connecting');

    const url = `${API_URL}/api/scan/live/stream/${deviceId}?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setSseStatus('open');
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent;
        setEvent(data);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setSseStatus('error');
      // EventSource auto-reconnects — status will change back to 'open'
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
    <div className="h-full bg-green-500 flex flex-col items-center justify-center p-6 text-center">
      {/* Bracelet — biggest element, the main info for volunteer */}
      {event.braceletColor && (
        <div
          className="w-36 h-36 rounded-full border-[6px] border-white/30 mb-5 shadow-2xl"
          style={{ backgroundColor: event.braceletColor }}
        />
      )}

      {event.braceletLabel && (
        <p className="text-3xl font-black uppercase tracking-widest mb-2 text-white">
          {event.braceletLabel}
        </p>
      )}

      <div className="bg-white/15 rounded-2xl px-6 py-4 mt-2 max-w-sm w-full">
        <p className="text-xl font-bold text-white mb-1">{event.customerName}</p>
        <p className="text-base text-white/70">
          {event.ticketName}
          {event.optionName ? ` \u2022 ${event.optionName}` : ''}
        </p>
      </div>

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
    <div className="h-full bg-amber-500 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1 className="text-5xl font-black mb-3 tracking-tight">СТОП</h1>
      <p className="text-2xl text-white/80 mb-1">{event.customerName}</p>
      <p className="text-lg text-white/60">Уже прошёл в {time}</p>
    </div>
  );
}

function InvalidDisplay() {
  return (
    <div className="h-full bg-red-500 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h1 className="text-5xl font-black tracking-tight">СТОП</h1>
    </div>
  );
}

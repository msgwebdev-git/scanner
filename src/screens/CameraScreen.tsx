import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { getTicket, localCheckIn, type Ticket } from '../lib/scanner-db';
import type { ScanResult } from '../App';

interface Props {
  deviceId: string;
  onBack: () => void;
}

const RESULT_DURATION_MS = 3000;

export default function CameraScreen({ deviceId, onBack }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isProcessingRef = useRef(false);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;

    const qrboxSize = Math.min(
      Math.floor(window.innerWidth * 0.65),
      Math.floor(window.innerHeight * 0.35),
      280
    );

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: window.innerHeight / window.innerWidth,
          disableFlip: false,
        },
        async (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          try { scanner.pause(true); } catch { /* */ }

          let scanResult: ScanResult;
          try {
            const ticket = await getTicket(decodedText);
            if (!ticket) {
              scanResult = { type: 'invalid' };
            } else if (ticket.checkedInAt) {
              scanResult = { type: 'duplicate', ticket };
            } else {
              await localCheckIn(decodedText, deviceIdRef.current);
              const updated = await getTicket(decodedText);
              scanResult = { type: 'valid', ticket: updated || ticket };
              setScanCount((c) => c + 1);
            }
          } catch {
            scanResult = { type: 'invalid' };
          }

          // Vibrate
          if (scanResult.type === 'valid') {
            navigator.vibrate?.(200);
          } else if (scanResult.type === 'duplicate') {
            navigator.vibrate?.([200, 100, 200]);
          } else {
            navigator.vibrate?.([200, 100, 200, 100, 200]);
          }

          setResult(scanResult);

          setTimeout(() => {
            setResult(null);
            isProcessingRef.current = false;
            try { scanner.resume(); } catch { /* */ }
          }, RESULT_DURATION_MS);
        },
        () => {}
      )
      .catch((err: unknown) => {
        console.error('Camera start failed:', err);
      });

    navigator.wakeLock?.request('screen').then((s) => {
      wakeLockRef.current = s;
    }).catch(() => {});

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const dismissResult = () => {
    setResult(null);
    isProcessingRef.current = false;
    try { scannerRef.current?.resume(); } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Camera feed — html5-qrcode renders here */}
      <div id="qr-reader" className="absolute inset-0" />

      {/* Custom viewfinder overlay */}
      {!result && <Viewfinder />}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {scanCount > 0 && (
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-green-400 text-sm font-bold">{scanCount}</span>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {!result && (
        <div className="absolute bottom-8 left-0 right-0 text-center z-10">
          <p className="text-white/50 text-sm">Наведите камеру на QR-код</p>
        </div>
      )}

      {/* Result overlay */}
      {result && <ResultOverlay result={result} onDismiss={dismissResult} />}
    </div>
  );
}

// ─── Custom Viewfinder ──────────────────────────────────

function Viewfinder() {
  return (
    <div className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center">
      {/* Dimmed corners */}
      <div className="relative w-[70vw] max-w-[280px] aspect-square">
        {/* Corner brackets */}
        <Corner position="top-left" />
        <Corner position="top-right" />
        <Corner position="bottom-left" />
        <Corner position="bottom-right" />

        {/* Scanning line */}
        <div className="absolute left-4 right-4 h-0.5 bg-green-400/80 shadow-[0_0_8px_rgba(74,222,128,0.6)] scan-line-animate" />
      </div>
    </div>
  );
}

function Corner({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const base = 'absolute w-8 h-8';
  const styles = {
    'top-left': `${base} top-0 left-0 border-t-[3px] border-l-[3px] border-white rounded-tl-lg`,
    'top-right': `${base} top-0 right-0 border-t-[3px] border-r-[3px] border-white rounded-tr-lg`,
    'bottom-left': `${base} bottom-0 left-0 border-b-[3px] border-l-[3px] border-white rounded-bl-lg`,
    'bottom-right': `${base} bottom-0 right-0 border-b-[3px] border-r-[3px] border-white rounded-br-lg`,
  };
  return <div className={styles[position]} />;
}

// ─── Result Overlay ─────────────────────────────────────

function ResultOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const bg = {
    valid: 'bg-green-500',
    duplicate: 'bg-amber-500',
    invalid: 'bg-red-500',
  }[result.type];

  return (
    <div
      className={`fixed inset-0 ${bg} z-20 flex flex-col items-center justify-center p-6 select-none`}
      onClick={onDismiss}
    >
      {result.type === 'valid' && result.ticket && <ValidResult ticket={result.ticket} />}
      {result.type === 'duplicate' && result.ticket && <DuplicateResult ticket={result.ticket} />}
      {result.type === 'invalid' && <InvalidResult />}

      {/* Countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
        <div
          className="h-full bg-white/40"
          style={{
            animation: `shrink ${RESULT_DURATION_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

function ValidResult({ ticket }: { ticket: Ticket }) {
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-5xl font-black mb-4 tracking-tight">ПРОХОДИ</h1>
      <p className="text-2xl font-semibold text-white/90 text-center mb-1">
        {ticket.customerName}
      </p>
      <p className="text-lg text-white/70 text-center">
        {ticket.ticketName}
        {ticket.optionName ? ` \u2022 ${ticket.optionName}` : ''}
      </p>
      {ticket.isInvitation && (
        <div className="mt-5 bg-white/20 rounded-full px-5 py-2">
          <span className="text-sm font-bold uppercase tracking-widest">Приглашение</span>
        </div>
      )}
    </>
  );
}

function DuplicateResult({ ticket }: { ticket: Ticket }) {
  const time = ticket.checkedInAt
    ? new Date(ticket.checkedInAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Chisinau',
      })
    : '—';

  return (
    <>
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1 className="text-4xl font-black mb-4 tracking-tight">УЖЕ ПРОШЁЛ</h1>
      <p className="text-xl font-semibold text-white/90 text-center mb-3">
        {ticket.customerName}
      </p>
      <div className="bg-white/15 rounded-xl px-5 py-3 text-center">
        <p className="text-white/80 text-base">
          Вход в <span className="font-bold">{time}</span>
        </p>
        {ticket.checkedInBy && (
          <p className="text-white/60 text-sm mt-1">{ticket.checkedInBy}</p>
        )}
      </div>
    </>
  );
}

function InvalidResult() {
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h1 className="text-4xl font-black tracking-tight">НЕДЕЙСТВИТЕЛЕН</h1>
    </>
  );
}

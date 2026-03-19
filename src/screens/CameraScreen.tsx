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

  // Initialize camera once on mount
  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;

    // Responsive qrbox — 70% of the smaller viewport dimension
    const qrboxSize = Math.min(
      Math.floor(window.innerWidth * 0.7),
      Math.floor(window.innerHeight * 0.4),
      300
    );

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: window.innerHeight / window.innerWidth,
        },
        async (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          try { scanner.pause(true); } catch { /* already paused */ }

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

          // Show result overlay
          setResult(scanResult);

          // Auto-resume after 3 seconds
          setTimeout(() => {
            setResult(null);
            isProcessingRef.current = false;
            try { scanner.resume(); } catch { /* scanner might be stopped */ }
          }, RESULT_DURATION_MS);
        },
        () => {} // no QR in frame — normal
      )
      .catch((err: unknown) => {
        console.error('Camera start failed:', err);
      });

    // Wake Lock — keep screen on while scanning
    navigator.wakeLock?.request('screen').then((sentinel) => {
      wakeLockRef.current = sentinel;
    }).catch(() => {});

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Dismiss result early on tap
  const dismissResult = () => {
    setResult(null);
    isProcessingRef.current = false;
    try { scannerRef.current?.resume(); } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Camera feed */}
      <div id="qr-reader" className="w-full h-full" />

      {/* Back button */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-base font-medium"
        >
          <span className="text-xl leading-none">&larr;</span>
          Назад
        </button>
      </div>

      {/* Result overlay — camera stays mounted underneath */}
      {result && <ResultOverlay result={result} onDismiss={dismissResult} />}
    </div>
  );
}

// ─── Result Overlay ─────────────────────────────────────

function ResultOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const bgColor =
    result.type === 'valid'
      ? 'bg-green-500'
      : result.type === 'duplicate'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div
      className={`fixed inset-0 ${bgColor} flex flex-col items-center justify-center p-8 z-20 cursor-pointer select-none`}
      onClick={onDismiss}
    >
      {result.type === 'valid' && result.ticket && (
        <ValidContent ticket={result.ticket} />
      )}
      {result.type === 'duplicate' && result.ticket && (
        <DuplicateContent ticket={result.ticket} />
      )}
      {result.type === 'invalid' && <InvalidContent />}

      <p className="absolute bottom-8 text-white/60 text-sm">
        Нажмите для продолжения
      </p>
    </div>
  );
}

function ValidContent({ ticket }: { ticket: Ticket }) {
  return (
    <>
      <div className="text-8xl mb-4">&#10003;</div>
      <h1 className="text-4xl font-bold mb-6">Проходи!</h1>
      <p className="text-2xl font-semibold text-center mb-2">
        {ticket.customerName}
      </p>
      <p className="text-xl text-white/80 text-center">
        {ticket.ticketName}
        {ticket.optionName ? ` — ${ticket.optionName}` : ''}
      </p>
      {ticket.isInvitation && (
        <span className="mt-4 inline-block bg-white/20 backdrop-blur-sm text-white text-lg font-bold px-6 py-2 rounded-full">
          ПРИГЛАШЕНИЕ
        </span>
      )}
    </>
  );
}

function DuplicateContent({ ticket }: { ticket: Ticket }) {
  const time = ticket.checkedInAt
    ? new Date(ticket.checkedInAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Chisinau',
      })
    : '—';

  return (
    <>
      <div className="text-8xl mb-4">&#9888;</div>
      <h1 className="text-4xl font-bold mb-6">Уже прошёл!</h1>
      <p className="text-2xl font-semibold text-center mb-2">
        {ticket.customerName}
      </p>
      <p className="text-xl text-white/80 text-center mb-1">Когда: {time}</p>
      {ticket.checkedInBy && (
        <p className="text-xl text-white/80 text-center">
          Кто: {ticket.checkedInBy}
        </p>
      )}
    </>
  );
}

function InvalidContent() {
  return (
    <>
      <div className="text-8xl mb-4">&#10007;</div>
      <h1 className="text-4xl font-bold">Недействителен!</h1>
    </>
  );
}

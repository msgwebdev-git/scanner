import { useState, useEffect, useCallback } from 'react';
import PinScreen from './screens/PinScreen';
import DashboardScreen from './screens/DashboardScreen';
import CameraScreen from './screens/CameraScreen';
import { getDeviceId } from './lib/device-id';

type Screen = 'pin' | 'dashboard' | 'camera';

export type ScanResultType = 'valid' | 'duplicate' | 'invalid';

export interface ScanResult {
  type: ScanResultType;
  ticket?: import('./lib/scanner-db').Ticket;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem('scanner_token') ? 'dashboard' : 'pin'
  );

  const deviceId = getDeviceId();

  useEffect(() => {
    const handler = () => setScreen('pin');
    window.addEventListener('scanner-auth-expired', handler);
    return () => window.removeEventListener('scanner-auth-expired', handler);
  }, []);

  const handleAuth = useCallback(() => {
    setScreen('dashboard');
  }, []);

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col">
      {screen === 'pin' && <PinScreen onAuth={handleAuth} />}
      {screen === 'dashboard' && (
        <DashboardScreen
          deviceId={deviceId}
          onScan={() => setScreen('camera')}
          onLogout={() => {
            localStorage.removeItem('scanner_token');
            setScreen('pin');
          }}
        />
      )}
      {screen === 'camera' && (
        <CameraScreen
          deviceId={deviceId}
          onBack={() => setScreen('dashboard')}
        />
      )}
    </div>
  );
}

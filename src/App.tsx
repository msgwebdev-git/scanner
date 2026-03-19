import { useState, useEffect, useCallback } from 'react';
import PinScreen from './screens/PinScreen';
import DashboardScreen from './screens/DashboardScreen';
import CameraScreen from './screens/CameraScreen';

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
  const [deviceName, setDeviceName] = useState(() =>
    localStorage.getItem('scanner_device') || ''
  );

  useEffect(() => {
    const handler = () => {
      setScreen('pin');
      setDeviceName('');
    };
    window.addEventListener('scanner-auth-expired', handler);
    return () => window.removeEventListener('scanner-auth-expired', handler);
  }, []);

  const handleAuth = useCallback((name: string) => {
    setDeviceName(name);
    localStorage.setItem('scanner_device', name);
    setScreen('dashboard');
  }, []);

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col">
      {screen === 'pin' && <PinScreen onAuth={handleAuth} />}
      {screen === 'dashboard' && (
        <DashboardScreen
          deviceName={deviceName}
          onScan={() => setScreen('camera')}
          onLogout={() => {
            localStorage.removeItem('scanner_token');
            localStorage.removeItem('scanner_device');
            setScreen('pin');
          }}
        />
      )}
      {screen === 'camera' && (
        <CameraScreen
          deviceName={deviceName}
          onBack={() => setScreen('dashboard')}
        />
      )}
    </div>
  );
}

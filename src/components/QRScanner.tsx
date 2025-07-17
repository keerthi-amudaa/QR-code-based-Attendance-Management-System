import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';

interface QRScannerProps {
  onResult: (result: string) => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onResult, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5Qrcode("qr-reader");

    const startScanning = async () => {
      try {
        await scannerRef.current?.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onResult(decodedText);
          },
          (errorMessage) => {
            if (onError) {
              onError(errorMessage);
            }
          }
        );
      } catch (err) {
        toast.error('Failed to start camera. Please check permissions.');
      }
    };

    startScanning();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current?.stop().catch(console.error);
      }
    };
  }, [onResult, onError]);

  return (
    <div>
      <div id="qr-reader" className="w-full max-w-sm mx-auto"></div>
    </div>
  );
}
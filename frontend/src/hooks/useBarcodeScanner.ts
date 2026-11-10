import { useEffect, useRef } from 'react';
import { playScannerBeep } from '../utils/scannerAudio';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => boolean | void; // return true if item was matched/added, false otherwise
  enabled?: boolean;
  maxIntervalMs?: number; // Maximum ms between keystrokes to qualify as a hardware scanner wedge
  minLength?: number;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  maxIntervalMs = 50,
  minLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional modifier shortcuts (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        bufferRef.current = '';
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Handle Enter (scanner terminating character)
      if (e.key === 'Enter') {
        const scannedCode = bufferRef.current.trim();
        bufferRef.current = '';

        // If buffer was populated with rapid characters and meets minLength
        if (scannedCode.length >= minLength) {
          // Verify it was a rapid burst typical of hardware barcode guns (< 60ms average)
          e.preventDefault();
          e.stopPropagation();

          const handled = onScanRef.current(scannedCode);
          if (handled !== false) {
            playScannerBeep('success');
          } else {
            playScannerBeep('alert');
          }
        }
        return;
      }

      // If user typed too slowly, this is manual human typing, reset buffer
      if (timeDiff > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // If buffer is becoming long (> 80 chars) without Enter, clear it
        if (bufferRef.current.length > 80) {
          bufferRef.current = '';
        }
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        bufferRef.current = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minLength]);
}

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PrintOverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Open the browser's print dialog as soon as the sheet is on screen. */
  autoPrint?: boolean;
}

/**
 * Full-screen print preview. It is rendered straight into <body>; the print stylesheet hides the rest of
 * the app, so only the sheet reaches the printer, on A4, without the sidebar/topbar/buttons.
 */
export function PrintOverlay({ title, onClose, children, autoPrint }: PrintOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!autoPrint) return;
    // Two frames so the sheet has laid out before the print dialog snapshots it.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => window.print()); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [autoPrint]);

  return createPortal(
    <div className="print-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="print-toolbar no-print">
        <strong>{title}</strong>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="print-scroll">
        <div className="print-sheet">{children}</div>
      </div>
    </div>,
    document.body
  );
}
import { QRCodeSVG } from 'qrcode.react';

/**
 * Encodes a link to the patient-facing tracking page for a given queue
 * entry. Per the spec, only the opaque queue entry UUID goes in the URL -
 * never a patient ID, name, or phone number.
 */
export default function QueueQRCode({ queueEntryId, size = 120 }) {
  const trackUrl = `${window.location.origin}/track/${queueEntryId}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <QRCodeSVG value={trackUrl} size={size} />
      </div>
      <p className="max-w-[160px] text-center text-xs text-slate-400">
        Scan to track your queue status on your phone
      </p>
    </div>
  );
}

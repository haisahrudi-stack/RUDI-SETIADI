import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeBoxProps {
  value: string;
  size?: number;
  label?: string;
}

export function QrCodeBox({ value, size = 140, label }: QrCodeBoxProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center gap-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Kode QR ${value}`}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="block"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="bg-slate-100 flex items-center justify-center text-xs font-mono text-slate-500"
        >
          {value}
        </div>
      )}
      {label && <span className="font-mono text-[11px] font-medium text-slate-700 tabular-nums">{label}</span>}
    </div>
  );
}

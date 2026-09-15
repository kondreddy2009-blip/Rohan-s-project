import { QRCodeSVG } from "qrcode.react";

export function QRDisplay({ value, size = 240, label }) {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="p-6 rounded-2xl bg-[#F2EDE7]" data-testid="qr-display">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor="#F2EDE7"
          fgColor="#0B0A0A"
          level="M"
          includeMargin={false}
        />
      </div>
      {label && <div className="overline mt-4 text-center">{label}</div>}
    </div>
  );
}

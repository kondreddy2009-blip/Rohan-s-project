import { QRCodeSVG } from "qrcode.react";

export function QRDisplay({ value, size = 240, label }) {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="p-6 bg-[#E8ECF5]" data-testid="qr-display">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor="#E8ECF5"
          fgColor="#0A1424"
          level="M"
          includeMargin={false}
        />
      </div>
      {label && <div className="overline mt-4 text-center">{label}</div>}
    </div>
  );
}

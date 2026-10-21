import { QRCodeSVG } from "qrcode.react";

export function QRDisplay({ value, size = 240, label }) {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="p-6 bg-[#F4F1EC]" data-testid="qr-display">
        <QRCodeSVG
          value={value}
          size={size}
          bgColor="#F4F1EC"
          fgColor="#110C09"
          level="M"
          includeMargin={false}
        />
      </div>
      {label && <div className="overline mt-4 text-center">{label}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Live camera QR scanner.
 *
 * Gracefully handles environments without camera access (preview iframes,
 * headless browsers, denied permissions) by surfacing an "unavailable" state
 * instead of throwing. Calls onScan(text) once when decoded, then stops.
 */
export function QRScanner({ onScan, onError }) {
  const wrapperRef = useRef(null);
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);
  const [status, setStatus] = useState("starting");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const hasMediaDevices =
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";

    if (!hasMediaDevices) {
      setStatus("error");
      setErrorMsg("Camera not available in this environment");
      onError?.("no-media-devices");
      return () => {};
    }

    if (!wrapperRef.current) return () => {};
    const elementId = "qr-scanner-" + Math.random().toString(36).slice(2);
    wrapperRef.current.id = elementId;

    let scanner;
    try {
      scanner = new Html5Qrcode(elementId, { verbose: false });
    } catch (e) {
      setStatus("error");
      setErrorMsg(e?.message || "Scanner failed to initialise");
      return () => {};
    }
    scannerRef.current = scanner;

    async function start() {
      try {
        const cams = await Html5Qrcode.getCameras();
        if (!cams || cams.length === 0) {
          throw new Error("No camera detected on this device.");
        }
        const preferred =
          cams.find((c) => /back|rear|environment/i.test(c.label || "")) || cams[cams.length - 1];

        await scanner
          .start(
            preferred.id,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decoded) => {
              if (stoppedRef.current) return;
              stoppedRef.current = true;
              scanner.stop().catch(() => {});
              onScan?.(decoded);
            },
            () => {
              /* per-frame decode misses ignored */
            },
          )
          .catch((err) => {
            throw err;
          });
        if (!stoppedRef.current) setStatus("running");
      } catch (e) {
        const msg = e?.message || String(e);
        if (!stoppedRef.current) {
          setStatus("error");
          setErrorMsg(msg);
          onError?.(msg);
        }
      }
    }

    start();

    return () => {
      stoppedRef.current = true;
      try {
        // stop() returns a promise; swallow any rejection (unmount race)
        const p = scanner.stop();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        /* ignore */
      }
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
    };
  }, [onScan, onError]);

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div
        ref={wrapperRef}
        className="w-full aspect-square bg-black overflow-hidden border border-[#4E1E32]"
        data-testid="qr-scanner-viewport"
      />
      <div className="pointer-events-none absolute inset-6">
        <div className="absolute top-0 left-0 h-6 w-6 border-t border-l border-[#C2A36B]" />
        <div className="absolute top-0 right-0 h-6 w-6 border-t border-r border-[#C2A36B]" />
        <div className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-[#C2A36B]" />
        <div className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-[#C2A36B]" />
      </div>
      <div className="mt-3 overline text-center">
        {status === "starting" && "Preparing camera…"}
        {status === "running" && "Center the room's QR"}
        {status === "error" && (
          <span className="text-[#B39586]">Camera unavailable · use the fallback below</span>
        )}
      </div>
    </div>
  );
}

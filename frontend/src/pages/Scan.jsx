import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Camera, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { QRScanner, decodeQrFromFile } from "@/components/QRScanner";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useAuth } from "@/lib/auth-context";

function parseVenueId(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("checkin");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    if (parts.length > 0) return parts[parts.length - 1];
  } catch {
    /* not a URL */
  }
  if (trimmed.startsWith("ritual:")) return trimmed.slice(7);
  return trimmed;
}

export default function Scan() {
  const { refresh } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scannerOn, setScannerOn] = useState(false);
  const [step, setStep] = useState("scan");
  const [result, setResult] = useState(null);
  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/venues").then((r) => setVenues(r.data));
    const hasMedia =
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    setCameraSupported(!!hasMedia);
  }, []);

  // Suppress benign html5-qrcode play() interruption errors that surface as
  // unhandled rejections in React's dev overlay when the video element is
  // mounted/unmounted quickly (StrictMode double-mount, iframe previews).
  useEffect(() => {
    const isBenign = (msg) =>
      typeof msg === "string" &&
      (msg.includes("play() request was interrupted") ||
        msg.includes("NotAllowedError") ||
        msg.includes("NotFoundError") ||
        msg.includes("Permission denied"));
    const onRejection = (ev) => {
      const msg = ev.reason?.message || String(ev.reason || "");
      if (isBenign(msg)) ev.preventDefault();
    };
    const onError = (ev) => {
      const msg = ev.error?.message || ev.message || "";
      if (isBenign(msg)) ev.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  const venueMap = useMemo(() => {
    const map = {};
    for (const v of venues) {
      map[v.id] = v;
      if (v.qr_slug) map[v.qr_slug] = v;
    }
    return map;
  }, [venues]);

  const doCheckin = useCallback(
    async (venueId) => {
      const venue = venueMap[venueId];
      if (!venue) {
        toast.error("That room is not in the network.");
        return;
      }
      setBusy(true);
      try {
        const { data } = await api.post(`/venues/${venue.id}/checkin`, {});
        setResult({ ...data, venue });
        await refresh();
        setStep("success");
      } catch (e) {
        toast.error(e.response?.data?.detail || "Could not check in just now.");
      } finally {
        setBusy(false);
      }
    },
    [venueMap, refresh],
  );

  const handleScan = useCallback(
    (text) => {
      const id = parseVenueId(text);
      if (id) doCheckin(id);
    },
    [doCheckin],
  );

  const handleScanError = useCallback(() => {
    /* handled by QRScanner UI + manual fallback */
  }, []);

  const submitManual = (e) => {
    e.preventDefault();
    if (manualId) doCheckin(manualId);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const text = await decodeQrFromFile(file);
      handleScan(text);
    } catch {
      toast.error("Couldn't find a QR code in that photo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8 py-10 sm:py-14" data-testid="scan-page">
      <div className="overline">Live check-in</div>
      <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-tight">
        Scan the room&apos;s QR.
      </h1>
      <p className="text-[#8F8781] font-light mt-2 max-w-md">
        Point your camera at the QR at the host stand. Your Table begins the moment it&apos;s read.
      </p>

      {step === "scan" && (
        <div className="mt-10 animate-fade-up">
          {scannerOn ? (
            <QRScanner onScan={handleScan} onError={handleScanError} />
          ) : (
            <div className="max-w-sm mx-auto">
              <div className="w-full aspect-square border border-[#262321] flex flex-col items-center justify-center relative">
                <Camera strokeWidth={0.8} className="h-16 w-16 text-[#CE6A4A]" />
                <div className="overline mt-4 text-center px-6">
                  {cameraSupported ? "Camera ready" : "Camera not available in this environment"}
                </div>
                <div className="absolute inset-6 pointer-events-none">
                  <div className="absolute top-0 left-0 h-6 w-6 border-t border-l border-[#CE6A4A]" />
                  <div className="absolute top-0 right-0 h-6 w-6 border-t border-r border-[#CE6A4A]" />
                  <div className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-[#CE6A4A]" />
                  <div className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-[#CE6A4A]" />
                </div>
              </div>
              {cameraSupported && (
                <button
                  onClick={() => setScannerOn(true)}
                  data-testid="start-camera-button"
                  className="btn-primary w-full mt-4"
                >
                  Open camera
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                data-testid="scan-upload-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="scan-upload-button"
                className="btn-ghost w-full mt-3 inline-flex items-center justify-center gap-2"
              >
                <Upload strokeWidth={1.2} className="h-4 w-4" />
                {uploading ? "Reading photo…" : "Upload a photo of the QR"}
              </button>
            </div>
          )}

          <div className="mt-10 hairline-t pt-8">
            <div className="overline mb-3">Or check in manually</div>
            <p className="text-sm text-[#8F8781] font-light mb-4">
              A quiet fallback — pick the room you&apos;re in.
            </p>
            <form onSubmit={submitManual} className="flex flex-col sm:flex-row gap-3">
              <select
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                data-testid="scan-manual-select"
                className="flex-1 bg-[#1B1917] border border-[#262321] py-3 px-3 focus:border-[#CE6A4A] outline-none font-light text-[#F2EDE7]"
              >
                <option value="">Select a room…</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.neighborhood}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!manualId || busy}
                data-testid="scan-manual-submit"
                className="btn-primary"
              >
                Check in
              </button>
            </form>
          </div>
        </div>
      )}

      {step === "success" && result && (
        <div className="mt-16 text-center animate-fade" data-testid="scan-success">
          <div className="mx-auto w-16 h-16 border border-[#CE6A4A] flex items-center justify-center">
            <Check strokeWidth={1} className="h-8 w-8 text-[#CE6A4A]" />
          </div>
          <div className="overline-accent mt-6">Welcomed</div>
          <h2 className="font-serif-display text-4xl mt-3">
            Your Table continues at {result.venue.name}.
          </h2>
          <div className="mt-10">
            <div className="overline mb-2">Table Points earned</div>
            <AnimatedNumber
              value={result.points_earned}
              prefix="+"
              className="font-serif-display text-7xl text-[#CE6A4A] tabular-nums block"
            />
            <div className="overline mt-4">
              Balance · <span className="text-[#F2EDE7]"><AnimatedNumber value={result.balance} /></span>
            </div>
          </div>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/wallet" className="btn-primary" data-testid="scan-view-wallet">
              View Wallet
            </Link>
            <Link to="/discover" className="btn-ghost" data-testid="scan-back-discover">
              Return to rooms
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const zbarRef = useRef<any>(null);
  const scanLineRef = useRef(0);
  const scanDirRef = useRef(1);
  const lastDetectRef = useRef(0);

  const [estado, setEstado] = useState<"cargando" | "escaneando" | "detectado" | "error">("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [zoom, setZoom] = useState(1);
  const [codigoManual, setCodigoManual] = useState("");
  const [mostrarManual, setMostrarManual] = useState(false);
  const [fps, setFps] = useState(0);
  const fpsCountRef = useRef({ count: 0, last: Date.now() });

  // Iniciar cámara + cargar zbar-wasm
  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        // 1. Cargar zbar wasm
        const zbarMod = await import("@undecaf/zbar-wasm" as any);
        zbarRef.current = zbarMod;

        // 2. Abrir cámara con mayor resolución posible
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
        });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (activo) setEstado("escaneando");

        // 3. Loop de escaneo
        const scan = async () => {
          if (!activo) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          const overlay = overlayRef.current;
          if (!v || !canvas || !overlay || v.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan);
            return;
          }

          const W = v.videoWidth;
          const H = v.videoHeight;
          canvas.width = W;
          canvas.height = H;
          overlay.width = overlay.offsetWidth;
          overlay.height = overlay.offsetHeight;

          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0, W, H);

          // Animación línea roja sobre overlay
          const oc = overlay.getContext("2d")!;
          const OW = overlay.width;
          const OH = overlay.height;
          oc.clearRect(0, 0, OW, OH);

          // Zona de escaneo (centro 70% ancho, 50% alto)
          const zx = OW * 0.15, zy = OH * 0.25;
          const zw = OW * 0.70, zh = OH * 0.50;

          // Marco de la zona
          oc.strokeStyle = "rgba(255,255,255,0.9)";
          oc.lineWidth = 2;
          const cs = 18; // corner size
          // Esquinas
          [[zx,zy],[zx+zw,zy],[zx,zy+zh],[zx+zw,zy+zh]].forEach(([cx,cy], i) => {
            oc.beginPath();
            oc.moveTo(cx + (i%2===0?0:-(cs)), cy);
            oc.lineTo(cx + (i%2===0?cs:0), cy);
            oc.moveTo(cx, cy + (i<2?0:-cs));
            oc.lineTo(cx, cy + (i<2?cs:0));
            oc.stroke();
          });

          // Línea roja animada
          scanLineRef.current += 1.5 * scanDirRef.current;
          if (scanLineRef.current > zh - 4) scanDirRef.current = -1;
          if (scanLineRef.current < 4) scanDirRef.current = 1;
          const lineY = zy + scanLineRef.current;
          const grad = oc.createLinearGradient(zx, lineY, zx + zw, lineY);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(0.2, "rgba(239,68,68,0.8)");
          grad.addColorStop(0.5, "rgba(239,68,68,1)");
          grad.addColorStop(0.8, "rgba(239,68,68,0.8)");
          grad.addColorStop(1, "transparent");
          oc.strokeStyle = grad;
          oc.lineWidth = 2.5;
          oc.shadowColor = "rgba(239,68,68,0.6)";
          oc.shadowBlur = 6;
          oc.beginPath();
          oc.moveTo(zx, lineY);
          oc.lineTo(zx + zw, lineY);
          oc.stroke();
          oc.shadowBlur = 0;

          // FPS counter
          fpsCountRef.current.count++;
          const now = Date.now();
          if (now - fpsCountRef.current.last > 1000) {
            setFps(fpsCountRef.current.count);
            fpsCountRef.current = { count: 0, last: now };
          }

          // Escanear cada 120ms para no saturar
          if (now - lastDetectRef.current > 120) {
            lastDetectRef.current = now;
            try {
              const imgData = ctx.getImageData(0, 0, W, H);
              const symbols = await zbarRef.current.scanImageData(imgData);
              if (symbols.length > 0 && activo) {
                const codigo = symbols[0].decode();
                if (codigo && codigo.length > 0) {
                  setEstado("detectado");
                  setTimeout(() => {
                    onDetected(codigo);
                  }, 300);
                  return; // Detener loop
                }
              }
            } catch {}
          }

          rafRef.current = requestAnimationFrame(scan);
        };

        rafRef.current = requestAnimationFrame(scan);

      } catch (e: any) {
        if (!activo) return;
        const msg = e?.toString() ?? "";
        setErrorMsg(
          msg.includes("NotAllowed") || msg.includes("permission") || msg.includes("denied")
            ? "Permiso de cámara denegado. Ve a Configuración → Privacidad → Cámara y permítelo."
            : "No se pudo abrir la cámara."
        );
        setEstado("error");
      }
    };

    iniciar();
    return () => {
      activo = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Zoom via track constraints
  const handleZoom = useCallback(async (val: number) => {
    setZoom(val);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ zoom: val }] });
    } catch {}
  }, []);

  const handleManual = () => {
    if (codigoManual.trim()) onDetected(codigoManual.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              Escanear código
              {estado === "escaneando" && (
                <span className="text-xs font-normal text-gray-400 font-mono">{fps} fps</span>
              )}
            </h3>
            <p className="text-xs text-gray-400">EAN · UPC · QR · Code128 · Code39 y más</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>

        {/* Visor cámara */}
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline muted autoPlay
          />
          {/* Canvas oculto para procesar frames */}
          <canvas ref={canvasRef} className="hidden" />
          {/* Overlay encima del video */}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Estado cargando */}
          {estado === "cargando" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="text-white text-center">
                <div className="text-4xl mb-2 animate-pulse">📷</div>
                <p className="text-sm">Iniciando cámara...</p>
                <p className="text-xs text-gray-400 mt-1">Cargando motor de escaneo</p>
              </div>
            </div>
          )}

          {/* Estado detectado */}
          {estado === "detectado" && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-40">
              <div className="bg-white rounded-2xl px-6 py-4 text-center shadow-xl">
                <div className="text-3xl mb-1">✅</div>
                <p className="font-medium text-gray-900">¡Código detectado!</p>
              </div>
            </div>
          )}

          {/* Error */}
          {estado === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 p-6">
              <div className="text-center">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="text-white text-sm leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Zoom slider */}
        {estado === "escaneando" && (
          <div className="px-4 pt-3 pb-1 flex items-center gap-3">
            <span className="text-xs text-gray-400 w-4">🔍</span>
            <input
              type="range" min="1" max="4" step="0.1"
              value={zoom}
              onChange={(e) => handleZoom(Number(e.target.value))}
              className="flex-1 accent-gray-900"
            />
            <span className="text-xs text-gray-500 font-mono w-8">{zoom.toFixed(1)}x</span>
          </div>
        )}

        {/* Campo manual */}
        <div className="px-4 pb-4 pt-2 space-y-2">
          {!mostrarManual ? (
            <button
              onClick={() => setMostrarManual(true)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 underline underline-offset-2"
            >
              ¿No escanea? Escribir código manualmente
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 7501055300439"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManual()}
                autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900 font-mono"
              />
              <button
                onClick={handleManual}
                disabled={!codigoManual.trim()}
                className="bg-gray-900 text-white rounded-xl px-4 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

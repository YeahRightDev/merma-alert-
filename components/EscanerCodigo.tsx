"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"cargando" | "escaneando" | "error" | "manual">("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [codigoManual, setCodigoManual] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectandoRef = useRef(false);

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Intentar BarcodeDetector nativo
        if ("BarcodeDetector" in window) {
          setEstado("escaneando");
          const detector = new (window as any).BarcodeDetector({
            formats: ["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"],
          });

          const loop = async () => {
            if (!activo) return;
            const v = videoRef.current;
            if (v && v.readyState >= 2 && !detectandoRef.current) {
              detectandoRef.current = true;
              try {
                const codes = await detector.detect(v);
                if (codes.length > 0 && activo) {
                  onDetected(codes[0].rawValue);
                  return;
                }
              } catch {}
              detectandoRef.current = false;
            }
            rafRef.current = requestAnimationFrame(loop);
          };
          rafRef.current = requestAnimationFrame(loop);
        } else {
          // Sin BarcodeDetector — mostrar cámara + campo manual
          setEstado("manual");
        }
      } catch (e: any) {
        if (!activo) return;
        setErrorMsg(
          e?.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Ve a Configuración de tu navegador y permite el acceso."
            : "No se pudo abrir la cámara. Intenta recargar la página."
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

  const handleManual = () => {
    if (codigoManual.trim()) onDetected(codigoManual.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Código de barras / SKU</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {estado === "escaneando" ? "Apunta la cámara al código" : "Escribe o escanea el código"}
            </p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        {/* Video */}
        {(estado === "cargando" || estado === "escaneando" || estado === "manual") && (
          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

            {estado === "cargando" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                <div className="text-white text-center">
                  <div className="text-3xl mb-2 animate-pulse">📷</div>
                  <p className="text-sm">Abriendo cámara...</p>
                </div>
              </div>
            )}

            {estado === "escaneando" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-36">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white" />
                  <div className="absolute left-2 right-2 h-0.5 bg-red-500"
                    style={{ top: "50%", animation: "scan 1.8s ease-in-out infinite" }} />
                </div>
                <style>{`@keyframes scan {
                  0%,100%{transform:translateY(-18px);opacity:.5}
                  50%{transform:translateY(18px);opacity:1}
                }`}</style>
              </div>
            )}

            {estado === "manual" && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-3">
                <p className="text-white text-xs text-center opacity-80">
                  Tu navegador no soporta escaneo automático — escribe el código abajo
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {estado === "error" && (
          <div className="p-5 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{errorMsg}</p>
          </div>
        )}

        {/* Campo manual — siempre visible excepto en escaneando puro */}
        {(estado === "manual" || estado === "error") && (
          <div className="p-4 space-y-3">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 7501055300439"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManual()}
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 font-mono pr-10"
              />
              {codigoManual && (
                <button onClick={() => setCodigoManual("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">✕</button>
              )}
            </div>
            <button
              onClick={handleManual}
              disabled={!codigoManual.trim()}
              className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-opacity"
            >
              Usar este código →
            </button>
          </div>
        )}

        {/* Footer escaneando — opción manual */}
        {estado === "escaneando" && (
          <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">EAN · UPC · QR · Code128</p>
            <button onClick={() => setEstado("manual")} className="text-xs text-gray-500 underline underline-offset-2">
              Escribir código
            </button>
          </div>
        )}

        {estado === "cargando" && (
          <div className="px-4 py-3">
            <button onClick={onCerrar} className="w-full text-sm text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"cargando" | "escaneando" | "error">("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        // Solicitar cámara — preferir trasera en móvil
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Cargar ZXing desde CDN (sin instalar nada)
        await new Promise<void>((resolve, reject) => {
          if ((window as any).ZXing) { resolve(); return; }
          const script = document.createElement("script");
          script.src = "https://unpkg.com/@zxing/library@0.19.2/umd/index.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("No se pudo cargar el escáner"));
          document.head.appendChild(script);
        });

        if (!activo) return;
        setEstado("escaneando");

        const ZXing = (window as any).ZXing;
        const hints = new Map();
        const formats = [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX,
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const escanear = () => {
          if (!activo || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            try {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const luminance = new ZXing.RGBLuminanceSource(imgData.data, canvas.width, canvas.height);
              const binary = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
              const result = reader.decode(binary);
              if (result && activo) {
                onDetected(result.getText());
                return;
              }
            } catch {
              // Sin código en este frame — normal, seguir escaneando
            }
          }
          rafRef.current = requestAnimationFrame(escanear);
        };
        rafRef.current = requestAnimationFrame(escanear);

      } catch (e: any) {
        if (!activo) return;
        if (e?.name === "NotAllowedError") {
          setErrorMsg("Permiso de cámara denegado. Actívalo en la configuración de tu navegador.");
        } else if (e?.message?.includes("cargar")) {
          setErrorMsg("Sin conexión para cargar el escáner. Intenta de nuevo.");
        } else {
          setErrorMsg("No se pudo acceder a la cámara.");
        }
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

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Escanear código de barras</h3>
            <p className="text-xs text-gray-400 mt-0.5">Apunta la cámara al código del producto</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >✕</button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

          {/* Marco de enfoque */}
          {estado === "escaneando" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-36">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                <div className="absolute left-2 right-2 h-0.5 bg-red-400 opacity-80 animate-bounce" style={{ top: "50%" }} />
              </div>
            </div>
          )}

          {estado === "cargando" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
              <div className="text-white text-center">
                <div className="text-3xl mb-2 animate-pulse">📷</div>
                <p className="text-sm">Iniciando cámara...</p>
              </div>
            </div>
          )}

          {estado === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 p-4">
              <div className="text-center">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="text-white text-sm leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          {estado === "error" ? (
            <button onClick={onCerrar} className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium">
              Cerrar
            </button>
          ) : (
            <p className="text-xs text-center text-gray-400">
              Compatible con EAN-13, EAN-8, UPC, QR, Code128 y más
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

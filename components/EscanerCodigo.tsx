"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const readerRef = useRef<any>(null);

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setError("No se encontró cámara en este dispositivo.");
          return;
        }

        // Preferir cámara trasera en móvil
        const camara =
          devices.find((d) => d.label.toLowerCase().includes("back")) ||
          devices.find((d) => d.label.toLowerCase().includes("rear")) ||
          devices[devices.length - 1];

        setEscaneando(true);

        await reader.decodeFromVideoDevice(
          camara.deviceId,
          videoRef.current!,
          (result, err) => {
            if (!activo) return;
            if (result) {
              const codigo = result.getText();
              onDetected(codigo);
            }
            // Ignoramos errores de "no encontrado en frame" — son normales
          }
        );
      } catch (e: any) {
        if (activo) {
          if (e?.name === "NotAllowedError") {
            setError("Permiso de cámara denegado. Actívalo en la configuración de tu navegador.");
          } else {
            setError("No se pudo acceder a la cámara. Intenta desde Chrome o Safari.");
          }
        }
      }
    };

    iniciar();

    return () => {
      activo = false;
      readerRef.current?.reset();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">Escanear código de barras</h3>
            <p className="text-xs text-gray-400 mt-0.5">Apunta la cámara al código del producto</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Marco de enfoque */}
          {escaneando && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-32">
                {/* Esquinas del marco */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-sm" />
                {/* Línea de escaneo animada */}
                <div className="absolute left-1 right-1 h-0.5 bg-red-400 opacity-80 animate-bounce" style={{ top: "50%" }} />
              </div>
            </div>
          )}

          {/* Spinner mientras carga */}
          {!escaneando && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-center">
                <div className="text-3xl mb-2 animate-pulse">📷</div>
                <p className="text-sm">Iniciando cámara...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 p-4">
              <div className="text-center">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="text-white text-sm leading-relaxed">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3">
          {error ? (
            <button
              onClick={onCerrar}
              className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium"
            >
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

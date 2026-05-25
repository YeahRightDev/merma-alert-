"use client";
import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(true);
  const [detectado, setDetectado] = useState("");

  useEffect(() => {
    let codeReader: import("@zxing/library").BrowserMultiFormatReader | null = null;

    const iniciar = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        codeReader = new BrowserMultiFormatReader();

        const devices = await codeReader.listVideoInputDevices();
        // Preferir cámara trasera en móvil
        const camara = devices.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("trasera") ||
          d.label.toLowerCase().includes("environment")
        ) || devices[devices.length - 1];

        if (!camara) {
          setError("No se encontró cámara disponible.");
          return;
        }

        if (videoRef.current) {
          await codeReader.decodeFromVideoDevice(
            camara.deviceId,
            videoRef.current,
            (result, err) => {
              if (result && escaneando) {
                const codigo = result.getText();
                setDetectado(codigo);
                setEscaneando(false);
                // Vibrar si el dispositivo lo soporta
                if (navigator.vibrate) navigator.vibrate(100);
                setTimeout(() => {
                  onDetected(codigo);
                }, 800);
              }
              // Ignorar errores de frame sin código
              void err;
            }
          );

          // Guardar stream para apagarlo al cerrar
          if (videoRef.current.srcObject) {
            streamRef.current = videoRef.current.srcObject as MediaStream;
          }
        }
      } catch (e) {
        setError("No se pudo acceder a la cámara. Verifica los permisos.");
        console.error(e);
      }
    };

    iniciar();

    return () => {
      codeReader?.reset();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const cerrar = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-black">
        <div>
          <p className="text-white font-medium text-sm">Escanear código de barras</p>
          <p className="text-gray-400 text-xs mt-0.5">Apunta la cámara al código del producto</p>
        </div>
        <button
          onClick={cerrar}
          className="text-gray-400 hover:text-white text-sm border border-gray-700 px-3 py-1.5 rounded-lg"
        >
          ✕ Cerrar
        </button>
      </div>

      {/* Cámara */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />

        {/* Overlay con guía de escaneo */}
        {!detectado && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Esquinas del recuadro guía */}
            <div className="relative w-64 h-40">
              {/* Esquina sup izq */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              {/* Esquina sup der */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              {/* Esquina inf izq */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              {/* Esquina inf der */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              {/* Línea de escaneo animada */}
              <div className="absolute left-2 right-2 h-0.5 bg-red-500 opacity-80 animate-scan" />
            </div>
          </div>
        )}

        {/* Estado: detectado */}
        {detectado && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl p-6 mx-6 text-center shadow-xl">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-gray-900 text-sm">¡Código detectado!</p>
              <p className="text-gray-500 text-xs mt-1 font-mono break-all">{detectado}</p>
            </div>
          </div>
        )}

        {/* Estado: error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="bg-white rounded-2xl p-6 mx-6 text-center">
              <div className="text-4xl mb-3">📵</div>
              <p className="font-medium text-gray-900 text-sm mb-1">Sin acceso a la cámara</p>
              <p className="text-gray-500 text-xs">{error}</p>
              <button
                onClick={cerrar}
                className="mt-4 bg-gray-900 text-white px-6 py-2 rounded-xl text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-black px-4 py-4 text-center">
        <p className="text-gray-500 text-xs">
          Compatible con códigos EAN-13, UPC-A, QR y más
        </p>
      </div>

      <style jsx>{`
        @keyframes scan {
          0%   { top: 10%; }
          50%  { top: 85%; }
          100% { top: 10%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
          position: absolute;
        }
      `}</style>
    </div>
  );
}

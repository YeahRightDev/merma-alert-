"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"cargando" | "escaneando" | "error" | "noSoportado">("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      // Verificar soporte de BarcodeDetector (Chrome 83+, Edge, Android Chrome)
      const soportado = "BarcodeDetector" in window;

      try {
        // Pedir acceso a cámara
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!soportado) {
          // Fallback: mostrar campo manual
          setEstado("noSoportado");
          return;
        }

        // BarcodeDetector nativo — funciona sin librerías
        const detector = new (window as any).BarcodeDetector({
          formats: [
            "ean_13", "ean_8", "upc_a", "upc_e",
            "code_128", "code_39", "qr_code", "data_matrix",
          ],
        });
        detectorRef.current = detector;
        setEstado("escaneando");

        const escanear = async () => {
          if (!activo || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
            try {
              const barcodes = await detector.detect(v);
              if (barcodes.length > 0 && activo) {
                const codigo = barcodes[0].rawValue;
                onDetected(codigo);
                return; // Detener loop al detectar
              }
            } catch { /* frame sin código, normal */ }
          }
          rafRef.current = requestAnimationFrame(escanear);
        };

        rafRef.current = requestAnimationFrame(escanear);

      } catch (e: any) {
        if (!activo) return;
        if (e?.name === "NotAllowedError") {
          setErrorMsg("Permiso de cámara denegado. Actívalo en la configuración de tu navegador.");
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

  // Fallback: input manual cuando BarcodeDetector no está disponible
  const [codigoManual, setCodigoManual] = useState("");
  const handleManual = () => {
    if (codigoManual.trim()) onDetected(codigoManual.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-900">
              {estado === "noSoportado" ? "Ingresar código" : "Escanear código de barras"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {estado === "noSoportado"
                ? "Tu navegador no soporta escaneo — ingresa el código manualmente"
                : "Apunta la cámara al código del producto"}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >✕</button>
        </div>

        {/* Visor cámara */}
        {estado !== "noSoportado" && (
          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {/* Marco */}
            {estado === "escaneando" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-52 h-36">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br" />
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-red-500 opacity-90"
                    style={{
                      top: "50%",
                      animation: "scan 2s ease-in-out infinite",
                    }}
                  />
                </div>
                <style>{`
                  @keyframes scan {
                    0%, 100% { transform: translateY(-20px); opacity: 0.6; }
                    50% { transform: translateY(20px); opacity: 1; }
                  }
                `}</style>
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
        )}

        {/* Fallback manual */}
        {estado === "noSoportado" && (
          <div className="p-4 space-y-3">
            <div className="bg-amber-50 text-amber-700 text-xs rounded-xl px-3 py-2">
              💡 Para escaneo automático usa Chrome en Android o Safari en iOS 17+
            </div>
            <input
              type="text"
              placeholder="Ej: 7501000000000"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManual()}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 font-mono"
            />
            <button
              onClick={handleManual}
              disabled={!codigoManual.trim()}
              className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              Usar este código
            </button>
          </div>
        )}

        {/* Footer */}
        {(estado === "escaneando" || estado === "error") && (
          <div className="px-4 py-3 border-t border-gray-50">
            {estado === "error" ? (
              <button onClick={onCerrar} className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium">
                Cerrar
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">EAN-13 · EAN-8 · UPC · QR · Code128</p>
                <button
                  onClick={() => setEstado("noSoportado")}
                  className="text-xs text-gray-400 underline underline-offset-2"
                >
                  Ingresar manual
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

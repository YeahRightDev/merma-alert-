"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected: (codigo: string) => void;
  onCerrar: () => void;
};

export default function EscanerCodigo({ onDetected, onCerrar }: Props) {
  const [codigoManual, setCodigoManual] = useState("");
  const [estado, setEstado] = useState<"iniciando" | "escaneando" | "error">("iniciando");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<any>(null);
  const divId = "html5qr-scanner-div";

  useEffect(() => {
    let montado = true;

    const iniciar = async () => {
      try {
        // Import dinámico — evita errores de TypeScript en build
        const mod = await import("html5-qrcode" as any);
        const Html5Qrcode = mod.Html5Qrcode;

        const scanner = new Html5Qrcode(divId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 140 } },
          (decodedText: string) => {
            if (montado) onDetected(decodedText);
          },
          () => {}
        );

        if (montado) setEstado("escaneando");
      } catch (e: any) {
        if (!montado) return;
        const msg = e?.toString() ?? "";
        if (msg.includes("permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
          setErrorMsg("Permiso de cámara denegado. Actívalo en la configuración de tu navegador.");
        } else {
          setErrorMsg("No se pudo abrir la cámara. Usa el campo de abajo para escribir el código.");
        }
        setEstado("error");
      }
    };

    iniciar();

    return () => {
      montado = false;
      try { scannerRef.current?.stop(); } catch {}
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
            <h3 className="font-medium text-gray-900">Escanear código</h3>
            <p className="text-xs text-gray-400 mt-0.5">Apunta la cámara al código de barras del producto</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        {/* Visor cámara */}
        <div className="bg-black relative">
          {estado === "iniciando" && (
            <div className="flex items-center justify-center bg-black" style={{ minHeight: 240 }}>
              <div className="text-white text-center">
                <div className="text-3xl mb-2 animate-pulse">📷</div>
                <p className="text-sm">Abriendo cámara...</p>
              </div>
            </div>
          )}
          {estado === "error" && (
            <div className="flex items-center justify-center p-8 bg-gray-50" style={{ minHeight: 180 }}>
              <div className="text-center">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="text-sm text-gray-600 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}
          {/* El div que usa html5-qrcode — siempre en DOM pero oculto si hay error */}
          <div
            id={divId}
            style={{ width: "100%", display: estado === "error" ? "none" : "block" }}
          />
        </div>

        {/* Campo manual siempre visible */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">o escribe el código manualmente</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 7501055300439"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManual()}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900 font-mono"
            />
            <button
              onClick={handleManual}
              disabled={!codigoManual.trim()}
              className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

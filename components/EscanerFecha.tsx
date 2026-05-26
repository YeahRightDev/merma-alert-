"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  onFechaDetectada: (fecha: string) => void;
  onCerrar: () => void;
};

function hoy() { return new Date().toISOString().split("T")[0]; }
function sumarDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}
function formatearFecha(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const meses = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${meses[parseInt(m)]} ${y}`;
}

function parsearFechaOCR(texto: string): string | null {
  const t = texto.toUpperCase().replace(/\n/g, " ");
  const MESES: Record<string,string> = {
    ENE:"01",FEB:"02",MAR:"03",ABR:"04",MAY:"05",JUN:"06",
    JUL:"07",AGO:"08",SEP:"09",OCT:"10",NOV:"11",DIC:"12",
    JAN:"01",APR:"04",AUG:"08",
  };

  const patterns = [
    // Con prefijo CAD/VENCE/EXP + DD/MM/YY(YY)
    /(?:CAD|VEN|VENCE|CADUCIDAD|EXP|EXPIRA|VAL|VALIDO|FECHA)[:\s.]*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/,
    // DD MMM YYYY — ej: 15 JUN 2026
    /(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG)\s+(\d{2,4})/,
    // MM/YYYY sin día
    /(?:CAD|VEN|EXP|VAL)[:\s.]*(\d{1,2})[\/\-](\d{4})/,
    // YYYYMMDD compacto en lotes industriales
    /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/,
    // Fecha genérica DD/MM/YY sin prefijo
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
  ];

  for (const pat of patterns) {
    const m = t.match(pat);
    if (!m) continue;
    try {
      // DD MMM YYYY
      if (MESES[m[2]]) {
        const dia = m[1].padStart(2,"0");
        const mes = MESES[m[2]];
        const anio = m[3].length===2 ? "20"+m[3] : m[3];
        return `${anio}-${mes}-${dia}`;
      }
      // MM/YYYY
      if (m[1] && m[2]?.length===4 && !m[3]) {
        const mes = m[1].padStart(2,"0");
        const anio = m[2];
        const last = new Date(parseInt(anio), parseInt(mes), 0).getDate();
        return `${anio}-${mes}-${String(last).padStart(2,"0")}`;
      }
      // YYYYMMDD
      if (m[1]?.length===4 && m[2] && m[3] && !m[1].includes("/")) {
        return `${m[1]}-${m[2]}-${m[3]}`;
      }
      // DD/MM/YY o DD/MM/YYYY
      if (m[3]) {
        const anio = m[3].length===2 ? "20"+m[3] : m[3];
        // detectar si es MM/DD o DD/MM
        const a = parseInt(m[1]), b = parseInt(m[2]);
        if (a > 12) return `${anio}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
        return `${anio}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
      }
    } catch {}
  }
  return null;
}

const RAPIDOS = [
  { label:"+3 días", dias:3, color:"bg-red-50 text-red-700 border-red-100" },
  { label:"+7 días", dias:7, color:"bg-red-50 text-red-700 border-red-100" },
  { label:"+15 días", dias:15, color:"bg-amber-50 text-amber-700 border-amber-100" },
  { label:"+1 mes", dias:30, color:"bg-amber-50 text-amber-700 border-amber-100" },
  { label:"+3 meses", dias:90, color:"bg-green-50 text-green-700 border-green-100" },
  { label:"+6 meses", dias:180, color:"bg-green-50 text-green-700 border-green-100" },
  { label:"+1 año", dias:365, color:"bg-green-50 text-green-700 border-green-100" },
  { label:"+2 años", dias:730, color:"bg-green-50 text-green-700 border-green-100" },
];

type Tab = "camara" | "rapido" | "manual";
type EstadoCam = "iniciando" | "listo" | "capturando" | "procesando" | "exito" | "error";

export default function EscanerFecha({ onFechaDetectada, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);

  const [tab, setTab] = useState<Tab>("camara");
  const [estadoCam, setEstadoCam] = useState<EstadoCam>("iniciando");
  const [progreso, setProgreso] = useState(0);
  const [fechaOCR, setFechaOCR] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fechaManual, setFechaManual] = useState(hoy());

  const dibujarOverlay = useCallback(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const oc = ov.getContext("2d")!;
    ov.width = ov.offsetWidth;
    ov.height = ov.offsetHeight;
    const W = ov.width, H = ov.height;
    oc.clearRect(0, 0, W, H);

    // Banda de escaneo: 35%-65% vertical
    const zy = H * 0.32, zh = H * 0.36;

    // Oscurecer zonas fuera de la banda
    oc.fillStyle = "rgba(0,0,0,0.45)";
    oc.fillRect(0, 0, W, zy);
    oc.fillRect(0, zy + zh, W, H);

    // Marco blanco con esquinas
    const cs = 18;
    const corners = [[0,0],[W,0],[0,zh],[W,zh]];
    oc.strokeStyle = "rgba(255,255,255,0.95)";
    oc.lineWidth = 2.5;
    corners.forEach(([cx,cy], i) => {
      const dx = i%2===0 ? cs : -cs;
      const dy = i<2 ? cs : -cs;
      oc.beginPath();
      oc.moveTo(cx, zy+cy); oc.lineTo(cx+dx, zy+cy);
      oc.moveTo(cx, zy+cy); oc.lineTo(cx, zy+cy+dy);
      oc.stroke();
    });

    // Línea roja animada
    scanYRef.current += 1.4 * scanDirRef.current;
    if (scanYRef.current > zh-3) scanDirRef.current = -1;
    if (scanYRef.current < 3) scanDirRef.current = 1;
    const ly = zy + scanYRef.current;
    const g = oc.createLinearGradient(0, ly, W, ly);
    g.addColorStop(0,"transparent"); g.addColorStop(0.1,"rgba(239,68,68,0.9)");
    g.addColorStop(0.5,"rgba(239,68,68,1)"); g.addColorStop(0.9,"rgba(239,68,68,0.9)");
    g.addColorStop(1,"transparent");
    oc.strokeStyle = g; oc.lineWidth = 2.5;
    oc.shadowColor = "rgba(239,68,68,0.6)"; oc.shadowBlur = 8;
    oc.beginPath(); oc.moveTo(0, ly); oc.lineTo(W, ly); oc.stroke();
    oc.shadowBlur = 0;

    // Texto guía
    oc.fillStyle = "rgba(255,255,255,0.92)";
    oc.font = "bold 12px system-ui, sans-serif";
    oc.textAlign = "center";
    oc.fillText("Apunta a CAD · VENCE · EXP del empaque", W/2, zy - 10);

    rafRef.current = requestAnimationFrame(dibujarOverlay);
  }, []);

  const abrirCamara = useCallback(async () => {
    setEstadoCam("iniciando");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEstadoCam("listo");
      dibujarOverlay();
    } catch {
      setEstadoCam("error");
      setErrorMsg("No se pudo abrir la cámara. Usa los botones rápidos o ingresa la fecha manual.");
    }
  }, [dibujarOverlay]);

  const cerrarCamara = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (tab === "camara") abrirCamara();
    else cerrarCamara();
    return cerrarCamara;
  }, [tab]);

  const capturar = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    cancelAnimationFrame(rafRef.current);
    setEstadoCam("capturando");

    // Capturar frame completo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    // Pre-procesar: escala de grises + contraste
    const W = canvas.width, H = canvas.height;
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const gray = 0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2];
      const v = gray > 140 ? Math.min(255, gray * 1.3) : gray * 0.6;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
    }
    ctx.putImageData(img, 0, 0);

    setEstadoCam("procesando");
    setProgreso(0);

    try {
      const { createWorker } = await import("tesseract.js" as any);
      const worker = await createWorker(["spa", "eng"], 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") setProgreso(Math.round(m.progress * 100));
        },
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789/-.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz: ",
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const fecha = parsearFechaOCR(text);
      if (fecha) {
        setFechaOCR(fecha);
        setEstadoCam("exito");
      } else {
        setErrorMsg("No se detectó una fecha. Ajusta el ángulo e intenta de nuevo.");
        setEstadoCam("error");
      }
    } catch {
      setErrorMsg("Error al procesar. Intenta de nuevo o usa los botones rápidos.");
      setEstadoCam("error");
    }
  }, []);

  const reintentar = () => {
    setErrorMsg(""); setFechaOCR(""); setEstadoCam("listo");
    dibujarOverlay();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-85 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden w-full max-w-sm max-h-screen overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-medium text-gray-900">📅 Fecha de caducidad</h3>
            <p className="text-xs text-gray-400 mt-0.5">Escanea, acceso rápido o manual</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          {([
            { id:"camara", icon:"📷", label:"Escanear" },
            { id:"rapido", icon:"⚡", label:"Rápido" },
            { id:"manual", icon:"✏️", label:"Manual" },
          ] as {id:Tab, icon:string, label:string}[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs font-medium transition-all ${
                tab===t.id
                  ? "text-gray-900 border-b-2 border-gray-900 bg-white"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Cámara OCR */}
        {tab === "camara" && (
          <div>
            <div className="relative bg-black overflow-hidden" style={{ aspectRatio:"16/9" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

              {(estadoCam==="capturando"||estadoCam==="procesando") && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                  <div className="text-white text-center px-6">
                    <div className="text-4xl mb-3 animate-pulse">{estadoCam==="capturando"?"📸":"🤖"}</div>
                    <p className="font-medium">{estadoCam==="capturando"?"Capturando...":"Leyendo fecha con IA..."}</p>
                    {estadoCam==="procesando" && progreso>0 && (
                      <div className="mt-3 w-48 mx-auto">
                        <div className="bg-gray-700 rounded-full h-1.5">
                          <div className="bg-green-400 rounded-full h-1.5 transition-all" style={{width:`${progreso}%`}}/>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{progreso}%</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {estadoCam==="exito" && (
                <div className="absolute inset-0 bg-green-500 bg-opacity-30 flex items-center justify-center">
                  <div className="bg-white rounded-2xl px-6 py-4 text-center shadow-xl mx-4">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="font-medium text-gray-900">¡Fecha detectada!</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatearFecha(fechaOCR)}</p>
                    <p className="text-xs text-gray-400 mt-1">{fechaOCR}</p>
                  </div>
                </div>
              )}

              {estadoCam==="error" && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
                  <div className="text-center">
                    <div className="text-3xl mb-3">⚠️</div>
                    <p className="text-white text-sm leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {estadoCam==="iniciando" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-white text-center">
                    <div className="text-4xl mb-2 animate-pulse">📷</div>
                    <p className="text-sm">Abriendo cámara...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-2">
              {estadoCam==="listo" && (
                <button onClick={capturar} className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 flex items-center justify-center gap-2">
                  📸 Capturar y leer fecha
                </button>
              )}
              {estadoCam==="exito" && (
                <div className="flex gap-2">
                  <button onClick={() => onFechaDetectada(fechaOCR)} className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800">
                    ✓ Usar esta fecha
                  </button>
                  <button onClick={reintentar} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    Reintentar
                  </button>
                </div>
              )}
              {estadoCam==="error" && (
                <div className="flex gap-2">
                  <button onClick={reintentar} className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium">
                    Intentar de nuevo
                  </button>
                  <button onClick={() => setTab("rapido")} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500">
                    ⚡ Rápido
                  </button>
                </div>
              )}
              <p className="text-xs text-center text-gray-400">
                Apunta la cámara donde dice "CAD", "VENCE" o "EXP"
              </p>
            </div>
          </div>
        )}

        {/* Tab: Botones rápidos */}
        {tab==="rapido" && (
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3 font-medium">Selecciona el tiempo aproximado de vencimiento:</p>
            <div className="grid grid-cols-2 gap-2">
              {RAPIDOS.map(({ label, dias, color }) => (
                <button
                  key={dias}
                  onClick={() => onFechaDetectada(sumarDias(dias))}
                  className={`${color} border rounded-xl py-3 px-4 text-left transition-all hover:opacity-80 active:scale-95`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs opacity-60 mt-0.5 font-mono">{formatearFecha(sumarDias(dias))}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-600 mb-2">Referencia rápida:</p>
              <div className="space-y-1 text-xs text-gray-500">
                <div>🥛 Lácteos / cremas → <strong>+15 días</strong></div>
                <div>🥩 Carnes / embutidos → <strong>+7 días</strong></div>
                <div>🍞 Pan / pasteles → <strong>+5 días</strong></div>
                <div>🥤 Refrescos / jugos → <strong>+6 meses</strong></div>
                <div>🥫 Enlatados → <strong>+1-2 años</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Manual */}
        {tab==="manual" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de caducidad</label>
              <input
                type="date"
                min={hoy()}
                value={fechaManual}
                onChange={e => setFechaManual(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
              {fechaManual && (
                <p className="text-xs text-gray-400 mt-2 text-center">{formatearFecha(fechaManual)}</p>
              )}
            </div>
            <button
              onClick={() => onFechaDetectada(fechaManual)}
              disabled={!fechaManual}
              className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              ✓ Usar esta fecha
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

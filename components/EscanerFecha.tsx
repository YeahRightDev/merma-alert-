"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  onFechaDetectada: (fecha: string) => void;
  onCerrar: () => void;
};

function hoy() { return new Date().toISOString().split("T")[0]; }
function sumarDias(n: number) {
  const d = new Date(); d.setDate(d.getDate()+n);
  return d.toISOString().split("T")[0];
}
function fmt(iso: string) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  const M = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${M[parseInt(m)]} ${y}`;
}

function parsearFecha(raw: string): string | null {
  // Normalizar — quitar ruido
  const t = raw.toUpperCase()
    .replace(/[O]/g,"0").replace(/[I|L]/g,"1") // OCR confunde O→0, I/L→1
    .replace(/\s+/g," ");

  const MES: Record<string,string> = {
    ENE:"01",FEB:"02",MAR:"03",ABR:"04",MAY:"05",JUN:"06",
    JUL:"07",AGO:"08",SEP:"09",OCT:"10",NOV:"11",DIC:"12",
    JAN:"01",APR:"04",AUG:"08",
  };

  const pats = [
    // CAD 15/06/26  CAD: 15-06-2026
    /(?:CAD|VEN|VENCE|EXP|EXPIRA|VAL|VALIDO|FECHA)[:\s.]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
    // 15 JUN 2026 | 15/JUN/26
    /(\d{1,2})[\/\s\-](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG)[\/\s\-](\d{2,4})/,
    // 06/2026 o 06/26  (sin día)
    /(?:CAD|VEN|EXP|VAL)[:\s.]*(\d{1,2})[\/\-](\d{4})/,
    /(?:CAD|VEN|EXP|VAL)[:\s.]*(\d{1,2})[\/\-](2\d)/,
    // 20260615 compacto
    /\b(202\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/,
    // Genérica DD/MM/YY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
  ];

  for (const p of pats) {
    const m = t.match(p);
    if (!m) continue;
    try {
      // 20YYMMDD compacto
      if (m[0].match(/^202\d{5}$/)) return `${m[1]}-${m[2]}-${m[3]}`;
      // Con mes texto: 15 JUN 2026
      if (MES[m[2]]) {
        const y = m[3].length===2 ? "20"+m[3] : m[3];
        return `${y}-${MES[m[2]]}-${m[1].padStart(2,"0")}`;
      }
      // MM/YYYY o MM/YY sin día → último día del mes
      if (m[1] && m[2] && !m[3]) {
        const mes = m[1].padStart(2,"0");
        const y   = m[2].length===2 ? "20"+m[2] : m[2];
        const ult = new Date(+y, +mes, 0).getDate();
        return `${y}-${mes}-${String(ult).padStart(2,"0")}`;
      }
      // DD/MM/YY o DD/MM/YYYY
      if (m[3]) {
        const y = m[3].length===2 ? "20"+m[3] : m[3];
        const a = +m[1], b = +m[2];
        if (a > 12 && b <= 12) return `${y}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
        if (b > 12 && a <= 12) return `${y}-${String(a).padStart(2,"0")}-${String(b).padStart(2,"0")}`;
        return `${y}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
      }
    } catch {}
  }
  return null;
}

const RAPIDOS = [
  { l:"+3 días",  d:3,   c:"bg-red-50 text-red-700 border-red-100" },
  { l:"+7 días",  d:7,   c:"bg-red-50 text-red-700 border-red-100" },
  { l:"+15 días", d:15,  c:"bg-amber-50 text-amber-700 border-amber-100" },
  { l:"+1 mes",   d:30,  c:"bg-amber-50 text-amber-700 border-amber-100" },
  { l:"+3 meses", d:90,  c:"bg-green-50 text-green-700 border-green-100" },
  { l:"+6 meses", d:180, c:"bg-green-50 text-green-700 border-green-100" },
  { l:"+1 año",   d:365, c:"bg-green-50 text-green-700 border-green-100" },
  { l:"+2 años",  d:730, c:"bg-green-50 text-green-700 border-green-100" },
];

type Tab = "camara"|"rapido"|"manual";
type Cam = "init"|"listo"|"snap"|"ocr"|"ok"|"fail";

export default function EscanerFecha({ onFechaDetectada, onCerrar }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const rafRef     = useRef<number>(0);
  const scanY      = useRef(0);
  const scanDir    = useRef(1);

  const [tab,  setTab]  = useState<Tab>("camara");
  const [cam,  setCam]  = useState<Cam>("init");
  const [pct,  setPct]  = useState(0);
  const [ocr,  setOcr]  = useState("");
  const [err,  setErr]  = useState("");
  const [manual, setManual] = useState(hoy());

  // ── overlay animado ──────────────────────────────────────────────────────
  const drawOverlay = useCallback(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const ctx = ov.getContext("2d")!;
    ov.width = ov.offsetWidth; ov.height = ov.offsetHeight;
    const W = ov.width, H = ov.height;
    ctx.clearRect(0,0,W,H);

    const zy = H*0.30, zh = H*0.40;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0,W,zy);
    ctx.fillRect(0,zy+zh,W,H);

    // Esquinas
    const cs = 20;
    ctx.strokeStyle="rgba(255,255,255,0.95)"; ctx.lineWidth=2.5;
    [[0,0],[W,0],[0,zh],[W,zh]].forEach(([cx,cy],i)=>{
      const dx=i%2===0?cs:-cs, dy=i<2?cs:-cs;
      ctx.beginPath();
      ctx.moveTo(cx,zy+cy); ctx.lineTo(cx+dx,zy+cy);
      ctx.moveTo(cx,zy+cy); ctx.lineTo(cx,zy+cy+dy);
      ctx.stroke();
    });

    // Línea roja
    scanY.current += 1.5*scanDir.current;
    if (scanY.current>zh-4) scanDir.current=-1;
    if (scanY.current<4)    scanDir.current=1;
    const ly = zy+scanY.current;
    const g = ctx.createLinearGradient(0,ly,W,ly);
    g.addColorStop(0,"transparent"); g.addColorStop(0.1,"rgba(239,68,68,0.9)");
    g.addColorStop(0.5,"#ef4444");   g.addColorStop(0.9,"rgba(239,68,68,0.9)");
    g.addColorStop(1,"transparent");
    ctx.strokeStyle=g; ctx.lineWidth=3;
    ctx.shadowColor="rgba(239,68,68,0.7)"; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(W,ly); ctx.stroke();
    ctx.shadowBlur=0;

    // Label
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.font="bold 12px system-ui";
    ctx.textAlign="center";
    ctx.fillText("Apunta donde dice CAD · VENCE · EXP", W/2, zy-8);

    rafRef.current = requestAnimationFrame(drawOverlay);
  }, []);

  // ── cámara ───────────────────────────────────────────────────────────────
  const openCam = useCallback(async () => {
    setCam("init"); setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080} }
      });
      streamRef.current = s;
      if (videoRef.current){ videoRef.current.srcObject=s; await videoRef.current.play(); }
      setCam("listo"); drawOverlay();
    } catch(e:any){
      setErr(e?.name==="NotAllowedError"
        ? "Permiso de cámara denegado. Usa los botones rápidos o la fecha manual."
        : "No se pudo abrir la cámara.");
      setCam("fail");
    }
  }, [drawOverlay]);

  const closeCam = useCallback(()=>{
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
  }, []);

  useEffect(()=>{ if(tab==="camara") openCam(); else closeCam(); return closeCam; }, [tab]);

  // ── capturar y leer con OCR ──────────────────────────────────────────────
  const capturar = useCallback(async ()=>{
    const v=videoRef.current, c=canvasRef.current;
    if(!v||!c) return;
    cancelAnimationFrame(rafRef.current);
    setCam("snap");

    // Capturar frame y pre-procesar
    c.width=v.videoWidth; c.height=v.videoHeight;
    const ctx=c.getContext("2d")!;
    ctx.drawImage(v,0,0);

    // Recortar banda central (donde está la fecha)
    const cy=Math.round(c.height*0.25), ch=Math.round(c.height*0.50);
    const crop = ctx.getImageData(0,cy,c.width,ch);

    // Escala de grises + contraste
    for(let i=0;i<crop.data.length;i+=4){
      const g = 0.299*crop.data[i]+0.587*crop.data[i+1]+0.114*crop.data[i+2];
      const v2 = g>100 ? Math.min(255,g*1.5) : g*0.5;
      crop.data[i]=crop.data[i+1]=crop.data[i+2]=v2;
    }
    // Crear canvas recortado y procesado
    const cc=document.createElement("canvas");
    cc.width=c.width; cc.height=ch;
    cc.getContext("2d")!.putImageData(crop,0,0);

    setCam("ocr"); setPct(0);

    try {
      const { createWorker } = await import("tesseract.js" as any);
      const w = await createWorker(["spa","eng"], 1, {
        logger:(m:any)=>{ if(m.status==="recognizing text") setPct(Math.round(m.progress*100)); }
      });
      // Config optimizada para fechas
      await w.setParameters({
        tessedit_char_whitelist: "0123456789/-.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz: ",
        tessedit_pageseg_mode: "6" as any, // bloque uniforme
        preserve_interword_spaces: "0" as any,
      });
      const { data:{ text } } = await w.recognize(cc);
      await w.terminate();

      console.log("OCR texto:", text); // debug
      const fecha = parsearFecha(text);
      if (fecha) {
        setOcr(fecha); setCam("ok");
      } else {
        // Segundo intento sin recortar — imagen completa
        const { createWorker: cw2 } = await import("tesseract.js" as any);
        const w2 = await cw2(["spa","eng"]);
        const { data:{ text:t2 } } = await w2.recognize(c);
        await w2.terminate();
        const f2 = parsearFecha(t2);
        if (f2) { setOcr(f2); setCam("ok"); }
        else { setErr("No se detectó fecha. Ajusta el ángulo o usa otra opción."); setCam("fail"); }
      }
    } catch(e){
      console.error(e);
      setErr("Error al procesar. Intenta de nuevo."); setCam("fail");
    }
  }, []);

  const reintentar = ()=>{ setErr(""); setOcr(""); setCam("listo"); drawOverlay(); };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-85 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">📅 Fecha de caducidad</h3>
            <p className="text-xs text-gray-400">Escanea el empaque, usa acceso rápido o escribe</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {([{id:"camara",icon:"📷",lbl:"Escanear"},{id:"rapido",icon:"⚡",lbl:"Rápido"},{id:"manual",icon:"✏️",lbl:"Manual"}] as {id:Tab,icon:string,lbl:string}[]).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs font-medium transition-all ${tab===t.id?"text-gray-900 border-b-2 border-gray-900":"text-gray-400 hover:text-gray-600"}`}>
              <span className="text-base">{t.icon}</span>{t.lbl}
            </button>
          ))}
        </div>

        {/* ── Cámara ── */}
        {tab==="camara" && (
          <>
            <div className="relative bg-black overflow-hidden" style={{aspectRatio:"16/9"}}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay/>
              <canvas ref={canvasRef} className="hidden"/>
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

              {cam==="init" && (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                  <div className="text-white text-center"><div className="text-4xl mb-2 animate-pulse">📷</div><p className="text-sm">Abriendo cámara...</p></div>
                </div>
              )}
              {(cam==="snap"||cam==="ocr") && (
                <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
                  <div className="text-white text-center px-6">
                    <div className="text-4xl mb-3 animate-pulse">{cam==="snap"?"📸":"🤖"}</div>
                    <p className="font-semibold">{cam==="snap"?"Capturando...":"Leyendo con IA..."}</p>
                    {cam==="ocr"&&pct>0&&(
                      <div className="mt-3 w-44 mx-auto">
                        <div className="bg-gray-700 rounded-full h-1.5">
                          <div className="bg-green-400 rounded-full h-1.5 transition-all" style={{width:`${pct}%`}}/>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{pct}%</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {cam==="ok" && (
                <div className="absolute inset-0 bg-green-500 bg-opacity-25 flex items-center justify-center">
                  <div className="bg-white rounded-2xl px-6 py-4 text-center shadow-xl mx-4">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="font-semibold text-gray-900">¡Fecha detectada!</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(ocr)}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{ocr}</p>
                  </div>
                </div>
              )}
              {cam==="fail" && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
                  <div className="text-center">
                    <div className="text-3xl mb-3">⚠️</div>
                    <p className="text-white text-sm">{err}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-2">
              {cam==="listo" && (
                <button onClick={capturar} className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center gap-2">
                  📸 Capturar y leer fecha
                </button>
              )}
              {cam==="ok" && (
                <div className="flex gap-2">
                  <button onClick={()=>onFechaDetectada(ocr)} className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800">
                    ✓ Usar esta fecha
                  </button>
                  <button onClick={reintentar} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    Reintentar
                  </button>
                </div>
              )}
              {cam==="fail" && (
                <div className="flex gap-2">
                  <button onClick={reintentar} className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold">
                    Intentar de nuevo
                  </button>
                  <button onClick={()=>setTab("rapido")} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500">
                    ⚡ Rápido
                  </button>
                </div>
              )}
              <p className="text-xs text-center text-gray-400">
                Apunta donde dice "CAD", "VENCE", "EXP" o "VAL"
              </p>
            </div>
          </>
        )}

        {/* ── Rápido ── */}
        {tab==="rapido" && (
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3 font-medium">¿Cuánto tiempo falta para que venza?</p>
            <div className="grid grid-cols-2 gap-2">
              {RAPIDOS.map(({l,d,c})=>(
                <button key={d} onClick={()=>onFechaDetectada(sumarDias(d))}
                  className={`${c} border rounded-xl py-3 px-4 text-left active:scale-95 transition-all`}>
                  <div className="text-sm font-semibold">{l}</div>
                  <div className="text-xs opacity-60 mt-0.5 font-mono">{fmt(sumarDias(d))}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-600 mb-1.5">Referencia:</p>
              <p>🥛 Lácteos / cremas → <strong>+15 días</strong></p>
              <p>🥩 Carnes / embutidos → <strong>+7 días</strong></p>
              <p>🍞 Pan / pasteles → <strong>+5 días</strong></p>
              <p>🥤 Refrescos / jugos → <strong>+6 meses</strong></p>
              <p>🥫 Enlatados → <strong>+1-2 años</strong></p>
            </div>
          </div>
        )}

        {/* ── Manual ── */}
        {tab==="manual" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de caducidad</label>
              <input type="date" min={hoy()} value={manual} onChange={e=>setManual(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
              {manual && <p className="text-xs text-gray-400 mt-2 text-center">{fmt(manual)}</p>}
            </div>
            <button onClick={()=>onFechaDetectada(manual)} disabled={!manual}
              className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 active:scale-95 transition-all">
              ✓ Usar esta fecha
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

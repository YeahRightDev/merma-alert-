"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const EscanerCodigo = dynamic(() => import("@/components/EscanerCodigo"), { ssr: false });
const EscanerFecha  = dynamic(() => import("@/components/EscanerFecha"),  { ssr: false });

type Producto = {
  id: number; nombre: string; sku: string; unidad: string;
  marca: string; imagen_url: string; costo_compra: number; precio_venta: number;
};

const UNIDADES = [
  { valor:"pieza",   icono:"📦", label:"Piezas",     tipo:"conteo" },
  { valor:"caja",    icono:"🗃️", label:"Cajas",      tipo:"conteo" },
  { valor:"bolsa",   icono:"🛍️", label:"Bolsas",     tipo:"conteo" },
  { valor:"lata",    icono:"🥫", label:"Latas",      tipo:"conteo" },
  { valor:"paquete", icono:"📫", label:"Paquetes",   tipo:"conteo" },
  { valor:"botella", icono:"🍶", label:"Botellas",   tipo:"conteo" },
  { valor:"porcion", icono:"🍽️", label:"Porciones",  tipo:"conteo" },
  { valor:"docena",  icono:"🥚", label:"Docenas",    tipo:"conteo" },
  { valor:"kg",      icono:"⚖️", label:"Kilogramos", tipo:"medida" },
  { valor:"g",       icono:"⚖️", label:"Gramos",     tipo:"medida" },
  { valor:"litro",   icono:"🧴", label:"Litros",     tipo:"medida" },
  { valor:"ml",      icono:"💧", label:"Mililitros", tipo:"medida" },
];

const CATEGORIA_DIAS: Record<string,number> = {
  "dairies":15,"dairy":15,"milks":15,"yogurts":21,"cheeses":30,"creams":14,
  "meats":7,"poultry":5,"fish":5,"cold-cuts":14,"sausages":14,
  "breads":7,"pastries":5,"bakery":5,"cakes":5,
  "fruits":7,"vegetables":7,"salads":5,
  "sodas":180,"juices":30,"waters":365,"beers":180,"wines":730,
  "canned":730,"jams":365,"sauces":180,
  "chocolates":365,"candies":365,"chips":90,"cookies":90,"snacks":90,
  "cereals":365,"pasta":730,"rice":730,"flour":365,"frozen":365,
};

function predecirFecha(cat: string): string|null {
  const key = cat.toLowerCase().replace(/^(en|es|fr|de):/,"");
  for (const [k,v] of Object.entries(CATEGORIA_DIAS)) {
    if (key.includes(k)) {
      const d = new Date(); d.setDate(d.getDate()+v);
      return d.toISOString().split("T")[0];
    }
  }
  return null;
}

function formatFecha(iso: string) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  const M = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${M[parseInt(m)]} ${y}`;
}

function diasRestantes(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

type NuevoProducto = {
  nombre: string; sku: string; unidad: string;
  marca: string; costo_compra: string; precio_venta: string;
};

export default function IngresoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);

  // Form lote
  const [productoId, setProductoId]   = useState("");
  const [cantidad, setCantidad]         = useState("");
  const [fechaCad, setFechaCad]         = useState("");
  const [notas, setNotas]               = useState("");

  // Nuevo producto
  const [nuevo, setNuevo] = useState<NuevoProducto>({
    nombre:"", sku:"", unidad:"pieza", marca:"", costo_compra:"", precio_venta:""
  });
  const [tipoUnidad, setTipoUnidad] = useState<"conteo"|"medida">("conteo");
  const [showUnidades, setShowUnidades] = useState(false);
  const [modoNuevo, setModoNuevo]       = useState(false);

  // Escáneres
  const [showEscanerSKU,   setShowEscanerSKU]   = useState(false);
  const [showEscanerFecha, setShowEscanerFecha] = useState(false);

  // Búsqueda en base de datos global
  const [buscando, setBuscando]                 = useState(false);
  const [productoInfo, setProductoInfo]         = useState<{nombre:string;marca:string|null;imagen:string|null}|null>(null);

  // Submit
  const [guardando, setGuardando]               = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [error, setError]                       = useState("");
  const [exito, setExito]                       = useState(false);

  useEffect(() => {
    fetch("/api/productos")
      .then(r => { if(r.status===401) router.push("/login"); return r.json(); })
      .then(d => { setProductos(d.productos||[]); setLoadingProductos(false); });
  }, [router]);

  const productoActual  = productos.find(p => String(p.id) === productoId);
  const unidadActual    = TODAS_U.find(u => u.valor === productoActual?.unidad);
  const unidadNueva     = TODAS_U.find(u => u.valor === nuevo.unidad) || TODAS_U[0];
  const unidadesActivas = TODAS_U.filter(u => u.tipo === tipoUnidad);

  // ── Escanear código de barras ────────────────────────────────────────────
  const handleSKU = useCallback(async (codigo: string) => {
    setShowEscanerSKU(false);

    // ¿Ya lo tengo?
    const exist = productos.find(p => p.sku === codigo);
    if (exist) { setProductoId(String(exist.id)); return; }

    // Mostrar formulario de nuevo producto con SKU pre-llenado
    setNuevo(n => ({...n, sku: codigo}));
    setModoNuevo(true);
    setBuscando(true);
    setProductoInfo(null);

    try {
      const res  = await fetch(`/api/barcode/${codigo}`);
      const data = await res.json();
      if (data.encontrado) {
        setNuevo(n => ({
          ...n,
          sku:    codigo,
          nombre: data.marca ? `${data.nombre} ${data.marca}`.trim() : data.nombre,
          marca:  data.marca || "",
        }));
        setProductoInfo({ nombre: data.nombre, marca: data.marca, imagen: data.imagen });
        // Predictor de fecha
        if (data.categoria) {
          const f = predecirFecha(data.categoria);
          if (f && !fechaCad) setFechaCad(f);
        }
      }
    } catch {}
    setBuscando(false);
  }, [productos, fechaCad]);

  // ── Guardar nuevo producto ───────────────────────────────────────────────
  const guardarProducto = useCallback(async () => {
    if (!nuevo.nombre.trim()) return;
    setGuardandoProducto(true);
    try {
      const body = {
        nombre:       nuevo.nombre.trim(),
        sku:          nuevo.sku.trim() || null,
        unidad:       nuevo.unidad,
        marca:        nuevo.marca.trim() || null,
        costo_compra: parseFloat(nuevo.costo_compra) || 0,
        precio_venta: parseFloat(nuevo.precio_venta) || 0,
      };
      const res  = await fetch("/api/productos", {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setProductos(ps => [...ps, data.producto]);
        setProductoId(String(data.producto.id));
        setModoNuevo(false);
        setShowUnidades(false);
        setProductoInfo(null);
        setNuevo({ nombre:"", sku:"", unidad:"pieza", marca:"", costo_compra:"", precio_venta:"" });
        setTipoUnidad("conteo");
      } else {
        setError(data.error || "Error al guardar producto");
      }
    } catch { setError("Error de conexión"); }
    setGuardandoProducto(false);
  }, [nuevo]);

  // ── Guardar lote ─────────────────────────────────────────────────────────
  const guardarLote = useCallback(async () => {
    setError("");
    if (!productoId)  { setError("Selecciona un producto."); return; }
    if (!cantidad)    { setError("Ingresa la cantidad."); return; }
    if (!fechaCad)    { setError("Ingresa la fecha de caducidad."); return; }

    setGuardando(true);
    try {
      const res = await fetch("/api/lotes", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          producto_id: Number(productoId),
          cantidad:    Number(cantidad),
          fecha_caducidad: fechaCad,
          notas: notas.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) { setExito(true); setTimeout(() => router.push("/dashboard"), 1400); }
      else setError(data.error || "Error al guardar");
    } catch { setError("Error de conexión"); }
    setGuardando(false);
  }, [productoId, cantidad, fechaCad, notas, router]);

  const hoy = new Date().toISOString().split("T")[0];

  // ─────────────────────────────────────────────────────────────────────────
  if (exito) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-gray-700 font-semibold text-lg">¡Lote registrado!</p>
        <p className="text-gray-400 text-sm mt-1">Volviendo al tablero...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 text-sm">← Volver</Link>
          <h1 className="font-semibold text-gray-900">Registrar lote</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── PASO 1: Producto ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">1. Producto</h2>
            {/* Botón escanear siempre visible */}
            <button
              onClick={() => setShowEscanerSKU(true)}
              className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-xl hover:bg-gray-700 transition-colors"
            >
              📷 Escanear código
            </button>
          </div>

          {!modoNuevo ? (
            <div className="space-y-3">
              {loadingProductos ? (
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse"/>
              ) : (
                <select
                  value={productoId}
                  onChange={e => setProductoId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                >
                  <option value="">— Selecciona un producto —</option>
                  {productos.map(p => {
                    const u = TODAS_U.find(u => u.valor === p.unidad);
                    return (
                      <option key={p.id} value={p.id}>
                        {u?.icono} {p.nombre}{p.sku ? ` (${p.sku})` : ""} · {u?.label}
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Info del producto seleccionado */}
              {productoActual && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  {productoActual.imagen_url && (
                    <img src={productoActual.imagen_url} alt="" className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-200 flex-shrink-0"/>
                  )}
                  <div>
                    <p className="text-xs text-gray-400">{unidadActual?.label || productoActual.unidad}</p>
                    {(productoActual.costo_compra > 0 || productoActual.precio_venta > 0) && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Costo <strong>${productoActual.costo_compra}</strong> · Venta <strong>${productoActual.precio_venta}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setModoNuevo(true)}
                className="text-sm text-gray-400 hover:text-gray-700 underline underline-offset-4 transition-colors"
              >
                + Crear producto nuevo
              </button>
            </div>
          ) : (
            /* ── Formulario nuevo producto ── */
            <div className="space-y-3">
              {/* Buscando... */}
              {buscando && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                  <span className="text-xl animate-spin">🔍</span>
                  <div>
                    <p className="text-sm font-medium text-blue-700">Buscando en 3M+ productos...</p>
                    <p className="text-xs text-blue-400">Open Food Facts · UPC Database</p>
                  </div>
                </div>
              )}

              {/* Producto encontrado */}
              {productoInfo && !buscando && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  {productoInfo.imagen && (
                    <img src={productoInfo.imagen} alt="" className="w-12 h-12 object-contain rounded-lg bg-white border border-green-100 flex-shrink-0"/>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-600">✓ Encontrado automáticamente</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{productoInfo.nombre}</p>
                    {productoInfo.marca && <p className="text-xs text-gray-500">{productoInfo.marca}</p>}
                  </div>
                </div>
              )}

              {/* Campos */}
              <input
                placeholder="Nombre del producto *"
                value={nuevo.nombre}
                onChange={e => setNuevo(n => ({...n, nombre:e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
                autoFocus={!buscando}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="SKU / Código"
                  value={nuevo.sku}
                  onChange={e => setNuevo(n => ({...n, sku:e.target.value}))}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  placeholder="Marca"
                  value={nuevo.marca}
                  onChange={e => setNuevo(n => ({...n, marca:e.target.value}))}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Costo de compra ($)</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={nuevo.costo_compra}
                    onChange={e => setNuevo(n => ({...n, costo_compra:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio de venta ($)</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={nuevo.precio_venta}
                    onChange={e => setNuevo(n => ({...n, precio_venta:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Unidad */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Unidad de medida</p>
                <div className="flex bg-gray-100 rounded-xl p-1 mb-2">
                  {(["conteo","medida"] as const).map(t => (
                    <button key={t}
                      onClick={() => { setTipoUnidad(t); setNuevo(n => ({...n, unidad: t==="conteo"?"pieza":"kg"})); setShowUnidades(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoUnidad===t?"bg-white shadow-sm text-gray-900":"text-gray-500"}`}
                    >
                      {t==="conteo"?"📦 Por cantidad":"⚖️ Por peso/volumen"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowUnidades(v => !v)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between hover:border-gray-400 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>{unidadNueva.icono}</span>
                    <span className="font-medium">{unidadNueva.label}</span>
                  </span>
                  <span className="text-gray-400 text-xs">{showUnidades?"▲":"▼"} cambiar</span>
                </button>
                {showUnidades && (
                  <div className={`mt-2 grid gap-2 ${tipoUnidad==="conteo"?"grid-cols-4":"grid-cols-3"}`}>
                    {unidadesActivas.map(u => (
                      <button key={u.valor}
                        onClick={() => { setNuevo(n => ({...n, unidad:u.valor})); setShowUnidades(false); }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${nuevo.unidad===u.valor?"border-gray-900 bg-gray-900 text-white":"border-gray-200 hover:border-gray-400"}`}
                      >
                        <span className="text-xl">{u.icono}</span>
                        <span className="text-xs font-medium leading-tight">{u.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardarProducto}
                  disabled={!nuevo.nombre.trim() || guardandoProducto}
                  className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-all"
                >
                  {guardandoProducto ? "Guardando..." : "✓ Guardar producto"}
                </button>
                <button
                  onClick={() => { setModoNuevo(false); setProductoInfo(null); setNuevo({nombre:"",sku:"",unidad:"pieza",marca:"",costo_compra:"",precio_venta:""}); }}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── PASO 2: Cantidad y caducidad ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">2. Cantidad y caducidad</h2>

          {/* Cantidad */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1.5">
              Cantidad{unidadActual ? ` (${unidadActual.label.toLowerCase()})` : ""} *
            </label>
            <div className="relative">
              <input
                type="number" min="0.01" step="0.01" placeholder="Ej: 12"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 pr-20"
              />
              {unidadActual && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                  {unidadActual.icono} {unidadActual.valor}
                </span>
              )}
            </div>
          </div>

          {/* Fecha caducidad */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-gray-600">Fecha de caducidad *</label>
              <button
                onClick={() => setShowEscanerFecha(true)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2 py-1 hover:border-gray-400 transition-colors"
              >
                📷 Escanear fecha
              </button>
            </div>
            <input
              type="date" min={hoy}
              value={fechaCad}
              onChange={e => setFechaCad(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            {fechaCad && (
              <div className="flex items-center gap-2 mt-2 ml-1">
                <span className="text-xs text-gray-500">📅 {formatFecha(fechaCad)}</span>
                {(() => {
                  const d = diasRestantes(fechaCad);
                  const c = d<=7?"text-red-500 font-semibold":d<=30?"text-amber-500 font-medium":"text-green-500";
                  return <span className={`text-xs ${c}`}>({d} días)</span>;
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── PASO 3: Notas ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            3. Notas <span className="text-gray-400 font-normal text-sm">(opcional)</span>
          </h2>
          <p className="text-xs text-gray-400 mb-3">Proveedor, temperatura, observaciones...</p>
          <textarea
            rows={3} placeholder='Ej: "Proveedor ABC, mantener refrigerado"'
            value={notas} onChange={e => setNotas(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={guardarLote}
          disabled={guardando || !productoId || !cantidad || !fechaCad}
          className="w-full bg-gray-900 text-white rounded-xl py-4 text-sm font-semibold hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {guardando ? "Guardando lote..." : "✓ Registrar lote"}
        </button>
        <div className="h-4"/>
      </main>

      {showEscanerSKU && (
        <EscanerCodigo onDetected={handleSKU} onCerrar={() => setShowEscanerSKU(false)}/>
      )}
      {showEscanerFecha && (
        <EscanerFecha
          onFechaDetectada={f => { setFechaCad(f); setShowEscanerFecha(false); }}
          onCerrar={() => setShowEscanerFecha(false)}
        />
      )}
    </div>
  );
}

// Constante fuera del componente para evitar re-renders
const TODAS_U = [
  { valor:"pieza",   icono:"📦", label:"Piezas",     tipo:"conteo" },
  { valor:"caja",    icono:"🗃️", label:"Cajas",      tipo:"conteo" },
  { valor:"bolsa",   icono:"🛍️", label:"Bolsas",     tipo:"conteo" },
  { valor:"lata",    icono:"🥫", label:"Latas",      tipo:"conteo" },
  { valor:"paquete", icono:"📫", label:"Paquetes",   tipo:"conteo" },
  { valor:"botella", icono:"🍶", label:"Botellas",   tipo:"conteo" },
  { valor:"porcion", icono:"🍽️", label:"Porciones",  tipo:"conteo" },
  { valor:"docena",  icono:"🥚", label:"Docenas",    tipo:"conteo" },
  { valor:"kg",      icono:"⚖️", label:"Kilogramos", tipo:"medida" },
  { valor:"g",       icono:"⚖️", label:"Gramos",     tipo:"medida" },
  { valor:"litro",   icono:"🧴", label:"Litros",     tipo:"medida" },
  { valor:"ml",      icono:"💧", label:"Mililitros", tipo:"medida" },
];

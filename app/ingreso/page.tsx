"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const EscanerCodigo = dynamic(() => import("@/components/EscanerCodigo"), { ssr: false });
const EscanerFecha  = dynamic(() => import("@/components/EscanerFecha"),  { ssr: false });

type Producto = { id: number; nombre: string; sku: string; unidad: string; marca: string; imagen_url: string; costo_compra: number; precio_venta: number; };

const UNIDADES_CONTEO = [
  { valor:"pieza", icono:"📦", label:"Piezas"    },
  { valor:"caja",  icono:"🗃️", label:"Cajas"     },
  { valor:"bolsa", icono:"🛍️", label:"Bolsas"    },
  { valor:"lata",  icono:"🥫", label:"Latas"     },
  { valor:"paquete",icono:"📫",label:"Paquetes"  },
  { valor:"botella",icono:"🍶",label:"Botellas"  },
  { valor:"porcion",icono:"🍽️",label:"Porciones" },
  { valor:"docena", icono:"🥚",label:"Docenas"   },
];
const UNIDADES_MEDIDA = [
  { valor:"kg",    icono:"⚖️", label:"Kilogramos" },
  { valor:"g",     icono:"⚖️", label:"Gramos"     },
  { valor:"litro", icono:"🧴", label:"Litros"     },
  { valor:"ml",    icono:"💧", label:"Mililitros" },
  { valor:"metro", icono:"📏", label:"Metros"     },
];
const TODAS_UNIDADES = [...UNIDADES_CONTEO, ...UNIDADES_MEDIDA];

const CATEGORIA_DIAS: Record<string,number> = {
  "dairies":15,"dairy":15,"milks":15,"yogurts":21,"cheeses":30,"creams":14,"butters":30,
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
function formatearFecha(iso: string) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  const meses = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${meses[parseInt(m)]} ${y}`;
}

export default function IngresoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({ producto_id:"", cantidad:"", fecha_caducidad:"", notas:"" });
  const [nuevoProducto, setNuevoProducto] = useState({ nombre:"", sku:"", unidad:"pieza", marca:"", costo_compra:"", precio_venta:"" });
  const [tipoUnidad, setTipoUnidad] = useState<"conteo"|"medida">("conteo");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarUnidades, setMostrarUnidades] = useState(false);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
  const [mostrarEscanerFecha, setMostrarEscanerFecha] = useState(false);
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [productoEncontrado, setProductoEncontrado] = useState<{nombre:string;marca:string|null;imagen:string|null}|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  useEffect(() => {
    fetch("/api/productos")
      .then(r => { if (r.status===401) router.push("/login"); return r.json(); })
      .then(d => setProductos(d.productos||[]));
  }, [router]);

  const unidadInfo = TODAS_UNIDADES.find(u => u.valor===nuevoProducto.unidad) || UNIDADES_CONTEO[0];
  const productoActual = productos.find(p => String(p.id)===form.producto_id);
  const unidadActual = TODAS_UNIDADES.find(u => u.valor===productoActual?.unidad);

  const handleCodigoDetectado = async (codigo: string) => {
    setMostrarEscaner(false);
    const existente = productos.find(p => p.sku===codigo);
    if (existente) { setForm(f => ({...f, producto_id:String(existente.id)})); return; }

    setBuscandoProducto(true);
    setProductoEncontrado(null);
    setMostrarNuevo(true);
    setNuevoProducto(p => ({...p, sku:codigo}));

    try {
      const res = await fetch(`/api/barcode/${codigo}`);
      const data = await res.json();
      if (data.encontrado) {
        const nombre = data.marca ? `${data.nombre} ${data.marca}`.trim() : data.nombre;
        setNuevoProducto(p => ({...p, nombre, sku:codigo, marca:data.marca||""}));
        setProductoEncontrado({ nombre:data.nombre, marca:data.marca, imagen:data.imagen });
        // Predictor de fecha
        if (data.categoria && !form.fecha_caducidad) {
          const f = predecirFecha(data.categoria);
          if (f) setForm(prev => ({...prev, fecha_caducidad:f}));
        }
      }
    } catch {}
    setBuscandoProducto(false);
  };

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return;
    const res = await fetch("/api/productos", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        ...nuevoProducto,
        costo_compra: parseFloat(nuevoProducto.costo_compra)||0,
        precio_venta: parseFloat(nuevoProducto.precio_venta)||0,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProductos([...productos, data.producto]);
      setForm(f => ({...f, producto_id:String(data.producto.id)}));
      setMostrarNuevo(false);
      setMostrarUnidades(false);
      setNuevoProducto({nombre:"",sku:"",unidad:"pieza",marca:"",costo_compra:"",precio_venta:""});
      setProductoEncontrado(null);
      setTipoUnidad("conteo");
    }
  };

  const handleSubmit = async () => {
    if (!form.producto_id||!form.cantidad||!form.fecha_caducidad) {
      setError("Completa todos los campos obligatorios."); return;
    }
    setLoading(true); setError("");
    const res = await fetch("/api/lotes", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({...form, producto_id:Number(form.producto_id), cantidad:Number(form.cantidad)}),
    });
    setLoading(false);
    if (res.ok) { setExito(true); setTimeout(()=>router.push("/dashboard"),1500); }
    else { const d=await res.json(); setError(d.error||"Error al guardar"); }
  };

  const hoy = new Date().toISOString().split("T")[0];
  const unidadesActivas = tipoUnidad==="conteo" ? UNIDADES_CONTEO : UNIDADES_MEDIDA;

  if (exito) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-gray-700 font-medium">¡Lote registrado!</p>
        <p className="text-gray-400 text-sm mt-1">Redirigiendo al tablero...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Volver</Link>
          <h1 className="font-semibold text-gray-900">Registrar lote</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Paso 1: Producto */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-medium text-gray-900 mb-4">1. Producto</h2>
          {!mostrarNuevo ? (
            <div className="space-y-3">
              <select value={form.producto_id} onChange={e=>setForm({...form,producto_id:e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">— Selecciona un producto —</option>
                {productos.map(p => {
                  const u = TODAS_UNIDADES.find(u=>u.valor===p.unidad);
                  return <option key={p.id} value={p.id}>{u?.icono} {p.nombre} {p.sku?`(${p.sku})`:""} · {u?.label||p.unidad}</option>;
                })}
              </select>

              {productoActual && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                  {productoActual.imagen_url && (
                    <img src={productoActual.imagen_url} alt="" className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-100 flex-shrink-0"/>
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">Unidad · {unidadActual?.label||productoActual.unidad}</p>
                    {productoActual.costo_compra>0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Costo: <strong>${productoActual.costo_compra}</strong> · Venta: <strong>${productoActual.precio_venta}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button onClick={()=>setMostrarNuevo(true)} className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4">
                  + Agregar producto nuevo
                </button>
                <span className="text-gray-200">|</span>
                <button onClick={()=>setMostrarEscaner(true)} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
                  📷 Escanear código
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Nuevo producto</p>

              {buscandoProducto && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                  <div className="animate-spin text-lg">🔍</div>
                  <div>
                    <p className="text-sm font-medium text-blue-700">Buscando en base de datos global...</p>
                    <p className="text-xs text-blue-400">Open Food Facts · 3M+ productos</p>
                  </div>
                </div>
              )}

              {productoEncontrado && !buscandoProducto && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  {productoEncontrado.imagen && (
                    <img src={productoEncontrado.imagen} alt="" className="w-12 h-12 object-contain rounded-lg bg-white border border-green-100 flex-shrink-0"/>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-600 font-medium">✓ Producto encontrado automáticamente</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{productoEncontrado.nombre}</p>
                    {productoEncontrado.marca && <p className="text-xs text-gray-500">{productoEncontrado.marca}</p>}
                  </div>
                </div>
              )}

              <input placeholder="Nombre del producto *" value={nuevoProducto.nombre}
                onChange={e=>setNuevoProducto({...nuevoProducto,nombre:e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>

              <div className="grid grid-cols-2 gap-3">
                <input placeholder="SKU / Código" value={nuevoProducto.sku}
                  onChange={e=>setNuevoProducto({...nuevoProducto,sku:e.target.value})}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
                <input placeholder="Marca (opcional)" value={nuevoProducto.marca}
                  onChange={e=>setNuevoProducto({...nuevoProducto,marca:e.target.value})}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>

              {/* Costo y precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Costo de compra ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={nuevoProducto.costo_compra}
                    onChange={e=>setNuevoProducto({...nuevoProducto,costo_compra:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio de venta ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={nuevoProducto.precio_venta}
                    onChange={e=>setNuevoProducto({...nuevoProducto,precio_venta:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              </div>

              {/* Tipo de unidad */}
              <div>
                <p className="text-sm text-gray-600 mb-2">¿Cómo se mide?</p>
                <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
                  <button onClick={()=>{setTipoUnidad("conteo");setNuevoProducto({...nuevoProducto,unidad:"pieza"});setMostrarUnidades(false);}}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoUnidad==="conteo"?"bg-white shadow-sm text-gray-900":"text-gray-500"}`}>
                    📦 Por cantidad
                  </button>
                  <button onClick={()=>{setTipoUnidad("medida");setNuevoProducto({...nuevoProducto,unidad:"kg"});setMostrarUnidades(false);}}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoUnidad==="medida"?"bg-white shadow-sm text-gray-900":"text-gray-500"}`}>
                    ⚖️ Por peso/volumen
                  </button>
                </div>
                <button onClick={()=>setMostrarUnidades(!mostrarUnidades)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between hover:border-gray-400 transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{unidadInfo.icono}</span>
                    <span className="font-medium text-gray-900">{unidadInfo.label}</span>
                  </span>
                  <span className="text-gray-400 text-xs">{mostrarUnidades?"▲ cerrar":"▼ cambiar"}</span>
                </button>
                {mostrarUnidades && (
                  <div className={`mt-2 grid gap-2 ${tipoUnidad==="conteo"?"grid-cols-4":"grid-cols-3"}`}>
                    {unidadesActivas.map(u=>(
                      <button key={u.valor} onClick={()=>{setNuevoProducto({...nuevoProducto,unidad:u.valor});setMostrarUnidades(false);}}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${nuevoProducto.unidad===u.valor?"border-gray-900 bg-gray-900 text-white":"border-gray-200 hover:border-gray-400 text-gray-700"}`}>
                        <span className="text-xl">{u.icono}</span>
                        <span className="text-xs font-medium leading-tight">{u.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={crearProducto} className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800">
                  Guardar producto
                </button>
                <button onClick={()=>{setMostrarNuevo(false);setMostrarUnidades(false);setProductoEncontrado(null);}}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Cantidad y caducidad */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-medium text-gray-900 mb-4">2. Cantidad y caducidad</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Cantidad{unidadActual ? ` en ${unidadActual.label.toLowerCase()}` : ""} *
              </label>
              <div className="relative">
                <input type="number" min="0.01" step="0.01" placeholder="Ej: 12" value={form.cantidad}
                  onChange={e=>setForm({...form,cantidad:e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 pr-20"/>
                {productoActual && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                    {unidadActual?.icono} {productoActual.unidad}
                  </span>
                )}
              </div>
            </div>

            {/* Fecha de caducidad */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de caducidad *</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input type="date" min={hoy} value={form.fecha_caducidad}
                    onChange={e=>setForm({...form,fecha_caducidad:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
                <button onClick={()=>setMostrarEscanerFecha(true)}
                  className="flex-shrink-0 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1"
                  title="Escanear fecha con cámara">
                  📷
                </button>
              </div>
              {form.fecha_caducidad && (
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  📅 {formatearFecha(form.fecha_caducidad)}
                  {(() => {
                    const dias = Math.round((new Date(form.fecha_caducidad).getTime() - Date.now()) / 86400000);
                    const color = dias<=7?"text-red-500":dias<=30?"text-amber-500":"text-green-500";
                    return <span className={`ml-2 font-medium ${color}`}>({dias} días)</span>;
                  })()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Paso 3: Notas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-medium text-gray-900 mb-1">
            3. Notas <span className="text-gray-400 font-normal text-sm">(opcional)</span>
          </h2>
          <p className="text-xs text-gray-400 mb-3">Proveedor, condiciones, observaciones...</p>
          <textarea rows={3} placeholder='Ej: "Lote de Lácteos del Norte, mantener refrigerado"' value={form.notas}
            onChange={e=>setForm({...form,notas:e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-gray-900 text-white rounded-xl py-4 text-sm font-medium hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
          {loading?"Guardando...":"✓ Registrar lote"}
        </button>
      </main>

      {mostrarEscaner && (
        <EscanerCodigo onDetected={handleCodigoDetectado} onCerrar={()=>setMostrarEscaner(false)}/>
      )}
      {mostrarEscanerFecha && (
        <EscanerFecha
          onFechaDetectada={fecha=>{setForm(f=>({...f,fecha_caducidad:fecha}));setMostrarEscanerFecha(false);}}
          onCerrar={()=>setMostrarEscanerFecha(false)}
        />
      )}
    </div>
  );
}

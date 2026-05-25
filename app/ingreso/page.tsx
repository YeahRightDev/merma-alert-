"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Producto = { id: number; nombre: string; sku: string; unidad: string };

const UNIDADES_MEDIDA = [
  { valor: "kg",      icono: "⚖️",  label: "Kilogramos" },
  { valor: "g",       icono: "⚖️",  label: "Gramos"     },
  { valor: "litro",   icono: "🧴",  label: "Litros"     },
  { valor: "ml",      icono: "💧",  label: "Mililitros" },
  { valor: "metro",   icono: "📏",  label: "Metros"     },
];

const UNIDADES_CONTEO = [
  { valor: "pieza",    icono: "📦", label: "Piezas"   },
  { valor: "caja",     icono: "🗃️", label: "Cajas"    },
  { valor: "bolsa",    icono: "🛍️", label: "Bolsas"   },
  { valor: "lata",     icono: "🥫", label: "Latas"    },
  { valor: "paquete",  icono: "📫", label: "Paquetes" },
  { valor: "botella",  icono: "🍶", label: "Botellas" },
  { valor: "porcion",  icono: "🍽️", label: "Porciones"},
  { valor: "docena",   icono: "🥚", label: "Docenas"  },
];

const TODAS_UNIDADES = [...UNIDADES_CONTEO, ...UNIDADES_MEDIDA];

export default function IngresoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    fecha_caducidad: "",
    notas: "",
  });
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: "", sku: "", unidad: "pieza" });
  const [tipoUnidad, setTipoUnidad] = useState<"conteo" | "medida">("conteo");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarUnidades, setMostrarUnidades] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => { if (r.status === 401) router.push("/login"); return r.json(); })
      .then((d) => setProductos(d.productos || []));
  }, [router]);

  const unidadInfo = TODAS_UNIDADES.find(u => u.valor === nuevoProducto.unidad) || UNIDADES_CONTEO[0];
  const productoActual = productos.find(p => String(p.id) === form.producto_id);
  const unidadActual = TODAS_UNIDADES.find(u => u.valor === productoActual?.unidad);

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return;
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoProducto),
    });
    const data = await res.json();
    if (res.ok) {
      setProductos([...productos, data.producto]);
      setForm({ ...form, producto_id: String(data.producto.id) });
      setMostrarNuevo(false);
      setMostrarUnidades(false);
      setNuevoProducto({ nombre: "", sku: "", unidad: "pieza" });
      setTipoUnidad("conteo");
    }
  };

  const handleSubmit = async () => {
    if (!form.producto_id || !form.cantidad || !form.fecha_caducidad) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setExito(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } else {
      const d = await res.json();
      setError(d.error || "Error al guardar");
    }
  };

  const hoy = new Date().toISOString().split("T")[0];

  if (exito) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-gray-700 font-medium">¡Lote registrado!</p>
          <p className="text-gray-400 text-sm mt-1">Redirigiendo al tablero...</p>
        </div>
      </div>
    );
  }

  const unidadesActivas = tipoUnidad === "conteo" ? UNIDADES_CONTEO : UNIDADES_MEDIDA;

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
              <select
                value={form.producto_id}
                onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">— Selecciona un producto —</option>
                {productos.map((p) => {
                  const u = TODAS_UNIDADES.find(u => u.valor === p.unidad);
                  return (
                    <option key={p.id} value={p.id}>
                      {u?.icono} {p.nombre} {p.sku ? `(${p.sku})` : ""} · {u?.label || p.unidad}
                    </option>
                  );
                })}
              </select>

              {/* Badge de unidad del producto seleccionado */}
              {productoActual && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
                  <span className="text-lg">{unidadActual?.icono}</span>
                  <div>
                    <p className="text-xs text-gray-400">Se mide en</p>
                    <p className="text-sm font-medium text-gray-700">{unidadActual?.label || productoActual.unidad}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setMostrarNuevo(true)}
                className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4"
              >
                + Agregar producto nuevo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Nuevo producto</p>

              <input
                placeholder="Nombre del producto *"
                value={nuevoProducto.nombre}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />

              <input
                placeholder="SKU / Código de barras (opcional)"
                value={nuevoProducto.sku}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, sku: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />

              {/* Tipo de unidad */}
              <div>
                <p className="text-sm text-gray-600 mb-2">¿Cómo se mide este producto?</p>

                {/* Toggle conteo vs medida */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
                  <button
                    onClick={() => {
                      setTipoUnidad("conteo");
                      setNuevoProducto({ ...nuevoProducto, unidad: "pieza" });
                      setMostrarUnidades(false);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      tipoUnidad === "conteo" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    📦 Por cantidad
                  </button>
                  <button
                    onClick={() => {
                      setTipoUnidad("medida");
                      setNuevoProducto({ ...nuevoProducto, unidad: "kg" });
                      setMostrarUnidades(false);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      tipoUnidad === "medida" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    ⚖️ Por peso / volumen
                  </button>
                </div>

                {/* Botón selector de unidad */}
                <button
                  onClick={() => setMostrarUnidades(!mostrarUnidades)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{unidadInfo.icono}</span>
                    <span className="font-medium text-gray-900">{unidadInfo.label}</span>
                  </span>
                  <span className="text-gray-400 text-xs">{mostrarUnidades ? "▲ cerrar" : "▼ cambiar"}</span>
                </button>

                {/* Grid de opciones */}
                {mostrarUnidades && (
                  <div className={`mt-2 grid gap-2 ${tipoUnidad === "conteo" ? "grid-cols-4" : "grid-cols-3"}`}>
                    {unidadesActivas.map((u) => (
                      <button
                        key={u.valor}
                        onClick={() => {
                          setNuevoProducto({ ...nuevoProducto, unidad: u.valor });
                          setMostrarUnidades(false);
                        }}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                          nuevoProducto.unidad === u.valor
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 hover:border-gray-400 text-gray-700"
                        }`}
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
                  onClick={crearProducto}
                  className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800"
                >
                  Guardar producto
                </button>
                <button
                  onClick={() => { setMostrarNuevo(false); setMostrarUnidades(false); }}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Cantidad y fecha */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-medium text-gray-900 mb-4">2. Cantidad y caducidad</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {unidadActual
                  ? UNIDADES_MEDIDA.find(u => u.valor === unidadActual.valor)
                    ? `Cantidad en ${unidadActual.label.toLowerCase()}`
                    : `Número de ${unidadActual.label.toLowerCase()}`
                  : "Cantidad"}{" "}*
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ej: 12"
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 pr-20"
                />
                {productoActual && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                    {unidadActual?.icono} {productoActual.unidad}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de caducidad *</label>
              <input
                type="date"
                min={hoy}
                value={form.fecha_caducidad}
                onChange={(e) => setForm({ ...form, fecha_caducidad: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Paso 3: Notas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-medium text-gray-900 mb-1">3. Notas{" "}
            <span className="text-gray-400 font-normal text-sm">(opcional)</span>
          </h2>
          <p className="text-xs text-gray-400 mb-3">Proveedor, condiciones de almacenaje, observaciones...</p>
          <textarea
            rows={3}
            placeholder='Ej: "Lote recibido de Lácteos del Norte, mantener refrigerado"'
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-xl py-4 text-sm font-medium hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "Guardando..." : "✓ Registrar lote"}
        </button>
      </main>
    </div>
  );
}

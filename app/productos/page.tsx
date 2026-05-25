"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Producto = { id: number; nombre: string; sku: string; unidad: string };

const UNIDADES_CONTEO = [
  { valor: "pieza",   icono: "📦", label: "Piezas"    },
  { valor: "caja",    icono: "🗃️", label: "Cajas"     },
  { valor: "bolsa",   icono: "🛍️", label: "Bolsas"    },
  { valor: "lata",    icono: "🥫", label: "Latas"     },
  { valor: "paquete", icono: "📫", label: "Paquetes"  },
  { valor: "botella", icono: "🍶", label: "Botellas"  },
  { valor: "porcion", icono: "🍽️", label: "Porciones" },
  { valor: "docena",  icono: "🥚", label: "Docenas"   },
];

const UNIDADES_MEDIDA = [
  { valor: "kg",    icono: "⚖️", label: "Kilogramos" },
  { valor: "g",     icono: "⚖️", label: "Gramos"     },
  { valor: "litro", icono: "🧴", label: "Litros"     },
  { valor: "ml",    icono: "💧", label: "Mililitros" },
  { valor: "metro", icono: "📏", label: "Metros"     },
];

const TODAS_UNIDADES = [...UNIDADES_CONTEO, ...UNIDADES_MEDIDA];

type EditForm = { nombre: string; sku: string; unidad: string };

export default function ProductosPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ nombre: "", sku: "", unidad: "pieza" });
  const [tipoUnidad, setTipoUnidad] = useState<"conteo" | "medida">("conteo");
  const [mostrarUnidades, setMostrarUnidades] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);

  const cargar = () => {
    fetch("/api/productos")
      .then((r) => { if (r.status === 401) router.push("/login"); return r.json(); })
      .then((d) => { setProductos(d.productos || []); setLoading(false); });
  };

  useEffect(() => { cargar(); }, []);

  const abrirEdicion = (p: Producto) => {
    setEditandoId(p.id);
    setEditForm({ nombre: p.nombre, sku: p.sku || "", unidad: p.unidad });
    setTipoUnidad(UNIDADES_MEDIDA.find(u => u.valor === p.unidad) ? "medida" : "conteo");
    setMostrarUnidades(false);
    setErrorMsg("");
  };

  const guardar = async () => {
    if (!editForm.nombre.trim()) { setErrorMsg("El nombre no puede estar vacío."); return; }
    setGuardando(true);
    const res = await fetch(`/api/productos/${editandoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setGuardando(false);
    if (res.ok) {
      setEditandoId(null);
      cargar();
    } else {
      const d = await res.json();
      setErrorMsg(d.error || "Error al guardar");
    }
  };

  const eliminar = async (id: number) => {
    const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProductos(productos.filter(p => p.id !== id));
      setConfirmEliminar(null);
    } else {
      const d = await res.json();
      setErrorMsg(d.error || "Error al eliminar");
      setConfirmEliminar(null);
    }
  };

  const unidadInfo = TODAS_UNIDADES.find(u => u.valor === editForm.unidad) || UNIDADES_CONTEO[0];
  const unidadesActivas = tipoUnidad === "conteo" ? UNIDADES_CONTEO : UNIDADES_MEDIDA;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Volver</Link>
            <h1 className="font-semibold text-gray-900">Mis productos</h1>
          </div>
          <Link href="/ingreso" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800">
            + Registrar lote
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">

        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
            {errorMsg}
            <button onClick={() => setErrorMsg("")} className="ml-3 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando productos...</div>
        ) : productos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🗂️</div>
            <p className="text-gray-500 text-sm">No hay productos todavía.</p>
            <Link href="/ingreso" className="inline-block mt-3 text-sm text-gray-900 underline underline-offset-4">
              Registrar el primero →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {productos.map((p) => {
              const u = TODAS_UNIDADES.find(u => u.valor === p.unidad);
              const estaEditando = editandoId === p.id;
              const estaConfirmando = confirmEliminar === p.id;

              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Vista normal */}
                  {!estaEditando && !estaConfirmando && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="text-2xl w-10 text-center flex-shrink-0">{u?.icono || "📦"}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u?.label || p.unidad}
                          {p.sku && <span className="ml-2 font-mono">· {p.sku}</span>}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => abrirEdicion(p)}
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => { setConfirmEliminar(p.id); setErrorMsg(""); }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmación eliminar */}
                  {estaConfirmando && (
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-900 mb-1">¿Eliminar "{p.nombre}"?</p>
                      <p className="text-xs text-gray-400 mb-4">Solo se puede eliminar si no tiene lotes activos.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => eliminar(p.id)}
                          className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setConfirmEliminar(null)}
                          className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modo edición */}
                  {estaEditando && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-700">Editando producto</p>
                        <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ cancelar</button>
                      </div>

                      <input
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                        placeholder="Nombre del producto"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                      />

                      <input
                        value={editForm.sku}
                        onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                        placeholder="SKU / Código (opcional)"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                      />

                      {/* Toggle tipo unidad */}
                      <div className="flex bg-gray-100 rounded-xl p-1">
                        <button
                          onClick={() => { setTipoUnidad("conteo"); setEditForm({ ...editForm, unidad: "pieza" }); setMostrarUnidades(false); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoUnidad === "conteo" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                        >
                          📦 Por cantidad
                        </button>
                        <button
                          onClick={() => { setTipoUnidad("medida"); setEditForm({ ...editForm, unidad: "kg" }); setMostrarUnidades(false); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoUnidad === "medida" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                        >
                          ⚖️ Por peso/volumen
                        </button>
                      </div>

                      {/* Selector de unidad */}
                      <button
                        onClick={() => setMostrarUnidades(!mostrarUnidades)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between hover:border-gray-400"
                      >
                        <span className="flex items-center gap-2">
                          <span>{unidadInfo.icono}</span>
                          <span className="font-medium text-gray-900">{unidadInfo.label}</span>
                        </span>
                        <span className="text-gray-400 text-xs">{mostrarUnidades ? "▲" : "▼"}</span>
                      </button>

                      {mostrarUnidades && (
                        <div className={`grid gap-2 ${tipoUnidad === "conteo" ? "grid-cols-4" : "grid-cols-3"}`}>
                          {unidadesActivas.map((u) => (
                            <button
                              key={u.valor}
                              onClick={() => { setEditForm({ ...editForm, unidad: u.valor }); setMostrarUnidades(false); }}
                              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                                editForm.unidad === u.valor
                                  ? "border-gray-900 bg-gray-900 text-white"
                                  : "border-gray-200 hover:border-gray-400 text-gray-700"
                              }`}
                            >
                              <span className="text-lg">{u.icono}</span>
                              <span className="text-xs font-medium leading-tight">{u.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

                      <button
                        onClick={guardar}
                        disabled={guardando}
                        className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                      >
                        {guardando ? "Guardando..." : "✓ Guardar cambios"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

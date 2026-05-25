"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lote = {
  id: number;
  producto: string;
  sku: string;
  unidad: string;
  cantidad: number;
  cantidad_inicial: number;
  fecha_caducidad: string;
  dias_para_vencer: number;
  semaforo: "rojo" | "amarillo" | "verde";
  notas: string;
};

type LoteEditando = {
  id: number;
  cantidad: string;
  fecha_caducidad: string;
  notas: string;
};

const SEMAFORO = {
  rojo:     { bg: "bg-red-50",    badge: "bg-red-100 text-red-700",    dot: "bg-red-500",    label: "Urgente" },
  amarillo: { bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "Próximo" },
  verde:    { bg: "bg-green-50",  badge: "bg-green-100 text-green-700", dot: "bg-green-500", label: "OK" },
};

export default function Dashboard() {
  const router = useRouter();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "rojo" | "amarillo" | "verde">("todos");
  const [editando, setEditando] = useState<LoteEditando | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargarLotes = () => {
    fetch("/api/lotes")
      .then((r) => { if (r.status === 401) router.push("/login"); return r.json(); })
      .then((d) => { setLotes(d.lotes || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargarLotes(); }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const abrirEdicion = (lote: Lote) => {
    setEditando({
      id: lote.id,
      cantidad: String(lote.cantidad),
      fecha_caducidad: lote.fecha_caducidad.split("T")[0],
      notas: lote.notas || "",
    });
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    await fetch(`/api/lotes/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cantidad: Number(editando.cantidad),
        fecha_caducidad: editando.fecha_caducidad,
        notas: editando.notas,
      }),
    });
    setGuardando(false);
    setEditando(null);
    cargarLotes();
  };

  const eliminarLote = async (id: number) => {
    setEliminando(id);
    await fetch(`/api/lotes/${id}`, { method: "DELETE" });
    setEliminando(null);
    setLotes(lotes.filter(l => l.id !== id));
  };

  const lotesFiltrados = filtro === "todos" ? lotes : lotes.filter((l) => l.semaforo === filtro);
  const cuenta = {
    rojo: lotes.filter((l) => l.semaforo === "rojo").length,
    amarillo: lotes.filter((l) => l.semaforo === "amarillo").length,
    verde: lotes.filter((l) => l.semaforo === "verde").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <span className="font-semibold text-gray-900">MermaAlert</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/productos"
              className="text-gray-500 hover:text-gray-900 text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              🗂️ Productos
            </Link>
            <Link
              href="/ingreso"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
            >
              + Lote
            </Link>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600 text-sm">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Resumen semáforo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["rojo", "amarillo", "verde"] as const).map((color) => {
            const s = SEMAFORO[color];
            const labels = { rojo: "Urgentes", amarillo: "Próximos", verde: "Seguros" };
            return (
              <button
                key={color}
                onClick={() => setFiltro(filtro === color ? "todos" : color)}
                className={`rounded-2xl p-4 text-left border transition-all ${
                  filtro === color ? "border-gray-900 shadow-sm" : "border-transparent"
                } ${s.bg}`}
              >
                <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full mb-2 ${s.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                  {s.label}
                </div>
                <div className="text-2xl font-semibold text-gray-900">{cuenta[color]}</div>
                <div className="text-xs text-gray-500">{labels[color]}</div>
              </button>
            );
          })}
        </div>

        {/* Lista de lotes */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Cargando lotes...</div>
          ) : lotesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-gray-500 text-sm">
                {lotes.length === 0 ? "Aún no hay lotes registrados." : "No hay lotes en esta categoría."}
              </p>
              {lotes.length === 0 && (
                <Link href="/ingreso" className="inline-block mt-3 text-sm text-gray-900 underline underline-offset-4">
                  Registrar el primero →
                </Link>
              )}
            </div>
          ) : (
            lotesFiltrados.map((lote) => {
              const s = SEMAFORO[lote.semaforo];
              const porcentaje = Math.round((lote.cantidad / lote.cantidad_inicial) * 100);
              const estaEditando = editando?.id === lote.id;
              const estaEliminando = eliminando === lote.id;

              return (
                <div key={lote.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all ${estaEliminando ? "opacity-50 scale-95" : ""}`}>

                  {/* Modo normal */}
                  {!estaEditando && (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                              {lote.dias_para_vencer <= 0
                                ? "Vencido"
                                : lote.dias_para_vencer === 1
                                ? "Vence mañana"
                                : `${lote.dias_para_vencer} días`}
                            </span>
                            {lote.sku && <span className="text-xs text-gray-400 font-mono">{lote.sku}</span>}
                          </div>
                          <h3 className="font-medium text-gray-900 truncate">{lote.producto}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {lote.cantidad} {lote.unidad}{lote.cantidad !== 1 ? "s" : ""} restantes
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">
                            {new Date(lote.fecha_caducidad).toLocaleDateString("es-MX", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{porcentaje}% restante</p>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="mt-3 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            lote.semaforo === "rojo" ? "bg-red-500"
                            : lote.semaforo === "amarillo" ? "bg-amber-400"
                            : "bg-green-500"
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>

                      {lote.notas && (
                        <p className="text-xs text-gray-400 mt-2 italic">"{lote.notas}"</p>
                      )}

                      {/* Botones editar / eliminar */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => abrirEdicion(lote)}
                          className="flex-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1"
                        >
                          ✏️ Editar
                        </button>
                        <div className="w-px bg-gray-100"></div>
                        <button
                          onClick={() => eliminarLote(lote.id)}
                          disabled={estaEliminando}
                          className="flex-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modo edición */}
                  {estaEditando && editando && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900">{lote.producto}</h3>
                        <span className="text-xs text-gray-400">Editando</span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Cantidad ({lote.unidad})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editando.cantidad}
                            onChange={(e) => setEditando({ ...editando, cantidad: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fecha de caducidad</label>
                          <input
                            type="date"
                            value={editando.fecha_caducidad}
                            onChange={(e) => setEditando({ ...editando, fecha_caducidad: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Notas (opcional)</label>
                          <input
                            type="text"
                            value={editando.notas}
                            onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                            placeholder="Notas del lote..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={guardarEdicion}
                            disabled={guardando}
                            className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                          >
                            {guardando ? "Guardando..." : "✓ Guardar cambios"}
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

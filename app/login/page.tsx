"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [form, setForm] = useState({ nombre: "", email: "", password: "", whatsapp: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const url = modo === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Error"); return; }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🛡️</div>
          <h1 className="text-2xl font-semibold text-gray-900">MermaAlert</h1>
          <p className="text-gray-500 text-sm mt-1">Control de caducidades sin esfuerzo</p>
        </div>

        {/* Toggle login / registro */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(["login", "registro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              {m === "login" ? "Iniciar sesión" : "Registrar negocio"}
            </button>
          ))}
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          {modo === "registro" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del negocio
              </label>
              <input
                type="text"
                placeholder="Ej: Pastelería El Sol"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="admin@negocio.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {modo === "registro" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp para alertas{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                placeholder="+52 449 123 4567"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 mt-2"
          >
            {loading ? "Cargando..." : modo === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

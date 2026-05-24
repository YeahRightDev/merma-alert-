import type { Metadata } from "next";
import "./globals.css";
import { runMigrations } from "@/lib/migrate";

// Crea las tablas automáticamente si no existen
runMigrations();

export const metadata: Metadata = {
  title: "MermaAlert — Control de caducidades",
  description: "Sistema de alertas de caducidad e inventario para negocios de alimentos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

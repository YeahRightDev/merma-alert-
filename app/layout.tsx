import type { Metadata } from "next";
import "./globals.css";

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

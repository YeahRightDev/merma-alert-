import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/migrate";

export async function GET() {
  try {
    await runMigrations();
    return NextResponse.json({ ok: true, mensaje: "✅ Tablas listas (v2 con dinero)" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

function getNegocioId(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token)?.id ?? null;
}

// GET /api/productos
export async function GET(req: NextRequest) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { rows } = await pool.query(
    "SELECT * FROM productos WHERE negocio_id = $1 ORDER BY nombre ASC",
    [negocioId]
  );
  return NextResponse.json({ productos: rows });
}

// POST /api/productos
export async function POST(req: NextRequest) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { nombre, sku, unidad } = await req.json();
  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { rows } = await pool.query(
    `INSERT INTO productos (negocio_id, nombre, sku, unidad)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [negocioId, nombre, sku ?? null, unidad ?? "pieza"]
  );
  return NextResponse.json({ producto: rows[0] }, { status: 201 });
}

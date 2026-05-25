import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

function getNegoioId(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.id ?? null;
}

// GET /api/lotes — Todos los lotes activos del negocio (para el tablero)
export async function GET(req: NextRequest) {
  const negocioId = getNegoioId(req);
  if (!negocioId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT * FROM vista_lotes WHERE negocio_id = $1`,
    [negocioId]
  );

  return NextResponse.json({ lotes: rows });
}

// POST /api/lotes — Registrar un nuevo lote
export async function POST(req: NextRequest) {
  const negocioId = getNegoioId(req);
  if (!negocioId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { producto_id, cantidad, fecha_caducidad, notas } = body;

  if (!producto_id || !cantidad || !fecha_caducidad) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO lotes (negocio_id, producto_id, cantidad, cantidad_inicial, fecha_caducidad, notas)
     VALUES ($1, $2, $3, $3, $4, $5)
     RETURNING *`,
    [negocioId, producto_id, cantidad, fecha_caducidad, notas ?? null]
  );

  return NextResponse.json({ lote: rows[0] }, { status: 201 });
}

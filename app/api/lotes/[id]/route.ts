import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

function getNegocioId(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token)?.id ?? null;
}

// PATCH /api/lotes/[id] — Editar un lote
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { cantidad, fecha_caducidad, notas } = body;

  const { rows } = await pool.query(
    `UPDATE lotes 
     SET cantidad = $1, fecha_caducidad = $2, notas = $3
     WHERE id = $4 AND negocio_id = $5
     RETURNING *`,
    [cantidad, fecha_caducidad, notas ?? null, id, negocioId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ lote: rows[0] });
}

// DELETE /api/lotes/[id] — Eliminar un lote
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const { rowCount } = await pool.query(
    `DELETE FROM lotes WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

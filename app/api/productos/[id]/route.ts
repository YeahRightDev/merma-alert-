import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

function getNegocioId(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token)?.id ?? null;
}

// PATCH /api/productos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { nombre, sku, unidad } = await req.json();

  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { rows } = await pool.query(
    `UPDATE productos SET nombre = $1, sku = $2, unidad = $3
     WHERE id = $4 AND negocio_id = $5 RETURNING *`,
    [nombre, sku ?? null, unidad, id, negocioId]
  );

  if (rows.length === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ producto: rows[0] });
}

// DELETE /api/productos/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const negocioId = getNegocioId(req);
  if (!negocioId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  // Verificar si tiene lotes activos
  const { rows: lotes } = await pool.query(
    `SELECT COUNT(*) as total FROM lotes WHERE producto_id = $1 AND activo = TRUE AND cantidad > 0`,
    [id]
  );

  if (parseInt(lotes[0].total) > 0) {
    return NextResponse.json(
      { error: "Este producto tiene lotes activos. Elimina sus lotes primero." },
      { status: 409 }
    );
  }

  const { rowCount } = await pool.query(
    `DELETE FROM productos WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId]
  );

  if (rowCount === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

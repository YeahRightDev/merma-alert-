import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { nombre, email, password, whatsapp } = await req.json();

  if (!nombre || !email || !password) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  // Verificar que el email no exista
  const exists = await pool.query("SELECT id FROM negocios WHERE email = $1", [email]);
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
  }

  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO negocios (nombre, email, password, whatsapp)
     VALUES ($1, $2, $3, $4) RETURNING id, email, nombre`,
    [nombre, email, hash, whatsapp ?? null]
  );

  const negocio = rows[0];
  const token = signToken({ id: negocio.id, email: negocio.email });

  const res = NextResponse.json({ negocio }, { status: 201 });
  res.cookies.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
  return res;
}

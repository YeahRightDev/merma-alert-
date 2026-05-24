import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const { rows } = await pool.query(
    "SELECT id, email, nombre, password FROM negocios WHERE email = $1",
    [email]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const negocio = rows[0];
  const valid = await verifyPassword(password, negocio.password);
  if (!valid) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = signToken({ id: negocio.id, email: negocio.email });
  const res = NextResponse.json({
    negocio: { id: negocio.id, email: negocio.email, nombre: negocio.nombre },
  });
  res.cookies.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
  return res;
}

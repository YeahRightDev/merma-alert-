import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ean: string }> }
) {
  const { ean } = await params;

  if (!ean || ean.length < 4) {
    return NextResponse.json({ encontrado: false });
  }

  // 1. Open Food Facts — 3M+ productos de alimentos globales
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${ean}.json`,
      {
        headers: { "User-Agent": "MermaAlert/1.0 (contacto@mermaalert.app)" },
        next: { revalidate: 86400 }, // Cache 24h
      }
    );
    const data = await res.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const nombre =
        p.product_name_es ||   // Español
        p.product_name ||      // Idioma principal
        p.abbreviated_product_name ||
        p.generic_name_es ||
        p.generic_name;

      const marca = p.brands?.split(",")[0]?.trim();

      if (nombre) {
        return NextResponse.json({
          encontrado: true,
          fuente: "openfoodfacts",
          ean,
          nombre: nombre.trim(),
          marca: marca || null,
          categoria: p.categories_tags?.[0]?.replace("en:", "") || null,
          imagen: p.image_small_url || p.image_url || null,
          pais: p.countries_tags?.[0]?.replace("en:", "") || null,
        });
      }
    }
  } catch {
    // Open Food Facts no disponible, intentar siguiente fuente
  }

  // 2. Open Beauty Facts — cosméticos y cuidado personal
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v0/product/${ean}.json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const nombre = p.product_name_es || p.product_name;
      if (nombre) {
        return NextResponse.json({
          encontrado: true,
          fuente: "openbeautyfacts",
          ean,
          nombre: nombre.trim(),
          marca: p.brands?.split(",")[0]?.trim() || null,
          categoria: "cosméticos",
          imagen: p.image_small_url || null,
          pais: null,
        });
      }
    }
  } catch {}

  // 3. Open Pet Food Facts — alimentos para mascotas
  try {
    const res = await fetch(
      `https://world.openpetfoodfacts.org/api/v0/product/${ean}.json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const nombre = p.product_name_es || p.product_name;
      if (nombre) {
        return NextResponse.json({
          encontrado: true,
          fuente: "openpetfoodfacts",
          ean,
          nombre: nombre.trim(),
          marca: p.brands?.split(",")[0]?.trim() || null,
          categoria: "mascotas",
          imagen: p.image_small_url || null,
          pais: null,
        });
      }
    }
  } catch {}

  // 4. UPC Item DB — base de datos general de productos
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    if (data.code === "OK" && data.items?.length > 0) {
      const item = data.items[0];
      return NextResponse.json({
        encontrado: true,
        fuente: "upcitemdb",
        ean,
        nombre: item.title,
        marca: item.brand || null,
        categoria: item.category || null,
        imagen: item.images?.[0] || null,
        pais: null,
      });
    }
  } catch {}

  // No encontrado en ninguna fuente
  return NextResponse.json({ encontrado: false, ean });
}

import crypto from "node:crypto";

import { exigirAdmin } from "../../lib/auth.js";
import {
  leerCategorias,
  guardarCategorias,
  categoriasExisten,
  leerProductos,
} from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

// GET /api/categorias -> { categorias: [...] } (público)
// POST /api/categorias -> agrega { nombre } (admin)
// DELETE /api/categorias?id=... -> elimina (admin)
export default async (req) => {
  let categorias = await leerCategorias();

  // Primera vez: se importan las categorías ya usadas en los productos.
  if (!(await categoriasExisten())) {
    const productos = await leerProductos();
    const nombres = [...new Set(productos.map((p) => (p.categoria || "").trim()).filter(Boolean))];
    categorias = nombres.map((nombre) => ({ id: crypto.randomUUID(), nombre }));
    await guardarCategorias(categorias);
  }

  if (req.method === "GET") {
    return json({ categorias });
  }

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  if (req.method === "POST") {
    const data = await req.json().catch(() => ({}));
    const nombre = (data.nombre ?? "").trim();
    if (!nombre) return json({ error: "El nombre de la categoría es obligatorio" }, 400);
    if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      return json({ error: "Esa categoría ya existe" }, 400);
    }
    const categoria = { id: crypto.randomUUID(), nombre };
    await guardarCategorias([...categorias, categoria]);
    return json({ ok: true, categoria }, 201);
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "Falta el id de la categoría" }, 400);
    await guardarCategorias(categorias.filter((c) => c.id !== id));
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/categorias",
  method: ["GET", "POST", "DELETE"],
};

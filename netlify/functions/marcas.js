import crypto from "node:crypto";

import { exigirAdmin } from "../../lib/auth.js";
import { leerMarcas, guardarMarcas } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

// Lista global de marcas.
// GET    /api/marcas        -> { marcas: [...] } (público)
// POST   /api/marcas        -> agrega { nombre } (admin)
// DELETE /api/marcas?id=... -> elimina (admin)
export default async (req) => {
  const marcas = await leerMarcas();

  if (req.method === "GET") {
    return json({ marcas });
  }

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  if (req.method === "POST") {
    const data = await req.json().catch(() => ({}));
    const nombre = (data.nombre ?? "").trim();
    if (!nombre) return json({ error: "El nombre de la marca es obligatorio" }, 400);
    if (marcas.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
      return json({ error: "Esa marca ya existe" }, 400);
    }
    const marca = { id: crypto.randomUUID(), nombre };
    await guardarMarcas([...marcas, marca]);
    return json({ ok: true, marca }, 201);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Falta el id de la marca" }, 400);
    await guardarMarcas(marcas.filter((m) => m.id !== id));
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/marcas",
  method: ["GET", "POST", "DELETE"],
};

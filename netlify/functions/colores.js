import crypto from "node:crypto";

import { exigirAdmin } from "../../lib/auth.js";
import { leerColores, guardarColores } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

// Palet global de colores. Arranca con blanco y negro.
const COLORES_DEFAULT = [
  { id: "blanco", nombre: "Blanco", hex: "#FFFFFF" },
  { id: "negro", nombre: "Negro", hex: "#000000" },
];

const RE_HEX = /^#[0-9a-fA-F]{6}$/;

// GET /api/colores -> { colores: [...] } (público para la ficha de producto)
// POST /api/colores -> agrega { nombre, hex } (admin)
// DELETE /api/colores?id=... -> elimina (admin)
export default async (req) => {
  const colores = await leerColores();
  const lista = colores.length ? colores : COLORES_DEFAULT;

  if (req.method === "GET") {
    if (!colores.length) await guardarColores(COLORES_DEFAULT);
    return json({ colores: lista });
  }

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  if (req.method === "POST") {
    const data = await req.json().catch(() => ({}));
    const nombre = (data.nombre ?? "").trim();
    const hex = (data.hex ?? "").trim();
    if (!nombre) return json({ error: "El nombre del color es obligatorio" }, 400);
    if (!RE_HEX.test(hex)) return json({ error: "El color debe ser un hex válido (#RRGGBB)" }, 400);
    if (lista.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) {
      return json({ error: "Ese color ya existe en el palet" }, 400);
    }
    const color = { id: crypto.randomUUID(), nombre, hex };
    await guardarColores([...lista, color]);
    return json({ ok: true, color }, 201);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Falta el id del color" }, 400);
    await guardarColores(lista.filter((c) => c.id !== id));
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/colores",
  method: ["GET", "POST", "DELETE"],
};
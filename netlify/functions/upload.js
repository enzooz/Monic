import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

import { exigirAdmin } from "../../lib/auth.js";
import { json } from "../../lib/responder.js";

const EXT_PERMITIDAS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB (límite de payload binario de Netlify ~4.5MB)

export default async (req) => {
  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  const form = await req.formData().catch(() => null);
  const archivo = form?.get("imagen");
  if (!archivo?.name) return json({ error: "No se envió ninguna imagen" }, 400);

  const ext = (archivo.name.split(".").pop() || "").toLowerCase();
  if (!EXT_PERMITIDAS.includes(ext)) {
    return json({ error: "Formato de imagen no permitido" }, 400);
  }
  if (archivo.size > MAX_BYTES) {
    return json({ error: "La imagen supera el tamaño máximo de 4MB" }, 400);
  }

  const nombre = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const imagenes = getStore({ name: "imagenes", consistency: "strong" });
  await imagenes.set(nombre, buffer);

  return json({ ok: true, imagen: nombre }, 201);
};

export const config = {
  path: "/api/upload",
  method: ["POST"],
};
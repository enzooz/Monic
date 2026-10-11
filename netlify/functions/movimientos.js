import { exigirAdmin } from "../../lib/auth.js";
import { leerMovimientos } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

// Historial de movimientos de stock (solo admin).
// Filtros opcionales: ?producto_id=... &tipo=... &limite=...
export default async (req) => {
  if (req.method !== "GET") return json({ error: "Método no permitido" }, 405);

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  const url = new URL(req.url);
  const productoId = url.searchParams.get("producto_id");
  const tipo = url.searchParams.get("tipo");
  const limite = Math.min(500, Math.max(1, Number(url.searchParams.get("limite")) || 200));

  let movimientos = await leerMovimientos();
  if (productoId) movimientos = movimientos.filter((m) => String(m.producto_id) === String(productoId));
  if (tipo) movimientos = movimientos.filter((m) => m.tipo === tipo);

  movimientos = movimientos.slice(-limite).reverse();
  return json({ movimientos });
};

export const config = {
  path: "/api/movimientos",
  method: ["GET"],
};

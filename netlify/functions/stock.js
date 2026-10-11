import { exigirAdmin } from "../../lib/auth.js";
import {
  leerProductos,
  guardarProductos,
  agregarMovimientos,
  stockDe,
} from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

// Ajuste manual de stock (admin).
// Body: { producto_id, talle, delta? , nuevo?, motivo?, tipo? }
//   - delta: suma/resta (reposición o merma).
//   - nuevo: fija el stock a un valor absoluto (ajuste de inventario).
//   - tipo: reposicion | ajuste | merma | devolucion  (default: ajuste)
const TIPOS = ["reposicion", "ajuste", "merma", "devolucion"];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  const data = await req.json().catch(() => ({}));
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === Number(data.producto_id));
  if (!producto) return json({ error: "Producto no encontrado" }, 404);

  const talles = producto.talles || [];
  const talle = (data.talle ?? "").trim();
  if (talles.length) {
    if (!talle || !talles.includes(talle)) {
      return json({ error: "Elegí un talle válido" }, 400);
    }
  } else if (talle) {
    return json({ error: "Este producto no maneja talles" }, 400);
  }
  const clave = talles.length ? talle : "";

  const actual = stockDe(producto, clave);
  let nuevo;
  if (data.nuevo !== undefined && data.nuevo !== null && data.nuevo !== "") {
    nuevo = Math.max(0, Math.floor(Number(data.nuevo)) || 0);
  } else {
    const delta = Math.trunc(Number(data.delta));
    if (!Number.isFinite(delta)) return json({ error: "Cantidad inválida" }, 400);
    nuevo = Math.max(0, actual + delta);
  }
  const deltaFinal = nuevo - actual;

  if (deltaFinal === 0) {
    return json({ ok: true, producto, sinCambios: true });
  }

  const tipo = TIPOS.includes(data.tipo) ? data.tipo : "ajuste";
  producto.stock[clave] = nuevo;
  await guardarProductos(productos);
  await agregarMovimientos([
    {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      talle: clave,
      tipo,
      motivo: (data.motivo ?? "").trim(),
      delta: deltaFinal,
      stock_resultante: nuevo,
    },
  ]);

  return json({ ok: true, producto });
};

export const config = {
  path: "/api/stock",
  method: ["POST"],
};

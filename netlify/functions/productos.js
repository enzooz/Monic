import { exigirAdmin } from "../../lib/auth.js";
import {
  leerProductos,
  guardarProductos,
  agregarMovimientos,
  normalizarStock,
} from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  if (req.method === "GET") {
    return json({ productos: await leerProductos() });
  }

  if (req.method === "POST") {
    const noAutorizado = await exigirAdmin(req);
    if (noAutorizado) return noAutorizado;

    const data = await req.json().catch(() => ({}));
    const nombre = (data.nombre ?? "").trim();
    if (!nombre) return json({ error: "El nombre es obligatorio" }, 400);

    const productos = await leerProductos();
    const nuevoId = productos.reduce((mayor, p) => Math.max(mayor, p.id || 0), 0) + 1;
    const talles = Array.isArray(data.talles) ? data.talles.filter(Boolean) : [];
    const marca = (data.marca ?? "").trim();
    const codigo = (data.codigo ?? "").trim() || "NOM0000";
    const repetido = productos.some(
      (p) => (p.codigo || "").trim().toLowerCase() === codigo.toLowerCase()
    );
    if (repetido) return json({ error: `La clave '${codigo}' ya está en uso` }, 400);
    const producto = {
      id: nuevoId,
      nombre,
      categoria: (data.categoria ?? "").trim(),
      marca,
      codigo,
      precio: Number(data.precio) || 0,
      talles,
      colores: Array.isArray(data.colores) ? data.colores.filter(Boolean) : [],
      stock: normalizarStock(data.stock, talles),
      imagenes: Array.isArray(data.imagenes) ? data.imagenes.filter(Boolean) : [],
      descripcion: (data.descripcion ?? "").trim(),
    };
    productos.push(producto);
    await guardarProductos(productos);

    const movimientos = Object.entries(producto.stock)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([talle, cantidad]) => ({
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        talle,
        tipo: "alta",
        motivo: "Alta de producto",
        delta: cantidad,
        stock_resultante: cantidad,
      }));
    if (movimientos.length) await agregarMovimientos(movimientos);

    return json({ ok: true, producto }, 201);
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/productos",
  method: ["GET", "POST"],
};

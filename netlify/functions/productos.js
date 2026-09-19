import { exigirAdmin } from "../../lib/auth.js";
import { leerProductos, guardarProductos } from "../../lib/datos.js";
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
    const producto = {
      id: nuevoId,
      nombre,
      categoria: (data.categoria ?? "").trim(),
      precio: Number(data.precio) || 0,
      talles: Array.isArray(data.talles) ? data.talles.filter(Boolean) : [],
      colores: Array.isArray(data.colores) ? data.colores.filter(Boolean) : [],
      stock: Number(data.stock) || 0,
      imagenes: Array.isArray(data.imagenes) ? data.imagenes.filter(Boolean) : [],
      descripcion: (data.descripcion ?? "").trim(),
    };
    productos.push(producto);
    await guardarProductos(productos);
    return json({ ok: true, producto }, 201);
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/productos",
  method: ["GET", "POST"],
};
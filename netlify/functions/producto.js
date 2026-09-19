import { exigirAdmin } from "../../lib/auth.js";
import { leerProductos, guardarProductos } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  const url = new URL(req.url);
  // Netlify dev resuelve distintas variantes de una misma URL al buscar
  // archivos estáticos ('/7.html', '/7.htm', '/7/index.html'). Tomamos el
  // primer segmento numérico después de 'productos' para obtener el id.
  const partes = url.pathname.split("/").filter(Boolean);
  const idx = partes.indexOf("productos") + 1;
  const segmento = idx > 0 ? partes[idx] : "";
  const base = segmento.replace(/\.[a-z]+$/i, "");
  const id = Number(base);
  if (!segmento || !Number.isInteger(id) || String(id) !== base) {
    return json({ error: "ID inválido" }, 400);
  }

  // Detalle de producto: lectura pública (la usa la ficha /producto/:id)
  const productos = await leerProductos();
  const producto = productos.find((p) => p.id === id);
  if (req.method === "GET") {
    if (!producto) return json({ error: "Producto no encontrado" }, 404);
    return json({ producto });
  }

  if (!producto) return json({ error: "Producto no encontrado" }, 404);

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  if (req.method === "PUT") {
    const data = await req.json().catch(() => ({}));
    const aplicar = (clave, valor) => {
      if (clave === "talles") producto.talles = Array.isArray(valor) ? valor.filter(Boolean) : [];
      else if (clave === "colores") producto.colores = Array.isArray(valor) ? valor.filter(Boolean) : [];
      else if (clave === "imagenes") producto.imagenes = Array.isArray(valor) ? valor.filter(Boolean) : [];
      else if (clave === "precio") producto.precio = Number(valor) || 0;
      else if (clave === "stock") producto.stock = Number(valor) || 0;
      else producto[clave] = String(valor ?? "").trim();
    };
    ["nombre", "categoria", "precio", "stock", "talles", "colores", "imagenes", "descripcion"].forEach(
      (campo) => {
        if (campo in data) aplicar(campo, data[campo]);
      }
    );

    await guardarProductos(productos);
    return json({ ok: true, producto });
  }

  if (req.method === "DELETE") {
    const nuevos = productos.filter((p) => p.id !== id);
    await guardarProductos(nuevos);
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/productos/*",
  method: ["GET", "PUT", "DELETE"],
};
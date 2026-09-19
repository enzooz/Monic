import { exigirAdmin } from "../../lib/auth.js";
import { leerProductos, guardarProductos } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  const url = new URL(req.url);
  const id = Number(url.pathname.split("/").pop());
  if (!Number.isInteger(id)) return json({ error: "ID inválido" }, 400);

  const noAutorizado = await exigirAdmin(req);
  if (noAutorizado) return noAutorizado;

  const productos = await leerProductos();

  if (req.method === "PUT") {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return json({ error: "Producto no encontrado" }, 404);

    const data = await req.json().catch(() => ({}));
    const aplicar = (clave, valor) => {
      if (clave === "talles") producto.talles = Array.isArray(valor) ? valor : [];
      else if (clave === "precio") producto.precio = Number(valor) || 0;
      else if (clave === "stock") producto.stock = Number(valor) || 0;
      else producto[clave] = String(valor ?? "").trim();
    };
    ["nombre", "categoria", "precio", "stock", "talles", "imagen", "descripcion"].forEach(
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
  method: ["PUT", "DELETE"],
};
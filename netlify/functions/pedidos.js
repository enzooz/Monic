import { exigirAdmin } from "../../lib/auth.js";
import {
  leerProductos,
  guardarProductos,
  leerPedidos,
  guardarPedidos,
  validarCliente,
  esHoneypot,
  fechaLocalAR,
} from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  // Registrar pedido (público, con anti-spam)
  if (req.method === "POST") {
    const data = await req.json().catch(() => ({}));
    if (esHoneypot(data)) return json({ error: "Pedido rechazado" }, 429);

    const cliente = data.cliente ?? {};
    const items = Array.isArray(data.items) ? data.items : [];

    const nombre = (cliente.nombre ?? "").trim();
    const telefono = (cliente.telefono ?? "").trim();
    const dni = (cliente.dni ?? "").trim();

    const errorCliente = validarCliente({ nombre, telefono, dni });
    if (errorCliente) return json({ error: errorCliente }, 400);
    if (items.length === 0) return json({ error: "El pedido está vacío" }, 400);

    const productos = await leerProductos();
    const itemsValidos = [];
    let total = 0;

    for (const item of items) {
      const producto = productos.find((p) => p.id === Number(item?.producto_id));
      if (!producto) return json({ error: "Producto no encontrado" }, 400);

      const cantidad = Math.floor(Number(item?.cantidad)) || 0;
      if (cantidad <= 0) return json({ error: "Cantidad inválida" }, 400);
      if (cantidad > producto.stock) {
        return json(
          {
            error: `Stock insuficiente de '${producto.nombre}' (disponible: ${producto.stock})`,
          },
          400
        );
      }

      itemsValidos.push({
        producto_id: producto.id,
        nombre: producto.nombre,
        talle: (item.talle ?? "").trim(),
        cantidad,
        precio_unitario: producto.precio,
      });
      total += producto.precio * cantidad;
      producto.stock -= cantidad;
    }

    await guardarProductos(productos);

    const pedidos = await leerPedidos();
    const nuevoId = pedidos.reduce((mayor, p) => Math.max(mayor, p.id || 0), 0) + 1;
    const pedido = {
      id: nuevoId,
      fecha: fechaLocalAR(),
      cliente: { nombre, telefono, dni },
      items: itemsValidos,
      total: Math.round(total * 100) / 100,
    };
    pedidos.push(pedido);
    await guardarPedidos(pedidos);
    return json({ ok: true, pedido }, 201);
  }

  // Listar pedidos (solo admin)
  if (req.method === "GET") {
    const noAutorizado = await exigirAdmin(req);
    if (noAutorizado) return noAutorizado;
    return json({ pedidos: await leerPedidos() });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = {
  path: "/api/pedidos",
  method: ["GET", "POST"],
  rateLimit: {
    windowLimit: 5,
    windowSize: 600,
    aggregateBy: ["ip"],
  },
};
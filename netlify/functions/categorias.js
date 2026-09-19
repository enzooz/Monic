import { leerProductos } from "../../lib/datos.js";
import { json } from "../../lib/responder.js";

export default async () => {
  const productos = await leerProductos();
  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  return json({ categorias });
};

export const config = {
  path: "/api/categorias",
  method: ["GET"],
};
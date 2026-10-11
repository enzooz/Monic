import { getStore } from "@netlify/blobs";

// El store "datos" guarda productos, pedidos, colores y movimientos de stock.
// consistency: "strong" garantiza leer lo que recién se escribió.
const store = getStore({ name: "datos", consistency: "strong" });

export async function leerProductos() {
  const productos = (await store.get("productos", { type: "json" })) ?? [];
  return productos.map(normalizarProducto);
}

export async function guardarProductos(items) {
  await store.setJSON("productos", items);
}

export async function leerPedidos() {
  return (await store.get("pedidos", { type: "json" })) ?? [];
}

export async function guardarPedidos(items) {
  await store.setJSON("pedidos", items);
}

export async function leerColores() {
  return (await store.get("colores", { type: "json" })) ?? [];
}

export async function guardarColores(items) {
  await store.setJSON("colores", items);
}

export async function leerMarcas() {
  return (await store.get("marcas", { type: "json" })) ?? [];
}

export async function guardarMarcas(items) {
  await store.setJSON("marcas", items);
}

export async function leerMovimientos() {
  return (await store.get("movimientos", { type: "json" })) ?? [];
}

export async function guardarMovimientos(items) {
  await store.setJSON("movimientos", items);
}

// Agrega uno o varios movimientos de stock, asignando id y fecha.
// `nuevos` es un array de objetos sin id/fecha.
export async function agregarMovimientos(nuevos) {
  const lista = (nuevos ?? []).filter(Boolean);
  if (lista.length === 0) return [];
  const actuales = await leerMovimientos();
  let id = actuales.reduce((mayor, m) => Math.max(mayor, m.id || 0), 0);
  const fecha = fechaLocalAR();
  const conId = lista.map((m) => {
    id += 1;
    return { id, fecha, tipo: "ajuste", motivo: "", ...m };
  });
  await guardarMovimientos([...actuales, ...conId]);
  return conId;
}

// ---------- Stock por talle ----------
// El stock de un producto es un objeto { talle: cantidad }.
// Un producto sin talles usa la clave "" (única).

const aEnteroNoNegativo = (valor) => Math.max(0, Math.floor(Number(valor)) || 0);

// Normaliza el campo stock a objeto por talle.
// - Si ya es objeto, conserva solo las claves válidas (talles o "").
// - Si es un número (formato viejo, stock global) lo reparte entre los talles,
//   preservando el total, o lo guarda bajo "" si el producto no tiene talles.
export function normalizarStock(stock, talles) {
  const lista = Array.isArray(talles) ? talles.map((t) => String(t)) : [];
  const obj = {};

  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    for (const [clave, valor] of Object.entries(stock)) {
      const n = aEnteroNoNegativo(valor);
      if (lista.length === 0) {
        if (clave === "") obj[""] = n;
      } else if (lista.includes(clave)) {
        obj[clave] = n;
      }
    }
  } else if (typeof stock === "number") {
    const n = aEnteroNoNegativo(stock);
    if (lista.length === 0) {
      obj[""] = n;
    } else {
      const base = Math.floor(n / lista.length);
      const resto = n - base * lista.length;
      lista.forEach((t, i) => {
        obj[t] = base + (i < resto ? 1 : 0);
      });
    }
  }

  // Garantiza una entrada por cada talle (o la clave "" si no hay talles).
  if (lista.length === 0) {
    if (!("" in obj)) obj[""] = 0;
  } else {
    lista.forEach((t) => {
      if (!(t in obj)) obj[t] = 0;
    });
  }
  return obj;
}

export function normalizarProducto(producto) {
  const talles = Array.isArray(producto?.talles) ? producto.talles.filter(Boolean) : [];
  return {
    ...producto,
    talles,
    marca: String(producto?.marca ?? "").trim(),
    codigo: String(producto?.codigo ?? "").trim(),
    stock: normalizarStock(producto?.stock, talles),
  };
}

// Cantidad disponible del producto para un talle puntual.
export function stockDe(producto, talle) {
  const stock = producto?.stock;
  const clave = (talle ?? "").trim();
  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    if (clave && clave in stock) return aEnteroNoNegativo(stock[clave]);
    if ("" in stock) return aEnteroNoNegativo(stock[""]);
    return 0;
  }
  return aEnteroNoNegativo(stock);
}

// Suma de todo el stock del producto.
export function stockTotal(producto) {
  const stock = producto?.stock;
  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    return Object.values(stock).reduce((suma, v) => suma + aEnteroNoNegativo(v), 0);
  }
  return aEnteroNoNegativo(stock);
}

const RE_DNI = /^\d{7,8}$/;
const RE_TEL = /^[\d\-\+\s()]{6,20}$/;

export function validarCliente(cliente) {
  const nombre = (cliente?.nombre ?? "").trim();
  const telefono = (cliente?.telefono ?? "").trim();
  const dni = (cliente?.dni ?? "").trim();
  if (!nombre || nombre.length < 2) return "El nombre debe tener al menos 2 caracteres";
  if (!RE_TEL.test(telefono)) return "El formato del teléfono no es válido";
  if (!RE_DNI.test(dni)) return "El DNI debe tener 7 u 8 dígitos";
  return null;
}

// Trampa honeypot: si un bot completó el campo  "website", se rechaza.
export function esHoneypot(data) {
  return Boolean(data && data.website);
}

// Fecha y hora local de Argentina (los pedidos se ven desde el admin).
export function fechaLocalAR() {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (tipo) => partes.find((p) => p.type === tipo).value;
  const hora = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hora}:${get("minute")}`;
}

import { getStore } from "@netlify/blobs";

// El store "datos" guarda productos y pedidos (como antes eran *.json).
// consistency: "strong" garantiza leer lo que recién se escribió.
const store = getStore({ name: "datos", consistency: "strong" });

export async function leerProductos() {
  return (await store.get("productos", { type: "json" })) ?? [];
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
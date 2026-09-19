import crypto from "node:crypto";

import { json } from "./responder.js";

// Credenciales del admin desde variables de entorno (defaults para desarrollo local).
const ADMIN_USER = process.env.MONIC_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.MONIC_ADMIN_PASS || "monic123";

// Clave para firmar la cookie de sesión (en producción se setea en Netlify).
const SECRET = process.env.MONIC_SECRET_KEY || "monic-clave-desarrollo-local";

const COOKIE_NOMBRE = "monic_admin";
const DURACION_HORAS = 12;

export function login(user, pass) {
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

function parsearCookies(header) {
  const datos = {};
  (header ?? "").split(";").forEach((parte) => {
    const idx = parte.indexOf("=");
    if (idx > -1) {
      const key = parte.slice(0, idx).trim();
      const val = parte.slice(idx + 1).trim();
      datos[key] = val;
    }
  });
  return datos;
}

function firmar(valor) {
  return crypto.createHmac("sha256", SECRET).update(valor).digest("base64url");
}

function generarCookie(secure) {
  const cuerpo = Buffer.from(
    JSON.stringify({ admin: true, exp: Date.now() + DURACION_HORAS * 3600000 })
  ).toString("base64url");
  const firmaValor = firmar(cuerpo);
  return `${COOKIE_NOMBRE}=${cuerpo}.${firmaValor}; Path=/; HttpOnly; SameSite=Lax${
    secure ? "; Secure" : ""
  }; Max-Age=${DURACION_HORAS * 3600}`;
}

export function borrarCookie() {
  return `${COOKIE_NOMBRE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function sesionValida(req) {
  const cookie = parsearCookies(req.headers.get("cookie"))[COOKIE_NOMBRE];
  if (!cookie) return false;
  const [cuerpo, firmaValor] = cookie.split(".");
  if (!cuerpo || !firmaValor) return false;

  const esperada = firmar(cuerpo);
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(firmaValor), Buffer.from(esperada));
  } catch {
    ok = false;
  }
  if (!ok) return false;

  try {
    const dato = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    return dato.admin === true && dato.exp > Date.now();
  } catch {
    return false;
  }
}

// Devuelve null si la sesión es válida, o una Response 401 si no.
export async function exigirAdmin(req) {
  if (!sesionValida(req)) {
    return json({ error: "No autorizado" }, 401);
  }
  return null;
}

export { generarCookie as generarCookieSesion };
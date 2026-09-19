import { login, generarCookieSesion } from "../../lib/auth.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  const data = await req.json().catch(() => ({}));
  const usuario = (data.usuario ?? "").trim();
  const password = data.password ?? "";

  if (login(usuario, password)) {
    const secure = req.url.startsWith("https");
    const res = json({ ok: true });
    res.headers.append("Set-Cookie", generarCookieSesion(secure));
    return res;
  }
  return json({ error: "Usuario o contraseña incorrectos" }, 401);
};

export const config = {
  path: "/api/login",
  method: ["POST"],
  rateLimit: {
    windowLimit: 5,
    windowSize: 300,
    aggregateBy: ["ip"],
  },
};
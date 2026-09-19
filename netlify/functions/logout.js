import { borrarCookie } from "../../lib/auth.js";
import { json } from "../../lib/responder.js";

export default async () => {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", borrarCookie());
  return res;
};

export const config = {
  path: "/api/logout",
  method: ["POST"],
};
import { sesionValida } from "../../lib/auth.js";
import { json } from "../../lib/responder.js";

export default async (req) => {
  return json({ autenticado: sesionValida(req) });
};

export const config = {
  path: "/api/verificar",
  method: ["GET"],
};
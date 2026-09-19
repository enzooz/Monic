import { json } from "../../lib/responder.js";

export default async () => {
  return json({ plataforma: "netlify" });
};

export const config = {
  path: "/api/estado",
  method: ["GET"],
};
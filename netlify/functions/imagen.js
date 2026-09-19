import { getStore } from "@netlify/blobs";

const MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export default async (req) => {
  const url = new URL(req.url);
  const nombre = decodeURIComponent(url.pathname.split("/").pop() || "");

  // Solo servimos imágenes generadas por upload.js (uuid + extensión).
  if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp|svg)$/.test(nombre)) {
    return new Response("No encontrado", { status: 404 });
  }

  const imagenes = getStore("imagenes");
  const datos = await imagenes.get(nombre, { type: "arrayBuffer" });
  if (!datos) return new Response("No encontrado", { status: 404 });

  const ext = nombre.split(".").pop();
  return new Response(datos, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = {
  path: "/api/img/*",
  method: ["GET"],
};
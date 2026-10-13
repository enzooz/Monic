// Las respuestas de la API nunca deben cachearse: los datos cambian (stock, pedidos,
// productos) y el caché de Netlify (Durable/Edge) o del navegador servían versiones
// viejas de forma intermitente.
const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Netlify-CDN-Cache-Control": "no-store",
};

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SIN_CACHE,
      ...headers,
    },
  });
}
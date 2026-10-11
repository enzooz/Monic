/* utils.js — Funciones compartidas entre main.js y admin.js */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function formatearPrecio(valor) {
  return "$" + Number(valor).toLocaleString("es-AR");
}

function mostrarMensaje(contenedor, texto, tipo) {
  if (!contenedor) return;
  contenedor.innerHTML =
    '<div class="mensaje mensaje-' + tipo + '">' + escapeHtml(texto) + "</div>";
}

/* Stock por talle — mismos criterios que el backend (lib/datos.js) */

function stockDe(producto, talle) {
  const stock = producto && producto.stock;
  const clave = (talle == null ? "" : String(talle)).trim();
  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    if (clave && clave in stock) return Math.max(0, Math.floor(Number(stock[clave])) || 0);
    if ("" in stock) return Math.max(0, Math.floor(Number(stock[""])) || 0);
    return 0;
  }
  return Math.max(0, Math.floor(Number(stock)) || 0);
}

function stockTotal(producto) {
  const stock = producto && producto.stock;
  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    return Object.values(stock).reduce(
      (suma, v) => suma + (Math.max(0, Math.floor(Number(v))) || 0),
      0
    );
  }
  return Math.max(0, Math.floor(Number(stock)) || 0);
}


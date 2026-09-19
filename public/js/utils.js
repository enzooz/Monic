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

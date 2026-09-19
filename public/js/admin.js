(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let productos = [];
  let paleta = [];
  let coloresSeleccionados = new Set();
  let imagenesSeleccionadas = [];

  function mostrarVista(contenidov) {
    $("#vista-login").style.display = "none";
    $("#vista-admin").style.display = "block";
    $("#vista-productos").style.display = contenidov === "productos" ? "block" : "none";
    $("#vista-colores").style.display = contenidov === "colores" ? "block" : "none";
    $("#vista-pedidos").style.display = contenidov === "pedidos" ? "block" : "none";
    $$(".admin-sidebar a[data-vista]").forEach((a) =>
      a.classList.toggle("activo", a.dataset.vista === contenidov)
    );
    if (contenidov === "pedidos") cargarPedidos();
    if (contenidov === "colores") cargarColores();
  }

  async function verificarSesion() {
    const res = await fetch("/api/verificar");
    const data = await res.json();
    if (data.autenticado) {
      mostrarVista("productos");
      cargarProductos();
    } else {
      $("#vista-login").style.display = "block";
      $("#vista-admin").style.display = "none";
    }
  }

  async function iniciarSesion(e) {
    e.preventDefault();
    const mensaje = $("#mensaje-login");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: $("#login-usuario").value.trim(),
        password: $("#login-password").value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarVista("productos");
      cargarProductos();
      $("#form-login").reset();
    } else {
      mostrarMensaje(mensaje, data.error || "No se pudo ingresar.", "error");
    }
  }

  async function cerrarSesion(e) {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  async function cargarProductos() {
    const res = await fetch("/api/productos");
    const data = await res.json();
    productos = data.productos || [];
    renderizarProductos();
    cargarCategorias();
  }

  async function cargarCategorias() {
    const res = await fetch("/api/categorias");
    const data = await res.json();
    $("#lista-categorias").innerHTML = (data.categorias || [])
      .map((c) => `<option value="${escapeHtml(c)}"></option>`)
      .join("");
  }

  function renderizarProductos() {
    const tbody = $("#tabla-productos");
    const vacio = $("#productos-vacio-admin");
    tbody.innerHTML = "";
    if (productos.length === 0) {
      vacio.style.display = "block";
      return;
    }
    vacio.style.display = "none";
    productos.forEach((p) => {
      const img = (p.imagenes && p.imagenes[0]) || p.imagen || "";
      const colores = p.colores || [];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${img ? `<img class="mini-img" src="/api/img/${encodeURIComponent(img)}" onerror="this.style.display='none';">` : "—"}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.categoria || "—")}</td>
        <td>${formatearPrecio(p.precio)}</td>
        <td>${p.stock}</td>
        <td>${escapeHtml((p.talles || []).join(", "))}</td>
        <td>
          ${colores
            .slice(0, 5)
            .map((hex) => `<span class="mini-swatch" title="${escapeHtml(hex)}" style="background:${escapeHtml(hex)}"></span>`)
            .join("")}
          ${colores.length > 5 ? `<span class="mini-swatch-mas">+${colores.length - 5}</span>` : ""}
        </td>
        <td>
          <div class="acciones">
            <button class="btn btn-outline" data-editar="${p.id}">Editar</button>
            <button class="btn btn-peligro" data-eliminar="${p.id}">Eliminar</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-editar]").forEach((btn) =>
      btn.addEventListener("click", () => abrirModal(parseInt(btn.dataset.editar, 10)))
    );
    tbody.querySelectorAll("[data-eliminar]").forEach((btn) =>
      btn.addEventListener("click", () => eliminarProducto(parseInt(btn.dataset.eliminar, 10)))
    );
  }

  async function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    if (res.ok) {
      mostrarMensaje($("#mensaje-admin"), "Producto eliminado.", "exito");
      cargarProductos();
    } else {
      const data = await res.json();
      mostrarMensaje($("#mensaje-admin"), data.error || "Error al eliminar.", "error");
    }
  }

  // ---------- Colores ----------

  async function cargarColores() {
    const res = await fetch("/api/colores");
    const data = await res.json();
    paleta = data.colores || [];
    renderizarColoresLista();
    renderColoresProducto();
  }

  function renderizarColoresLista() {
    const cont = $("#lista-colores");
    if (!cont) return;
    cont.innerHTML = paleta
      .map(
        (c) => `
        <div class="color-item">
          <span class="swatch" style="background:${escapeHtml(c.hex)}"></span>
          <span class="color-item-nombre">${escapeHtml(c.nombre)}</span>
          <span class="color-item-hex">${escapeHtml(c.hex)}</span>
          <button type="button" class="link-btn" data-eliminar-color="${c.id}">Eliminar</button>
        </div>`
      )
      .join("");
    cont.querySelectorAll("[data-eliminar-color]").forEach((btn) =>
      btn.addEventListener("click", () => eliminarColor(btn.dataset.eliminarColor))
    );
  }

  async function eliminarColor(id) {
    if (!confirm("¿Eliminar este color del palet?")) return;
    const res = await fetch(`/api/colores?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje($("#mensaje-colores"), "Color eliminado.", "exito");
      cargarColores();
    } else {
      mostrarMensaje($("#mensaje-colores"), data.error || "Error al eliminar.", "error");
    }
  }

  async function agregarColor() {
    const mensaje = $("#mensaje-colores");
    const res = await fetch("/api/colores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: $("#color-nombre").value.trim(),
        hex: $("#color-hex").value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje(mensaje, "Color agregado.", "exito");
      $("#color-nombre").value = "";
      cargarColores();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al agregar el color.", "error");
    }
  }

  function renderColoresProducto() {
    const cont = $("#colores-producto");
    if (!cont) return;
    cont.innerHTML = paleta
      .map(
        (c) => `<button type="button" class="swatch ${coloresSeleccionados.has(c.hex) ? "activo" : ""}" data-hex="${c.hex}" title="${escapeHtml(c.nombre)}" style="background:${c.hex}"></button>`
      )
      .join("");
    cont.querySelectorAll(".swatch").forEach((b) =>
      b.addEventListener("click", () => {
        const hex = b.dataset.hex;
        if (coloresSeleccionados.has(hex)) coloresSeleccionados.delete(hex);
        else coloresSeleccionados.add(hex);
        b.classList.toggle("activo", coloresSeleccionados.has(hex));
      })
    );
  }

  // ---------- Producto (modal) ----------

  function abrirModal(id) {
    $("#modal-titulo-producto").textContent = id ? "Editar producto" : "Nuevo producto";
    $("#mensaje-modal").innerHTML = "";
    const form = $("#form-producto");
    form.reset();
    $("#producto-id").value = id || "";
    imagenesSeleccionadas = [];
    coloresSeleccionados = new Set();
    renderImagenes();
    renderColoresProducto();
    $("#upload-texto").textContent = "Hacé clic para subir una o varias imágenes";

    if (id) {
      const p = productos.find((x) => x.id === id);
      if (p) {
        $("#producto-nombre").value = p.nombre || "";
        $("#producto-categoria").value = p.categoria || "";
        $("#producto-precio").value = p.precio || "";
        $("#producto-stock").value = p.stock || 0;
        $("#producto-talles").value = (p.talles || []).join(", ");
        $("#producto-descripcion").value = p.descripcion || "";
        imagenesSeleccionadas = (p.imagenes && p.imagenes.length) ? p.imagenes : (p.imagen ? [p.imagen] : []);
        (p.colores || []).forEach((hex) => coloresSeleccionados.add(hex));
        renderImagenes();
        renderColoresProducto();
        if (imagenesSeleccionadas.length) {
          $("#upload-texto").textContent = imagenesSeleccionadas.length + " imagen(es) — clic para cambiar";
        }
      }
    } else {
      cargarColores();
    }
    $("#modal-producto").classList.add("visible");
  }

  function renderImagenes() {
    const cont = $("#upload-lista");
    if (!cont) return;
    cont.innerHTML = imagenesSeleccionadas
      .map(
        (img, i) => `
        <div class="upload-item">
          <img src="/api/img/${encodeURIComponent(img)}" alt="" />
          <button type="button" class="link-btn" data-borrar-img="${i}">Quitar</button>
        </div>`
      )
      .join("");
    cont.querySelectorAll("[data-borrar-img]").forEach((btn) =>
      btn.addEventListener("click", () => {
        imagenesSeleccionadas.splice(parseInt(btn.dataset.borrarImg, 10), 1);
        renderImagenes();
      })
    );
  }

  function cerrarModal() {
    $("#modal-producto").classList.remove("visible");
  }

  async function guardarProducto(e) {
    e.preventDefault();
    const mensaje = $("#mensaje-modal");
    const id = $("#producto-id").value;
    const payload = {
      nombre: $("#producto-nombre").value.trim(),
      categoria: $("#producto-categoria").value.trim(),
      precio: parseFloat($("#producto-precio").value) || 0,
      stock: parseInt($("#producto-stock").value) || 0,
      talles: $("#producto-talles").value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      colores: [...coloresSeleccionados],
      imagenes: imagenesSeleccionadas,
      descripcion: $("#producto-descripcion").value.trim(),
    };

    if (!payload.nombre) {
      mostrarMensaje(mensaje, "El nombre es obligatorio.", "error");
      return;
    }

    const res = await fetch(id ? `/api/productos/${id}` : "/api/productos", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje($("#mensaje-admin"), "Producto guardado.", "exito");
      cerrarModal();
      cargarProductos();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al guardar.", "error");
    }
  }

  // ---------- Pedidos ----------

  async function cargarPedidos() {
    const tbody = $("#tabla-pedidos tbody");
    const vacio = $("#pedidos-vacio-admin");
    const res = await fetch("/api/pedidos");
    if (!res.ok) {
      mostrarMensaje($("#mensaje-admin"), "No se pudieron cargar los pedidos.", "error");
      return;
    }
    const data = await res.json();
    const pedidos = data.pedidos || [];
    tbody.innerHTML = "";
    if (pedidos.length === 0) {
      vacio.style.display = "block";
      return;
    }
    vacio.style.display = "none";
    pedidos.forEach((p) => {
      const tr = document.createElement("tr");
      const itemsResumen = (p.items || [])
        .map(
          (i) =>
            `${escapeHtml(i.nombre)} (${i.cantidad}${i.talle ? " " + escapeHtml(i.talle) : ""}${
              i.color_nombre ? " · " + escapeHtml(i.color_nombre) : ""
            })`
        )
        .join("<br/>");
      tr.innerHTML = `
        <td>#${p.id}</td>
        <td>${escapeHtml(p.fecha)}</td>
        <td>${escapeHtml(p.cliente.nombre)}</td>
        <td>${escapeHtml(p.cliente.telefono)}</td>
        <td>${escapeHtml(p.cliente.dni)}</td>
        <td>${itemsResumen}</td>
        <td>${formatearPrecio(p.total)}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ---------- Subida de imágenes ----------

  async function subirArchivos(archivos) {
    for (const archivo of archivos) {
      try {
        const formData = new FormData();
        formData.append("imagen", archivo);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) {
          imagenesSeleccionadas.push(data.imagen);
          renderImagenes();
          $("#upload-texto").textContent =
            imagenesSeleccionadas.length > 1
              ? imagenesSeleccionadas.length + " imágenes — clic para agregar más"
              : "1 imagen — clic para agregar más";
        } else {
          alert(data.error || "No se pudo subir la imagen.");
        }
      } catch (err) {
        alert("Error al subir la imagen.");
      }
    }
  }

  function initUpload() {
    const zona = $("#upload-zona");
    const input = $("#upload-input");
    zona.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files.length === 0) return;
      subirArchivos([...input.files]);
      input.value = "";
    });
  }

  function init() {
    $("#form-login").addEventListener("submit", iniciarSesion);
    $("#btn-logout").addEventListener("click", cerrarSesion);
    $("#btn-nuevo").addEventListener("click", () => abrirModal(null));
    $("#form-producto").addEventListener("submit", guardarProducto);
    $("#modal-cancelar").addEventListener("click", cerrarModal);
    $("#modal-producto").addEventListener("click", (e) => {
      if (e.target === $("#modal-producto")) cerrarModal();
    });
    $("#btn-agregar-color").addEventListener("click", agregarColor);
    $("#color-nombre").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        agregarColor();
      }
    });
    document.querySelectorAll(".admin-sidebar a[data-vista]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarVista(a.dataset.vista);
      });
    });
    initUpload();
    $("#btn-verificar").addEventListener("click", (e) => {
      e.preventDefault();
      verificarSesion();
    });
    verificarSesion();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
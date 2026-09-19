(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let productos = [];

  function mostrarVista(contenidov) {
    $("#vista-login").style.display = "none";
    $("#vista-admin").style.display = "block";
    $("#vista-productos").style.display = contenidov === "productos" ? "block" : "none";
    $("#vista-pedidos").style.display = contenidov === "pedidos" ? "block" : "none";
    $$(".admin-sidebar a[data-vista]").forEach((a) =>
      a.classList.toggle("activo", a.dataset.vista === contenidov)
    );
    if (contenidov === "pedidos") cargarPedidos();
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.imagen ? `<img class="mini-img" src="/api/img/${encodeURIComponent(p.imagen)}" onerror="this.style.display='none';">` : "—"}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.categoria || "—")}</td>
        <td>${formatearPrecio(p.precio)}</td>
        <td>${p.stock}</td>
        <td>${escapeHtml((p.talles || []).join(", "))}</td>
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

  function abrirModal(id) {
    $("#modal-titulo-producto").textContent = id ? "Editar producto" : "Nuevo producto";
    $("#mensaje-modal").innerHTML = "";
    const form = $("#form-producto");
    form.reset();
    $("#producto-id").value = id || "";
    $("#upload-preview").style.display = "none";
    $("#upload-texto").textContent = "Hacé clic para subir una imagen";

    if (id) {
      const p = productos.find((x) => x.id === id);
      if (p) {
        $("#producto-nombre").value = p.nombre || "";
        $("#producto-categoria").value = p.categoria || "";
        $("#producto-precio").value = p.precio || "";
        $("#producto-stock").value = p.stock || 0;
        $("#producto-talles").value = (p.talles || []).join(", ");
        $("#producto-descripcion").value = p.descripcion || "";
        $("#producto-imagen").value = p.imagen || "";
        if (p.imagen) {
          $("#upload-preview").src = `/api/img/${encodeURIComponent(p.imagen)}`;
          $("#upload-preview").style.display = "block";
          $("#upload-texto").textContent = "Imagen actual — clic para cambiar";
        }
      }
    }
    $("#modal-producto").classList.add("visible");
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
      imagen: $("#producto-imagen").value.trim(),
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
        .map((i) => `${escapeHtml(i.nombre)} (${i.cantidad}${i.talle ? " " + escapeHtml(i.talle) : ""})`)
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

  function initUpload() {
    const zona = $("#upload-zona");
    const input = $("#upload-input");
    zona.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      if (input.files.length === 0) return;
      const archivo = input.files[0];
      const formData = new FormData();
      formData.append("imagen", archivo);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) {
          $("#producto-imagen").value = data.imagen;
          $("#upload-preview").src = `/api/img/${encodeURIComponent(data.imagen)}`;
          $("#upload-preview").style.display = "block";
          $("#upload-texto").textContent = archivo.name;
        } else {
          alert(data.error || "No se pudo subir la imagen.");
        }
      } catch (err) {
        alert("Error al subir la imagen.");
      }
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

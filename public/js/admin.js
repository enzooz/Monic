(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const TIPO_LABEL = {
    alta: "Alta",
    venta: "Venta",
    reposicion: "Reposición",
    ajuste: "Ajuste",
    merma: "Merma",
    devolucion: "Devolución",
  };

  let productos = [];
  let paleta = [];
  let marcas = [];
  let categorias = [];
  let coloresSeleccionados = new Set();
  let imagenesSeleccionadas = [];
  let stockEdicion = {};
  let movimientos = [];
  let umbral = Number(localStorage.getItem("monic_umbral_stock")) || 3;
  let orden = (() => {
    try {
      const g = JSON.parse(localStorage.getItem("monic_orden"));
      if (g && g.campo) return { campo: g.campo, dir: g.dir === -1 ? -1 : 1 };
    } catch (e) {}
    return { campo: null, dir: 1 };
  })();

  function mostrarVista(contenidov) {
    $("#vista-login").style.display = "none";
    $("#vista-admin").style.display = "block";
    $("#vista-productos").style.display = contenidov === "productos" ? "block" : "none";
    $("#vista-stock").style.display = contenidov === "stock" ? "block" : "none";
    $("#vista-movimientos").style.display = contenidov === "movimientos" ? "block" : "none";
    $("#vista-categorias").style.display = contenidov === "categorias" ? "block" : "none";
    $("#vista-marcas").style.display = contenidov === "marcas" ? "block" : "none";
    $("#vista-colores").style.display = contenidov === "colores" ? "block" : "none";
    $("#vista-pedidos").style.display = contenidov === "pedidos" ? "block" : "none";
    $$(".admin-sidebar a[data-vista]").forEach((a) =>
      a.classList.toggle("activo", a.dataset.vista === contenidov)
    );
    if (contenidov === "pedidos") cargarPedidos();
    if (contenidov === "colores") cargarColores();
    if (contenidov === "categorias") cargarCategorias();
    if (contenidov === "marcas") cargarMarcas();
    if (contenidov === "stock") renderizarStockView();
    if (contenidov === "movimientos") cargarMovimientos();
  }

  async function verificarSesion() {
    const res = await fetch("/api/verificar");
    const data = await res.json();
    if (data.autenticado) {
      mostrarVista("productos");
      cargarProductos();
      cargarMarcas();
      cargarCategorias();
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
      cargarMarcas();
      cargarCategorias();
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
    categorias = data.categorias || [];
    renderizarCategoriasLista();
    renderCategoriasProducto();
  }

  function renderizarCategoriasLista() {
    const cont = $("#lista-categorias-admin");
    if (!cont) return;
    if (categorias.length === 0) {
      cont.innerHTML = `<p class="vacio-inline">Todavía no cargaste categorías.</p>`;
      return;
    }
    cont.innerHTML = categorias
      .map(
        (c) => `
        <div class="marca-item">
          <span class="marca-item-nombre">${escapeHtml(c.nombre)}</span>
          <button type="button" class="link-btn" data-eliminar-categoria="${c.id}">Eliminar</button>
        </div>`
      )
      .join("");
    cont.querySelectorAll("[data-eliminar-categoria]").forEach((btn) =>
      btn.addEventListener("click", () => eliminarCategoria(btn.dataset.eliminarCategoria))
    );
  }

  function renderCategoriasProducto() {
    const dl = $("#lista-categorias");
    if (!dl) return;
    dl.innerHTML = categorias
      .map((c) => `<option value="${escapeHtml(c.nombre)}"></option>`)
      .join("");
  }

  async function eliminarCategoria(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const res = await fetch(`/api/categorias?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje($("#mensaje-categorias"), "Categoría eliminada.", "exito");
      cargarCategorias();
    } else {
      mostrarMensaje($("#mensaje-categorias"), data.error || "Error al eliminar.", "error");
    }
  }

  async function agregarCategoria() {
    const mensaje = $("#mensaje-categorias");
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: $("#categoria-nombre").value.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje(mensaje, "Categoría agregada.", "exito");
      $("#categoria-nombre").value = "";
      cargarCategorias();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al agregar la categoría.", "error");
    }
  }

  function clavesDeProducto(p) {
    return p.talles && p.talles.length ? p.talles : [""];
  }

  function chipsStock(producto, { chico = false } = {}) {
    return clavesDeProducto(producto)
      .map((t) => {
        const n = stockDe(producto, t);
        const etiqueta = t === "" ? "Único" : escapeHtml(t);
        return `<span class="stock-chip ${chico ? "chico" : ""} ${n <= umbral ? "bajo" : ""}">${etiqueta}: ${n}</span>`;
      })
      .join(" ");
  }

  // ---------- Ordenamiento ----------

  const CAMPOS_TEXTO = ["nombre", "categoria", "marca", "codigo"];

  function valorOrden(p, campo) {
    if (campo === "stock") return stockTotal(p);
    if (campo === "precio") return Number(p.precio) || 0;
    return String(p[campo] || "").trim();
  }

  function compararProductos(a, b) {
    const campo = orden.campo;
    if (!campo) return 0;
    if (CAMPOS_TEXTO.includes(campo)) {
      const va = valorOrden(a, campo);
      const vb = valorOrden(b, campo);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return va.localeCompare(vb, "es", { sensitivity: "base" }) * orden.dir;
    }
    return (valorOrden(a, campo) - valorOrden(b, campo)) * orden.dir;
  }

  function ordenarProductos(lista) {
    if (!orden.campo) return lista;
    return [...lista].sort(compararProductos);
  }

  function actualizarFlechas() {
    $$("th[data-sort]").forEach((th) => {
      const activo = th.dataset.sort === orden.campo;
      th.classList.toggle("activo", activo);
      th.dataset.flecha = activo ? (orden.dir === 1 ? "▲" : "▼") : "";
    });
  }

  function inicializarOrden() {
    $$("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const campo = th.dataset.sort;
        if (orden.campo === campo) orden.dir = orden.dir === 1 ? -1 : 1;
        else {
          orden.campo = campo;
          orden.dir = 1;
        }
        localStorage.setItem("monic_orden", JSON.stringify(orden));
        actualizarFlechas();
        renderizarProductos();
        renderizarStockView();
      });
    });
    actualizarFlechas();
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
    ordenarProductos(productos).forEach((p) => {
      const img = (p.imagenes && p.imagenes[0]) || p.imagen || "";
      const colores = p.colores || [];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${img ? `<img class="mini-img" src="/api/img/${encodeURIComponent(img)}" onerror="this.style.display='none';">` : "—"}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.categoria || "—")}</td>
        <td>${escapeHtml(p.marca || "—")}</td>
        <td>${escapeHtml(p.codigo || "—")}</td>
        <td>${formatearPrecio(p.precio)}</td>
        <td>
          <div class="stock-chips">${chipsStock(p, { chico: true })}</div>
          <div class="stock-total-linea">Total: ${stockTotal(p)}</div>
        </td>
        <td>${escapeHtml((p.talles || []).join(", ")) || "—"}</td>
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

  // ---------- Marcas ----------

  async function cargarMarcas() {
    const res = await fetch("/api/marcas");
    const data = await res.json();
    marcas = data.marcas || [];
    renderizarMarcasLista();
    renderMarcasProducto();
  }

  function renderizarMarcasLista() {
    const cont = $("#lista-marcas");
    if (!cont) return;
    if (marcas.length === 0) {
      cont.innerHTML = `<p class="vacio-inline">Todavía no cargaste marcas.</p>`;
      return;
    }
    cont.innerHTML = marcas
      .map(
        (m) => `
        <div class="marca-item">
          <span class="marca-item-nombre">${escapeHtml(m.nombre)}</span>
          <button type="button" class="link-btn" data-eliminar-marca="${m.id}">Eliminar</button>
        </div>`
      )
      .join("");
    cont.querySelectorAll("[data-eliminar-marca]").forEach((btn) =>
      btn.addEventListener("click", () => eliminarMarca(btn.dataset.eliminarMarca))
    );
  }

  async function eliminarMarca(id) {
    if (!confirm("¿Eliminar esta marca?")) return;
    const res = await fetch(`/api/marcas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje($("#mensaje-marcas"), "Marca eliminada.", "exito");
      cargarMarcas();
    } else {
      mostrarMensaje($("#mensaje-marcas"), data.error || "Error al eliminar.", "error");
    }
  }

  async function agregarMarca() {
    const mensaje = $("#mensaje-marcas");
    const res = await fetch("/api/marcas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: $("#marca-nombre").value.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje(mensaje, "Marca agregada.", "exito");
      $("#marca-nombre").value = "";
      cargarMarcas();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al agregar la marca.", "error");
    }
  }

  function renderMarcasProducto(seleccionada) {
    const sel = $("#producto-marca");
    if (!sel) return;
    const actual = seleccionada !== undefined ? seleccionada : sel.value;
    let opciones = marcas
      .map((m) => `<option value="${escapeHtml(m.nombre)}">${escapeHtml(m.nombre)}</option>`)
      .join("");
    if (actual && !marcas.some((m) => m.nombre === actual)) {
      opciones = `<option value="${escapeHtml(actual)}">${escapeHtml(actual)}</option>` + opciones;
    }
    sel.innerHTML = `<option value="">Sin marca</option>` + opciones;
    sel.value = actual || "";
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

  function tallesDesdeInput() {
    return $("#producto-talles")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function renderStockEditor() {
    const cont = $("#stock-editor");
    if (!cont) return;
    const talles = tallesDesdeInput();
    const claves = talles.length ? talles : [""];
    const nuevo = {};
    claves.forEach((k) => (nuevo[k] = Math.max(0, parseInt(stockEdicion[k], 10) || 0)));
    stockEdicion = nuevo;

    cont.innerHTML = claves
      .map(
        (k) => `
        <div class="stock-editor-fila">
          <span class="stock-editor-talle">${k === "" ? "Stock (sin talle)" : escapeHtml(k)}</span>
          <input type="number" min="0" step="1" data-talle="${escapeHtml(k)}" value="${stockEdicion[k]}" />
        </div>`
      )
      .join("");
    cont.querySelectorAll("input[data-talle]").forEach((inp) =>
      inp.addEventListener("input", () => {
        stockEdicion[inp.dataset.talle] = Math.max(0, parseInt(inp.value, 10) || 0);
      })
    );
  }

  function abrirModal(id) {
    $("#modal-titulo-producto").textContent = id ? "Editar producto" : "Nuevo producto";
    $("#mensaje-modal").innerHTML = "";
    const form = $("#form-producto");
    form.reset();
    $("#producto-id").value = id || "";
    imagenesSeleccionadas = [];
    coloresSeleccionados = new Set();
    stockEdicion = {};
    renderImagenes();
    renderColoresProducto();
    $("#upload-texto").textContent = "Hacé clic para subir una o varias imágenes";
    $("#producto-codigo").value = "NOM0000";
    renderMarcasProducto("");

    if (id) {
      const p = productos.find((x) => x.id === id);
      if (p) {
        $("#producto-nombre").value = p.nombre || "";
        $("#producto-categoria").value = p.categoria || "";
        renderMarcasProducto(p.marca || "");
        $("#producto-codigo").value = p.codigo || "NOM0000";
        $("#producto-precio").value = p.precio || "";
        $("#producto-talles").value = (p.talles || []).join(", ");
        $("#producto-descripcion").value = p.descripcion || "";
        stockEdicion = { ...(p.stock || {}) };
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
    renderStockEditor();
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
      marca: $("#producto-marca").value,
      codigo: $("#producto-codigo").value.trim(),
      precio: parseFloat($("#producto-precio").value) || 0,
      talles: tallesDesdeInput(),
      colores: [...coloresSeleccionados],
      imagenes: imagenesSeleccionadas,
      stock: { ...stockEdicion },
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
      await cargarProductos();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al guardar.", "error");
    }
  }

  // ---------- Stock ----------

  function renderizarStockView() {
    renderAlertaStock();
    const tbody = $("#tabla-stock");
    const vacio = $("#stock-vacio-admin");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (productos.length === 0) {
      vacio.style.display = "block";
      return;
    }
    vacio.style.display = "none";
    ordenarProductos(productos).forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.categoria || "—")}</td>
        <td><div class="stock-chips">${chipsStock(p)}</div></td>
        <td>${stockTotal(p)}</td>
        <td><div class="acciones"><button class="btn btn-outline" data-stock="${p.id}">Ajustar</button></div></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-stock]").forEach((b) =>
      b.addEventListener("click", () => abrirModalStock(parseInt(b.dataset.stock, 10)))
    );
  }

  function variantesBajas() {
    const bajas = [];
    productos.forEach((p) => {
      clavesDeProducto(p).forEach((t) => {
        const n = stockDe(p, t);
        if (n <= umbral) bajas.push({ producto: p, talle: t, cantidad: n });
      });
    });
    return bajas;
  }

  function renderAlertaStock() {
    const cont = $("#alerta-stock");
    if (!cont) return;
    const bajas = variantesBajas();
    if (bajas.length === 0) {
      cont.style.display = "none";
      return;
    }
    cont.style.display = "block";
    cont.innerHTML = `
      <div class="alerta-titulo">Atención: ${bajas.length} variante(s) con stock bajo (≤ ${umbral})</div>
      <div class="alerta-items">${bajas
        .map(
          (b) =>
            `<span class="stock-chip bajo">${escapeHtml(b.producto.nombre)}${
              b.talle ? " · " + escapeHtml(b.talle) : ""
            }: ${b.cantidad}</span>`
        )
        .join(" ")}</div>`;
  }

  function abrirModalStock(id) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    $("#mensaje-modal-stock").innerHTML = "";
    $("#stock-producto-id").value = id;
    $("#modal-titulo-stock").textContent = "Ajustar stock — " + p.nombre;
    const talles = clavesDeProducto(p);
    const sel = $("#stock-talle");
    sel.innerHTML = talles
      .map((t) => `<option value="${escapeHtml(t)}">${t === "" ? "Único" : escapeHtml(t)}</option>`)
      .join("");
    $("#stock-talle-grupo").style.display = p.talles && p.talles.length ? "block" : "none";
    $("#stock-operacion").value = "reposicion";
    $("#stock-cantidad").value = 0;
    $("#stock-motivo").value = "";
    actualizarInfoStock();
    $("#modal-stock").classList.add("visible");
  }

  function cerrarModalStock() {
    $("#modal-stock").classList.remove("visible");
  }

  function productoDeStockModal() {
    const id = parseInt($("#stock-producto-id").value, 10);
    return productos.find((x) => x.id === id);
  }

  function actualizarInfoStock() {
    const p = productoDeStockModal();
    if (!p) return;
    const talle = $("#stock-talle").value;
    const actual = stockDe(p, talle);
    $("#stock-actual-info").textContent = `Stock actual${talle ? " (talle " + talle + ")" : ""}: ${actual}`;
    const op = $("#stock-operacion").value;
    $("#stock-cantidad-label").textContent = op === "ajuste" ? "Nuevo stock" : "Cantidad";
  }

  async function aplicarStock(e) {
    e.preventDefault();
    const mensaje = $("#mensaje-modal-stock");
    const p = productoDeStockModal();
    if (!p) return;
    const talle = p.talles && p.talles.length ? $("#stock-talle").value : "";
    const operacion = $("#stock-operacion").value;
    const cantidad = Math.max(0, parseInt($("#stock-cantidad").value, 10) || 0);
    const body = {
      producto_id: p.id,
      talle,
      motivo: $("#stock-motivo").value.trim(),
      tipo: operacion,
    };
    if (operacion === "ajuste") body.nuevo = cantidad;
    else if (operacion === "merma") body.delta = -cantidad;
    else body.delta = cantidad;

    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje($("#mensaje-stock"), "Stock actualizado.", "exito");
      cerrarModalStock();
      await cargarProductos();
      if ($("#vista-stock").style.display !== "none") renderizarStockView();
    } else {
      mostrarMensaje(mensaje, data.error || "Error al ajustar el stock.", "error");
    }
  }

  // ---------- Movimientos ----------

  function llenarFiltroProductos() {
    const sel = $("#filtro-mov-producto");
    if (!sel) return;
    const actual = sel.value;
    sel.innerHTML =
      `<option value="">Todos los productos</option>` +
      productos.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");
    sel.value = actual;
  }

  async function cargarMovimientos() {
    llenarFiltroProductos();
    const partes = [];
    const pid = $("#filtro-mov-producto").value;
    const tipo = $("#filtro-mov-tipo").value;
    if (pid) partes.push("producto_id=" + encodeURIComponent(pid));
    if (tipo) partes.push("tipo=" + encodeURIComponent(tipo));
    const res = await fetch("/api/movimientos" + (partes.length ? "?" + partes.join("&") : ""));
    if (!res.ok) {
      mostrarMensaje($("#mensaje-stock"), "No se pudieron cargar los movimientos.", "error");
      return;
    }
    const data = await res.json();
    movimientos = data.movimientos || [];
    renderizarMovimientos();
  }

  function renderizarMovimientos() {
    const tbody = $("#tabla-movimientos tbody");
    const vacio = $("#movimientos-vacio-admin");
    tbody.innerHTML = "";
    if (movimientos.length === 0) {
      vacio.style.display = "block";
      return;
    }
    vacio.style.display = "none";
    movimientos.forEach((m) => {
      const clase = m.delta > 0 ? "mov-pos" : m.delta < 0 ? "mov-neg" : "";
      const signo = m.delta > 0 ? "+" : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(m.fecha)}</td>
        <td>${escapeHtml(m.producto_nombre || "—")}</td>
        <td>${m.talle ? escapeHtml(m.talle) : "—"}</td>
        <td><span class="mov-tipo mov-${escapeHtml(m.tipo)}">${escapeHtml(TIPO_LABEL[m.tipo] || m.tipo)}</span></td>
        <td class="${clase}">${signo}${m.delta}</td>
        <td>${m.stock_resultante}</td>
        <td>${escapeHtml(m.motivo || "—")}</td>`;
      tbody.appendChild(tr);
    });
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

  function initUmbral() {
    const inp = $("#umbral-stock");
    if (!inp) return;
    inp.value = umbral;
    inp.addEventListener("input", () => {
      umbral = Math.max(0, parseInt(inp.value, 10) || 0);
      localStorage.setItem("monic_umbral_stock", umbral);
      renderizarStockView();
    });
  }

  function init() {
    $("#form-login").addEventListener("submit", iniciarSesion);
    $("#btn-logout").addEventListener("click", cerrarSesion);
    $("#btn-nuevo").addEventListener("click", () => abrirModal(null));
    $("#form-producto").addEventListener("submit", guardarProducto);
    $("#producto-talles").addEventListener("input", renderStockEditor);
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
    $("#btn-agregar-marca").addEventListener("click", agregarMarca);
    $("#marca-nombre").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        agregarMarca();
      }
    });
    $("#btn-agregar-categoria").addEventListener("click", agregarCategoria);
    $("#categoria-nombre").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        agregarCategoria();
      }
    });
    $("#form-stock").addEventListener("submit", aplicarStock);
    $("#modal-stock-cancelar").addEventListener("click", cerrarModalStock);
    $("#modal-stock").addEventListener("click", (e) => {
      if (e.target === $("#modal-stock")) cerrarModalStock();
    });
    $("#stock-talle").addEventListener("change", actualizarInfoStock);
    $("#stock-operacion").addEventListener("change", actualizarInfoStock);
    $("#filtro-mov-producto").addEventListener("change", cargarMovimientos);
    $("#filtro-mov-tipo").addEventListener("change", cargarMovimientos);
    document.querySelectorAll(".admin-sidebar a[data-vista]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarVista(a.dataset.vista);
      });
    });
    initUpload();
    initUmbral();
    inicializarOrden();
    $("#btn-verificar").addEventListener("click", (e) => {
      e.preventDefault();
      verificarSesion();
    });
    verificarSesion();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

(function () {
  const CARRITO_KEY = "monic_carrito";
  let productos = [];
  let categoriaActiva = "todos";

  const $ = (sel) => document.querySelector(sel);

  function obtenerCarrito() {
    try {
      const datos = JSON.parse(localStorage.getItem(CARRITO_KEY));
      return Array.isArray(datos) ? datos : [];
    } catch (e) {
      return [];
    }
  }

  function guardarCarrito(carrito) {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
    actualizarContador();
  }

  function actualizarContador() {
    const carrito = obtenerCarrito();
    const total = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const contador = $("#carrito-contador");
    if (contador) {
      contador.textContent = total;
      contador.classList.toggle("visible", total > 0);
    }
  }

  function imagenProducto(p) {
    return p.imagen
      ? `<img src="/api/img/${encodeURIComponent(p.imagen)}" alt="${p.nombre}" loading="lazy" onerror="this.parentElement.classList.add('sin-imagen');this.style.display='none';" />`
      : `<span>Sin imagen</span>`;
  }

  async function cargarProductos() {
    const res = await fetch("/api/productos");
    const data = await res.json();
    productos = data.productos || [];
    renderizarFiltros();
    renderizarProductos();
  }

  function renderizarFiltros() {
    const cont = $("#filtros");
    if (!cont) return;
    const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
    let html = `<button class="filtro-btn ${categoriaActiva === "todos" ? "activo" : ""}" data-cat="todos">Todos</button>`;
    categorias.forEach((cat) => {
      html += `<button class="filtro-btn ${categoriaActiva === cat ? "activo" : ""}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    });
    cont.innerHTML = html;
    cont.querySelectorAll(".filtro-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        categoriaActiva = btn.dataset.cat;
        renderizarFiltros();
        renderizarProductos();
      });
    });
  }

  function renderizarProductos() {
    const cont = $("#productos");
    const vacio = $("#productos-vacio");
    if (!cont) return;

    const lista = categoriaActiva === "todos"
      ? productos
      : productos.filter((p) => p.categoria === categoriaActiva);

    if (lista.length === 0) {
      cont.innerHTML = "";
      if (vacio) vacio.style.display = "block";
      return;
    }
    if (vacio) vacio.style.display = "none";

    cont.innerHTML = lista.map((p) => {
      const talles = (p.talles || []).map(
        (t) =>
          `<button class="talle-btn" data-talle="${escapeHtml(t)}">${escapeHtml(t)}</button>`
      ).join("");
      return `
        <div class="tarjeta" data-id="${p.id}">
          <div class="tarjeta-imagen ${p.imagen ? "" : "sin-imagen"}">${imagenProducto(p)}</div>
          <div class="tarjeta-categoria">${escapeHtml(p.categoria || "—")}</div>
          <div class="tarjeta-nombre">${escapeHtml(p.nombre)}</div>
          <div class="tarjeta-precio">${formatearPrecio(p.precio)}</div>
          ${talles ? `<div class="talles" data-talles>${talles}</div>` : ""}
          <div class="tarjeta-botones">
            <button class="btn ${p.stock > 0 ? "" : "btn-outline"}" ${p.stock > 0 ? "" : "disabled"}>
              ${p.stock > 0 ? "Agregar al carrito" : "Sin stock"}
            </button>
          </div>
        </div>`;
    }).join("");

    cont.querySelectorAll(".tarjeta").forEach((tarjeta) => {
      const id = parseInt(tarjeta.dataset.id, 10);
      const producto = productos.find((p) => p.id === id);
      let talleSeleccionado = null;
      const boton = tarjeta.querySelector(".btn");

      const talleBtns = tarjeta.querySelectorAll("[data-talle]");
      talleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          talleSeleccionado = btn.dataset.talle;
          talleBtns.forEach((b) => b.classList.remove("activo"));
          btn.classList.add("activo");
        });
      });

      boton.addEventListener("click", () => {
        if (producto.stock <= 0) return;
        if (talleBtns.length > 0 && !talleSeleccionado) {
          alert("Elegí un talle primero.");
          return;
        }
        agregarAlCarrito(producto, talleSeleccionado);
      });
    });
  }

  function mostrarToast(texto) {
    let toast = document.getElementById("toast-monic");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-monic";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = texto;
    toast.classList.add("visible");
    clearTimeout(mostrarToast._t);
    mostrarToast._t = setTimeout(() => toast.classList.remove("visible"), 2000);
  }

  function agregarAlCarrito(producto, talle) {
    const carrito = obtenerCarrito();
    const existente = carrito.find(
      (i) => i.producto_id === producto.id && i.talle === (talle || "")
    );
    if (existente) {
      existente.cantidad += 1;
    } else {
      carrito.push({
        producto_id: producto.id,
        talle: talle || "",
        nombre: producto.nombre,
        precio: producto.precio,
        imagen: producto.imagen,
        cantidad: 1,
      });
    }
    guardarCarrito(carrito);
    actualizarContador();
    mostrarToast("Producto agregado al carrito");
    if (window.location.pathname === "/carrito") {
      renderizarCarrito();
    }
  }

  function renderizarCarrito() {
    const cont = $("#carrito-contenido");
    const checkout = $("#checkout");
    if (!cont) return;
    const carrito = obtenerCarrito();

    if (carrito.length === 0) {
      cont.innerHTML = `
        <div class="vacio">
          <p>Tu carrito está vacío.</p>
          <br />
          <a href="/" class="btn btn-outline">Ir al catálogo</a>
        </div>`;
      if (checkout) checkout.style.display = "none";
      return;
    }

    cont.innerHTML = carrito.map((item, idx) => {
      const subtotal = item.precio * item.cantidad;
      return `
        <div class="item-carrito">
          ${item.imagen ? `<img src="/api/img/${encodeURIComponent(item.imagen)}" alt="${escapeHtml(item.nombre)}">` : ""}
          <div class="item-info">
            <div class="nombre">${escapeHtml(item.nombre)}</div>
            <div class="detalle">${item.talle ? "Talle " + escapeHtml(item.talle) : ""}</div>
            <div class="detalle">${formatearPrecio(item.precio)} c/u</div>
            <div class="cantidad-controles">
              <button data-acc="menos" data-idx="${idx}">-</button>
              <span>${item.cantidad}</span>
              <button data-acc="mas" data-idx="${idx}">+</button>
              <button class="link-btn" data-acc="quitar" data-idx="${idx}">Quitar</button>
            </div>
            <div class="detalle">Subtotal: ${formatearPrecio(subtotal)}</div>
          </div>
        </div>`;
    }).join("") +
      `<div class="total-carrito">
        <span>Total</span>
        <span id="total-texto">${formatearPrecio(carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0))}</span>
      </div>`;

    if (checkout) checkout.style.display = "block";

    cont.querySelectorAll("button[data-acc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const acc = btn.dataset.acc;
        if (acc === "menos") {
          carrito[idx].cantidad -= 1;
          if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
        } else if (acc === "mas") {
          carrito[idx].cantidad += 1;
        } else if (acc === "quitar") {
          carrito.splice(idx, 1);
        }
        guardarCarrito(carrito);
        renderizarCarrito();
      });
    });
  }

  async function initCarrito() {
    const form = $("#form-pedido");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = $("#nombre").value.trim();
      const telefono = $("#telefono").value.trim();
      const dni = $("#dni").value.trim();
      const website = ($("#website") || {}).value || "";
      const carrito = obtenerCarrito();
      const mensaje = $("#mensaje");

      if (carrito.length === 0) {
        mostrarMensaje(mensaje, "El carrito está vacío.", "error");
        return;
      }

      const items = carrito.map((i) => ({
        producto_id: i.producto_id,
        talle: i.talle,
        cantidad: i.cantidad,
      }));

      try {
        const res = await fetch("/api/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cliente: { nombre, telefono, dni }, items, website }),
        });
        const data = await res.json();
        if (!res.ok) {
          mostrarMensaje(mensaje, data.error || "No se pudo registrar el pedido.", "error");
          return;
        }
        localStorage.removeItem(CARRITO_KEY);
        actualizarContador();
        const total = data.pedido.total;
        $("#carrito-contenido").innerHTML = `
          <div class="vacio">
            <p>¡Pedido registrado correctamente!</p>
            <p>ID: #${data.pedido.id} — Total: ${formatearPrecio(total)}</p>
            <p>Gracias ${escapeHtml(data.pedido.cliente.nombre)}.</p>
            <br />
            <a href="/" class="btn btn-outline">Seguir comprando</a>
          </div>`;
        $("#checkout").style.display = "none";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        mostrarMensaje(mensaje, "Error de conexión con el servidor.", "error");
      }
    });
  }

  function init() {
    actualizarContador();
    const anio = $("#anio");
    if (anio) anio.textContent = new Date().getFullYear();

    if (document.getElementById("productos")) {
      cargarProductos();
    }
    if (document.getElementById("carrito-contenido")) {
      renderizarCarrito();
      initCarrito();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

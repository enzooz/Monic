(function () {
  const CARRITO_KEY = "monic_carrito";
  let productos = [];
  let categoriaActiva = "todos";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

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
    const img = (p.imagenes && p.imagenes[0]) || p.imagen || "";
    return img
      ? `<img src="/api/img/${encodeURIComponent(img)}" alt="${escapeHtml(p.nombre)}" loading="lazy" onerror="this.parentElement.classList.add('sin-imagen');this.style.display='none';" />`
      : `<span>Sin imagen</span>`;
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
      const img = (p.imagenes && p.imagenes[0]) || p.imagen || "";
      return `
        <a class="tarjeta-link" href="/producto/${p.id}">
          <div class="tarjeta-imagen ${img ? "" : "sin-imagen"}">${imagenProducto(p)}</div>
          <div class="tarjeta-categoria">${escapeHtml(p.categoria || "—")}</div>
          <div class="tarjeta-nombre">${escapeHtml(p.nombre)}</div>
          <div class="tarjeta-precio">${formatearPrecio(p.precio)}</div>
        </a>`;
    }).join("");
  }

  function agregarAlCarrito(producto, talle, color) {
    const carrito = obtenerCarrito();
    const colorHex = color && color.hex ? color.hex : "";
    const existente = carrito.find(
      (i) =>
        i.producto_id === producto.id &&
        i.talle === (talle || "") &&
        (i.color && i.color.hex ? i.color.hex : "") === colorHex
    );
    if (existente) {
      existente.cantidad += 1;
    } else {
      carrito.push({
        producto_id: producto.id,
        talle: talle || "",
        color: color || null,
        nombre: producto.nombre,
        precio: producto.precio,
        imagen: (producto.imagenes && producto.imagenes[0]) || producto.imagen || "",
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

  function colorHtml(item) {
    if (!item.color || !item.color.hex) return "";
    return `<span class="mini-swatch" style="background:${escapeHtml(item.color.hex)}"></span> ${escapeHtml(item.color.nombre || item.color.hex)}`;
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
            <div class="detalle">${colorHtml(item)}</div>
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
        color: i.color,
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

  // ---------- Ficha de producto ----------

  function idDesdeURL() {
    const sp = new URLSearchParams(location.search);
    const q = sp.get("id");
    if (q && /^\d+$/.test(q)) return parseInt(q, 10);
    const seg = location.pathname.split("/").filter(Boolean);
    const ultimo = seg[seg.length - 1];
    if (/^\d+$/.test(ultimo)) return parseInt(ultimo, 10);
    return null;
  }

  function coloresHtml(colores, nombrePorHex) {
    return colores
      .map((hex) => {
        const nombre = nombrePorHex[hex.toLowerCase()] || hex;
        return `<button class="swatch" data-hex="${hex}" data-nombre="${escapeHtml(nombre)}" title="${escapeHtml(nombre)}" style="background:${hex}"></button>`;
      })
      .join("");
  }

  async function initProducto() {
    const cont = $("#producto");
    if (!cont) return;

    const id = idDesdeURL();
    if (id === null) {
      cont.innerHTML = `<div class="producto-vacio"><p>Producto no encontrado.</p></div>`;
      return;
    }

    let nombrePorHex = {};
    try {
      const cr = await fetch("/api/colores");
      const cd = await cr.json();
      (cd.colores || []).forEach((c) => (nombrePorHex[c.hex.toLowerCase()] = c.nombre));
    } catch (e) {}

    const res = await fetch(`/api/productos/${id}`);
    const data = await res.json();
    if (!res.ok) {
      cont.innerHTML = `<div class="producto-vacio"><p>${escapeHtml(data.error || "Producto no encontrado.")}</p></div>`;
      return;
    }
    const p = data.producto;

    const imagenes = (p.imagenes && p.imagenes.length) ? p.imagenes : (p.imagen ? [p.imagen] : []);
    const talles = p.talles || [];
    const colores = p.colores || [];
    let seleccion = { talle: null, color: null };

    cont.innerHTML = `
      <div class="producto-ficha">
        <div class="producto-galeria">
          <div class="galeria-principal ${imagenes.length ? "" : "sin-imagen"}">
            ${
              imagenes.length
                ? `<img id="galeria-img" src="/api/img/${encodeURIComponent(imagenes[0])}" alt="${escapeHtml(p.nombre)}">`
                : "<span>Sin imagen</span>"
            }
          </div>
          ${
            imagenes.length > 1
              ? `<div class="galeria-mini" id="galeria-mini">${imagenes
                  .map(
                    (img, i) =>
                      `<img src="/api/img/${encodeURIComponent(img)}" alt="" data-i="${i}" class="${i === 0 ? "activa" : ""}">`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="producto-info">
          <div class="producto-categoria">${escapeHtml(p.categoria || "")}</div>
          <h1 class="producto-nombre">${escapeHtml(p.nombre)}</h1>
          <div class="producto-precio">${formatearPrecio(p.precio)}</div>
          ${p.descripcion ? `<p class="producto-descripcion">${escapeHtml(p.descripcion)}</p>` : ""}
          ${
            talles.length
              ? `<div class="producto-opciones">
                  <div class="opciones-etiqueta">Talle</div>
                  <div class="selector-grupo">${talles
                    .map((t) => `<button class="talle-btn" data-valor="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
                    .join("")}</div>
                </div>`
              : ""
          }
          ${
            colores.length
              ? `<div class="producto-opciones">
                  <div class="opciones-etiqueta">Color</div>
                  <div class="selector-grupo">${coloresHtml(colores, nombrePorHex)}</div>
                </div>`
              : ""
          }
          <button class="btn btn-block ${p.stock > 0 ? "" : "sin-stock"}" id="btn-agregar" ${p.stock > 0 ? "" : "disabled"}>
            ${p.stock > 0 ? "Agregar al carrito" : "Sin stock"}
          </button>
          <div class="producto-acciones">
            <a href="/" class="link-btn">Volver al catálogo</a>
            <a class="link-btn" id="compartir-wa" target="_blank" rel="noopener">Compartir por WhatsApp</a>
          </div>
        </div>
      </div>`;

    $$("#galeria-mini img").forEach((img) => {
      img.addEventListener("click", () => {
        $$("#galeria-mini img").forEach((m) => m.classList.remove("activa"));
        img.classList.add("activa");
        $("#galeria-img").src = img.src;
      });
    });

    const talleBtns = $$("#producto .talle-btn");
    talleBtns.forEach((b) =>
      b.addEventListener("click", () => {
        seleccion.talle = b.dataset.valor;
        talleBtns.forEach((x) => x.classList.remove("activo"));
        b.classList.add("activo");
      })
    );

    const swatches = $$("#producto .swatch");
    swatches.forEach((b) =>
      b.addEventListener("click", () => {
        seleccion.color = { hex: b.dataset.hex, nombre: b.dataset.nombre };
        swatches.forEach((x) => x.classList.remove("activo"));
        b.classList.add("activo");
      })
    );

    const wa = $("#compartir-wa");
    if (wa) {
      wa.href = `https://wa.me/?text=${encodeURIComponent(
        `${p.nombre} - ${formatearPrecio(p.precio)}\n${location.href}`
      )}`;
    }

    $("#btn-agregar").addEventListener("click", () => {
      if (p.stock <= 0) return;
      if (talles.length && !seleccion.talle) {
        alert("Elegí un talle primero.");
        return;
      }
      if (colores.length && !seleccion.color) {
        alert("Elegí un color primero.");
        return;
      }
      agregarAlCarrito(p, seleccion.talle, seleccion.color);
    });

    const migaIni = $("#miga-categoria");
    const migaFin = $("#miga-producto");
    if (migaIni) migaIni.textContent = p.categoria ? ` / ${p.categoria}` : "";
    if (migaFin) migaFin.textContent = ` / ${p.nombre}`;
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
    if (document.getElementById("producto")) {
      initProducto();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
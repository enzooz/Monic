# Monic Indumentaria — Información del Proyecto

## Resumen

Sitio web de catálogo y pedidos para la indumentaria **"Monic Indumentaria"**. Diseño minimalista (colores neutros, mucho espacio en blanco, tipografía limpia) enfocado en mostrar productos con imágenes y permitir a los clientes realizar pedidos, más un panel de administración para gestionar productos, colores y pedidos.

## Estado actual

Migrado de un servidor Flask local a la plataforma **Netlify** (hosting estático + serverless functions + blob storage). En línea en `https://indumentariamonic.netlify.app`.

### Arquitectura legacy (`legacy-flask/`, ya no se usa)

- **Backend:** Python 3 + Flask (`legacy-flask/app.py`)
- **Frontend:** HTML, CSS, JavaScript vanilla
- **Almacenamiento:** Archivos JSON locales (`legacy-flask/datos/`)
- **Imágenes:** Archivos locales en `legacy-flask/img/`
- **Servidor:** Flask dev server en `localhost:5000`, expuesto con túnel de Cloudflare

### Arquitectura actual (Netlify)

- **Frontend:** HTML, CSS, JavaScript vanilla servidos como sitio estático (`public/`)
- **Backend:** Netlify Functions en JavaScript (una función por grupo de endpoints)
- **Persistencia:** Netlify Blobs (stores `datos` para productos/pedidos/colores/movimientos e `imagenes` para imágenes)
- **Deploy:** Repositorio Git + GitHub + Netlify (push = deploy automático)
- **Auth admin:** Usuario/contraseña vía variables de entorno, cookie de sesión firmada (HMAC)

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Backend | Netlify Functions (JavaScript, ESM) |
| Almacenamiento | Netlify Blobs (`@netlify/blobs`) |
| Imágenes | Netlify Blobs, servidas vía `/api/img/...` |
| Hosting | Netlify (`*.netlify.app`) |
| VCS | Git + GitHub |

## Estructura de carpetas

```
Monic/
├── netlify.toml              # Configuración de Netlify (build, redirects, páginas)
├── package.json              # Dependencias (Netlify CLI dev, @netlify/blobs)
├── public/                   # Sitio estático
│   ├── index.html            # Catálogo (tarjetas enlazan a la ficha de cada producto)
│   ├── carrito.html          # Carrito de compras
│   ├── admin.html            # Panel de administración (Productos · Stock · Movimientos · Marcas · Colores · Pedidos)
│   ├── producto.html         # Ficha de producto (galería, talle, color, WhatsApp)
│   ├── css/style.css         # Estilos minimalistas
│   └── js/
│       ├── utils.js          # Funciones compartidas
│       ├── main.js           # Lógica de la tienda pública (catálogo + ficha + carrito)
│       └── admin.js          # Lógica del panel admin
├── netlify/functions/        # Backend (Netlify Functions)
│   ├── estado.js             # GET    /api/estado
│   ├── login.js              # POST   /api/login  (rate limit por IP)
│   ├── logout.js             # POST   /api/logout
│   ├── verificar.js          # GET    /api/verificar
│   ├── productos.js          # GET/POST /api/productos
│   ├── producto.js           # GET/PUT/DELETE /api/productos/:id
│   ├── categorias.js         # GET    /api/categorias
│   ├── colores.js            # GET/POST/DELETE /api/colores (palet global)
│   ├── marcas.js             # GET/POST/DELETE /api/marcas (lista de marcas)
│   ├── stock.js              # POST   /api/stock (reponer/ajustar/merma/devolución)
│   ├── movimientos.js        # GET    /api/movimientos (historial de movimientos)
│   ├── pedidos.js            # GET/POST /api/pedidos (rate limit por IP)
│   ├── upload.js             # POST   /api/upload (sube imágenes a Blobs)
│   └── imagen.js             # GET    /api/img/:archivo (sirve imágenes)
├── lib/                      # Lógica compartida entre funciones
│   ├── datos.js              # Lectura/escritura de Blobs + validaciones
│   ├── auth.js               # Cookie de sesión firmada (HMAC)
│   └── responder.js          # Helper de respuestas JSON
├── .env.example              # Variables de entorno de ejemplo
├── README.md                 # Guía de instalación y deploy
├── legacy-flask/             # Código Flask original (solo referencia)
└── Información_proyecto.md   # Este documento
```

## Sistema de datos

### Productos (store `datos`, clave `productos`)

```json
[
  {
    "id": 1,
    "nombre": "Remera Básica",
    "categoria": "Remeras",
    "marca": "Nike",
    "codigo": "NOM0000",
    "precio": 15000,
    "talles": ["S", "M", "L", "XL"],
    "colores": ["#FFFFFF", "#000000"],
    "stock": { "S": 5, "M": 10, "L": 5, "XL": 0 },
    "imagenes": ["abc123.jpg", "def456.jpg"],
    "descripcion": "Remera de algodón suave"
  }
]
```

- **Colores:** se guardan como **hex** (`#RRGGBB`). Se eligen desde el palet global (store `datos`, clave `colores`), que administra el panel admin. El palet arranca con blanco `#FFFFFF` y negro `#000000`.
- **Marca:** texto tomado de la lista global de marcas (store `datos`, clave `marcas`), administrada desde la pestaña **Marcas**. Puede quedar sin marca.
- **Código / clave:** identificador editable por producto. Si no se carga, queda el valor por defecto `NOM0000`. **Debe ser único** (no se permiten dos productos con la misma clave).
- **Imágenes:** cada producto puede tener **una o varias**; se guardan en el store `imagenes` de Blobs con nombre único (UUID) y se referencian por ese nombre. La ficha muestra galería con miniaturas; el catálogo/carrito usan la primera.
- **Stock:** es un objeto **por talle** (`{ talle: cantidad }`). Para productos sin talles se usa la clave vacía `""`. Los productos legacy con stock numérico se migran automáticamente al leerlos (el total se reparte entre los talles, o queda bajo `""` si no hay talles). La cantidad nunca puede ser negativa.
- El catálogo inicia vacío y se carga desde el panel admin.

### Colores (store `datos`, clave `colores`)

```json
[
  { "id": "blanco", "nombre": "Blanco", "hex": "#FFFFFF" },
  { "id": "negro", "nombre": "Negro", "hex": "#000000" }
]
```

Cada producto guarda una **copia del hex** en su campo `colores`, así que borrar un color del palet no modifica productos ya cargados.

### Marcas (store `datos`, clave `marcas`)

```json
[
  { "id": "a1b2c3d4-...", "nombre": "Nike" },
  { "id": "e5f6a7b8-...", "nombre": "Adidas" }
]
```

Cada producto guarda el **nombre** de la marca en su campo `marca` (no el id), así que renombrar/borrar una marca no rompe productos ya cargados. La lista arranca vacía y se administra desde la pestaña **Marcas**.

### Movimientos de stock (store `datos`, clave `movimientos`)

```json
[
  {
    "id": 12,
    "fecha": "2026-09-01 14:30",
    "producto_id": 1,
    "producto_nombre": "Remera Básica",
    "talle": "M",
    "tipo": "venta",
    "motivo": "Venta (pedido #12)",
    "delta": -2,
    "stock_resultante": 8
  }
]
```

- **Tipos:** `alta` (producto creado con stock), `venta` (descuento por pedido), `reposicion` (+), `ajuste` (valor absoluto), `merma` (−), `devolucion` (+).
- `delta` es la variación aplicada y `stock_resultante` el stock del talle tras el movimiento.
- Se generan automáticamente desde productos/pedidos/stock y se consultan en la pestaña **Movimientos** del admin (filtros por producto y tipo).

### Pedidos (store `datos`, clave `pedidos`)

```json
[
  {
    "id": 1,
    "fecha": "2026-09-01 14:30",
    "cliente": {
      "nombre": "Juan Pérez",
      "telefono": "11-5555-1234",
      "dni": "30123456"
    },
    "items": [
      {
        "producto_id": 1,
        "nombre": "Remera Básica",
        "talle": "M",
        "color": "#FFFFFF",
        "color_nombre": "Blanco",
        "cantidad": 2,
        "precio_unitario": 15000
      }
    ],
    "total": 30000
  }
]
```

- **Identificación del cliente:** nombre + teléfono + DNI.
- No se captura dirección de envío; solo identificación y detalle del pedido.
- Los pedidos solo se registran (sin estados de seguimiento).

## Páginas y endpoints

### Páginas públicas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `index.html` | Catálogo con filtros por categoría; cada tarjeta es un link a su ficha |
| `/producto/:id` | `producto.html?id=:id` | Ficha del producto: galería, talle, color, agregar al carrito, compartir por WhatsApp |
| `/carrito` | `carrito.html` | Revisar selección (muestra talle y color) y confirmar pedido |
| `/admin` | `admin.html` | Login y panel de administración (protegido por contraseña) |

### API

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/estado` | Público | Estado de la plataforma |
| POST | `/api/login` | Público (rate limit) | Autenticación admin |
| POST | `/api/logout` | Admin | Cerrar sesión |
| GET | `/api/verificar` | Público | ¿Sesión admin activa? |
| GET | `/api/productos` | Público | Lista de productos |
| POST | `/api/productos` | Admin | Agregar producto |
| GET | `/api/productos/:id` | Público | Detalle de un producto (ficha) |
| PUT | `/api/productos/:id` | Admin | Modificar producto |
| DELETE | `/api/productos/:id` | Admin | Eliminar producto |
| GET | `/api/categorias` | Público | Lista de categorías (de los productos existentes) |
| GET | `/api/colores` | Público | Palet global de colores (seed blanco/negro si está vacío) |
| POST | `/api/colores` | Admin | Agregar color al palet `{nombre, hex}` |
| DELETE | `/api/colores?id=...` | Admin | Eliminar color del palet |
| GET | `/api/marcas` | Público | Lista global de marcas |
| POST | `/api/marcas` | Admin | Agregar marca `{nombre}` |
| DELETE | `/api/marcas?id=...` | Admin | Eliminar marca |
| POST | `/api/stock` | Admin | Ajustar stock de un talle `{producto_id, talle, delta\|nuevo, tipo?, motivo?}` |
| GET | `/api/movimientos` | Admin | Historial de movimientos (filtros `?producto_id=&tipo=&limite=`) |
| GET | `/api/pedidos` | Admin | Listar pedidos |
| POST | `/api/pedidos` | Público (rate limit) | Registrar un pedido |
| POST | `/api/upload` | Admin | Subir una imagen (multipart, campo `imagen`) |
| GET | `/api/img/:archivo` | Público | Servir una imagen desde Blobs |

### Flujo de compra

1. El cliente entra a la ficha de un producto (`/producto/:id`).
2. Elige talle y color (según los que tenga cargados) y toca **Agregar al carrito** → aparece un toast de confirmación. Los talles sin stock aparecen deshabilitados y el botón refleja el stock del talle elegido.
3. En el carrito revisa la selección (talle + color) y completa nombre, teléfono, DNI.
4. Confirma → el backend valida, descuenta el stock del talle correspondiente y guarda el pedido + los movimientos de stock en Blobs.
5. Se confirma el total y el ID del pedido.

## Validaciones

- **Cliente:** nombre ≥ 2 caracteres; teléfono `[\d\-\+\s()]{6,20}`; DNI 7 u 8 dígitos.
- **Producto:** nombre obligatorio; `talles`, `colores` e `imagenes` son arrays de texto no vacío; el `stock` se normaliza a un entero ≥ 0 por talle. La `marca` es opcional. El `codigo` por defecto es `NOM0000` y **no puede repetirse** entre productos.
- **Marca (lista):** nombre obligatorio; no se permiten nombres duplicados.
- **Color (palet):** nombre obligatorio; hex con formato `#RRGGBB`; no se permiten hex duplicados.
- **Stock:** el talle debe existir en el producto (o `""` si no tiene talles); el stock nunca queda negativo (se acota a 0); `ajuste` fija un valor absoluto; si el resultado no cambia, no se registra movimiento.
- **Pedido:** no vacío; cada item debe referenciar un producto existente; cantidad > 0; stock suficiente **del talle elegido**.
- **Imágenes:** extensiones permitidas `jpg/jpeg/png/gif/webp/svg`; tamaño máximo ~4.5MB (límite de Netlify).

## Seguridad

- **Admin:** solo usuario y contraseña (variables `MONIC_ADMIN_USER` / `MONIC_ADMIN_PASS` en Netlify). No existe restricción de "localhost" porque en la nube no aplica.
- **Sesión:** cookie HttpOnly + Secure + SameSite=Lax, firmada con HMAC usando `MONIC_SECRET_KEY`.
- **Anti-spam de pedidos:** campo honeypot (`website`) oculto + rate limiting nativo de Netlify (`config.rateLimit`) sobre `/api/pedidos` y `/api/login`.
- **Secretos:** `.env`, `.secret_key`, `legacy-flask/datos/` y binarios están en `.gitignore` (no se suben a GitHub).

## Variables de entorno (Netlify)

| Variable | Descripción | Default local |
|----------|-------------|---------------|
| `MONIC_ADMIN_USER` | Usuario del panel admin | `admin` |
| `MONIC_ADMIN_PASS` | Contraseña del panel admin | `monic123` |
| `MONIC_SECRET_KEY` | Clave para firmar cookies de sesión | aleatoria persistida en `.secret_key` |

> El `.env.example` documenta las variables; en Netlify se configuran en *Site settings → Environment variables* y se pueden editar en cualquier momento sin tocar código.

## Configuración de Netlify (`netlify.toml`)

- `[build] publish = "public"` — la carpeta servida como sitio estático.
- Redirects de páginas limpias: `/carrito` → `/carrito.html`, `/admin` → `/admin.html`, `/producto/:id` → `/producto.html?id=:id`.
- El resto de rutas `/api/*` se enrutan automáticamente a las funciones por su ruta declarada.

## Cómo ejecutar en local (desarrollo)

Requisitos: Node.js + npm.

```bash
# Instalar dependencias
npm.cmd install

# Levantar el entorno local de Netlify (funciones + sitio estático)
npx.cmd netlify dev
```

Abrir `http://localhost:8888`. Las funciones y Blobs corren en un sandbox local. Nota: en el dev server las rutas de funciones con parámetros (`/api/productos/:id`) se prueban con varias variantes de URL (`/7.html`, `/7.htm`, `/7/index.html`) — el backend ya las tolera.

## Deploy (git → GitHub → Netlify)

1. `git init` en la raíz del proyecto, `git add -A`, commit.
2. `git remote add origin https://github.com/enzooz/Monic.git`
3. `git branch -M main` y `git push -u origin main`.
4. En Netlify: *Add new site → Import an existing project → GitHub*, elegir el repo.
5. Configurar variables de entorno en el panel de Netlify.
6. Cada `git push` genera un deploy automático; se puede configurar dominio propio en *Site settings → Domain management*.

## Próximos pasos / mejoras pendientes

- **Stock por talle × color** si el negocio lo requiere — hoy el stock es por talle.
- Optimización de imágenes con Netlify Image CDN (redimensionar/optimizar al vuelo).
- Dominio propio (`monic.com.ar` o similar).
- Manejo de concurrencia en Blobs con `etag` (compare-and-swap) si el volumen de pedidos crece.
- Estados de pedido / seguimiento (fuera de alcance original).
- Sección de "productos relacionados" (misma categoría) en la ficha.
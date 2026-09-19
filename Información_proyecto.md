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
- **Persistencia:** Netlify Blobs (stores `datos` para productos/pedidos/colores e `imagenes` para imágenes)
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
│   ├── admin.html            # Panel de administración (Productos · Colores · Pedidos)
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
    "precio": 15000,
    "talles": ["S", "M", "L", "XL"],
    "colores": ["#FFFFFF", "#000000"],
    "stock": 20,
    "imagenes": ["abc123.jpg", "def456.jpg"],
    "descripcion": "Remera de algodón suave"
  }
]
```

- **Colores:** se guardan como **hex** (`#RRGGBB`). Se eligen desde el palet global (store `datos`, clave `colores`), que administra el panel admin. El palet arranca con blanco `#FFFFFF` y negro `#000000`.
- **Imágenes:** cada producto puede tener **una o varias**; se guardan en el store `imagenes` de Blobs con nombre único (UUID) y se referencian por ese nombre. La ficha muestra galería con miniaturas; el catálogo/carrito usan la primera.
- El stock es **global por producto** (no por talle/color).
- El catálogo inicia vacío y se carga desde el panel admin.

### Colores (store `datos`, clave `colores`)

```json
[
  { "id": "blanco", "nombre": "Blanco", "hex": "#FFFFFF" },
  { "id": "negro", "nombre": "Negro", "hex": "#000000" }
]
```

Cada producto guarda una **copia del hex** en su campo `colores`, así que borrar un color del palet no modifica productos ya cargados.

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
| GET | `/api/pedidos` | Admin | Listar pedidos |
| POST | `/api/pedidos` | Público (rate limit) | Registrar un pedido |
| POST | `/api/upload` | Admin | Subir una imagen (multipart, campo `imagen`) |
| GET | `/api/img/:archivo` | Público | Servir una imagen desde Blobs |

### Flujo de compra

1. El cliente entra a la ficha de un producto (`/producto/:id`).
2. Elige talle y color (según los que tenga cargados) y toca **Agregar al carrito** → aparece un toast verde de confirmación.
3. En el carrito revisa la selección (talle + color) y completa nombre, teléfono, DNI.
4. Confirma → el backend valida, descuenta stock y guarda el pedido en Blobs.
5. Se confirma el total y el ID del pedido.

## Validaciones

- **Cliente:** nombre ≥ 2 caracteres; teléfono `[\d\-\+\s()]{6,20}`; DNI 7 u 8 dígitos.
- **Producto:** nombre obligatorio; `talles`, `colores` e `imagenes` son arrays de texto no vacío; stock no puede quedar negativo en un pedido.
- **Color (palet):** nombre obligatorio; hex con formato `#RRGGBB`; no se permiten hex duplicados.
- **Pedido:** no vacío; cada item debe referenciar un producto existente; cantidad > 0; stock suficiente.
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

- **Stock por variante** (talle × color) si el negocio lo requiere — hoy el stock es global por producto.
- Optimización de imágenes con Netlify Image CDN (redimensionar/optimizar al vuelo).
- Dominio propio (`monic.com.ar` o similar).
- Manejo de concurrencia en Blobs con `etag` (compare-and-swap) si el volumen de pedidos crece.
- Estados de pedido / seguimiento (fuera de alcance original).
- Sección de "productos relacionados" (misma categoría) en la ficha.
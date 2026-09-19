# Monic Indumentaria — Información del Proyecto

## Resumen

Sitio web de catálogo y pedidos para la indumentaria **"Monic Indumentaria"**. Diseño minimalista (colores neutros, mucho espacio en blanco, tipografía limpia) enfocado en mostrar productos con imágenes y permitir a los clientes realizar pedidos, más un panel de administración para gestionar productos y ver pedidos.

## Estado actual

En migración de un servidor Flask local a la plataforma **Netlify** (hosting estático + serverless functions + blob storage).

### Arquitectura pre-migración (legacy, rama `legacy-flask`)

- **Backend:** Python 3 + Flask (`app.py`)
- **Frontend:** HTML, CSS, JavaScript vanilla
- **Almacenamiento:** Archivos JSON locales (`datos/productos.json`, `datos/pedidos.json`)
- **Imágenes:** Archivos locales en `static/img/`
- **Servidor:** Flask dev server en `localhost:5000`, expuesto con túnel de Cloudflare (`cloudflared.exe`) compartiendo una URL temporal.

### Arquitectura objetivo (Netlify)

- **Frontend:** HTML, CSS, JavaScript vanilla servidos como sitio estático (`public/`)
- **Backend:** Netlify Functions en JavaScript (una función por grupo de endpoints)
- **Persistencia:** Netlify Blobs (stores `datos` para productos/pedidos e `imagenes` para imágenes)
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
├── public/                   # Sitio estático (antes templates/ + static/)
│   ├── index.html            # Página principal (catálogo)
│   ├── carrito.html          # Carrito de compras
│   ├── admin.html            # Panel de administración
│   ├── css/style.css         # Estilos minimalistas
│   └── js/
│       ├── utils.js          # Funciones compartidas
│       ├── main.js           # Lógica de la tienda pública
│       └── admin.js          # Lógica del panel admin
├── netlify/functions/        # Backend (Netlify Functions)
│   ├── estado.js             # GET  /api/estado
│   ├── auth.js               # POST /api/login · POST /api/logout · GET /api/verificar
│   ├── productos.js          # GET/POST  /api/productos
│   ├── producto.js           # PUT/DELETE /api/productos/:id
│   ├── categorias.js         # GET  /api/categorias
│   ├── pedidos.js            # GET/POST  /api/pedidos
│   ├── upload.js             # POST /api/upload (sube imágenes a Blobs)
│   └── imagen.js             # GET  /api/img/:archivo (sirve imágenes)
├── lib/                      # Lógica compartida entre funciones
│   ├── datos.js              # Lectura/escritura de Blobs + validaciones
│   └── auth.js               # Cookie de sesión firmada (HMAC)
├── datos/                    # (legacy) Respaldos JSON pre-migración
└── Información_proyecto.md   # Este documento
```

## Sistema de datos

### Productos (store `datos`, clave `productos`)

Formato usado históricamente (se conserva en la migración):

```json
[
  {
    "id": 1,
    "nombre": "Remera Básica",
    "categoria": "Remeras",
    "precio": 15000,
    "talles": ["S", "M", "L", "XL"],
    "stock": 20,
    "imagen": "archivo-único.jpg",
    "descripcion": "Remera de algodón suave"
  }
]
```

- Las imágenes se guardan en el store `imagenes` de Blobs con un nombre único y se referencian por ese nombre.
- El catálogo inicia **vacío** y se carga desde el panel admin.

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
- Los pedidos **solo se registran** (sin estados de seguimiento).

## Páginas y endpoints

### Páginas públicas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `index.html` | Catálogo con filtros por categoría |
| `/carrito` | `carrito.html` | Revisar selección y confirmar pedido (nombre, teléfono, DNI) |
| `/admin` | `admin.html` | Login y panel de administración (protegido por contraseña) |

### API

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/estado` | Público | Estado de la plataforma |
| POST | `/api/login` | Público (con rate limit) | Autenticación admin |
| POST | `/api/logout` | Admin | Cerrar sesión |
| GET | `/api/verificar` | Público | ¿Sesión admin activa? |
| GET | `/api/productos` | Público | Lista de productos |
| POST | `/api/productos` | Admin | Agregar producto |
| PUT | `/api/productos/:id` | Admin | Modificar producto |
| DELETE | `/api/productos/:id` | Admin | Eliminar producto |
| GET | `/api/categorias` | Público | Lista de categorías (de los productos existentes) |
| GET | `/api/pedidos` | Admin | Listar pedidos |
| POST | `/api/pedidos` | Público (con rate limit) | Registrar un pedido |
| POST | `/api/upload` | Admin | Subir una imagen (multipart/form-data, campo `imagen`) |
| GET | `/api/img/:archivo` | Público | Servir una imagen desde Blobs |

### Flujo de pedido

1. El cliente agrega productos al carrito (localStorage).
2. Ingresa al carrito y completa sus datos (nombre, teléfono, DNI).
3. Confirma → el backend valida, descuenta stock y guarda el pedido en Blobs.
4. Se confirma el total y el ID del pedido.

## Validaciones

- **Cliente:** nombre ≥ 2 caracteres; teléfono `[\d\-\+\s()]{6,20}`; DNI 7 u 8 dígitos.
- **Producto:** nombre obligatorio; stock no puede quedar negativo en un pedido.
- **Pedido:** no vacío; cada item debe referenciar un producto existente; cantidad > 0; stock suficiente.
- **Imágenes:** extensiones permitidas `jpg/jpeg/png/gif/webp/svg`; tamaño máximo ~4.5MB (límite de Netlify).

## Seguridad

- **Admin:** solo usuario y contraseña (variables `MONIC_ADMIN_USER` / `MONIC_ADMIN_PASS` en Netlify). No existe restricción de "localhost" porque en la nube no aplica.
- **Sesión:** cookie HttpOnly + Secure + SameSite=Lax, firmada con HMAC usando `MONIC_SECRET_KEY`.
- **Anti-spam de pedidos:** campo honeypot (`website`) oculto + rate limiting nativo de Netlify (`config.rateLimit`) sobre `/api/pedidos` y `/api/login`.
- **Secretos:** `.env`, `.secret_key`, `datos/*.json` y binarios están en `.gitignore` (no se suben a GitHub).

## Variables de entorno (Netlify)

| Variable | Descripción | Default local |
|----------|-------------|---------------|
| `MONIC_ADMIN_USER` | Usuario del panel admin | `admin` |
| `MONIC_ADMIN_PASS` | Contraseña del panel admin | `monic123` |
| `MONIC_SECRET_KEY` | Clave para firmar cookies de sesión | aleatoria persistida en `.secret_key` |

> El `.env.example` documenta las variables; en Netlify se configuran en *Site settings → Environment variables* y se pueden editar en cualquier momento sin tocar código.

## Configuración de Netlify (`netlify.toml`)

- `[build] publish = "public"` — la carpeta servida como sitio estático.
- Redirects de páginas limpias: `/carrito` → `/carrito.html`, `/admin` → `/admin.html`.
- El resto de rutas `/api/*` se enrutan automáticamente a las funciones por su ruta declarada.

## Cómo ejecutar en local (desarrollo)

Requisitos: Node.js + npm.

```bash
# Instalar dependencias
npm.cmd install

# Levantar el entorno local de Netlify (funciones + sitio estático)
npx.cmd netlify dev
```

Abrir `http://localhost:8888`. Las funciones y Blobs corren en un sandbox local.

## Deploy (git → GitHub → Netlify)

1. `git init` en la raíz del proyecto, `git add -A`, commit.
2. `git remote add origin https://github.com/<usuario>/Monic.git`
3. `git branch -M main` y `git push -u origin main`.
4. En Netlify: *Add new site → Import an existing project → GitHub*, elegir el repo.
5. Configurar variables de entorno en el panel de Netlify.
6. Cada `git push` genera un deploy automático; se puede configurar dominio propio en *Site settings → Domain management*.

## Próximos pasos / mejoras pendientes

- Optimización de imágenes con Netlify Image CDN (redimensionar/optimizar al vuelo).
- Dominio propio (`monic.com.ar` o similar).
- Manejo de concurrencia en Blobs con `etag` (compare-and-swap) si el volumen de pedidos crece.
- Estados de pedido / seguimiento (fuera de alcance original).
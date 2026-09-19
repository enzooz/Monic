# Monic Indumentaria

Sitio web de catálogo y pedidos para la indumentaria "Monic Indumentaria". Diseño minimalista: muestra productos con imágenes y permite a los clientes realizar pedidos. La administración se hace desde un panel privado.

## Stack

- **Hosting:** Netlify (sitio estático + Netlify Functions + Netlify Blobs)
- **Backend:** JavaScript (Node) como funciones Netlify
- **Frontend:** HTML, CSS, JavaScript vanilla
- **Almacenamiento:** Netlify Blobs (sin base de datos ni archivos locales)

## Pre-requisitos

- Node.js 18+
- Cuenta de GitHub y de Netlify

## Instalación

```bash
git clone <url-del-repo>
cd Monic
npm install
```

Incluye `netlify-cli` como dependencia de desarrollo para probar en local:

```bash
npm run start        # abre http://localhost:8888
```

## Configuración

La autenticación del panel admin se configura con variables de entorno (ver `.env.example`):

| Variable           | Descripción                                          | Default   |
| ------------------ | ---------------------------------------------------- | --------- |
| `MONIC_ADMIN_USER` | Usuario del panel de administración                   | `admin`   |
| `MONIC_ADMIN_PASS` | Contraseña del panel (dejar la default NO es seguro) | `monic123` |
| `MONIC_SECRET_KEY` | Clave para firmar la cookie de sesión                 | aleatoria |

Para pruebas locales, copiar `.env.example` a `.env`. En producción, definir las variables en la consola de Netlify (Site settings → Environment variables).

## Estructura

```
Monic/
├── netlify.toml          # Configuración de build, publish y redirects
├── package.json          # Dependencias de runtime y netlify-cli
├── lib/                  # Lógica compartida de las funciones
│   ├── datos.js          # Blobs: productos, pedidos, validaciones
│   ├── auth.js           # Sesión admin (cookie firmada HMAC)
│   └── responder.js      # Helper de respuestas JSON
├── netlify/functions/    # API (backend)
│   ├── productos.js      # GET/POST /api/productos
│   ├── producto.js       # PUT/DELETE /api/productos/*
│   ├── pedidos.js        # POST público + GET admin /api/pedidos
│   ├── categorias.js     # GET /api/categorias
│   ├── upload.js         # POST /api/upload (imágenes admin)
│   ├── imagen.js         # GET /api/img/* (sirve imágenes)
│   ├── login.js          # POST /api/login
│   ├── logout.js         # POST /api/logout
│   ├── verificar.js      # GET /api/verificar (sesión)
│   └── estado.js         # GET /api/estado (health)
├── public/               # Sitio estático publicado
│   ├── index.html        # Catálogo con filtros por categoría
│   ├── carrito.html      # Carrito y datos del cliente
│   ├── admin.html        # Panel de administración
│   ├── css/style.css
│   └── js/               # utils.js, main.js, admin.js
└── legacy-flask/         # Código Flask original (referencia)
```

## Deploy

1. Subir el repo a GitHub.
2. En Netlify: "Add new site → Import an existing project", elegir el repo.
3. Build command: `npm ci --omit=dev` · Publish directory: `public`.
4. Definir las variables de entorno (`MONIC_ADMIN_USER`, `MONIC_ADMIN_PASS`, `MONIC_SECRET_KEY`).
5. Cada `git push` a la rama main despliega automáticamente.

## Uso público

- `/` — Catálogo de productos con filtros por categoría
- `/carrito` — Revisar selección, completar datos (nombre, teléfono, DNI) y confirmar pedido

## Panel de administración

- `/admin` — Login con `MONIC_ADMIN_USER` / `MONIC_ADMIN_PASS`
- Permite agregar, editar y eliminar productos (con subida de imágenes) y ver pedidos recibidos
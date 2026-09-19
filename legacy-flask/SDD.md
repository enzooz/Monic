# SDD — Monic Indumentaria

Sitio web local para la indumentaria "Monic Indumentaria". Diseño minimalista, enfocado en mostrar productos con imágenes y permitir a los clientes realizar pedidos.

## 1. Resumen

- **Nombre:** Monic Indumentaria
- **Tipo:** Página web localhost
- **Estética:** Minimalista (colores neutros, mucho espacio en blanco, tipografía limpia)
- **Backend:** Python + Flask
- **Frontend:** HTML + CSS + JavaScript (vanilla)
- **Persistencia:** Archivos JSON locales

## 2. Objetivos / Prioridades

1. **Cargar imágenes** de los productos (archivos locales).
2. **Registrar pedidos** en un archivo JSON.
3. Diferenciar clientes por **nombre, teléfono y DNI**.
4. Panel de administración **solo accesible desde la máquina local**, protegido con **login/contraseña**, para gestionar el stock.

## 3. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Backend | Python 3 + Flask |
| Almacenamiento | Archivos JSON locales (`pedidos.json`, `productos.json`) |
| Imágenes | Archivos locales en carpeta `static/img/` |
| Servidor local | Flask dev server (`localhost`) |

## 4. Estructura de Carpetas

```
Monic/
├── app.py                 # Servidor Flask (backend)
├── requirements.txt       # Dependencias Python
├── SDD.md                 # Este documento
├── datos/
│   ├── productos.json     # Catálogo de productos (stock)
│   └── pedidos.json       # Pedidos de clientes
├── static/
│   ├── css/
│   │   └── style.css      # Estilos minimalistas
│   ├── js/
│   │   ├── main.js        # Lógica de la tienda pública
│   │   └── admin.js       # Lógica del panel admin
│   └── img/               # Imágenes de productos (archivos locales)
└── templates/
    ├── index.html         # Página principal (catálogo)
    ├── carrito.html       # Carrito de compras
    └── admin.html         # Panel de administración
```

## 5. Sistema de Datos

### 5.1 Productos (`datos/productos.json`)

```json
{
  "productos": [
    {
      "id": 1,
      "nombre": "Remera Básica",
      "categoria": "Remeras",
      "precio": 15000,
      "talles": ["S", "M", "L", "XL"],
      "stock": 20,
      "imagen": "remera-basica.jpg",
      "descripcion": "Remera de algodón suave"
    }
  ]
}
```

- Las imágenes se guardan en `static/img/` y se referencian por nombre de archivo.
- El catálogo inicia **vacío** y se carga desde el panel admin.

### 5.2 Pedidos (`datos/pedidos.json`)

Archivo único con todos los pedidos. Cada cliente se identifica por su **DNI**.

```json
{
  "pedidos": [
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
}
```

- **Identificación del cliente:** nombre + teléfono + DNI.
- No se captura dirección de envío; solo identificación y detalle del pedido.
- Los pedidos **solo se registran** (sin estados de seguimiento).

## 6. Categorías

Entre 5 y 10 categorías configurables desde el panel admin (ejemplo):

- Remeras
- Pantalones
- Buzos
- Camperas
- Vestidos
- Polleras
- Accesorios

## 7. Página Pública (`/`)

- Muestra el catálogo con **imágenes** de cada producto.
- Se puede filtrar o agrupar por **categoría**.
- Botón "Agregar al carrito".
- **Carrito**: página donde el cliente revisa su selección.
- **Checkout**: formulario que pide **nombre, teléfono y DNI** del cliente y confirma el pedido.

### Flujo de pedido

1. Cliente agrega productos al carrito.
2. Ingresa al carrito y completa sus datos (nombre, teléfono, DNI).
3. Confirma → el backend valida y guarda el pedido en `pedidos.json`.
4. Confirma el total y el stock descontado del producto.

## 8. Panel Administración (`/admin`)

- Accesible **solo en la máquina local** (el servidor valida que la petición venga de `localhost`).
- Protegido con **login/contraseña** (usuario/contraseña configurados en `app.py` o variables).
- Permite al dueño:
  - ➕ **Agregar** productos (nombre, categoría, precio, talles, stock, imagen).
  - ✏️ **Modificar** productos existentes.
  - 🗑️ **Eliminar** productos.
  - 📦 Ver el listado de **pedidos** recibidos.

## 9. Diseño Minimalista

- **Paleta:** blancos, grises y negro (colores neutros).
- **Tipografía:** limpia y simple (ej. sans-serif).
- **Espaciado:** amplio, sin elementos decorativos recargados.
- **Imágenes:** protagonistas de la página.

## 10. Endpoints de la API (Flask)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Página principal (catálogo) |
| GET | `/carrito` | Página del carrito |
| GET | `/admin` | Panel de administración |
| POST | `/api/login` | Autenticación admin |
| GET | `/api/productos` | Lista de productos (público) |
| POST | `/api/pedidos` | Registrar un pedido (público) |
| GET | `/api/pedidos` | Listar pedidos (admin) |
| POST | `/api/productos` | Agregar producto (admin) |
| PUT | `/api/productos/<id>` | Modificar producto (admin) |
| DELETE | `/api/productos/<id>` | Eliminar producto (admin) |

## 11. Dependencias

`requirements.txt`:

```
Flask
```

## 12. Cómo Ejecutar

```bash
pip install -r requirements.txt
python app.py
```

Abrir el navegador en `http://localhost:5000`.

## 13. Consideraciones de Seguridad

- El admin solo se sirve si la petición proviene de `localhost`.
- Login con contraseña para el panel admin.
- Los archivos JSON se escriben solo vía la API del backend.

## 14. Alcance / Fuera de Alcance

**Incluido:**
- Catálogo público con imágenes.
- Carrito y checkout con registro de pedidos en JSON.
- Panel admin (agregar/editar/eliminar productos, ver pedidos).
- Diferenciación de clientes por DNI + teléfono + nombre.

**Fuera de alcance (por ahora):**
- Pagos en línea.
- Envíos / dirección de envío.
- Estados de pedido.
- Base de datos (SQL) — se usa JSON.

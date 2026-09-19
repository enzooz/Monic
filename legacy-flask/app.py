import json
import os
import secrets
import time
import uuid
from datetime import datetime
from functools import wraps
from pathlib import Path
import re

from dotenv import load_dotenv

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATOS_DIR = BASE_DIR / "datos"
PRODUCTOS_PATH = DATOS_DIR / "productos.json"
PEDIDOS_PATH = DATOS_DIR / "pedidos.json"
IMG_DIR = BASE_DIR / "static" / "img"

ADMIN_USER = os.environ.get("MONIC_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("MONIC_ADMIN_PASS", "monic123")
MAX_UPLOAD_MB = int(os.environ.get("MONIC_MAX_UPLOAD_MB", "5"))

DATOS_DIR.mkdir(exist_ok=True)
IMG_DIR.mkdir(exist_ok=True)


def _default_data(path, empty_key):
    if not path.exists():
        with open(path, "w", encoding="utf-8") as f:
            json.dump({empty_key: []}, f, ensure_ascii=False, indent=2)


_default_data(PRODUCTOS_PATH, "productos")
_default_data(PEDIDOS_PATH, "pedidos")


def _read(path, empty_key):
    with open(path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)
    return data.get(empty_key, [])


def _write(path, empty_key, items):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({empty_key: items}, f, ensure_ascii=False, indent=2)


def _lee_productos():
    return _read(PRODUCTOS_PATH, "productos")


def _escribe_productos(items):
    _write(PRODUCTOS_PATH, "productos", items)


def _lee_pedidos():
    return _read(PEDIDOS_PATH, "pedidos")


def _escribe_pedidos(items):
    _write(PEDIDOS_PATH, "pedidos", items)


_secret_file = BASE_DIR / ".secret_key"


def _load_secret_key():
    env_key = os.environ.get("MONIC_SECRET_KEY")
    if env_key:
        return env_key
    if _secret_file.exists():
        return _secret_file.read_text().strip()
    key = secrets.token_hex(32)
    _secret_file.write_text(key)
    return key


app = Flask(__name__)
app.secret_key = _load_secret_key()
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


def solo_localhost():
    """Solo permite peticiones provenientes directamente de la maquina local (admin).

    Cuando corre un tunel (cloudflared), todo el trafico de internet llega
    a Flask como si viniera de 127.0.0.1, pero trae el header Cf-Connecting-Ip
    con la IP real del visitante. Se usa ese header para distinguir al admin:
    si hay Cf-Connecting-Ip, la peticion vino por internet y se rechaza.
    """
    if request.headers.get("Cf-Connecting-Ip"):
        return False
    ip = request.remote_addr or "127.0.0.1"
    return ip in ("127.0.0.1", "::1", "localhost")


_RE_DNI = re.compile(r"^\d{7,8}$")
_RE_TEL = re.compile(r"^[\d\-\+\s()]{6,20}$")


def _validar_cliente(cliente):
    """Valida nombre, telefono y DNI del cliente. Retorna error o None."""
    nombre = (cliente.get("nombre") or "").strip()
    telefono = (cliente.get("telefono") or "").strip()
    dni = (cliente.get("dni") or "").strip()
    if not nombre or len(nombre) < 2:
        return "El nombre debe tener al menos 2 caracteres"
    if not _RE_TEL.match(telefono):
        return "El formato del teléfono no es válido"
    if not _RE_DNI.match(dni):
        return "El DNI debe tener 7 u 8 dígitos"
    return None


def login_requerido(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"error": "No autorizado"}), 401
        return f(*args, **kwargs)

    return wrapper


def admin_local_requerido(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not solo_localhost():
            return jsonify({"error": "Acceso restringido a localhost"}), 403
        return f(*args, **kwargs)

    return wrapper


# Anti-spam sencillo para pedidos publicos.
# LIMITE_PEDIDOS pedidos por IP dentro de VENTANA_PEDIDOS segundos.
LIMITE_PEDIDOS = 5
VENTANA_PEDIDOS = 600
_pedidos_por_ip = {}

# Rate limiting para login.
LIMITE_LOGIN = 5
VENTANA_LOGIN = 300
_intentos_login = {}


def anti_spam_pedidos():
    """Honeypot + limite por IP. True si el pedido debe ser bloqueado."""
    if request.get_json(silent=True).get("website"):
        return True

    ip = (request.headers.get("Cf-Connecting-Ip") or request.remote_addr or "127.0.0.1")
    ahora = time.time()
    marcas = _pedidos_por_ip.get(ip, [])
    marcas = [m for m in marcas if ahora - m < VENTANA_PEDIDOS]
    if len(marcas) >= LIMITE_PEDIDOS:
        _pedidos_por_ip[ip] = marcas
        return True
    marcas.append(ahora)
    _pedidos_por_ip[ip] = marcas
    return False


def rate_limit_login():
    """True si el intento de login debe ser bloqueado por rate limiting."""
    ip = request.remote_addr or "127.0.0.1"
    ahora = time.time()
    marcas = _intentos_login.get(ip, [])
    marcas = [m for m in marcas if ahora - m < VENTANA_LOGIN]
    if len(marcas) >= LIMITE_LOGIN:
        _intentos_login[ip] = marcas
        return True
    marcas.append(ahora)
    _intentos_login[ip] = marcas
    return False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/carrito")
def carrito():
    return render_template("carrito.html")


@app.route("/admin")
def admin():
    if not solo_localhost():
        return redirect(url_for("index"))
    return render_template("admin.html")


@app.route("/api/estado")
def estado():
    return jsonify({"admin_local": solo_localhost()})


@app.route("/api/login", methods=["POST"])
def login():
    if rate_limit_login():
        return jsonify({"error": "Demasiados intentos. Intentá de nuevo en unos minutos."}), 429
    data = request.get_json(silent=True) or {}
    user = data.get("usuario", "")
    password = data.get("password", "")
    if user == ADMIN_USER and password == ADMIN_PASS:
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "Usuario o contraseña incorrectos"}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("admin", None)
    return jsonify({"ok": True})


@app.route("/api/verificar", methods=["GET"])
def verificar():
    return jsonify({"autenticado": bool(session.get("admin"))})


@app.route("/api/productos", methods=["GET"])
def listar_productos():
    return jsonify({"productos": _lee_productos()})


@app.route("/api/productos", methods=["POST"])
@login_requerido
@admin_local_requerido
def crear_producto():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400

    productos = _lee_productos()
    nuevo_id = max([p["id"] for p in productos], default=0) + 1
    producto = {
        "id": nuevo_id,
        "nombre": nombre,
        "categoria": (data.get("categoria") or "").strip(),
        "precio": float(data.get("precio") or 0),
        "talles": data.get("talles") or [],
        "stock": int(data.get("stock") or 0),
        "imagen": (data.get("imagen") or "").strip(),
        "descripcion": (data.get("descripcion") or "").strip(),
    }
    productos.append(producto)
    _escribe_productos(productos)
    return jsonify({"ok": True, "producto": producto}), 201


@app.route("/api/productos/<int:pid>", methods=["PUT"])
@login_requerido
@admin_local_requerido
def modificar_producto(pid):
    data = request.get_json(silent=True) or {}
    productos = _lee_productos()
    producto = next((p for p in productos if p["id"] == pid), None)
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    if "nombre" in data:
        producto["nombre"] = (data.get("nombre") or "").strip()
    if "categoria" in data:
        producto["categoria"] = (data.get("categoria") or "").strip()
    if "precio" in data:
        producto["precio"] = float(data.get("precio") or 0)
    if "talles" in data:
        producto["talles"] = data.get("talles") or []
    if "stock" in data:
        producto["stock"] = int(data.get("stock") or 0)
    if "imagen" in data:
        producto["imagen"] = (data.get("imagen") or "").strip()
    if "descripcion" in data:
        producto["descripcion"] = (data.get("descripcion") or "").strip()

    _escribe_productos(productos)
    return jsonify({"ok": True, "producto": producto})


@app.route("/api/productos/<int:pid>", methods=["DELETE"])
@login_requerido
@admin_local_requerido
def eliminar_producto(pid):
    productos = _lee_productos()
    productos = [p for p in productos if p["id"] != pid]
    _escribe_productos(productos)
    return jsonify({"ok": True})


@app.route("/api/categorias", methods=["GET"])
def listar_categorias():
    categorias = sorted({p["categoria"] for p in _lee_productos() if p.get("categoria")})
    return jsonify({"categorias": categorias})


@app.route("/api/pedidos", methods=["POST"])
def crear_pedido():
    data = request.get_json(silent=True) or {}
    if anti_spam_pedidos():
        return jsonify({"error": "Pedido rechazado"}), 429
    cliente = data.get("cliente") or {}
    items = data.get("items") or []

    nombre = (cliente.get("nombre") or "").strip()
    telefono = (cliente.get("telefono") or "").strip()
    dni = (cliente.get("dni") or "").strip()

    error_cliente = _validar_cliente(cliente)
    if error_cliente:
        return jsonify({"error": error_cliente}), 400
    if not items:
        return jsonify({"error": "El pedido está vacío"}), 400

    productos = _lee_productos()
    items_validos = []
    total = 0
    for item in items:
        prod = next(
            (p for p in productos if p["id"] == int(item.get("producto_id", 0))),
            None,
        )
        if not prod:
            return jsonify({"error": "Producto no encontrado"}), 400
        cantidad = int(item.get("cantidad") or 0)
        if cantidad <= 0:
            return jsonify({"error": "Cantidad inválida"}), 400
        if cantidad > prod.get("stock", 0):
            return (
                jsonify(
                    {
                        "error": (
                            f"Stock insuficiente de '{prod['nombre']}' "
                            f"(disponible: {prod.get('stock', 0)})"
                        )
                    }
                ),
                400,
            )
        items_validos.append(
            {
                "producto_id": prod["id"],
                "nombre": prod["nombre"],
                "talle": (item.get("talle") or "").strip(),
                "cantidad": cantidad,
                "precio_unitario": prod["precio"],
            }
        )
        total += prod["precio"] * cantidad
        prod["stock"] -= cantidad

    _escribe_productos(productos)

    pedidos = _lee_pedidos()
    nuevo_id = max([p["id"] for p in pedidos], default=0) + 1
    pedido = {
        "id": nuevo_id,
        "fecha": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "cliente": {"nombre": nombre, "telefono": telefono, "dni": dni},
        "items": items_validos,
        "total": round(total, 2),
    }
    pedidos.append(pedido)
    _escribe_pedidos(pedidos)
    return jsonify({"ok": True, "pedido": pedido}), 201


@app.route("/api/pedidos", methods=["GET"])
@login_requerido
@admin_local_requerido
def listar_pedidos():
    return jsonify({"pedidos": _lee_pedidos()})


@app.route("/api/upload", methods=["POST"])
@login_requerido
@admin_local_requerido
def subir_imagen():
    archivo = request.files.get("imagen")
    if not archivo or not archivo.filename:
        return jsonify({"error": "No se envió ninguna imagen"}), 400
    ext = archivo.filename.rsplit(".", 1)[-1].lower() if "." in archivo.filename else ""
    if ext not in ("jpg", "jpeg", "png", "gif", "webp", "svg"):
        return jsonify({"error": "Formato de imagen no permitido"}), 400
    nombre = f"{uuid.uuid4().hex}.{ext}"
    archivo.save(IMG_DIR / nombre)
    return jsonify({"ok": True, "imagen": nombre}), 201


@app.errorhandler(413)
def archivo_demasiado_grande(e):
    return jsonify({"error": f"La imagen supera el tamaño máximo de {MAX_UPLOAD_MB}MB"}), 413


if __name__ == "__main__":
    debug = os.environ.get("MONIC_DEBUG") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug)

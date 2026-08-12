"""Convierte los HTML sueltos de analogia-voltaje/ en módulos de sketch.

De cada HTML saca el cuerpo del `new p5(function(p){...})` y lo escribe como
`<id>.js`, registrado contra el player. Además genera un wrapper fino en
standalone/ para que el sketch se siga pudiendo abrir solo.

Se corre una vez (o de nuevo si editas los HTML originales):
    ../../s12-venv/Scripts/python.exe extraer.py
"""

import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ORIGEN = AQUI.parent / "analogia-voltaje"
STANDALONE = AQUI / "standalone"

PLANTILLA_JS = """// Generado por extraer.py desde analogia-voltaje/{origen}
// No edites este encabezado a mano; el cuerpo del sketch sí es editable.
registrarSketch('{id}', {{
  ancho: {ancho},
  alto: {alto},
  pista: {pista!r},
}}, function(p, opciones) {{
{cuerpo}
}});
"""

PLANTILLA_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{titulo}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: #0d0d1a;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      height: 100vh; font-family: monospace; color: #aaa;
    }}
    canvas {{ display: block; }}
    #hint {{ margin-top: 14px; font-size: 12px; opacity: 0.45; letter-spacing: 0.05em; }}
  </style>
</head>
<body>
<div id="escenario"></div>
<div id="hint">{pista}</div>
<script src="../../player/vendor/p5.min.js"></script>
<script src="../registro.js"></script>
<script src="../{id}.js"></script>
<script>
  montarSketch('{id}', document.getElementById('escenario'));
</script>
</body>
</html>
"""


def extraer(ruta):
    texto = ruta.read_text(encoding="utf-8")
    ident = ruta.stem

    # El sketch vive en el <script> inline (el otro es el <script src> de p5).
    bloques = re.findall(r"<script>\s*(.*?)\s*</script>", texto, re.S)
    if not bloques:
        raise SystemExit(f"{ruta.name}: no encontré el <script> del sketch")
    codigo = max(bloques, key=len)

    # Quitar el envoltorio `new p5(function(p) { ... });`
    m = re.search(r"new p5\(\s*function\s*\(\s*p\s*\)\s*\{(.*)\}\s*\)\s*;?\s*$",
                  codigo, re.S)
    if not m:
        raise SystemExit(f"{ruta.name}: no reconocí el patrón instance-mode de p5")
    cuerpo = m.group(1)

    # Todo lo declarado ANTES del `new p5(...)` (p.ej. el bloque CONFIG) también
    # es parte del sketch: se mueve adentro del envoltorio o queda sin definir.
    preambulo = codigo[:m.start()].strip()
    if preambulo:
        # CONFIG pasa a ser sobrescribible por el player: así un mismo sketch
        # sirve para "poca energía" y "mucha energía" sin duplicar el archivo.
        if re.search(r"\bconst\s+CONFIG\s*=", preambulo):
            preambulo = re.sub(r"\bconst\s+CONFIG\s*=", "const CONFIG_BASE =",
                               preambulo, count=1)
            preambulo += (
                "\n\n// Inyectado por extraer.py: el player puede pasar overrides\n"
                "// en opciones.config sin tocar los valores por defecto.\n"
                "const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});"
            )
        cuerpo = preambulo + "\n\n" + cuerpo

    # El canvas ahora cuelga del contenedor que le pase el player, no del body.
    cuerpo, n = re.subn(r"\.parent\(\s*document\.body\s*\)",
                        ".parent(opciones.contenedor)", cuerpo)
    if n == 0:
        raise SystemExit(f"{ruta.name}: no encontré el .parent(document.body)")

    # Tamaño lógico del lienzo: el player escala, nunca redimensiona, para no
    # tocar la física que está afinada en píxeles.
    mc = re.search(r"createCanvas\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)", cuerpo)
    ancho, alto = mc.group(1).strip(), mc.group(2).strip()
    if not ancho.replace(".", "").isdigit():          # viene de const W / H
        dims = {}
        for nombre in ("W", "H"):
            md = re.search(rf"const\s+{nombre}\s*=\s*(\d+)", cuerpo)
            if md:
                dims[nombre] = md.group(1)
        ancho = dims.get(ancho, ancho)
        alto = dims.get(alto, alto)

    mh = re.search(r'<div id="hint">(.*?)</div>', texto, re.S)
    pista = mh.group(1).strip() if mh else ""
    mt = re.search(r"<title>(.*?)</title>", texto, re.S)
    titulo = mt.group(1).strip() if mt else ident

    (AQUI / f"{ident}.js").write_text(
        PLANTILLA_JS.format(origen=ruta.name, id=ident, ancho=ancho, alto=alto,
                            pista=pista, cuerpo=cuerpo.rstrip()),
        encoding="utf-8")

    (STANDALONE / f"{ident}.html").write_text(
        PLANTILLA_HTML.format(id=ident, titulo=titulo, pista=pista),
        encoding="utf-8")

    print(f"  {ruta.name}  ->  {ident}.js ({ancho}x{alto})")


if __name__ == "__main__":
    STANDALONE.mkdir(exist_ok=True)
    fuentes = sorted(ORIGEN.glob("*.html"))
    print(f"Extrayendo {len(fuentes)} sketches de {ORIGEN.name}/")
    for f in fuentes:
        extraer(f)
    print("Listo.")

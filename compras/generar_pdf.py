"""Genera los PDF de la lista de materiales a partir de los .md.

    python compras/generar_pdf.py

Convierte cada markdown a HTML, le aplica una hoja de estilos pensada para
papel, y lo imprime con Chrome en modo headless. Se usa Chrome porque ya está
instalado: las alternativas (pandoc + LaTeX, weasyprint) obligan a instalar un
toolchain entero para un documento de una página.

Los links de las tiendas se acortan a una etiqueta corta —"amazon · B0799KM8T6"—
pero siguen siendo clicables. Sin eso, una sola URL de AliExpress con todos sus
parámetros de tracking mide más de mil caracteres y revienta el ancho de la
tabla, dejando las demás columnas en una tira ilegible.
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import markdown

AQUI = Path(__file__).resolve().parent

DOCS = [
    ("FRA_materiales.md", "FRA_materiales.pdf"),
    ("FRA_materials_EN.md", "FRA_materials_EN.pdf"),
]

CHROME = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]

# Apaisado: la tabla tiene seis columnas y en vertical no cabe sin apretar el
# texto hasta romper palabras.
CSS = """
@page { size: A4 landscape; margin: 12mm 10mm 14mm 10mm; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 8.4pt; line-height: 1.45; color: #1a1a1a; margin: 0;
}
h1 { font-size: 16pt; margin: 0 0 2mm; letter-spacing: -.01em; }
h2 { font-size: 11pt; margin: 6mm 0 2mm; padding-bottom: 1mm;
     border-bottom: .6pt solid #d0d0d0; }
h3 { font-size: 9.5pt; margin: 4mm 0 1.5mm; }
p, li { margin: 0 0 1.5mm; }
ul { margin: 0 0 2mm; padding-left: 5mm; }
a { color: #1c5fa8; text-decoration: none; }
hr { border: 0; border-top: .6pt solid #d0d0d0; margin: 4mm 0; }

table { width: 100%; border-collapse: collapse; margin: 2mm 0 3mm;
        table-layout: fixed; }
th, td { border: .5pt solid #ccc; padding: 1.4mm 1.8mm;
         vertical-align: top; word-wrap: break-word; }
th { background: #f0f0f0; font-weight: 600; text-align: left; }
tr { page-break-inside: avoid; }

/* Anchos fijos: sin esto el navegador reparte según el contenido y la columna
   de función se come el resto. */
td:nth-child(1), th:nth-child(1) { width: 22%; }
td:nth-child(2), th:nth-child(2) { width: 30%; }
td:nth-child(3), th:nth-child(3) { width: 8%;  }
td:nth-child(4), th:nth-child(4) { width: 11%; text-align: right; }
td:nth-child(5), th:nth-child(5) { width: 11%; text-align: right;
                                   font-weight: 600; }
td:nth-child(6), th:nth-child(6) { width: 18%; font-size: 7.6pt; }

blockquote { margin: 2mm 0; padding: 1.5mm 3mm; background: #f6f6f6;
             border-left: 2pt solid #999; }
blockquote p { margin: 0; }
.total { font-size: 10pt; }
"""

TIENDAS = {"amazon.com": "amazon", "es.aliexpress.com": "aliexpress",
           "aliexpress.com": "aliexpress"}


def etiqueta(url):
    """Nombre corto y reconocible para un link de tienda."""
    host = urlparse(url).netloc.replace("www.", "")
    tienda = TIENDAS.get(host, host)
    # El identificador del producto es lo único del path que le sirve a alguien
    # que quiera buscarlo a mano.
    m = re.search(r"/dp/([A-Z0-9]{10})", url) or re.search(r"/item/(\d+)", url)
    return f"{tienda} · {m.group(1)}" if m else tienda


def es_tienda(url):
    return urlparse(url).netloc.replace("www.", "") in TIENDAS


def acortar_links(html):
    """Acorta solo los links de tienda; los demás se dejan como están.

    El link del repositorio dice `github.com/daniel-pgkf/s12-control-de-tono`,
    y ese nombre es información: acortarlo a `github.com` lo empeora.
    """
    def con_etiqueta(m):
        url = m.group(1)
        return (f'<a href="{url}">{etiqueta(url)}</a>'
                if es_tienda(url) else m.group(0))

    html = re.sub(r'<a href="([^"]+)">[^<]*</a>', con_etiqueta, html)
    # URLs que quedaron como texto plano dentro de una celda. Se excluyen las
    # que van dentro de un href —precedidas por comilla— para no anidar <a>.
    html = re.sub(r"""(?<!["'])(https?://[^\s<]+)""", con_etiqueta, html)
    return html


def buscar_chrome():
    for ruta in CHROME:
        if ruta.exists():
            return ruta
    for nombre in ("chrome", "msedge"):
        hallado = shutil.which(nombre)
        if hallado:
            return Path(hallado)
    raise SystemExit("No se encontró Chrome ni Edge para imprimir el PDF.")


def construir_html(md_texto):
    cuerpo = markdown.markdown(md_texto, extensions=["tables", "sane_lists"])
    cuerpo = acortar_links(cuerpo)
    cuerpo = cuerpo.replace("<p><strong>Total:", '<p class="total"><strong>Total:')
    return (f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
            f"<style>{CSS}</style></head><body>{cuerpo}</body></html>")


def main():
    chrome = buscar_chrome()
    for nombre_md, nombre_pdf in DOCS:
        origen = AQUI / nombre_md
        if not origen.exists():
            print(f"  -- falta {nombre_md}, se omite")
            continue

        html = construir_html(origen.read_text(encoding="utf-8"))
        destino = AQUI / nombre_pdf

        # Chrome no imprime desde stdin: necesita un archivo con extensión .html.
        with tempfile.TemporaryDirectory() as tmp:
            tmp_html = Path(tmp) / "doc.html"
            tmp_html.write_text(html, encoding="utf-8")
            subprocess.run(
                [str(chrome), "--headless", "--disable-gpu", "--no-pdf-header-footer",
                 f"--print-to-pdf={destino}", tmp_html.as_uri()],
                check=True, capture_output=True, timeout=120,
            )

        kb = destino.stat().st_size / 1024
        print(f"  ok  {nombre_pdf}  ({kb:.0f} KB)")


if __name__ == "__main__":
    sys.exit(main())

"""Servidor de desarrollo para el player.

Igual que `python -m http.server`, pero prohibiendo la caché.

Por qué hace falta: http.server solo manda Last-Modified, sin Cache-Control.
Con eso el browser aplica caché heurística y sigue ejecutando el .js viejo
después de editarlo — que se ve exactamente como un bug en el sketch.

    ../../s12-venv/Scripts/python.exe servidor.py [puerto]
"""

import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

AQUI = Path(__file__).resolve().parent


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        # Silencia el ruido de cada .js y deja ver solo los errores.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(formato, *args)


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(SinCache, directory=str(AQUI))
    print(f"Player en  http://127.0.0.1:{puerto}/player/")
    print("Ctrl+C para parar.")
    HTTPServer(("127.0.0.1", puerto), handler).serve_forever()

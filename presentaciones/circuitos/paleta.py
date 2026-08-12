"""Lee paleta.json y la expone a Manim.

Una sola fuente de verdad compartida con el player y los sketches p5:
si cambias paleta.json, cambian los dos lados a la vez.
"""

import json
from pathlib import Path

_RUTA = Path(__file__).resolve().parent.parent / "paleta.json"

with open(_RUTA, encoding="utf-8") as f:
    PALETA = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

FONDO = PALETA["fondo"]
TEXTO = PALETA["texto"]
TEXTO_TENUE = PALETA["texto_tenue"]

ENERGIA = PALETA["energia"]
ACEITE = PALETA["aceite"]
NODO = PALETA["nodo"]

C_RESISTENCIA = PALETA["resistencia"]
C_CONDENSADOR = PALETA["condensador"]
C_FUENTE = PALETA["fuente"]
C_CABLE = PALETA["cable"]
C_ALERTA = PALETA["alerta"]


def aplicar_fondo(escena):
    """Iguala el fondo de la escena al de los sketches p5.

    Sin esto el corte se nota: Manim rinde sobre negro puro y los
    sketches sobre #0d0d1a.
    """
    escena.camera.background_color = FONDO

"""Demo: filtro RC pasa-bajos (la perilla de tono de la guitarra).

Render:
  ../s12-venv/Scripts/manim.exe -pql presentaciones/circuitos/rc_pasabajos.py RCPasaBajos
  ../s12-venv/Scripts/manim.exe -s -qh presentaciones/circuitos/rc_pasabajos.py CircuitoEstatico
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from manim import *
from componentes import (
    Cable, Condensador, FuenteAC, Nodo, Resistencia, Tierra,
)
from paleta import C_ALERTA, TEXTO, aplicar_fondo

X_IZQ, X_DER = -3.2, 2.2
Y_SUP, Y_INF = 1.3, -1.6


def construir_rc():
    """Devuelve (grupo_completo, piezas) del RC pasa-bajos."""
    fuente = FuenteAC(etiqueta="v_{in}").move_to([X_IZQ, (Y_SUP + Y_INF) / 2, 0])
    r = Resistencia(etiqueta="R", largo=2.0).move_to([(X_IZQ + X_DER) / 2, Y_SUP, 0])
    c = Condensador(etiqueta="C", largo=1.6)
    c.move_to([X_DER, (Y_SUP + Y_INF) / 2, 0]).vertical()

    cables = VGroup(
        Cable([X_IZQ, fuente.trazo.get_top()[1], 0], [X_IZQ, Y_SUP, 0], r.izq),
        Cable(r.der, [X_DER, Y_SUP, 0], c.arriba),
        Cable(c.abajo, [X_DER, Y_INF, 0], [X_IZQ, Y_INF, 0],
              [X_IZQ, fuente.trazo.get_bottom()[1], 0]),
    )

    tierra = Tierra().anclar([X_IZQ, Y_INF, 0])
    nodo = Nodo([X_DER, Y_SUP, 0])

    salida = Cable([X_DER, Y_SUP, 0], [X_DER + 1.3, Y_SUP, 0])
    etiq_salida = MathTex("v_{out}").scale(0.65).next_to(salida, RIGHT, buff=0.15)

    piezas = dict(fuente=fuente, r=r, c=c, cables=cables, tierra=tierra,
                  nodo=nodo, salida=salida, etiq_salida=etiq_salida)
    grupo = VGroup(cables, fuente, r, c, tierra, nodo, salida, etiq_salida)
    return grupo, piezas


class RCPasaBajos(Scene):
    def construct(self):
        aplicar_fondo(self)
        circuito, p = construir_rc()

        titulo = Text("La perilla de tono = filtro RC", font_size=34, color=TEXTO)
        titulo.to_edge(UP, buff=0.4)

        # Se traza como si lo dibujaras a mano, en el orden en que se explica.
        self.play(FadeIn(titulo, shift=DOWN * 0.3))
        self.play(Create(p["fuente"]), run_time=1.0)
        self.play(Create(p["cables"][0]), run_time=0.6)
        self.play(Create(p["r"]), run_time=1.0)
        self.play(Create(p["cables"][1]), run_time=0.6)
        self.play(Create(p["c"]), run_time=1.0)
        self.play(Create(p["cables"][2]), run_time=0.9)
        self.play(FadeIn(p["tierra"], shift=UP * 0.2), run_time=0.5)
        self.play(FadeIn(p["nodo"]), Create(p["salida"]),
                  Write(p["etiq_salida"]), run_time=0.8)
        self.wait(0.4)

        # Camino de las frecuencias altas: entran por R y se van a tierra por C.
        camino = Cable(
            p["r"].izq, p["r"].der, [X_DER, Y_SUP, 0],
            p["c"].arriba, p["c"].abajo, [X_DER, Y_INF, 0], [X_IZQ, Y_INF, 0],
            color=C_ALERTA,
        ).set_stroke(width=9, opacity=0.5)

        nota = Text("Las frecuencias altas se escapan por C", font_size=26, color=C_ALERTA)
        nota.next_to(circuito, DOWN, buff=0.5)

        self.play(Create(camino), FadeIn(nota), run_time=1.8)
        self.wait(1.5)
        self.play(FadeOut(camino), FadeOut(nota))
        self.wait(0.5)


class CircuitoEstatico(Scene):
    """Sin animación — para exportar el esquemático como PNG del syllabus."""

    def construct(self):
        aplicar_fondo(self)
        circuito, _ = construir_rc()
        self.add(circuito)

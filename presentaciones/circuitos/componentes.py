"""Primitivas de circuitos para Manim CE.

Cada componente es un VGroup con dos puertos (.izq / .der en coords absolutas)
para poder encadenarlos con Cable() sin calcular posiciones a mano.

Convención: todo componente se construye horizontal, centrado en ORIGIN,
de ancho `largo`. Para ponerlo vertical: .rotate(PI/2).
"""

from manim import *

from paleta import C_CABLE, C_CONDENSADOR, C_FUENTE, C_RESISTENCIA

# Colores heredados de paleta.json — los mismos que usan los sketches p5,
# para que el corte entre un clip Manim y una analogía no se note.
COLOR_CABLE = C_CABLE
COLOR_R = C_RESISTENCIA
COLOR_C = C_CONDENSADOR
COLOR_FUENTE = C_FUENTE
GROSOR = 4


class Componente(VGroup):
    """Base: expone puertos izq/der que siguen las transformaciones del grupo."""

    def __init__(self, largo=1.6, **kwargs):
        super().__init__(**kwargs)
        self.largo = largo
        self._p_izq = LEFT * largo / 2
        self._p_der = RIGHT * largo / 2
        # Marcadores invisibles: se transforman con el grupo, así que los puertos
        # siguen siendo exactos tras move_to/rotate. No usar el bounding box:
        # la etiqueta lo desplaza y los cables salen torcidos.
        self._m_a = VectorizedPoint(self._p_izq)
        self._m_b = VectorizedPoint(self._p_der)
        self.add(self._m_a, self._m_b)

    @property
    def izq(self):
        return self._m_a.get_center()

    @property
    def der(self):
        return self._m_b.get_center()

    @property
    def arriba(self):
        return max((self._m_a, self._m_b), key=lambda m: m.get_center()[1]).get_center()

    @property
    def abajo(self):
        return min((self._m_a, self._m_b), key=lambda m: m.get_center()[1]).get_center()

    def move_to(self, punto, **kwargs):
        """Centra el TRAZO en el punto (ignora la etiqueta al medir)."""
        self.shift(np.array(punto) - self.trazo.get_center())
        return self

    def vertical(self, lado_etiqueta=RIGHT):
        """Rota el componente 90° dejando la etiqueta horizontal y legible.

        Los puertos pasan a ser .arriba / .abajo.
        """
        centro = self.trazo.get_center()
        self.trazo.rotate(-PI / 2, about_point=centro)
        self._m_a.rotate(-PI / 2, about_point=centro)
        self._m_b.rotate(-PI / 2, about_point=centro)
        if hasattr(self, "etiqueta"):
            self.etiqueta.next_to(self.trazo, lado_etiqueta, buff=0.2)
        return self


class Resistencia(Componente):
    """Zigzag clásico. `etiqueta` se dibuja encima."""

    def __init__(self, etiqueta=None, largo=1.6, color=COLOR_R, dientes=6, **kwargs):
        super().__init__(largo=largo, **kwargs)
        cuerpo = largo * 0.6
        patilla = (largo - cuerpo) / 2
        alto = 0.22

        puntos = [self._p_izq, self._p_izq + RIGHT * patilla]
        paso = cuerpo / dientes
        for i in range(dientes):
            x = self._p_izq[0] + patilla + paso * (i + 0.5)
            puntos.append(np.array([x, alto if i % 2 == 0 else -alto, 0]))
        puntos += [self._p_der + LEFT * patilla, self._p_der]

        self.trazo = VMobject(stroke_color=color, stroke_width=GROSOR)
        self.trazo.set_points_as_corners(puntos)
        self.add(self.trazo)

        if etiqueta:
            self.etiqueta = MathTex(etiqueta, color=color).scale(0.6)
            self.etiqueta.next_to(self.trazo, UP, buff=0.15)
            self.add(self.etiqueta)


class Condensador(Componente):
    """Dos placas paralelas. Se dibuja horizontal; rotar para vertical."""

    def __init__(self, etiqueta=None, largo=1.6, color=COLOR_C, sep=0.22, **kwargs):
        super().__init__(largo=largo, **kwargs)
        alto = 0.42

        izq = Line(self._p_izq, LEFT * sep / 2, stroke_color=color, stroke_width=GROSOR)
        der = Line(RIGHT * sep / 2, self._p_der, stroke_color=color, stroke_width=GROSOR)
        placa_i = Line(
            LEFT * sep / 2 + UP * alto, LEFT * sep / 2 + DOWN * alto,
            stroke_color=color, stroke_width=GROSOR + 2,
        )
        placa_d = Line(
            RIGHT * sep / 2 + UP * alto, RIGHT * sep / 2 + DOWN * alto,
            stroke_color=color, stroke_width=GROSOR + 2,
        )
        self.trazo = VGroup(izq, der, placa_i, placa_d)
        self.add(self.trazo)

        if etiqueta:
            self.etiqueta = MathTex(etiqueta, color=color).scale(0.6)
            self.etiqueta.next_to(self.trazo, UP, buff=0.15)
            self.add(self.etiqueta)


class FuenteAC(Componente):
    """Círculo con senoide adentro — la señal de la guitarra."""

    def __init__(self, etiqueta=None, radio=0.42, color=COLOR_FUENTE, **kwargs):
        super().__init__(largo=radio * 2, **kwargs)
        circulo = Circle(radius=radio, stroke_color=color, stroke_width=GROSOR)
        onda = FunctionGraph(
            lambda x: 0.18 * np.sin(x * PI / (radio * 0.55)),
            x_range=[-radio * 0.55, radio * 0.55],
            stroke_color=color, stroke_width=GROSOR - 1,
        )
        self.trazo = VGroup(circulo, onda)
        self.add(self.trazo)

        if etiqueta:
            self.etiqueta = MathTex(etiqueta, color=color).scale(0.6)
            self.etiqueta.next_to(self.trazo, LEFT, buff=0.2)
            self.add(self.etiqueta)


class Tierra(VGroup):
    """Símbolo de tierra: se ancla por su punto superior."""

    def __init__(self, color=COLOR_CABLE, **kwargs):
        super().__init__(**kwargs)
        anchos = [0.36, 0.22, 0.10]
        lineas = VGroup(*[
            Line(LEFT * a / 2 + DOWN * 0.12 * i, RIGHT * a / 2 + DOWN * 0.12 * i,
                 stroke_color=color, stroke_width=GROSOR)
            for i, a in enumerate(anchos)
        ])
        tallo = Line(UP * 0.22, ORIGIN, stroke_color=color, stroke_width=GROSOR)
        self.add(tallo, lineas)
        self.punto = self.get_top()

    def anclar(self, punto):
        """Coloca la tierra colgando del punto dado."""
        self.next_to(punto, DOWN, buff=0)
        return self


def Cable(*puntos, color=COLOR_CABLE):
    """Cable ortogonal que pasa por los puntos dados, en orden."""
    trazo = VMobject(stroke_color=color, stroke_width=GROSOR)
    trazo.set_points_as_corners([np.array(p) for p in puntos])
    return trazo


def Nodo(punto, color=COLOR_CABLE, radio=0.06):
    """Punto de unión (bolita) para nodos de 3+ ramas."""
    return Dot(punto, radius=radio, color=color)


def esquina(p_desde, p_hasta, primero="h"):
    """Punto intermedio para un cable en L entre dos puntos.

    primero='h' → va horizontal y luego vertical; 'v' al revés.
    """
    if primero == "h":
        return np.array([p_hasta[0], p_desde[1], 0])
    return np.array([p_desde[0], p_hasta[1], 0])

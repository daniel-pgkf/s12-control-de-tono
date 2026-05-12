# S12 — Curso Filtros RC + FRA

## Estructura del proyecto

```
S12/
├── presentaciones/   # Diseño de sesiones, animaciones, demos
├── FRA/              # Hardware + software del analizador de frecuencia
└── syllabus/         # Estructura y contenido del curso
```

## Qué es este proyecto

Dos componentes paralelos:

1. **Curso universitario** de electrónica básica para primer semestre de ingeniería electrónica. Sin bases previas. Hilo conductor: perillas de tono de guitarra eléctrica (= filtro RC pasa-bajos). Temas: divisor de voltaje → ley de mallas → superposición → filtros RC → diagramas de Bode. Máx. 1.5h por sesión, 3–6 sesiones, cierra con proyecto integrador.

2. **FRA (Frequency Response Analyzer)** — hardware que mide la respuesta en frecuencia de redes de 2 puertos (20Hz–20kHz). Dos modos: Modo Bode (genera diagrama de Bode del DUT) y Modo Pedal (señal de guitarra pasa en tiempo real por el DUT). Se conecta al PC para visualización.

## Filosofía pedagógica

- Mínima matemática, máxima intuición
- Cada concepto se demuestra antes de explicarse formalmente
- El efecto del filtro se escucha antes de graficarse
- Estilo Veritasium / 3Blue1Brown

## Presentaciones — stack DECIDIDO

Formato: video continuo con checkpoints controlados por tecla. No PowerPoint.

**Manim CE** (Python) — animaciones matemáticas/técnicas: ondas, Bode plots, diagramas de circuitos, flechas, transformaciones.

**p5.js** (JavaScript) — analogías físicas: partículas representando electrones, flujos, simulaciones intuitivas. Corre directo en browser como HTML.

**Player**: webapp simple que combina clips de Manim y sketches de p5.js, avanza con barra espaciadora en checkpoints definidos.

Herramientas evaluadas y descartadas: Motion Canvas (limitado para física), Godot (overkill para presentaciones).

## FRA — pendiente definir

- Plataforma de hardware (ESP32, RPi Pico, Arduino...)
- Método de excitación (swept sine, chirp, ruido blanco)
- Software PC para visualización
- Rango: 20Hz–20kHz

## Stack técnico

| Herramienta | Uso | Estado |
|---|---|---|
| Manim CE v0.20.1 | Animaciones técnicas/matemáticas | Instalado en s12-venv |
| p5.js | Analogías físicas en browser | Listo (CDN, sin instalación) |
| FFmpeg 8.1 | Renderizado Manim | Instalado (sistema) |
| Node.js v24.15.0 | Dependencias JS si se necesitan | Instalado (sistema) |
| Python 3.12.7 + venv | Base del proyecto | s12-venv/ |

## Timeline

~4 meses para tener el curso completo listo.

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

## FRA — decisiones de hardware

**Meta de calidad:** instrumento serio (medidas confiables ±0.5 dB, fase precisa, SNR >70 dB).
**Estrategia de fabricación:** primero protoboard (validar cadena de señal), luego PCB.

### Decisiones clave
- **μC: ESP32-S3** (no C3) — FPU para FFT, USB nativo, más RAM, 2× I²S. El C3 single-core/sin-FPU se queda corto.
- **ADC: PCM1808** (estéreo 24-bit, 96 kSps, I²S). Por ser **estéreo** captura entrada (L) y salida (R) del DUT en un solo stream → sincronía de muestra inherente; elimina el problema "ADC₁ + ADC₂ sincronizados" del diagrama v0.1.
- **DAC: PCM5102A** — genera la excitación (ruido blanco) del modo Bode. Comparte reloj I²S con el ADC (I²S full-duplex del ESP32) → DAC y ADC perfectamente sincronizados.
- **Excitación: ruido blanco** validado en `FRA/codigos/ruido_blanco.ipynb` (bloques de 500 ms, estimador H1 `H = Gxy/Gxx` vía `csd/welch`, coherencia γ² como semáforo de confiabilidad). Abre la puerta a swept-sine/chirp solo por firmware.
- **Tierra virtual: TLE2426** (rail splitter) — punto medio estable a 2.5 V para centrar el audio con supply única de 5 V (USB).
- **Driver de salida: PAM8302** (clase D 2.5 W) para parlante integrado; opcional si se enchufa a ampli externo (basta buffer NE5532).
- **Buffers/acondicionamiento: NE5532** (opamp dual bajo ruido). En PCB final considerar OPA1612/OPA2134.
- **Jack confirmado: DAIERTEK 1/4" hembra estéreo PCB-mount switched** (detecta cable insertado → permite auto-detección guitarra/Bode).
- Rango objetivo: 20Hz–20kHz.

### BOM del prototipo
Lista completa con cantidades, precios y links de compra: **`compras/FRA_materiales.md`** (también en PDF ES/EN).
Total ≈ **US$200** (sin envío). Tasa usada: 1 USD ≈ 3.445 COP.

| Componente | Función | Link |
|---|---|---|
| Jack 1/4" estéreo PCB DAIERTEK (18pcs) | Jacks entrada/salida | amazon.com/dp/B097BDHV5Y |
| ESP32-S3 N16R8 WROOM-1 (3pack) | Microcontrolador | amazon.com/dp/B0F5QCK6X5 |
| PCM1808 ADC 24bit/105dB | ADC estéreo (entrada+salida DUT) | amazon.com/dp/B0D9LNGBD1 |
| PCM5102A DAC I²S | Genera excitación (ruido) | amazon.com/dp/B0DNW32Y46 |
| NE5532P opamp dual bajo ruido | Buffers entrada/salida | amazon.com/dp/B0FPQLWVSD |
| TLE2426CLP rail splitter TO-92 | Tierra virtual (bias) | aliexpress 1005010260337368 |
| Footswitch 3PDT + PCB (5pcs) | Switch modo Pedal/Bode | amazon.com/dp/B01HJDJ1PA |
| PAM8302 amp clase D 2.5W (5u) | Driver de parlante | amazon.com/dp/B0BG2F3LMP |
| Kit botones táctiles (120pcs) | 6 botones programables | amazon.com/dp/B0G2CRTDPX |
| Potenciómetro lineal 50K (10pcs) | Pot ganancia (10K/50K/250K/500K) | amazon.com/dp/B0CZ73Z347 |
| Kit resistencias 25 valores (1000pcs) | Pasivos / redes DUT | amazon.com/dp/B08FD1XVL6 |
| Kit condensadores electrolíticos (240pcs) | Pasivos / redes DUT | amazon.com/dp/B0C1VBXCQM |
| Mini breadboard 170pts (6pcs) | Prototipado | amazon.com/dp/B07LF71ZTS |

### Pendientes FRA
- Software PC para visualización (Bode/espectro) — reusar pipeline `csd/welch` del notebook.
- Migración protoboard → PCB (KiCad): plano de tierra, regulador de bajo ruido, rutas de audio cortas/apantalladas.
- SW de entrada guitarra↔ruido: relé de señal o switch analógico (DG419) — pendiente confirmar en BOM.

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

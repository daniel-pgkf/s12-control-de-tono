<a id="espanol"></a>

**Español** · [English](#english)

# S12 — Enseñar electrónica a través de equipos de música

S12 es un proyecto para enseñar electrónica usando como material de estudio los **equipos de música**: efectos, pedales, amplificadores, guitarras. La premisa es que un pedal de distorsión, una perilla de tono o una etapa de ganancia no son ejemplos decorativos de la teoría de circuitos — son teoría de circuitos, en un objeto que el estudiante ya conoce, ya escucha y ya quiere entender.

El proyecto tiene dos componentes que se alimentan mutuamente:

- **Los cursos** — material pedagógico completo y replicable, diseñado por audiencia.
- **El FRA** — un analizador de respuesta en frecuencia, construido desde cero, que sirve para caracterizar los efectos que ya existen y los que construyen los estudiantes, y para tocarlos con una guitarra eléctrica.

---

## El programa y sus cursos

S12 no es un curso único: es un programa del que se van derivando cursos, cada uno con su audiencia y su equipo de entrada. Lo que se mantiene constante es el método — entrar por un equipo de música real, construir la intuición antes de la fórmula, y cerrar midiendo.

### Curso 1 — Control de Tono

**Audiencia:** estudiantes de primer semestre de ingeniería electrónica, sin conocimientos previos de electrónica.

**Equipo de entrada:** la perilla de tono de una guitarra eléctrica.

Este primer curso es el que da nombre al repositorio. Su punto de entrada es la perilla de tono porque es, probablemente, el circuito no trivial más accesible que existe: se gira con la mano y el resultado se escucha de inmediato.

Una perilla de tono es un filtro RC pasa-bajos. Es un potenciómetro — girarla cambia el valor de la resistencia (R), lo que desplaza la frecuencia de corte del filtro y modifica el timbre de la guitarra. El capacitor es fijo. Ese objeto cotidiano contiene, en su interior, los mismos principios que se usan para diseñar filtros de audio, sistemas de comunicación y circuitos de procesamiento de señales.

**Progresión temática:**

```
Divisor de voltaje → Ley de mallas → Superposición → Filtros RC → Diagramas de Bode
```

Cada concepto se introduce como extensión natural del anterior. Al final, la perilla de tono deja de ser un misterio: el estudiante sabe exactamente qué está cambiando cuando la gira y por qué eso afecta el sonido.

**Formato:**

- Máximo 1.5 horas por sesión
- Entre 3 y 6 sesiones en total
- Cierra con un proyecto integrador en el que los estudiantes construyen o modifican un filtro RC y escuchan el resultado en tiempo real

### Cursos siguientes

El resto del gear musical queda como territorio por recorrer: distorsión y recorte, etapas de ganancia, delay, las fuentes de alimentación de un amplificador. Cada uno entra por su propio equipo y apunta a su propia audiencia. El curso de la perilla de tono es **el diseño para primeros semestres**, no el alcance del programa.

---

## Filosofía pedagógica

**Mínima matemática, máxima intuición.**

La idea es la misma que sigue Veritasium o 3Blue1Brown: el efecto se muestra antes de explicarse, la intuición se construye antes de formalizarse. Las fórmulas llegan al final, como descripción de algo que ya se entiende — no como punto de partida.

Para lograrlo se usa un sistema de analogías físicas. En lugar de definir el voltaje como diferencia de potencial eléctrico, se introduce como una propiedad del espacio que hace que una pelota —el portador de carga— siempre ruede de lo alto a lo bajo. En lugar de memorizar que un capacitor "bloquea DC y pasa AC", se visualiza como un bloque elástico que responde distinto según qué tan rápido lleguen las señales.

Estas analogías son deliberadamente imperfectas: son herramientas para construir intuición, no definiciones formales. El objetivo es que cuando el estudiante vea la definición real, ya tenga algo concreto en la cabeza a qué anclarla.

Un principio atraviesa todo el material: la resistencia le cobra **energía** a la carga, no existencia. La pelota nunca desaparece — si se queda sin energía se detiene, pero sigue ahí. Eso ataca de raíz la idea de que "la corriente se gasta".

---

## El FRA

### Qué es

Un **Frequency Response Analyzer** (analizador de respuesta en frecuencia) es un instrumento que mide cómo una red de dos puertos modifica una señal en función de la frecuencia. La salida es un diagrama de Bode: magnitud en dB y fase en grados, trazados sobre el eje de frecuencia.

Este FRA cubre el rango de 20 Hz a 20 kHz — el espectro audible completo.

### Para qué existe

El FRA es el instrumento de caracterización del programa. Se le conecta un efecto —uno comercial, uno casero, o **uno desarrollado por los estudiantes**— y mide qué le hace a la señal. En modo pedal, además, ese mismo efecto se puede **tocar con una guitarra eléctrica** en tiempo real.

Eso es lo que cierra el ciclo: el estudiante construye un efecto, lo mide y le ve el Bode, y lo toca. Sin el FRA, un efecto propio se queda en "suena raro". Con el FRA se vuelve un circuito caracterizado.

De ahí sale una restricción de diseño que no es negociable: el DUT (*device under test*) tiene que ser **genérico e intercambiable**. Cualquier efecto de un estudiante debe poder entrar, no solo una red RC. El slot modular y los jacks de 1/4" son parte del propósito, no un detalle de empaque.

### Cómo funciona

La señal entra por un jack, se acondiciona, y llega al slot donde está conectado el DUT. Lo que hace al FRA un instrumento de medida y no solo una caja de paso es que **mide los dos lados del DUT a la vez**: la señal tal como entra y la señal tal como sale. Comparar esas dos capturas es lo que da la respuesta en frecuencia.

Un microcontrolador se encarga de la captura, del cálculo y de enviar los datos al PC, donde se visualizan.

### Modos de operación

**Modo Pedal**

La señal de la guitarra pasa en vivo por el DUT y sale por el jack de salida, hacia un parlante o un amplificador. Mientras tanto se monitorean entrada y salida, así que el músico escucha el efecto y ve su huella espectral al mismo tiempo.

**Modo Bode**

Se desconecta la guitarra y se excita el DUT con una señal generada internamente. Comparando lo que entra con lo que sale, se obtiene el diagrama de Bode completo del efecto, de forma automática.

La excitación es ruido blanco: como tiene espectro plano, golpea todas las frecuencias del rango a la vez y la respuesta completa se obtiene en una sola captura corta, en lugar de barrer frecuencia por frecuencia. La estimación usa el método de Welch y reporta la coherencia como indicador de confiabilidad, para saber en qué bandas la medida es de fiar. El procesamiento está validado en `FRA/codigos/ruido_blanco.ipynb`.

---

## Las presentaciones

### Formato general

Las presentaciones no son slides. Son escenas continuas con checkpoints controlados por teclado: el instructor avanza cuando el grupo está listo, ni más rápido ni más lento. Varias escenas son además **simuladores** que el instructor maneja en vivo — se abre y cierra el circuito, se sueltan cargas, se cambia la resistencia, se transforma el modelo físico en esquemático.

Cada sesión combina dos tipos de contenido animado:

**Manim CE (Python)** — animaciones matemáticas y técnicas: ondas, diagramas de Bode emergiendo, circuitos con flechas, transformaciones. Renderizadas a video.

**p5.js (JavaScript)** — simulaciones físicas interactivas: la carga viajando por el conductor, el aceite de la resistencia deformándose a su paso, el divisor de voltaje respondiendo en tiempo real. Corren directo en el browser.

Un player web propio combina los clips de Manim y los sketches de p5.js en una sola secuencia navegable, y comparte una paleta única entre ambos mundos para que no se note la costura.

### Secuencia de cada concepto

Para cualquier concepto del curso, la presentación sigue siempre el mismo orden:

1. **Demostración observable** — se muestra el fenómeno antes de nombrarlo
2. **Analogía física animada** — se construye la intuición con el modelo físico
3. **Transferencia al circuito** — se mapea la analogía al circuito real
4. **Formalización** — llega la fórmula, ya anclada a algo concreto
5. **Medición** — se verifica con el FRA

---

## Stack técnico

| Herramienta         | Uso                                              |
| ------------------- | ------------------------------------------------ |
| Python 3.12 + venv  | Base del proyecto                                |
| Manim CE v0.20.1    | Animaciones técnicas y matemáticas             |
| p5.js (vendorizado) | Simulaciones físicas interactivas en browser    |
| FFmpeg              | Renderizado de video                             |
| Jupyter             | Documentación pedagógica y análisis de señal |
| KiCad               | Diseño de la PCB del FRA                        |

---

## Estructura del repositorio

```
control-de-tono/
├── presentaciones/     # Animaciones Manim, sketches p5.js, player web
├── FRA/                # Hardware, firmware, software PC
├── compras/            # BOM y materiales
└── syllabus/           # Contenido del curso, notebooks pedagógicos
```

Para correr las presentaciones:

```bash
cd presentaciones
python servidor.py 8000
# luego abrir http://127.0.0.1:8000/player/
```

<br>

---

<a id="english"></a>

[Español](#espanol) · **English**

# S12 — Teaching electronics through music gear

S12 is a project for teaching electronics using **music gear** as the study material: effects, pedals, amplifiers, guitars. The premise is that a distortion pedal, a tone knob or a gain stage aren't decorative examples of circuit theory — they *are* circuit theory, embodied in an object the student already knows, already listens to, and already wants to understand.

The project has two components that feed each other:

- **The courses** — complete, reproducible teaching material, designed per audience.
- **The FRA** — a frequency response analyzer, built from scratch, used to characterize both existing effects and the ones students build, and to play them through an electric guitar.

---

## The program and its courses

S12 isn't a single course: it's a program that spawns courses, each with its own audience and its own entry-point piece of gear. What stays constant is the method — enter through a real piece of music gear, build intuition before the formula, and close the loop by measuring.

### Course 1 — Tone Control

**Audience:** first-semester electronic engineering students, with no prior background in electronics.

**Entry-point gear:** the tone knob of an electric guitar.

This first course is the one the repository is named after. Its entry point is the tone knob because it's arguably the most accessible non-trivial circuit there is: you turn it by hand and hear the result immediately.

A tone knob is an RC low-pass filter. It's a potentiometer — turning it changes the resistance (R), which shifts the filter's cutoff frequency and alters the guitar's timbre. The capacitor is fixed. That everyday object contains, inside it, the same principles used to design audio filters, communication systems and signal processing circuits.

**Topic progression:**

```
Voltage divider → Kirchhoff's voltage law → Superposition → RC filters → Bode plots
```

Each concept is introduced as a natural extension of the previous one. By the end, the tone knob stops being a mystery: the student knows exactly what changes when they turn it, and why that affects the sound.

**Format:**

- 1.5 hours per session, maximum
- 3 to 6 sessions total
- Closes with a capstone project where students build or modify an RC filter and hear the result in real time

### Later courses

The rest of the musical gear landscape is territory still to be covered: distortion and clipping, gain stages, delay, amplifier power supplies. Each one enters through its own piece of gear and targets its own audience. The tone knob course is **the design for first-semester students**, not the scope of the program.

---

## Teaching philosophy

**Minimum math, maximum intuition.**

The approach is the one Veritasium and 3Blue1Brown follow: show the effect before explaining it, build the intuition before formalizing it. Formulas arrive last, as a description of something already understood — not as the starting point.

To get there, the material uses a system of physical analogies. Instead of defining voltage as electric potential difference, it's introduced as a property of space that makes a ball — the charge carrier — always roll from high to low. Instead of memorizing that a capacitor "blocks DC and passes AC", it's visualized as an elastic block that responds differently depending on how fast the signals arrive.

These analogies are deliberately imperfect: they're tools for building intuition, not formal definitions. The goal is that when the student meets the real definition, they already have something concrete to anchor it to.

One principle runs through all the material: resistance charges the carrier **energy**, not existence. The ball never disappears — if it runs out of energy it stops, but it's still there. That attacks the "current gets used up" misconception at its root.

---

## The FRA

### What it is

A **Frequency Response Analyzer** is an instrument that measures how a two-port network modifies a signal as a function of frequency. The output is a Bode plot: magnitude in dB and phase in degrees, plotted against frequency.

This FRA covers 20 Hz to 20 kHz — the full audible spectrum.

### Why it exists

The FRA is the program's characterization instrument. You plug an effect into it — a commercial one, a homemade one, or **one developed by the students** — and it measures what that effect does to the signal. In pedal mode, that same effect can also be **played through an electric guitar** in real time.

That's what closes the loop: the student builds an effect, measures it and sees its Bode plot, and then plays it. Without the FRA, a homemade effect stays at "sounds weird". With the FRA it becomes a characterized circuit.

From this follows a non-negotiable design constraint: the DUT (device under test) must be **generic and swappable**. Any student's effect has to be able to go in, not just an RC network. The modular slot and the 1/4" jacks are part of the purpose, not a packaging detail.

### How it works

The signal comes in through a jack, gets conditioned, and reaches the slot where the DUT is connected. What makes the FRA a measuring instrument rather than just a box the signal passes through is that it **measures both sides of the DUT at once**: the signal as it goes in and the signal as it comes out. Comparing those two captures is what yields the frequency response.

A microcontroller handles capture, computation, and streaming the data to the PC, where it's visualized.

### Operating modes

**Pedal mode**

The guitar signal passes live through the DUT and out the output jack, into a speaker or an amplifier. Meanwhile input and output are monitored, so the player hears the effect and sees its spectral fingerprint at the same time.

**Bode mode**

The guitar is disconnected and the DUT is excited with an internally generated signal. Comparing what goes in with what comes out yields the effect's complete Bode plot, automatically.

The excitation is white noise: since its spectrum is flat, it hits every frequency in the range at once, so the full response comes from a single short capture instead of a frequency-by-frequency sweep. The estimate uses Welch's method and reports coherence as a confidence indicator, to tell which bands are trustworthy. The processing is validated in `FRA/codigos/ruido_blanco.ipynb`.

---

## The presentations

### General format

The presentations aren't slides. They're continuous scenes with keyboard-driven checkpoints: the instructor advances when the group is ready, no faster and no slower. Several scenes are also **simulators** the instructor drives live — opening and closing the circuit, releasing charges, swapping the resistance, morphing the physical model into a schematic.

Each session combines two kinds of animated content:

**Manim CE (Python)** — mathematical and technical animations: waveforms, Bode plots being drawn, circuits with annotation arrows, transformations. Rendered to video.

**p5.js (JavaScript)** — interactive physical simulations: the charge traveling down the conductor, the resistance's oil deforming as it passes, the voltage divider responding in real time. They run directly in the browser.

A custom web player stitches the Manim clips and p5.js sketches into a single navigable sequence, and shares one palette across both worlds so the seam doesn't show.

### Sequence for every concept

For any concept in the course, the presentation always follows the same order:

1. **Observable demonstration** — show the phenomenon before naming it
2. **Animated physical analogy** — build intuition with the physical model
3. **Transfer to the circuit** — map the analogy onto the real circuit
4. **Formalization** — the formula arrives, already anchored to something concrete
5. **Measurement** — verify it with the FRA

---

## Tech stack

| Tool                | Used for                                     |
| ------------------- | -------------------------------------------- |
| Python 3.12 + venv  | Project base                                 |
| Manim CE v0.20.1    | Technical and mathematical animations        |
| p5.js (vendored)    | Interactive physical simulations in-browser  |
| FFmpeg              | Video rendering                              |
| Jupyter             | Teaching documentation and signal analysis   |
| KiCad               | FRA PCB design                               |

---

## Repository layout

```
control-de-tono/
├── presentaciones/     # Manim animations, p5.js sketches, web player
├── FRA/                # Hardware, firmware, PC software
├── compras/            # BOM and materials
└── syllabus/           # Course content, teaching notebooks
```

To run the presentations:

```bash
cd presentaciones
python servidor.py 8000
# then open http://127.0.0.1:8000/player/
```

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

### Arquitectura de hardware

**Cadena de entrada**
- Jack 1/4" → buffer de alta impedancia (~1 MΩ, NE5532) con pot de ganancia en panel → switch de modo (guitarra o excitación interna)

**Slot DUT**
- Conector modular. Acepta cualquier red de dos puertos: filtros RC, pedales, efectos de estudiantes, redes pasivas.

**Captura: PCM1808 — un solo ADC estéreo, 24 bit, 96 kSps, I²S**
- El canal L mide la señal **antes** del DUT; el canal R, **después**.
- Al ser un único ADC estéreo, ambas medidas viajan en el mismo stream: la sincronía de muestra es inherente. Esto reemplaza el esquema original de dos ADCs separados, que obligaba a sincronizarlos entre sí.

**Excitación: PCM5102A (DAC I²S)**
- Genera el ruido blanco del modo Bode. Comparte el reloj I²S con el ADC, así que excitación y captura quedan sincronizadas.

**Salida**
- Buffer NE5532 → PAM8302 (clase D, 2.5 W) para parlante integrado → jack 1/4"

**Microcontrolador: ESP32-S3 (N16R8 WROOM-1)**
- Tiene FPU para la FFT, USB nativo, RAM suficiente y dos periféricos I²S. El C3, single-core y sin FPU, se queda corto.
- Calcula la función de transferencia, controla el switch de modo, y maneja el footswitch y 6 botones programables.
- Envía datos al PC vía USB para visualización.

**Tierra virtual: TLE2426**
- Rail splitter que da un punto medio estable a 2.5 V, para centrar el audio con alimentación única de 5 V por USB.

### Modos de operación

**Modo Pedal (footswitch ON)**

La señal de guitarra entra, pasa por el DUT y sale por el jack de salida. El ADC monitorea entrada y salida en tiempo real, y el PC muestra el espectro antes y después del DUT. El músico escucha el efecto mientras ve su huella espectral.

**Modo Bode (footswitch OFF)**

El switch desconecta la guitarra y conecta el generador de ruido blanco. El ruido pasa por el DUT, el ADC captura ambos lados, y se estima:

```
H(f) = Gxy(f) / Gxx(f)

donde:
  Gxy = espectro cruzado entrada-salida   [complejo]
  Gxx = auto-espectro de la entrada       [real]
```

Se promedian múltiples ventanas (método de Welch) para reducir el ruido de estimación. La coherencia γ² actúa como indicador de confiabilidad por frecuencia: valores bajos señalan bandas donde la medición no es de fiar.

El resultado es un diagrama de Bode completo, generado automáticamente. El pipeline está validado en `FRA/codigos/ruido_blanco.ipynb`.

### Señal de excitación

Se usa ruido blanco gaussiano generado digitalmente. La elección es intencional:

- Espectro plano sobre todo el rango → excita todas las frecuencias con igual energía
- No requiere barrer frecuencia por frecuencia, como el swept sine
- La medición completa cabe en una sola captura de ~500 ms a 1 s

500 ms es el mínimo recomendado para una planitud espectral aceptable (desviación estándar < 1.5 dB sobre el rango de interés); 1 s produce calidad de referencia. Al vivir la excitación en firmware, migrar a swept-sine o chirp más adelante no toca el hardware.

### Meta de calidad y fabricación

El objetivo es un instrumento serio: ±0.5 dB en magnitud, fase precisa, SNR > 70 dB. La ruta de fabricación es protoboard primero —para validar la cadena de señal— y PCB después, en KiCad.

El BOM completo, con cantidades, precios y enlaces, está en `compras/FRA_materiales.md` (≈ US$200 sin envío).

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

| Herramienta | Uso |
|---|---|
| Python 3.12 + venv | Base del proyecto |
| Manim CE v0.20.1 | Animaciones técnicas y matemáticas |
| p5.js (vendorizado) | Simulaciones físicas interactivas en browser |
| FFmpeg | Renderizado de video |
| Jupyter | Documentación pedagógica y análisis de señal |
| ESP32-S3 | Microcontrolador del FRA |
| KiCad | PCB del FRA |

---

## Estructura del repositorio

```
control-de-tono/
├── presentaciones/     # Animaciones Manim, sketches p5.js, player web
├── FRA/                # Hardware, firmware ESP32, software PC
├── compras/            # BOM y materiales
└── syllabus/           # Contenido del curso, notebooks pedagógicos
```

Para correr las presentaciones:

```bash
cd presentaciones
python servidor.py 8000
# luego abrir http://127.0.0.1:8000/player/
```

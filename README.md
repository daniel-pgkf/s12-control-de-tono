# Control de Tono — S12

Un proyecto de dos partes: un curso universitario de electrónica básica y un analizador de respuesta en frecuencia (FRA) construido desde cero. El hilo conductor de ambos es el mismo objeto: la perilla de tono de una guitarra eléctrica.

---

## La idea central

Una perilla de tono es un filtro RC pasa-bajos. Girarla cambia el valor de un capacitor, lo que desplaza la frecuencia de corte del filtro y modifica el timbre de la guitarra. Este objeto cotidiano contiene, en su interior, los mismos principios que se usan para diseñar filtros de audio, sistemas de comunicación y circuitos de procesamiento de señales.

El proyecto parte de ahí: usar algo que los estudiantes pueden escuchar y tocar como punto de entrada a la teoría de circuitos.

---

## Parte 1 — El Curso

### Qué se quiere lograr

Un curso de electrónica básica para estudiantes de primer semestre de ingeniería electrónica, sin conocimientos previos. El objetivo no es cubrir temario: es que los estudiantes *entiendan* — que puedan predecir el comportamiento de un circuito antes de medirlo, que sientan la intuición antes de ver la fórmula.

La progresión temática va de lo más simple a lo más completo:

```
Divisor de voltaje → Ley de mallas → Superposición → Filtros RC → Diagramas de Bode
```

Cada concepto se introduce como extensión natural del anterior. Al final, la perilla de tono deja de ser un misterio: el estudiante sabe exactamente qué está cambiando cuando la gira y por qué eso afecta el sonido.

### Formato

- Máximo 1.5 horas por sesión
- Entre 3 y 6 sesiones en total
- Cierra con un proyecto integrador en el que los estudiantes construyen o modifican un filtro RC y escuchan el resultado en tiempo real

### Filosofía pedagógica

**Mínima matemática, máxima intuición.**

La idea es la misma que sigue Veritasium o 3Blue1Brown: el efecto se muestra antes de explicarse, la intuición se construye antes de formalizarse. Las fórmulas llegan al final, como descripción de algo que ya se entiende — no como punto de partida.

Para lograrlo, se usa un sistema de analogías físicas. En lugar de definir voltaje como diferencia de potencial eléctrico, se introduce como la velocidad de una pelota que viaja por el espacio. En lugar de memorizar que un capacitor "bloquea DC y pasa AC", se visualiza como un bloque elástico que responde diferente según qué tan rápido lleguen las señales.

Estas analogías son deliberadamente imperfectas — son herramientas para construir intuición, no definiciones formales. El objetivo es que cuando el estudiante vea la definición real, ya tenga algo concreto en la cabeza a qué anclarla.

### Las analogías en detalle

**Voltaje como velocidad**

Una pelota viaja desde un punto A (voltaje alto) hasta tierra (0V). La velocidad de la pelota en cada punto del recorrido *es* el voltaje en ese punto. Cuando la pelota pasa por una resistencia — representada como un bloque de aceite viscoso — su velocidad cae linealmente. Dos resistencias en serie forman un divisor: la velocidad total se reparte proporcionalmente entre los dos bloques.

Esta analogía reemplaza a la clásica analogía de la montaña porque la velocidad es directamente observable y no confunde voltaje con energía acumulada.

**El capacitor como bloque elástico**

En un filtro RC, el capacitor ocupa el lugar de una de las resistencias en el divisor. A diferencia de la resistencia (bloque de aceite, longitud fija), el bloque elástico *cambia de longitud* según la frecuencia de la señal:

- Señal lenta (baja frecuencia): la pelota llega despacio, el bloque se comprime mucho, actúa como un bloque muy largo → atenúa la señal
- Señal rápida (alta frecuencia): la pelota llega y se va antes de que el bloque se comprima significativamente → actúa como bloque corto → la señal pasa

La frecuencia de corte es el punto donde el bloque elástico y el bloque de aceite tienen la misma longitud efectiva. El voltaje se divide al 50% (−3 dB).

**La perilla de tono**

Girar la perilla cambia el valor de C, lo que cambia la longitud "natural" del bloque elástico y desplaza la frecuencia de corte. Posición oscura → C grande → fc baja → se atenúan los agudos. Posición brillante → C pequeño → fc alta → pasan más agudos.

---

## Parte 2 — El FRA

### Qué es

Un **Frequency Response Analyzer** (analizador de respuesta en frecuencia) es un instrumento que mide cómo una red de dos puertos modifica una señal en función de la frecuencia. La salida es un diagrama de Bode: magnitud en dB y fase en grados, trazados sobre el eje de frecuencia.

Este FRA cubre el rango de 20 Hz a 20 kHz — el espectro audible completo — y está diseñado para medir redes relativamente simples: filtros RC, pedales de guitarra, redes pasivas en general.

### Qué se quiere lograr con él

El FRA tiene dos propósitos complementarios:

1. **Instrumento de medición**: permite generar diagramas de Bode automáticamente de cualquier red de dos puertos conectada al slot DUT. Útil en el curso para mostrar en tiempo real cómo cambia la respuesta del filtro cuando se modifican los componentes.

2. **Procesador de señal en tiempo real**: en modo pedal, la señal de la guitarra pasa en vivo por el DUT. El estudiante puede escuchar cómo suena un filtro antes de ver su diagrama de Bode, y luego medir ese mismo filtro para relacionar lo que escuchó con lo que ve en la gráfica.

Esta dualidad es intencional: el FRA conecta el sonido (intuición) con la medición (formalización), que es exactamente la secuencia pedagógica del curso.

### Arquitectura de hardware

El FRA tiene dos cadenas de señal simétricas y un microcontrolador central:

**Cadena de entrada**
- Jack 1/4" mono → buffer de alta impedancia (~1MΩ) con pot de ganancia → switch de modo (guitarra o ruido blanco) → ADC₁ (96 kSps, I²S)

**Slot DUT**
- Conector modular de 4 terminales. Acepta cualquier red de dos puertos: filtros RC, pedales, redes pasivas.

**Cadena de salida**
- ADC₂ (96 kSps, sincronizado con ADC₁) → buffer de salida + driver de parlante → jack 1/4" mono

**Microcontrolador: ESP32-C3 Mini**
- Captura datos síncronos de ambos ADCs vía I²S
- Calcula FFT de la señal de entrada y de salida
- Calcula H(f) = FFT(salida) / FFT(entrada) → magnitud y fase
- Controla el switch de modo (pedal vs. Bode)
- Maneja footswitch y 6 botones programables
- Envía datos al PC vía USB para visualización

**Generador de ruido blanco**
- Activo solo en modo Bode. Provee la señal de excitación. El ruido blanco tiene espectro plano — excita todas las frecuencias del rango simultáneamente, lo que permite medir la respuesta completa en una sola captura.

### Modos de operación

**Modo Pedal (footswitch ON)**

La señal de guitarra entra por el jack de entrada, pasa por el DUT y sale por el jack de salida. Ambos ADCs monitorean en tiempo real. El PC muestra simultáneamente el espectro de la señal antes y después del DUT. El músico escucha el efecto del filtro mientras ve su huella espectral.

**Modo Bode (footswitch OFF)**

El switch desconecta la guitarra y conecta el generador de ruido blanco. El ruido pasa por el DUT. Ambos ADCs capturan. El ESP32-C3 calcula:

```
H(f) = Gxy(f) / Gxx(f)

donde:
  Gxy = FFT*(entrada) × FFT(salida)   [espectro cruzado, complejo]
  Gxx = |FFT(entrada)|²               [auto-espectro de entrada, real]
```

Se promedian múltiples ventanas (método de Welch) para reducir el ruido de estimación. La coherencia γ² actúa como indicador de confiabilidad por frecuencia — valores < 0.95 señalan mediciones poco confiables en esa banda.

El resultado es un diagrama de Bode completo: magnitud en dB y fase en grados, generado automáticamente.

### Señal de excitación

Se usa ruido blanco gaussiano generado digitalmente. La elección es intencional:

- Espectro plano sobre todo el rango → excita todas las frecuencias con igual energía
- No requiere hacer un barrido frecuencia por frecuencia (como el swept sine)
- La medición completa cabe en una sola captura de ~500 ms a 1 s

Una duración de 500 ms es el mínimo recomendado para obtener flatness espectral aceptable (desviación estándar < 1.5 dB sobre el rango de interés). Una captura de 1 s produce calidad de referencia.

---

## Parte 3 — Las Presentaciones

### Formato general

Las presentaciones no son slides. Son videos continuos con checkpoints controlados por teclado. El instructor avanza con la barra espaciadora cuando el grupo está listo — ni más rápido, ni más lento.

Cada sesión combina dos tipos de contenido animado:

**Manim CE (Python)** — animaciones matemáticas y técnicas: ondas, diagramas de Bode emergiendo, circuitos con flechas, transformaciones. Renderizadas a video de alta calidad.

**p5.js (JavaScript)** — simulaciones físicas interactivas: la pelota viajando por el conductor, el bloque elástico comprimiéndose, el divisor de voltaje ajustándose en tiempo real. Corren directo en el browser como HTML, sin instalación.

Un player web personalizado combina clips de Manim y sketches de p5.js en una secuencia única, navegable con la barra espaciadora en los checkpoints definidos.

### Secuencia de cada concepto

Para cualquier concepto del curso, la secuencia de presentación sigue siempre el mismo orden:

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
| p5.js (CDN) | Simulaciones físicas interactivas en browser |
| FFmpeg | Renderizado de video |
| Jupyter | Documentación pedagógica y análisis de señal |
| ESP32-C3 Mini | Microcontrolador del FRA |
| Node.js | Dependencias JS del player si se requieren |

---

## Estructura del repositorio

```
control-de-tono/
├── presentaciones/     # Animaciones Manim, sketches p5.js, player web
├── FRA/                # Hardware, firmware ESP32, software PC
└── syllabus/           # Contenido del curso, notebooks pedagógicos
```

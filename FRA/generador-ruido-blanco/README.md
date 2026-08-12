# Generador de ruido blanco — verificación de planicidad

Mide el espectro **real** del generador de ruido blanco del FRA, capturándolo por
la Scarlett 2i2. Es la contraparte física de [`../codigos/ruido_blanco.ipynb`](../codigos/ruido_blanco.ipynb),
que simula el ruido con `randn()` y establece la teoría.

## Cadena de medición

```
Generador ruido blanco → jack 1/4" → Scarlett 2i2 (line in) → USB → captura_planicidad.py
```

Antes de correr: phantom power **apagado**, ganancia ajustada sin clipping.

## El generador — diseño final

Fuente de ruido por **avalancha**: la juntura base-emisor del transistor en
inversa, polarizada por el 100K desde 12 V. Acople de 1 µF y pulldown de 100K
(pasaaltos en 1.6 Hz, bien debajo de la banda).

```
        12V
         │
        100K
         │        1µF                                            1K
  Q ─────●────────┤├────●──── [buffer] ── [G=15.5] ── [G=15.5] ── [buffer] ──/\/\── NOISE
  (BE en                │
   inversa)           100K
         │              │
        GND            GND
```

Cuatro amplificadores en **un solo TL074** (JFET, quad, GBW 3 MHz):

| Etapa | Función | Rf / R1 | Ganancia |
|---|---|---|---|
| 1 | buffer de entrada | — | 1 |
| 2 | ganancia, no inversor | 680k / 47k | 15.47 |
| 3 | ganancia, no inversor | 680k / 47k | 15.47 |
| 4 | buffer de salida | — | 1 |

**Ganancia total: 15.47² ≈ 239.** Entrada ~0.84 mV RMS → salida ~200 mV RMS,
que es nivel de humbucker (ver "Nivel de salida" abajo).

### Por qué la ganancia va repartida y no en una etapa

Esta es **la** decisión de diseño del circuito, y no es obvia. Un opamp no
entrega su ganancia a cualquier frecuencia: lo constante es el **producto**
ganancia-ancho de banda. El ancho de banda real de una etapa es `GBW / G`.

La primera versión eran `1 + 100k/680 = 148` en una sola etapa:

```
fc = 3 MHz / 148 = 20.3 kHz      →  el polo caía justo en el borde de la banda
```

Repartida en dos etapas de 15.47, cada una solo necesita `3 MHz / 15.47`:

```
fc_etapa  = 194 kHz
fc_total  = 194 kHz × √(2^(1/2) − 1) = 125 kHz
```

(El `fc_total` no es el de una etapa: al encadenar N polos iguales, el −3 dB
conjunto llega antes. Con N=2 el factor es 0.644.)

Error en 20 kHz: **−0.09 dB**, contra −2.95 dB de la versión de una etapa. Y eso
que la ganancia total *subió* de 148 a 239: repartida, sale gratis.

> **Honestidad sobre la causa:** el polo de GBW explica ~3 dB, pero la versión
> vieja medía ~19 dB de rango. El resto salía del nodo de 50 kΩ sin bufferear
> (y de un opamp viejo que nunca identificamos). Los dos cambios —repartir la
> ganancia y bufferear la entrada— se hicieron juntos, así que con una sola
> medición no se pueden separar. Ambos eran necesarios.

### Por qué los buffers

- **Entrada:** el nodo de ruido tiene 100k ‖ 100k = **50 kΩ** de impedancia. Con
  esa Z, cualquier capacidad parásita del protoboard forma su propio pasabajos,
  y un opamp bipolar además metería offset por corriente de polarización. El
  buffer JFET (Ib ≈ 30 pA) aísla el nodo y manda ese polo lejos.
- **Salida:** deja el generador con impedancia baja para manejar el cable sin
  que la capacidad se coma los agudos. El 1K en serie es protección.

> Si algún día se sube la ganancia, **repartirla** — no subir una etapa. Al
> triplicar G se te divide por tres el ancho de banda de esa etapa.

### Nivel de salida

Ajustado a **~200 mV RMS** para imitar una pastilla pasiva (humbucker típica:
150–350 mV RMS). Con ruido gaussiano se iguala el **RMS, no el Vpp** — los picos
del ruido son estadísticos y crecen con el tiempo de observación, así que no hay
un Vpp definido. Con factor de cresta ≈ 4 (12 dB), esos 200 mV dan picos de
~800 mV.

> **Cuidado al medir la entrada con osciloscopio:** los ~0.84 mV RMS del nodo de
> ruido están por debajo del piso de un scope típico. Si lees ~20 mV ahí, es casi
> seguro el ruido propio del instrumento, no la señal. La cuenta que cierra es:
> salida medida ÷ 239.

## Uso

```bash
python captura_planicidad.py --list     # ver dispositivos, identificar la Scarlett
python captura_planicidad.py            # captura 10 s y analiza (autodetecta Scarlett)
python captura_planicidad.py --device 3 --dur 10 --channel 1
python captura_planicidad.py --wav espectro_ruido.wav   # re-analizar sin recapturar
```

Cada captura guarda el audio crudo en `.wav` junto al `.png`, así se puede
re-analizar con otro `nperseg` sin volver a montar el setup.

## Qué hace

1. **Verifica clipping** antes de procesar — aborta si el pico llega a fondo de
   escala. Un factor de cresta bajo (< 8 dB) también delata clipping: el ruido
   gaussiano sano da ≈ 11–13 dB.
2. **PSD por Welch**, no FFT directa. Una sola ventana de ruido tiene ~5.6 dB de
   desviación por bin (chi² 2 gdl) — imposible distinguir la respuesta del
   generador de la varianza de la propia realización. Welch promedia ventanas
   solapadas y baja esa varianza.
3. **Métricas de planicidad** en 20 Hz – 20 kHz: nivel medio, desviación estándar,
   rango max-min y SFM.

## Antes de medir: poner la Scarlett a 48 kHz

Estado al 2026-07-14: la interfaz está configurada a **44.1 kHz** en Windows, y
el script aborta con instrucciones si se pide 48 kHz. Conviene cambiarla:

> Panel de control de sonido → Grabación → Scarlett 2i2 → Propiedades →
> Opciones avanzadas → 48000 Hz

**Por qué importa:** a 44.1 kHz el Nyquist es 22.05 kHz, así que el filtro
anti-alias del ADC empieza a caer justo sobre los 20 kHz que queremos medir —
se mediría el filtro de la Scarlett, no el generador. A 48 kHz el Nyquist es
24 kHz y deja margen.

El script usa **WASAPI** a propósito. MME y DirectSound aceptan cualquier
sample rate, pero lo hacen remuestreando en silencio, lo que mete su propio
rolloff. WASAPI en modo compartido rechaza el rate que no coincide — un error
explícito es preferible a un espectro falso.

## Zumbido de 60 Hz

El script mide el hum aparte de la planicidad y lo reporta en su propia sección,
con el exceso en dB de cada armónico sobre el piso de ruido local.

### Por qué se mide aparte en vez de filtrarlo

El hum es de **banda angosta** (60 Hz y armónicos) y el ruido blanco es de
**banda ancha**. Son separables, y conviene separarlos en vez de mezclarlos:

- **Un notch no sirve** para esta métrica: borra el hum, pero deja un hueco que
  la estadística de planicidad lee como una caída del generador. Estarías
  midiendo tu propio filtro.
- **Excluir los bins contaminados** de la estadística mide lo que querés saber
  (¿es plano el ruido de banda ancha?) sin mentir sobre el resto. El hum se
  reporta por separado, con su nivel real.

El script excluye sólo las líneas que sobresalen > 3 dB del piso, y busca
armónicos hasta 2 kHz nada más — el acople de red decae rápido, y arriba de eso
los armónicos de 60 Hz caen más juntos que la resolución de Welch, así que
buscarlos marcaría casi todos los bins como "red".

Cuánto pesa: en una prueba con hum inyectado a propósito (60/120/180 Hz), el
rango pasó de **21.6 dB con hum a 4.1 dB sin él**. El hum solo destroza la
métrica de rango.

### Cómo bajarlo — de más probable a menos

1. **Lazo de tierra (lo más probable, y gratis de probar).** La Scarlett se
   alimenta por USB de la laptop. Si la laptop está enchufada, tenés dos caminos
   a tierra y la diferencia entre ellos aparece como 60 Hz.
   → **Desenchufá el cargador y medí con la laptop a batería.** Si el hum cae,
   era esto.
2. **Alimentá el generador con pila de 9 V**, no con fuente de pared. Elimina de
   una el ripple de la fuente y el lazo de tierra. Para un generador casero es
   lo más efectivo por lo que cuesta.
3. **Cable corto y blindado**, con la malla a tierra en **un solo extremo** (si
   se conecta en los dos, la malla misma se vuelve una espira de tierra).
4. **Alejá el generador** de fuentes conmutadas, transformadores, cargadores,
   monitores y tubos fluorescentes/dimmers. Mover 30 cm a veces ya se nota.
5. **Tierra en estrella** en el protoboard: todos los retornos a un punto, no
   encadenados. Trenzá los cables de alimentación y separalos de los de señal.
6. **Usá la entrada LINE, no la de instrumento (Hi-Z)** — la Hi-Z tiene mucha
   más impedancia y capta bastante más.

### Diagnóstico: ¿de dónde viene?

Cuatro capturas cortas (`--dur 2`) aíslan el origen. Cada `.wav` queda guardado:

| # | Setup | Si aparece el hum acá... |
|---|---|---|
| A | Nada conectado a la Scarlett | es la interfaz / el USB |
| B | Cable conectado, otro extremo al aire | el cable hace de antena → blindaje |
| C | Cable al generador, generador apagado | es la tierra / la fuente del generador |
| D | Generador encendido | lo que quede es del circuito en sí |

```bash
python captura_planicidad.py --dur 2 --out A_nada.png
python captura_planicidad.py --dur 2 --out B_cable_al_aire.png
python captura_planicidad.py --dur 2 --out C_gen_apagado.png
python captura_planicidad.py --dur 2 --out D_gen_on.png
```

Comparás el exceso en 60 Hz que reporta cada una y sabés dónde atacar.

### Para mirar el hum en detalle: `--nperseg 16384`

```bash
python captura_planicidad.py --wav espectro_ruido.wav --nperseg 16384
```

El default (4096) da 11.7 Hz/bin, pensado para promediar mucho y medir
planicidad. Es poca resolución para las líneas de red: en la prueba con hum
inyectado, 4096 detectó 60/120/180 Hz pero **se perdió el armónico de 300 Hz**,
que 16384 (2.9 Hz/bin) sí encontró. También sube el exceso reportado en 60 Hz de
+19.2 a +25.3 dB, más cerca del valor real — a poca resolución la energía del
tono se reparte entre bins y se subestima.

Dos herramientas distintas: **4096 para planicidad, 16384 para cazar hum.** El
`.wav` queda guardado, así que se reanaliza sin volver a medir.

> **Límite:** el exceso en dB de una línea depende de `nperseg` (la PSD de una
> senoide crece con la resolución; la del ruido no). Compará capturas con el
> mismo `nperseg`, no entre distintos. Y a 11.7 Hz/bin, 50 y 60 Hz caen a un bin
> de distancia: son indistinguibles sin subir la resolución.

> **Buena noticia para el FRA:** el hum molesta para *verificar el generador*,
> pero mucho menos para el Bode. Como `H(f) = ADC₂(f)/ADC₁(f)`, un hum común a
> los dos canales se cancela en gran parte al dividir. Además la coherencia
> (γ²) cae en 60 Hz y te avisa sola de que ese punto no es confiable.

## Umbrales

| Métrica | Referencia | Origen |
|---|---|---|
| Desv. estándar | < 3 dB | aceptable para audio |
| Rango max-min | < 6 dB | peor pico/valle tolerable |
| SFM | > −1 dB | 0 dB = plano ideal |
| Hum sobre el piso | < 10 dB | líneas de red (se mide aparte) |

## Piso del estimador

Con ruido gaussiano ideal (10 s, `nperseg=4096`, 233 ventanas) el script mide
**std 0.29 dB, rango 1.93 dB, SFM −0.01 dB**. Ese es el piso del método: cualquier
desviación mayor medida en el generador real es del generador o de la interfaz,
no del estimador.

## Resultados medidos

| | 1 etapa de 148, sin buffers | **2 etapas de 15.47 + buffers** | Piso ideal |
|---|---|---|---|
| std | 4.38 dB | **0.58 dB** ✓ | 0.29 dB |
| rango | 19.46 dB | **4.69 dB** ✓ | 1.93 dB |
| SFM | −2.29 dB | **−0.04 dB** ✓ | −0.01 dB |
| hum 60 Hz | +3.4 dB | +4.0 dB | — |
| nivel medio | −71.8 dB/Hz | −76.8 dB/Hz | — |

(El **nivel medio no es comparable** entre capturas: depende de dónde esté la
perilla de ganancia de la Scarlett. Solo la *forma* de la curva —std, rango,
SFM— es independiente de la ganancia, y por eso son esas las métricas.)

El SFM es el dato que cierra el caso: pasó de −2.29 a −0.04, prácticamente el
ideal. Como el SFM es lo más sensible a una inclinación de banda ancha, ese
número dice que el polo se eliminó, no que se tapó.

**Lo que quedó, y no vale la pena perseguir:**

- El **hum es ahora el factor limitante** del rango, no el generador. El bulto de
  180 Hz queda a +2.8 dB de la media — justo debajo del umbral de 3 dB, así que
  no se excluye y cuenta en el rango. Sin él, el rango bajaría a ~3 dB.
- La caída de ~1.5 dB entre 10k y 20k puede ser en buena parte el filtro
  anti-alias de la propia Scarlett, no el generador.
- **SNR:** señal a −76.8 dB/Hz contra un piso de interfaz de −148.7 dB/Hz
  (medido sin nada conectado) = **~72 dB de margen** en toda la banda.

> Recordá que esta planicidad ni siquiera era necesaria: `H(f) = ADC₂/ADC₁` la
> cancela al dividir. Lo que se compró es **SNR parejo** en toda la banda.

## Trade-off de `nperseg`

Con 10 s a 48 kHz:

| nperseg | Resolución | Ventanas | Espectro |
|---|---|---|---|
| 2048 | 23.4 Hz | ~468 | más suave, menos detalle |
| **4096** | **11.7 Hz** | **~233** | equilibrio (default) |
| 8192 | 5.9 Hz | ~117 | más detalle, más rugoso |

Más resolución cuesta ventanas de promedio. Para *planicidad* conviene
priorizar el promedio; 4096 ya da 11.7 Hz, de sobra para ver desviaciones de
banda ancha.

> **Nota:** una irregularidad del generador no invalida el Bode del FRA —
> `H(f) = ADC₂(f)/ADC₁(f)` cancela lo que sea común a ambos canales. Lo que
> importa es que haya SNR suficiente en toda la banda.

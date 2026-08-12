# Analizador de Bode en tiempo real — FRA

Captura los dos canales de la Scarlett 2i2 y muestra en vivo la función de
transferencia del sistema bajo prueba (DUT): **magnitud, fase y coherencia**.

Es la contraparte en tiempo real de la demo de Bode en
[`../codigos/ruido_blanco.ipynb`](../codigos/ruido_blanco.ipynb) — la misma
matemática (estimador H1), pero midiendo hardware real y actualizándose sola.

## Conexiones

```
Generador de ruido ──┬──────────────────────────→ Scarlett IN 1  (entrada, x)
                     │
                     └──→ [ DUT ] ──→ Scarlett IN 2  (salida, y)
```

- **Canal 1 = entrada:** el ruido del generador, directo.
- **Canal 2 = salida:** el mismo ruido después de pasar por el DUT.
- La app **no reproduce nada** — el ruido es externo, solo escucha.
- Sin clipping en ninguno de los dos canales (la app lo vigila en vivo).
- Scarlett a 48 kHz en Windows (si no, corré con `--fs 44100`).

El DUT puede ser cualquier red de dos puertos: filtro RC, tone knob de guitarra,
pedal, etc.

## Uso

```bash
python fra_bode_live.py --list      # ver dispositivos e índices
python fra_bode_live.py             # abrir el analizador (autodetecta Scarlett)
python fra_bode_live.py --test      # verificar la matemática sin hardware
python fra_bode_live.py --device 15 --fs 44100
```

En la ventana:  **`g`** guarda un snapshot PNG en `imagenes/`  ·  **`q`** cierra.

## Detección del polo y predicción de R

La app detecta sola la **fc** (frecuencia del polo) del DUT y la marca con una
línea vertical ámbar en los paneles de magnitud y fase, con el rótulo
`pasa-bajos  fc = 998 Hz` (o `pasa-altos`).

Cómo la encuentra: busca dónde la magnitud cae **−3 dB respecto a la banda de
paso** (no respecto a 0 dB absoluto, así una pérdida fija de cables no la corre),
y sólo dentro de la zona donde la coherencia es confiable. El tipo (pasa-bajos vs
pasa-altos) sale de qué extremo del espectro es la banda de paso.

**Predicción de R:** escribí la capacitancia en el campo **`C =`** abajo a la
izquierda y Enter. La app despeja del polo:

```
R = 1 / (2π · fc · C)
```

y muestra `C = 100 nF → R ≈ 1.59 kΩ`. Acepta sufijos SI: `100n`, `100nF`,
`0.1u`, `4.7n`, o notación científica `4.7e-9`.

> Es el uso inverso del Bode: en vez de calcular la curva desde R y C conocidos,
> medís la curva y deducís el componente que no conocés. Útil para caracterizar
> un capacitor sin marca, o para confirmar un RC armado.

> Los índices de dispositivo de Windows **no son estables** entre sesiones (hoy la
> Scarlett puede ser 15, mañana 17). Por eso la app autodetecta por nombre + 2
> canales + WASAPI en vez de pedirte un número fijo.

## Cómo leer los tres paneles

1. **Magnitud (dB)** — el Bode de amplitud. Un pasa-bajos RC cae −3 dB en su fc y
   sigue a −6 dB/octava; un pasa-altos hace lo inverso.
2. **Fase (°)** — con `np.unwrap`. Se dibuja **sólida donde la coherencia es
   buena** (γ² ≥ 0.9) y **fantasma (tenue) donde no** — así se ve de un vistazo en
   qué frecuencias creerle. Un RC pasa-bajos va de 0° a −90°, cruzando −45° en fc.
3. **Coherencia γ² (0–1)** — el semáforo. 1 = la salida se explica enteramente por
   la entrada en esa frecuencia (medición confiable). Cae donde falta señal, hay
   ruido de red, o el DUT no responde linealmente. **Donde γ² baja, ignorá la
   fase y la magnitud ahí.**

Barra de estado (arriba): nivel pico de cada canal en dBFS (con aviso de
**CLIPPING** en vivo) y la coherencia media en la banda.

## Por qué la fase es medible con esta interfaz

La Scarlett 2i2 tiene **un solo ADC estéreo**: los dos canales se muestrean con el
mismo reloj y en el mismo instante, dentro de un único stream. Por eso:

- La diferencia de fase entre canales es **real y estable** (sin deriva de reloj).
- El retardo entre canales es **cero por construcción** — no hay que alinear nada.
- Los anti-alias de ambos canales son idénticos → su fase se **cancela** al
  dividir `H = ADC₂/ADC₁`. Queda la fase pura del DUT.

Con dos conversores de relojes independientes esto no funcionaría. Acá sí.

> **Fase e inversión:** si el DUT invierte la señal (p. ej. una etapa inversora),
> la fase parte de ±180°. Es correcto, no un error — el DUT realmente invierte.

## Estabilidad en vivo — el promedio exponencial

El ruido blanco da una estimación con varianza; en vivo, sin promediar, el Bode
"tiembla". La app promedia los espectros complejos `Gxy`/`Gxx` entre refrescos con
un factor de olvido α (`avg = α·avg + (1−α)·nuevo`, α=0.7 por defecto). Es el
equivalente en tiempo real de promediar más ventanas Welch:

- **α alto (→1):** más estable, pero responde más lento cuando ajustás el DUT.
- **α bajo (→0):** más ágil, pero más tembloroso.

Ajustable con `--alpha`.

## Parámetros

| Flag | Default | Qué es |
|---|---|---|
| `--fs` | 48000 | sample rate |
| `--nperseg` | 4096 | ventana Welch (11.7 Hz/bin) |
| `--buffer` | 2.0 | segundos de historia por estimación (~22 ventanas) |
| `--refresh` | 400 | ms entre redibujos |
| `--alpha` | 0.7 | olvido exponencial (0–1) |

## Verificación

`--test` corre la matemática contra un RC pasa-bajos sintético de fc = 1 kHz, sin
hardware ni pantalla, y confirma −3 dB y −45° en fc con coherencia ≈ 1, que la
**detección del polo** cae dentro del 5% de la fc real, y que la **predicción de
R** da el valor esperado. Es la misma prueba de la última celda del notebook.
Sirve para confirmar que el núcleo de cálculo está sano antes de medir con
hardware.

La ventana en vivo (backend TkAgg) solo se prueba con display y la interfaz
conectada. Prueba de humo recomendada: poné un RC conocido como DUT y confirmá que
el codo de −3 dB y el cruce de −45° caen donde la teoría dice.

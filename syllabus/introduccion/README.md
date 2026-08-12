# Introducción — Reproductor con filtros de primer orden

Demo interactiva para abrir el curso: reproducí un mp3 y escuchá (y **veé**) el
efecto de filtros de primer orden pasa-altas / pasa-bajas, encadenables.

Un filtro de primer orden **es** el RC del curso (la perilla de tono). Encadenar
un pasa-altas + un pasa-bajas hace un pasa-banda. La idea es que el estudiante
*oiga* el efecto antes de cualquier fórmula, y vea en la misma pantalla la causa
(la curva del filtro) y el efecto (cómo cambia el espectro).

## Uso

Abrí **`index.html`** con doble clic en el navegador. No necesita instalar nada
ni servidor; funciona offline.

1. **Cargar mp3** (botón o arrastrar el archivo). El audio queda en tu navegador,
   no se sube a ningún lado.
2. **▶** para reproducir.
3. Abajo de todo, **＋ Añadir filtro** — cada tarjeta: pasa-altas / pasa-bajas y su
   frecuencia de corte (slider o número). Añadí los que quieras; se aplican en
   cadena. Los controles de filtros viven bajo las gráficas.
4. **Switch FILTROS ON/OFF** — activa o desactiva toda la cadena, para comparar
   A/B con y sin filtro.
5. **Promedio entrada** (sobre el espectro) — acumula el espectro promedio (LTAS)
   del track mientras suena, y lo dibuja como línea ámbar.

**Controles de las gráficas:**
- **Eje Y: dB / lineal** (arriba a la derecha) — cambia la escala vertical de ambas
  gráficas entre decibeles (log) y amplitud lineal. En lineal, el espectro se
  autoescala al pico y el Bode fija la ganancia unitaria arriba, para aprovechar
  todo el alto.
- **Leyenda del espectro** (entrada / salida / promedio) — clic en cada una para
  mostrarla u ocultarla.
- **Arrastrar el borde inferior** de cada gráfica cambia su alto.

## Qué muestran las dos gráficas

Comparten el mismo eje de frecuencia (20 Hz–20 kHz, log), alineadas:

- **Espectro** (arriba): la **entrada** al fondo (tenue) y la **salida** encima
  (verde). Se ve en tiempo real qué frecuencias sobreviven al filtro.
- **|H(f)|** (abajo): la respuesta de la cadena de filtros — el Bode. Los puntos
  ámbar marcan cada fc (donde cae −3 dB). Es la *causa* del cambio de arriba.

Con el switch en OFF, la salida coincide con la entrada y el Bode queda plano: se
ve que sin filtro no pasa nada.

## Notas técnicas

- Filtros de **primer orden reales** (6 dB/oct), vía `IIRFilterNode` con
  coeficientes por transformada bilineal — no el biquad de 2º orden del navegador.
  Verificado contra `scipy`: −3.01 dB exactos en fc.
- El **orden de la cadena no cambia el sonido** (filtros lineales → la cascada
  conmuta), por eso no hace falta reordenar.

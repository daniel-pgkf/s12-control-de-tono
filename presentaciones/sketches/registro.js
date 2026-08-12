// Registro de sketches p5.
//
// Cada archivo <id>.js se declara a sí mismo llamando registrarSketch(). El
// player (o un wrapper standalone) los monta después con montarSketch().
//
// Los sketches conservan su tamaño lógico original (750x320, 780x520...) y el
// player los ESCALA con CSS. Nunca se redimensiona el lienzo: la física de la
// pelota y del fluido está afinada en píxeles y cambiar el tamaño la rompería.

const SKETCHES = {};

function registrarSketch(id, meta, fabrica) {
  SKETCHES[id] = { id, meta, fabrica };
}

/**
 * Monta un sketch dentro de un contenedor.
 * Devuelve un handle con .destruir() y .reiniciar().
 */
function montarSketch(id, contenedor, opciones = {}) {
  const entrada = SKETCHES[id];
  if (!entrada) throw new Error(`Sketch no registrado: ${id}`);

  // Caja de tamaño lógico fijo; el escalado se aplica encima.
  const caja = document.createElement('div');
  caja.className = 'caja-sketch';
  caja.style.width = entrada.meta.ancho + 'px';
  caja.style.height = entrada.meta.alto + 'px';
  contenedor.appendChild(caja);

  const ctx = Object.assign({ contenedor: caja }, opciones);
  const instancia = new p5((p) => entrada.fabrica(p, ctx));

  return {
    id,
    meta: entrada.meta,
    caja,
    instancia,
    destruir() {
      instancia.remove();
      caja.remove();
    },
    // Los sketches reinician con click; se lo reenviamos sintéticamente.
    reiniciar() {
      if (typeof instancia.mousePressed === 'function') instancia.mousePressed();
    },
    /**
     * Sub-pasos internos. Un sketch puede definir p.avanzarPaso() y devolver
     * true mientras le queden pasos por consumir; el player entonces NO cambia
     * de checkpoint. Cuando devuelve false, el checkpoint se da por terminado.
     *
     * Sirve para escenas que arrancan quietas y reaccionan al ESPACIO
     * (p. ej. disparar los cañones antes de pasar a la siguiente escena).
     */
    avanzarPaso() {
      if (typeof instancia.avanzarPaso === 'function') return !!instancia.avanzarPaso();
      return false;
    },
    /**
     * Teclas propias del sketch. Un sketch interactivo puede definir
     * p.manejarTecla(code) y devolver true si la consume; el player entonces no
     * hace nada con ella. Sirve para escenas que son un simulador manejable y
     * no una secuencia de pasos.
     *
     * El player se reserva sus teclas de navegación, así que un sketch no puede
     * secuestrar la salida del checkpoint.
     */
    tecla(code) {
      if (typeof instancia.manejarTecla === 'function') return !!instancia.manejarTecla(code);
      return false;
    },
    /**
     * Estado que el sketch quiere pasarle al siguiente checkpoint, con forma de
     * `config`. Sirve para que la escena que entra arranque como dejaste la
     * anterior en vez de volver a sus valores por defecto.
     */
    estado() {
      if (typeof instancia.estado === 'function') return instancia.estado() || {};
      return {};
    },
    pausar() { instancia.noLoop(); },
    reanudar() { instancia.loop(); },
  };
}

/**
 * Escala `caja` para que quepa en `stage` conservando proporción.
 *
 * El centrado lo hace el flex de #stage sobre la caja SIN escalar; aquí solo
 * se aplica el zoom respecto al centro. No se calculan left/top a mano:
 * mezclar posicionamiento absoluto con transform daba un encuadre corrido.
 */
function ajustarEscala(caja, stage, meta, instancia) {
  const k = Math.min(stage.clientWidth / meta.ancho, stage.clientHeight / meta.alto);
  caja.style.transformOrigin = 'center center';
  caja.style.transform = `scale(${k})`;
  if (instancia) afinarResolucion(instancia, k);
}

/**
 * Ajusta la resolución interna del lienzo al zoom con que se muestra.
 *
 * El zoom lo hace CSS sobre un mapa de píxeles YA dibujado: sin esto el sketch
 * se rasteriza a 900 px de ancho y luego se estira. En pantalla completa eso es
 * más del doble de aumento, y se ve borroso justo cuando más se mira.
 * Subiendo la densidad, p5 dibuja directamente con los píxeles que la pantalla
 * va a usar.
 *
 * densidad = zoom × densidad del display. El tope evita reservar lienzos
 * enormes en pantallas 4K sin ganancia visible.
 */
function afinarResolucion(instancia, k) {
  const objetivo = Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * k));

  // p5 crea el lienzo dentro de setup(), que puede no haber corrido todavía;
  // cambiar la densidad antes redimensionaría un lienzo de ancho 0.
  const aplicar = () => {
    if (!instancia.width) { setTimeout(aplicar, 30); return; }
    if (Math.abs(instancia.pixelDensity() - objetivo) > 0.01) {
      instancia.pixelDensity(objetivo);
      // pixelDensity() redimensiona el lienzo, y redimensionar lo BORRA. Si el
      // bucle de dibujo no vuelve a correr enseguida —pestaña en segundo plano,
      // navegador headless— la escena se queda en blanco. Un repintado explícito
      // lo evita.
      if (typeof instancia.redraw === 'function') instancia.redraw();
    }
  };
  aplicar();
}

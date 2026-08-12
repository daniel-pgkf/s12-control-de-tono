// Escena: el voltaje es una propiedad del ESPACIO.
//
// Dos nodos (alimentación y tierra) con una resistencia en medio, una batería,
// y un tubo a la entrada y otro a la salida por donde pasan las pelotas.
//
// La escena avanza en 3 sub-pasos con ESPACIO:
//   0. Todo apagado, batería sin conectar → ninguna zona tiene voltaje fijo.
//   1. Se conecta la fuente: el nodo de alimentación se enciende con un aura
//      amarilla y el de tierra queda en cero.
//   2. Salen las pelotas: cruzan la resistencia perdiendo el aura por el camino.
//
// Por qué el aura de la pelota se apaga DENTRO de la resistencia y no antes ni
// después: los nodos son equipotenciales (una zona, un voltaje), así que el
// aura no cambia mientras la pelota está en uno. La caída ocurre a lo largo del
// elemento que hay entre los dos, que es exactamente lo que dice el modelo.
//
// Marco conceptual (idéntico en las escenas del bloque):
//   pelota = portador de carga · el aura = el voltaje del sitio donde está
//
// Colores de paleta.json: energia #ff5528, aceite_vivo #ffdc50, nodo #78c8ff.

registrarSketch('zonas_voltaje', {
  ancho: 900,
  alto: 540,
  pista: 'ESPACIO interruptor · P cargas · C resistencia · E esquemático · R reinicia',
}, function (p, opciones) {

  const CONFIG_BASE = {
    V_FUENTE: 9,          // 9 V: la pila de un pedal de guitarra
    VELOCIDAD: 3.4,
    INTERVALO: 40,        // frames entre pelota y pelota
    FRAMES_CARGA: 70,     // duración del encendido y del barrido de color
    FRAMES_INTERRUPTOR: 10,  // lo que tarda la palanca en abrir o cerrar

    // 'zonas'   → tres bloques contiguos; los nodos son zonas del espacio
    // 'canones'  → sin bloques de nodo: los cañones SON los nodos y la carga
    //              entra directamente en la resistencia al salir del tubo
    ESTILO: 'zonas',

    // Resistencias por las que rota la tecla C, en orden.
    // 'leve' existe en la biblioteca pero está fuera de las diapositivas:
    // no aparece en el guion ni la alcanza la tecla C.
    TIPOS: ['media', 'fuerte'],
    TIPO_INICIAL: 'media',

    // Cuánto del degradado de voltaje tiñe las pepitas del medio (0..1).
    // Con 0 conservan solo su color de material; con 1 son puro voltaje y se
    // pierde la señal de color que distingue una resistencia de otra —quedan
    // la densidad y la elasticidad, pero el color es la más inmediata.
    MEZCLA_GRADIENTE: 0.7,

    FRAMES_MORPH: 70,     // transformación al esquemático
    FRAMES_CAMBIO: 34,    // relevo de una resistencia a otra
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 900, H = 540;

  const CANONES = CONFIG.ESTILO === 'canones';

  const ZY = 140, ZH = 180;
  const TUBO_W = 62;
  const BALL_R = 9;

  const AMARILLO = [255, 214, 70];
  const AZUL = [120, 200, 255];

  // En 'canones' la resistencia es más ancha porque ocupa todo el centro: sin
  // bloques de nodo a los lados, el recorrido de la carga es cañón → R → cañón.
  const Z_RES = CANONES
    ? { x: 300, w: 300, nombre: 'resistencia' }
    : { x: 340, w: 220, nombre: 'resistencia' };
  const Z_ALIM = { x: 120, w: 220, nombre: 'alimentación' };
  const Z_TIERRA = { x: 560, w: 220, nombre: 'tierra' };

  // Base de cada cañón. En 'canones' sus bocas tocan el borde de la R.
  const HUECO = CANONES ? 34 : 0;
  const CANON_IZQ = CANONES ? Z_RES.x - TUBO_W - HUECO : Z_ALIM.x - TUBO_W;
  const CANON_DER = CANONES ? Z_RES.x + Z_RES.w + TUBO_W + HUECO
                            : Z_TIERRA.x + Z_TIERRA.w + TUBO_W;

  const Y_CARRIL = CANONES ? ZY + ZH / 2 : ZY + ZH * 0.66;
  const Y_VOLTAJE = ZY + ZH * 0.34;

  // Rectángulo del que parte cada nodo al desplegarse en riel. En 'zonas' es el
  // bloque entero; en 'canones', la caja del propio cañón. El resto del morph
  // es idéntico, así que ambos estilos comparten toda la transformación.
  const NODO_ALIM = CANONES
    ? { x: CANON_IZQ, y: Y_CARRIL - 26, w: TUBO_W, h: 52, nombre: 'alimentación' }
    : { x: Z_ALIM.x, y: ZY, w: Z_ALIM.w, h: ZH, nombre: 'alimentación' };
  const NODO_TIERRA = CANONES
    ? { x: CANON_DER - TUBO_W, y: Y_CARRIL - 26, w: TUBO_W, h: 52, nombre: 'tierra' }
    : { x: Z_TIERRA.x, y: ZY, w: Z_TIERRA.w, h: ZH, nombre: 'tierra' };

  const BAT_X = 450, BAT_Y = 428, BAT_W = 108, BAT_H = 46;
  const SW_W = 96, SW_H = 46;   // interruptor: componente, no dos puntitos

  // ── Esquemático destino ──────────────────────────────────────
  // Lazo simple: riel superior (nodo de alimentación), resistencia vertical a
  // la derecha, riel inferior (nodo de tierra) y batería cerrando por la
  // izquierda. Los rieles SON los nodos: conservan color y voltaje.
  const RIEL_X = 285, RIEL_W = 330;
  const RIEL_SUP = 175, RIEL_INF = 400;
  const X_RES_ESQ = RIEL_X + RIEL_W;
  const Y_BAT_ESQ = (RIEL_SUP + RIEL_INF) / 2;

  // Esta escena no es una secuencia de pasos: es un simulador. Cada tecla
  // enciende o apaga una cosa, y se pueden combinar en cualquier orden.
  let fuente = false;        // ESPACIO — la batería conectada
  let flujo = false;         // P       — se sueltan cargas
  let iTipo = 0;             // C       — cuál de CONFIG.TIPOS está puesta
  let hacia = 0;             // E       — 0 modelo · 1 esquemático

  let interruptor = 0;       // 0 abierto · 1 cerrado (se mueve rápido)
  let carga = 0;             // 0→1, encendido del aura de los nodos
  let morphT = 0;            // 0→1, avance de la transformación
  let cambioT = 1;           // 0→1, relevo entre dos resistencias
  let pelotas = [];
  let contador = 0;
  let resistencia = null;
  let saliente = null;       // la resistencia que se va, mientras dura el relevo
  let drenando = false;      // dejó de generar; espera a que salgan las que hay
  let camino = null;         // polilínea del zigzag destino
  let morphPuntos = [];      // partícula → destino en el zigzag

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () { reset(); };

  function reset() {
    fuente = false;
    flujo = false;
    hacia = 0;
    interruptor = 0;
    carga = 0;
    morphT = 0;
    cambioT = 1;
    pelotas = [];
    contador = 0;
    drenando = false;
    morphPuntos = [];
    saliente = null;
    iTipo = Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.TIPO_INICIAL));
    resistencia = nuevaResistencia();
  }

  function nuevaResistencia() {
    return crearResistencia(p, CONFIG.TIPOS[iTipo], Z_RES.x, ZY, Z_RES.w, ZH);
  }

  // ── Teclas ───────────────────────────────────────────────────
  //
  // Una tecla por acción, todas conmutables y combinables. Al ser ESPACIO una
  // acción de la escena y no un avance, para salir del checkpoint se usa la
  // flecha derecha, que el player nunca cede.

  // Lo que esta escena le pasa a la siguiente: la resistencia que dejaste
  // puesta. Se manda con los dos nombres porque el divisor la llama R1_INICIAL
  // y las escenas de una sola resistencia, TIPO_INICIAL.
  p.estado = function () {
    const tipo = CONFIG.TIPOS[iTipo];
    return { TIPO_INICIAL: tipo, R1_INICIAL: tipo };
  };

  p.manejarTecla = function (code) {
    switch (code) {
      case 'Space':
        fuente = !fuente;
        // Sin voltaje no hay corriente: apagar la fuente apaga el flujo.
        // Dejar cargas circulando sin fuente enseñaría justo lo contrario.
        if (!fuente) flujo = false;
        return true;

      case 'KeyP':
        if (fuente && morphT === 0) flujo = !flujo;
        return true;

      case 'KeyC':
        // Solo en la vista de modelo: en el esquemático las pepitas ya son el
        // trazo de la R y cambiarlas a media transformación las descoloca.
        if (morphT === 0 && cambioT >= 1) cambiarResistencia();
        return true;

      case 'KeyE':
        alternarEsquematico();
        return true;

      default:
        return false;
    }
  };

  // El medio nuevo entra desordenado y los resortes lo acomodan a la vista:
  // se lee como una reorganización, no como un cambio de imagen.
  function cambiarResistencia() {
    saliente = resistencia;
    iTipo = (iTipo + 1) % CONFIG.TIPOS.length;
    resistencia = nuevaResistencia();
    for (const pt of resistencia.particulas) {
      pt.x = pt.rx + p.random(-15, 15);
      pt.y = pt.ry + p.random(-15, 15);
    }
    cambioT = 0;
  }

  // Ida y vuelta. Antes de transformar hay que vaciar la escena de cargas:
  // transformar con cargas circulando mezcla dos movimientos que compiten.
  function alternarEsquematico() {
    if (hacia === 1) { hacia = 0; return; }
    if (pelotas.length > 0) { drenando = true; return; }
    prepararMorph();
    hacia = 1;
  }

  // Zigzag vertical de la resistencia en el esquemático. Misma construcción
  // que componentes.py en Manim: patilla, dientes, patilla.
  function caminoZigzag(x, y1, y2, dientes = 6, amplitud = 22) {
    const patilla = 45;
    const cuerpo = (y2 - y1) - patilla * 2;
    const paso_ = cuerpo / dientes;
    const pts = [{ x, y: y1 }, { x, y: y1 + patilla }];
    for (let i = 0; i < dientes; i++) {
      pts.push({
        x: x + (i % 2 === 0 ? amplitud : -amplitud),
        y: y1 + patilla + paso_ * (i + 0.5),
      });
    }
    pts.push({ x, y: y2 - patilla }, { x, y: y2 });

    // Longitudes acumuladas, para poder pedir "el punto al 37% del camino".
    const acum = [0];
    for (let i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { pts, acum, largo: acum[acum.length - 1] };
  }

  function puntoEnCamino(cam, s) {
    const d = Math.max(0, Math.min(1, s)) * cam.largo;
    let i = 1;
    while (i < cam.acum.length - 1 && cam.acum[i] < d) i++;
    const t = (d - cam.acum[i - 1]) / Math.max(1e-6, cam.acum[i] - cam.acum[i - 1]);
    return {
      x: p.lerp(cam.pts[i - 1].x, cam.pts[i].x, t),
      y: p.lerp(cam.pts[i - 1].y, cam.pts[i].y, t),
    };
  }

  function prepararMorph() {
    camino = caminoZigzag(X_RES_ESQ, RIEL_SUP, RIEL_INF);

    // Se ordenan por posición de reposo antes de repartirlas por el camino.
    // Asignando al azar, las trayectorias se cruzan y el movimiento se ve como
    // un revoltijo en vez de como un ordenarse.
    const orden = resistencia.particulas
      .map((pt) => pt)
      .sort((a, b) => (a.rx - b.rx) || (a.ry - b.ry));

    morphPuntos = orden.map((pt, i) => {
      const destino = puntoEnCamino(camino, i / Math.max(1, orden.length - 1));
      return { pt, ox: pt.x, oy: pt.y, dx: destino.x, dy: destino.y };
    });
  }

  // Suaviza el arranque y el frenado del movimiento.
  function suave(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function actualizarEstado() {
    // El interruptor se mueve rápido; el voltaje viene DESPUÉS de cerrarlo y se
    // va en cuanto se abre. Ese orden es el que hace que la escena tenga
    // sentido físico: la fuente no se enciende, el circuito se cierra.
    const di = 1 / CONFIG.FRAMES_INTERRUPTOR;
    if (fuente && interruptor < 1) interruptor = Math.min(1, interruptor + di);
    if (!fuente && interruptor > 0) interruptor = Math.max(0, interruptor - di);

    // Sin circuito cerrado no hay voltaje que repartir.
    const objetivo = fuente && interruptor >= 1 ? 1 : 0;
    const dc = 1 / CONFIG.FRAMES_CARGA;
    if (carga < objetivo) carga = Math.min(objetivo, carga + dc);
    if (carga > objetivo) carga = Math.max(objetivo, carga - dc);

    if (cambioT < 1) cambioT = Math.min(1, cambioT + 1 / CONFIG.FRAMES_CAMBIO);

    // La escena ya se vació: arranca la transformación que estaba esperando.
    if (drenando && pelotas.length === 0) {
      drenando = false;
      prepararMorph();
      hacia = 1;
    }

    const dm = 1 / CONFIG.FRAMES_MORPH;
    if (hacia === 1 && morphT < 1) morphT = Math.min(1, morphT + dm);
    if (hacia === 0 && morphT > 0) morphT = Math.max(0, morphT - dm);

    // Las pepitas viajan a su sitio en el zigzag — o vuelven de él.
    if (morphPuntos.length) {
      const m = suave(morphT);
      for (const q of morphPuntos) {
        q.pt.x = p.lerp(q.ox, q.dx, m);
        q.pt.y = p.lerp(q.oy, q.dy, m);
      }
    }
  }

  // Voltaje de cada nodo. Sin fuente no hay ninguno; el valor sigue a `carga`,
  // así que sube y baja con el encendido en vez de aparecer de golpe.
  // Con el interruptor abierto no circula corriente, así que no hay caída en la
  // resistencia y ambos nodos quedan al potencial de tierra: 0 V en los dos.
  // Un '?' sugería que el valor es desconocido, y no lo es.
  function voltajeNodo(cual) {
    return cual === 'alim' ? CONFIG.V_FUENTE * carga : 0;
  }

  p.draw = function () {
    p.background(13, 13, 26);

    actualizarEstado();
    actualizarPelotas();

    const m = suave(morphT);
    // Las pepitas se apagan en el último tramo, mientras aparece el trazo
    // limpio del zigzag: así el relevo entre nube de puntos y línea no se nota.
    const alfaPepitas = 1 - Math.max(0, (m - 0.7) / 0.3);

    dibujarNodo(NODO_ALIM, AMARILLO, voltajeNodo('alim'), RIEL_SUP, m);
    dibujarNodo(NODO_TIERRA, AZUL, voltajeNodo('tierra'), RIEL_INF, m);

    // El recuadro del aceite se desvanece en cuanto las pepitas se van: sin
    // partículas dentro, un marco vacío se lee como un hueco.
    if (m < 1) {
      hazDelNodo(NODO_ALIM, AMARILLO, true);
      hazDelNodo(NODO_TIERRA, AZUL, false);
      dibujarFondoResistencia(1 - m);
    }
    auraResistencia(m);

    // Mientras alguien mueve las partículas por fuera, los resortes se apagan.
    if (morphT === 0) resistencia.actualizar(pelotas);
    if (saliente && cambioT < 1) dibujarPepitasDe(saliente, (1 - cambioT) * alfaPepitas);
    dibujarPepitasDe(resistencia, cambioT * alfaPepitas);
    if (m > 0.7) dibujarZigzag((m - 0.7) / 0.3);

    if (m < 1) etiquetaResistencia(1 - m);
    dibujarPelotas();
    if (m < 1) dibujarCanones(1 - m);
    dibujarTierra(m);
    dibujarBateria(m, m);
    dibujarInterruptor(m);
    if (m < 1) dibujarTitulos(1 - m);
    dibujarLeyenda();
  };

  // ── Aura ─────────────────────────────────────────────────────
  //
  // El voltaje NO se pinta como relleno sólido: se insinúa como un halo en el
  // borde de la zona. Un relleno fuerte hace pensar que el voltaje es una
  // sustancia que llena el espacio; el aura deja ver que es un estado del sitio.

  function auraBorde(x, y, w, h, col, fuerza, radio = 8) {
    p.noFill();
    for (let i = 6; i >= 1; i--) {
      p.strokeWeight(i * 3.4);
      p.stroke(col[0], col[1], col[2], (fuerza * 30) / i);
      p.rect(x, y, w, h, radio);
    }
    p.strokeWeight(1.6);
    p.stroke(col[0], col[1], col[2], 60 + fuerza * 165);
    p.rect(x, y, w, h, radio);
    p.noStroke();
  }

  // El nodo se dibuja siempre igual; lo que cambia con `m` es su GEOMETRÍA:
  // el rectángulo se aplasta hasta quedar en un riel de altura cero. No se
  // sustituye una figura por otra — es la misma que se deforma, y por eso el
  // riel conserva el color y el voltaje del nodo del que salió.
  function dibujarNodo(nodo, col, voltaje, rielY, m) {
    const fuerza = carga;

    const x = p.lerp(nodo.x, RIEL_X, m);
    const y = p.lerp(nodo.y, rielY, m);
    const w = p.lerp(nodo.w, RIEL_W, m);
    const h = p.lerp(nodo.h, 0, m);
    const r = p.lerp(8, 0, m);

    p.noStroke();
    p.fill(col[0], col[1], col[2], (6 + fuerza * 12) * (1 - m));
    p.rect(x, y, w, h, r);

    auraBorde(x, y, w, h, col, fuerza, r);

    // El valor de voltaje viaja con el nodo y acaba junto al riel. En estilo
    // 'canones' el cañón es pequeño, así que la cifra va encima y más chica.
    const xTexto = p.lerp(nodo.x + nodo.w / 2, RIEL_X + RIEL_W / 2, m);
    const yTexto0 = CANONES ? nodo.y - 16 : Y_VOLTAJE;
    const yTexto = p.lerp(yTexto0, rielY + (rielY < 300 ? -18 : 30), m);
    p.textAlign(p.CENTER);
    p.textSize(p.lerp(CANONES ? 20 : 30, 17, m));
    if (voltaje === null) {
      p.fill(150, 150, 180, 120);
      p.text('?', xTexto, yTexto);
    } else {
      p.fill(col[0], col[1], col[2], 120 + fuerza * 135);
      p.text(`${voltaje.toFixed(1)} V`, xTexto, yTexto);
    }

    if (carga > 0.05 && m < 1 && !CANONES) {
      p.textSize(10);
      p.fill(col[0], col[1], col[2], 170 * (1 - m));
      p.text('fijado por la fuente', nodo.x + nodo.w / 2, nodo.y + nodo.h - 14);
    }
  }

  // ── Resistencia ──────────────────────────────────────────────
  // El mismo aceite de las otras escenas: no es un nodo, es lo que hay ENTRE
  // los dos nodos. Por eso no lleva un valor de voltaje propio.

  function dibujarFondoResistencia(alfa) {
    const [cr, cg, cb] = resistencia.def.color;
    p.noStroke();
    p.fill(cr, cg, cb, 16 * alfa);
    p.rect(Z_RES.x, ZY, Z_RES.w, ZH, 6);
    p.noFill();
    // El contorno propio del medio se atenúa cuando hay voltaje: encima va el
    // aura del degradado, y dos bordes compitiendo ensucian el borde.
    p.stroke(cr, cg, cb, 120 * alfa * (1 - carga * 0.6));
    p.strokeWeight(1.8);
    p.rect(Z_RES.x, ZY, Z_RES.w, ZH, 6);
    p.noStroke();
  }

  // Cuánto ha alcanzado a este punto del medio el frente de color que sale de
  // los nodos. `s` va de 0 (borde de alimentación) a 1 (borde de tierra).
  //
  // Cada frente avanza hasta el centro con un poco de sobrepaso, para que al
  // final los dos se solapen ahí y el medio quede teñido entero: sin ese margen
  // la franja central se quedaba a medio tono para siempre.
  function alcanzadoPor(s) {
    const borde = 0.12;
    const frente = carga * (0.5 + borde);
    const desdeIzq = (frente - s) / borde;
    const desdeDer = (s - (1 - frente)) / borde;
    return Math.max(0, Math.min(1, Math.max(desdeIzq, desdeDer)));
  }

  // Haz que une la boca de cada cañón con el medio. Es la pieza que dice de
  // DÓNDE viene el color: sin él, el degradado del bloque podría leerse como
  // una propiedad del propio material.
  function hazDelNodo(nodo, col, haciaDerecha) {
    if (!CANONES || carga <= 0.01) return;

    // Degradado RADIAL desde la BOCA, no una banda rectangular: con un
    // rectángulo el resplandor tenía bordes rectos arriba y abajo y se leía
    // como una placa pintada en vez de como luz saliendo del cañón.
    //
    // Centrado en la boca y no en el cuerpo del cañón: es por ahí por donde
    // el nodo toca el medio, y es lo que hay que señalar.
    const bocaX = haciaDerecha ? nodo.x + nodo.w : nodo.x;
    const radio = 95;
    const ctx = p.drawingContext;

    p.push();
    p.noStroke();
    const g = ctx.createRadialGradient(bocaX, Y_CARRIL, 0, bocaX, Y_CARRIL, radio);
    g.addColorStop(0, `rgba(${col.join(',')},${0.26 * carga})`);
    g.addColorStop(0.45, `rgba(${col.join(',')},${0.09 * carga})`);
    g.addColorStop(1, `rgba(${col.join(',')},0)`);
    ctx.fillStyle = g;
    // El rectángulo se hace más grande que el radio para que el degradado
    // llegue a cero por sí solo y no lo corte ningún borde.
    ctx.fillRect(bocaX - radio, Y_CARRIL - radio, radio * 2, radio * 2);
    p.pop();
  }

  // ── Interruptor ──────────────────────────────────────────────
  //
  // Va en la rama de alimentación y viaja con el morph, igual que el resto:
  // sobre el cable de la batería en la vista de modelo, sobre el riel superior
  // en el esquemático.
  //
  // Antes, apagar la fuente solo atenuaba el dibujo, y un esquemático completo
  // pero apagado no significa nada: un circuito cerrado con pila SIEMPRE tiene
  // voltaje. Con el interruptor abierto sí lo significa.
  // Aura de la resistencia: un halo en el borde que va del amarillo de la
  // alimentación al azul de tierra, de izquierda a derecha.
  //
  // Por qué importa: con el degradado SOLO en las cargas, el color parece una
  // propiedad de la pelota que se va apagando. Poniéndolo también en el espacio
  // que atraviesa, se ve que el color lo pone el SITIO y la carga simplemente
  // adopta el del punto donde está. Por eso usa la misma función `nivelEn`: a
  // cada altura, el borde tiene exactamente el color de la carga que pasa por
  // debajo.
  //
  // Se dibuja con un degradado del canvas y no por tramos de color: por tramos
  // se ven las costuras entre segmentos justo en el borde, que es lo que el ojo
  // sigue.
  function auraResistencia(m) {
    const fuerza = carga * (1 - m);
    if (fuerza <= 0.01) return;

    const ctx = p.drawingContext;
    const x0 = Z_RES.x, x1 = Z_RES.x + Z_RES.w;

    const trazar = (ancho, alfa) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(${AMARILLO.join(',')},${alfa})`);
      g.addColorStop(1, `rgba(${AZUL.join(',')},${alfa})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = ancho;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, ZY, Z_RES.w, ZH, 6);
      else ctx.rect(x0, ZY, Z_RES.w, ZH);
      ctx.stroke();
    };

    p.push();
    p.noFill();
    // Capas de fuera hacia dentro: anchas y tenues primero, luego el filo.
    for (let capa = 6; capa >= 1; capa--) {
      trazar(capa * 3.4, (fuerza * 30) / capa / 255);
    }
    trazar(1.8, (60 + fuerza * 165) / 255);
    p.pop();
  }

  // Las pepitas se dibujan aquí y no con resistencia.dibujarParticulas() para
  // poder desvanecerlas: al final del morph se apagan mientras aparece el
  // trazo limpio del zigzag, de modo que el relevo no se note.
  function dibujarPepitasDe(res, alfa) {
    if (alfa <= 0.01) return;
    const [cr, cg, cb] = res.def.color;
    const radio = Math.max(2.6, res.def.espaciado * 0.38);

    // El teñido no aparece de golpe ni por igual: AVANZA desde los dos nodos
    // hacia el centro, donde los frentes se encuentran. Así se ve que el color
    // lo están induciendo los cañones y no que el medio se ilumina solo.

    p.noStroke();
    for (const pt of res.particulas) {
      const disp = Math.hypot(pt.x - pt.rx, pt.y - pt.ry);
      const t2 = Math.min(disp / 14, 1);
      let rr = p.lerp(cr, 255, t2 * 0.75);
      let gg = p.lerp(cg, 220, t2 * 0.75);
      let bb = p.lerp(cb, 120, t2 * 0.75);

      const s = (pt.rx - Z_RES.x) / Z_RES.w;
      const cubierto = alcanzadoPor(s);
      const mezcla = CONFIG.MEZCLA_GRADIENTE * cubierto;

      if (mezcla > 0.01) {
        // Se usa la posición de REPOSO, no la actual: con la posición real el
        // tono parpadearía al vibrar la partícula, y durante la transformación
        // al esquemático se revolvería mientras viajan al zigzag.
        const n = nivelEn(pt.rx);
        rr = p.lerp(rr, p.lerp(AZUL[0], AMARILLO[0], n), mezcla);
        gg = p.lerp(gg, p.lerp(AZUL[1], AMARILLO[1], n), mezcla);
        bb = p.lerp(bb, p.lerp(AZUL[2], AMARILLO[2], n), mezcla);
      }

      // Frente de onda: las partículas que el color está alcanzando AHORA
      // brillan de más. Sin esto el barrido existe pero no se ve, porque el
      // amarillo que entra apenas contrasta con el ámbar del propio medio.
      const frente = cubierto * (1 - cubierto) * 4;
      if (frente > 0.01) {
        rr = p.lerp(rr, 255, frente * 0.8);
        gg = p.lerp(gg, 245, frente * 0.8);
        bb = p.lerp(bb, 200, frente * 0.8);
      }

      const aa = p.lerp(150, 250, t2) * alfa;
      const grosor = p.lerp(radio, radio * 1.45, t2) * (1 + frente * 0.5);
      if (t2 > 0.25 || frente > 0.2) {
        p.fill(rr, gg, bb, aa * 0.18 + frente * 40);
        p.circle(pt.x, pt.y, radio * 3);
      }
      p.fill(rr, gg, bb, aa);
      p.circle(pt.x, pt.y, grosor);
    }
  }

  // Trazo limpio del zigzag, ya en lenguaje de esquemático.
  // El zigzag lleva el MISMO degradado que el medio, pero en vertical: arriba
  // toca el riel de 9 V y abajo el de 0 V, así que el voltaje cae a lo largo
  // del componente igual que caía a lo largo del bloque. Sin esto, el
  // esquemático perdía la única idea que la escena viene defendiendo.
  function dibujarZigzag(alfa) {
    const [cr, cg, cb] = resistencia.def.color;
    const mezcla = CONFIG.MEZCLA_GRADIENTE * carga;
    const arriba = [p.lerp(cr, AMARILLO[0], mezcla), p.lerp(cg, AMARILLO[1], mezcla),
                    p.lerp(cb, AMARILLO[2], mezcla)];
    const abajo = [p.lerp(cr, AZUL[0], mezcla), p.lerp(cg, AZUL[1], mezcla),
                   p.lerp(cb, AZUL[2], mezcla)];

    const ctx = p.drawingContext;
    p.push();
    p.noFill();
    const g = ctx.createLinearGradient(0, RIEL_SUP, 0, RIEL_INF);
    g.addColorStop(0, `rgba(${arriba.map(Math.round).join(',')},${alfa})`);
    g.addColorStop(1, `rgba(${abajo.map(Math.round).join(',')},${alfa})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.4;
    ctx.globalAlpha = 0.34 + 0.66 * carga;   // apagada si el circuito está abierto
    ctx.beginPath();
    camino.pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.stroke();
    p.pop();
    p.noStroke();

    p.fill(cr, cg, cb, 220 * alfa);
    p.textAlign(p.LEFT);
    p.textSize(15);
    p.text('R', X_RES_ESQ + 34, (RIEL_SUP + RIEL_INF) / 2 + 5);
  }

  // Se dibuja después del fluido: encima de las partículas el texto sin
  // respaldo no se lee.
  function etiquetaResistencia(alfa) {
    if (carga <= 0.05) return;
    const txt = 'aquí cae el voltaje';
    const x = Z_RES.x + Z_RES.w / 2, y = ZY + ZH - 14;
    p.textAlign(p.CENTER);
    p.textSize(10);
    const w = p.textWidth(txt) + 12;
    p.noStroke();
    p.fill(13, 13, 26, 225 * alfa);
    p.rect(x - w / 2, y - 10, w, 15, 3);
    p.fill(200, 160, 50, 200 * alfa);
    p.text(txt, x, y);
  }

  // ── Tubos ────────────────────────────────────────────────────

  // Mismos cañones que en la escena del tiro parabólico: el modelo circuital y
  // el mecánico deben verse como el mismo mundo, si no parecen dos temas.
  //
  // `sentido` +1 apunta a la derecha, −1 a la izquierda. Los dos abren hacia
  // las zonas: del izquierdo salen las cargas, en el derecho entran.
  function dibujarCanon(xBase, sentido, alfa) {
    p.push();
    p.translate(xBase, Y_CARRIL);
    p.scale(sentido, 1);

    // El tubo debe ser más grueso que el AURA, no solo que la bola: el anillo
    // llega a unos 34 px de diámetro y con un tubo estrecho asomaba por arriba
    // y por abajo mientras la carga aún estaba dentro.
    p.noStroke();
    p.fill(70, 70, 95, 255 * alfa);
    p.circle(0, 0, 50);
    p.fill(50, 50, 72, 255 * alfa);
    p.circle(0, 0, 28);

    p.fill(95, 95, 125, 255 * alfa);
    p.rect(0, -19, TUBO_W - 6, 38, 5);
    p.fill(120, 120, 150, 255 * alfa);
    p.rect(TUBO_W - 12, -21, 10, 42, 3);

    p.pop();
  }

  // Se dibujan DESPUÉS de las cargas: así el tubo tapa el instante en que una
  // carga aparece y da la sensación de que sale disparada del cañón, en vez de
  // materializarse de la nada en mitad del aire.
  function dibujarCanones(alfa) {
    dibujarCanon(CANON_IZQ, 1, alfa);
    dibujarCanon(CANON_DER, -1, alfa);
  }

  // ── Pelotas ──────────────────────────────────────────────────
  //
  // El aura de cada pelota es el voltaje del sitio donde está: llena mientras
  // va por el nodo de alimentación, se apaga a lo largo de la resistencia, y
  // ya no existe en tierra.

  // Nivel de voltaje del sitio donde está la carga: 1 en alimentación, 0 en
  // tierra, cayendo linealmente a lo largo de la resistencia.
  function nivelEn(x) {
    const t = (x - Z_RES.x) / Z_RES.w;
    return 1 - Math.min(1, Math.max(0, t));
  }

  function actualizarPelotas() {
    // Nacen cargas solo con fuente encendida, flujo activado, sin drenar y en
    // la vista de modelo. Cualquiera de esas condiciones que falle detiene la
    // generación, pero las que ya están en camino terminan su recorrido.
    const generando = fuente && flujo && !drenando && morphT === 0 && hacia === 0;
    if (generando && contador++ % CONFIG.INTERVALO === 0) {
      pelotas.push({ x: CANON_IZQ + TUBO_W / 2, y: Y_CARRIL, nivel: 1 });
    }
    for (const b of pelotas) {
      // La carga solo va lenta MIENTRAS está dentro de la resistencia. Al
      // salir recupera su velocidad: la resistencia estorba donde está, no
      // deja a la carga tocada para siempre.
      const dentro = resistencia.contiene(b.x, b.y);
      b.x += CONFIG.VELOCIDAD * (dentro ? resistencia.retencion : 1);
      b.nivel = nivelEn(b.x);
    }
    pelotas = pelotas.filter((b) => b.x < CANON_DER);
  }

  // La esfera ENTERA lleva el color del voltaje del sitio: amarilla en
  // alimentación, azul en tierra, y todo el degradado por medio. Antes el
  // voltaje era un anillo alrededor de una bola naranja, lo que sugería que
  // la carga tiene un color propio y el voltaje es algo que se le añade.
  // Siendo la esfera su propio voltaje, se lee que es un estado, no un adorno.
  function dibujarPelotas() {
    p.noStroke();
    for (const b of pelotas) {
      const cr = p.lerp(AZUL[0], AMARILLO[0], b.nivel);
      const cg = p.lerp(AZUL[1], AMARILLO[1], b.nivel);
      const cb = p.lerp(AZUL[2], AMARILLO[2], b.nivel);

      p.fill(cr, cg, cb, 34);
      p.circle(b.x, b.y, BALL_R * 3.4);
      p.fill(cr, cg, cb, 70);
      p.circle(b.x, b.y, BALL_R * 2.5);
      p.fill(cr, cg, cb);
      p.circle(b.x, b.y, BALL_R * 2);
      // Brillo: el mismo color aclarado, para que no parezca otro material.
      p.fill(p.lerp(cr, 255, 0.55), p.lerp(cg, 255, 0.55), p.lerp(cb, 255, 0.55), 210);
      p.circle(b.x - BALL_R * 0.3, b.y - BALL_R * 0.3, BALL_R * 0.55);
    }
  }

  // ── Batería ──────────────────────────────────────────────────

  // La batería viaja y gira hasta cerrar el lazo por la izquierda. Los cables
  // viejos (que iban a los bloques) se desvanecen a la vez: en el esquemático
  // los rieles YA son el cable, y dejarlos dibujaría el camino dos veces.
  function cableAlNodo(nodo, xSalida, col, alfa) {
    const x = nodo.x + nodo.w / 2;
    p.stroke(col[0], col[1], col[2], alfa);
    p.beginShape();
    p.vertex(xSalida, BAT_Y);
    p.vertex(x, BAT_Y);
    p.vertex(x, nodo.y + nodo.h);
    p.endShape();
  }

  // `m` es el avance de la batería; `mNodos` el de los rieles. Los cables
  // viejos se apagan con los NODOS, no con la batería: en cuanto los bloques
  // dejan de existir, esos cables apuntan a la nada y se quedan colgando.
  function dibujarBateria(m, mNodos) {
    const viva = carga > 0.05;
    const alfa = viva ? 255 : 110;

    if (mNodos < 1) {
      const a = (1 - mNodos);
      p.noFill();
      p.strokeWeight(2.5);
      // Cada cable sube hasta el nodo que exista en este estilo: el bloque en
      // 'zonas', el propio cañón en 'canones'.
      cableAlNodo(NODO_ALIM, BAT_X - BAT_W / 2, AMARILLO, (viva ? 190 : 55) * a);
      cableAlNodo(NODO_TIERRA, BAT_X + BAT_W / 2, AZUL, (viva ? 190 : 55) * a);
      p.noStroke();
    }

    const cx = p.lerp(BAT_X, RIEL_X, m);
    const cy = p.lerp(BAT_Y, Y_BAT_ESQ, m);

    if (m > 0) {
      // Se corta en los bornes en vez de atravesar la pila: un cable pasando
      // por debajo del símbolo no es como se dibuja un esquemático.
      // Y se atenúa con el circuito abierto, igual que los rieles: antes
      // quedaba a pleno brillo mientras todo lo demás estaba apagado.
      const vivo = 0.32 + 0.68 * carga;
      const borne = BAT_W / 2;
      p.strokeWeight(2.6);
      p.noFill();
      p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 230 * m * vivo);
      p.line(RIEL_X, RIEL_SUP, RIEL_X, Y_BAT_ESQ - borne);
      p.stroke(AZUL[0], AZUL[1], AZUL[2], 230 * m * vivo);
      p.line(RIEL_X, Y_BAT_ESQ + borne, RIEL_X, RIEL_INF);
      p.noStroke();
    }

    p.push();
    p.translate(cx, cy);
    // Gira un cuarto de vuelta en el sentido que deja la placa larga (+)
    // mirando al riel de arriba: (-16,0) → (0,-16). Con el giro contrario la
    // pila queda con la polaridad invertida respecto a sus propios rótulos.
    p.rotate(p.HALF_PI * m);

    p.noStroke();
    p.fill(46, 46, 68, alfa);
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.stroke(120, 200, 255, viva ? 120 : 60);
    p.strokeWeight(1.4);
    p.noFill();
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.noStroke();

    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], alfa);
    p.rect(-16, -15, 3, 30);
    p.fill(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.rect(13, -8, 3, 16);
    p.pop();

    // Los signos no giran: un "+" de lado no se lee. Y acaban a un LADO del
    // cable, no encima: en amarillo sobre cable amarillo desaparecían.
    p.textAlign(p.CENTER);
    p.textSize(13);
    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], alfa);
    p.text('+', p.lerp(BAT_X - 30, RIEL_X + 26, m), p.lerp(BAT_Y + 5, Y_BAT_ESQ - 34, m));
    p.fill(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.text('−', p.lerp(BAT_X + 30, RIEL_X + 26, m), p.lerp(BAT_Y + 5, Y_BAT_ESQ + 42, m));

    p.textSize(11);
    p.fill(170, 170, 195, alfa);
    p.text(`${CONFIG.V_FUENTE} V`,
           p.lerp(BAT_X, RIEL_X - 42, m), p.lerp(BAT_Y + BAT_H / 2 + 16, Y_BAT_ESQ + 5, m));

    if (m < 1) {
      p.textSize(10);
      p.fill(130, 130, 158, alfa * (1 - m));
      p.text(!fuente ? 'circuito abierto' : 'la fuente fija las dos zonas',
             BAT_X, BAT_Y + BAT_H / 2 + 31);
    }
  }

  function dibujarInterruptor(m) {
    const xModelo = (BAT_X - BAT_W / 2 + NODO_ALIM.x + NODO_ALIM.w / 2) / 2;
    // Pegado a la pila, no a media distancia: al agrandar la placa se comía
    // la cifra del nodo, que va centrada sobre el riel.
    const x = p.lerp(xModelo, RIEL_X + RIEL_W * 0.21, m);
    const y = p.lerp(BAT_Y, RIEL_SUP, m);
    const medio = SW_W / 2;

    // Tapa el cable por debajo: sin este corte la palanca se levanta pero el
    // conductor sigue dibujado entero y el circuito parece cerrado igual.
    p.noStroke();
    p.fill(13, 13, 26);
    p.rect(x - medio - 2, y - SW_H / 2 - 2, SW_W + 4, SW_H + 4);

    // Placa: el interruptor es una de las cosas que el instructor señala, así
    // que ocupa sitio en vez de ser dos puntitos sobre el cable.
    p.fill(40, 40, 60, 230);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);
    p.noFill();
    p.stroke(110, 110, 140, 150);
    p.strokeWeight(1.4);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);

    // Palanca: pivota sobre el borne izquierdo.
    const bx = x - medio + 14, dx = SW_W - 28;
    const ang = p.lerp(-Math.PI / 3.4, 0, interruptor);
    p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 90 + interruptor * 165);
    p.strokeWeight(4);
    p.line(bx, y, bx + Math.cos(ang) * dx, y + Math.sin(ang) * dx);
    p.noStroke();

    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], 110 + interruptor * 145);
    p.circle(bx, y, 9);
    p.circle(bx + dx, y, 9);

    p.textAlign(p.CENTER);
    p.textSize(10);
    p.fill(150, 150, 178, 200);
    p.text(interruptor > 0.5 ? 'cerrado' : 'abierto', x, y + SW_H / 2 + 16);
  }

  // Símbolo de tierra. Viaja con el nodo: cuelga bajo el cañón (o bajo el
  // bloque) en la vista de modelo y acaba sobre el riel inferior en el
  // esquemático, que es el mismo nodo dibujado de otra forma.
  //
  // En el esquemático va descentrado a propósito: en el centro chocaba con la
  // cifra de 0.0 V que rotula ese mismo riel.
  function dibujarTierra(m) {
    // Desplazado del centro del nodo: justo debajo se cruzaba con el cable
    // que baja a la batería y las dos cosas se leían como una sola.
    const x = p.lerp(NODO_TIERRA.x + NODO_TIERRA.w / 2 + 28, RIEL_X + RIEL_W * 0.30, m);
    const y = p.lerp(NODO_TIERRA.y + NODO_TIERRA.h + 8, RIEL_INF, m);
    const alfa = 90 + carga * 150;

    p.stroke(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.strokeWeight(2.2);
    p.line(x, y, x, y + 9);
    const anchos = [26, 16, 8];
    for (let i = 0; i < anchos.length; i++) {
      const w = anchos[i] / 2;
      p.line(x - w, y + 9 + i * 6, x + w, y + 9 + i * 6);
    }
    p.noStroke();
  }

  function dibujarTitulos(alfa) {
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textSize(12);

    const [cr, cg, cb] = resistencia.def.color;
    p.fill(cr, cg, cb, 255 * alfa);
    p.text(Z_RES.nombre, Z_RES.x + Z_RES.w / 2, ZY - 14);

    // En 'canones' el rótulo va ENCIMA del cañón, apilado sobre el voltaje:
    // debajo lo cruzaba el cable que sube de la batería.
    for (const n of [NODO_ALIM, NODO_TIERRA]) {
      p.fill(170, 170, 195, 255 * alfa);
      p.text(n.nombre, n.x + n.w / 2, CANONES ? n.y - 38 : ZY - 14);
    }
  }

  // Panel de mando: qué tecla hace qué y en qué estado está cada cosa. Al ser
  // un simulador y no una secuencia, sin esto no hay forma de saber qué se
  // puede tocar ni qué está encendido.
  function dibujarLeyenda() {
    const items = [
      // "circuito abierto/cerrado" y no "voltaje ON/OFF": lo que la tecla
      // mueve es el interruptor, y el voltaje es la consecuencia.
      { tecla: 'ESPACIO', etiqueta: 'circuito', on: fuente,
        valor: fuente ? 'cerrado' : 'abierto', col: AMARILLO },
      { tecla: 'P', etiqueta: 'cargas', on: flujo,
        valor: flujo ? 'ON' : 'OFF', col: [255, 120, 60] },
      { tecla: 'C', etiqueta: 'resistencia', on: true,
        valor: CONFIG.TIPOS[iTipo], col: resistencia.def.color },
      { tecla: 'E', etiqueta: 'esquemático', on: hacia === 1,
        valor: hacia === 1 ? 'ON' : 'OFF', col: AZUL },
    ];

    p.textSize(11);
    const anchos = items.map((it) =>
      p.textWidth(`${it.tecla} ${it.etiqueta}: ${it.valor}`));
    const sep = 26;
    let x = W / 2 - (anchos.reduce((a, b) => a + b, 0) + sep * (items.length - 1)) / 2;

    p.noStroke();
    p.textAlign(p.LEFT);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const [cr, cg, cb] = it.col;
      // La tecla siempre legible; el valor se enciende solo si está activo.
      p.fill(150, 150, 178);
      const tw = p.textWidth(it.tecla + ' ');
      p.text(it.tecla, x, H - 20);
      p.fill(120, 120, 145);
      const ew = p.textWidth(it.etiqueta + ': ');
      p.text(it.etiqueta + ':', x + tw, H - 20);
      if (it.on) p.fill(cr, cg, cb, 235); else p.fill(95, 95, 118);
      p.text(it.valor, x + tw + ew, H - 20);
      x += anchos[i] + sep;
    }

    if (drenando) {
      p.textAlign(p.CENTER);
      p.fill(150, 150, 178);
      p.text('esperando a que salgan las cargas en camino...', W / 2, H - 38);
    }
  }
});

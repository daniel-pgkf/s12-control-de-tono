// Divisor de voltaje: dos resistencias, tres nodos.
//
// Mismo lenguaje que el modelo circuital de una resistencia —cañones-nodo y
// aceite— pero ahora con R1 en SERIE y R2 en SHUNT, que es la topología que da
// el divisor. Entre las dos hay un nodo intermedio hecho con la misma tubería
// de los cañones: recibe las cargas por la izquierda, las oculta y las manda
// hacia abajo, hacia la resistencia vertical.
//
//   ESPACIO  abre/cierra el circuito      P  soltar cargas
//   1 / 2    elegir qué resistencia       C  cambiarla
//   E        transformar a esquemático (ida y vuelta)
//
// El nodo intermedio es lo que hay que mirar: su voltaje NO lo fija la fuente,
// lo deciden las dos resistencias entre sí. Cambiar cualquiera de las dos lo
// mueve, y ese es el divisor.

registrarSketch('divisor_voltaje', {
  ancho: 1120,
  alto: 620,
  pista: 'ESPACIO interruptor · P cargas · 1/2 elegir R · C cambiarla · E esquemático',
}, function (p, opciones) {

  const CONFIG_BASE = {
    V_FUENTE: 9,
    VELOCIDAD: 3.2,
    INTERVALO: 42,
    FRAMES_CARGA: 70,
    FRAMES_INTERRUPTOR: 10,
    FRAMES_MORPH: 70,
    FRAMES_CAMBIO: 34,

    TIPOS: ['media', 'fuerte'],
    R1_INICIAL: 'media',
    R2_INICIAL: 'media',

    MEZCLA_GRADIENTE: 0.7,
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 1120, H = 620;
  const AMARILLO = [255, 214, 70];
  const AZUL = [120, 200, 255];

  // ── Geometría del modelo ─────────────────────────────────────
  // Las resistencias son más delgadas que en la escena de una sola: con dos en
  // pantalla, los bloques gruesos dominaban y el recorrido se perdía.
  // El modelo se organiza como un LAZO rectangular, igual que el circuito real:
  // pila a la izquierda, interruptor y R1 arriba, R2 bajando por la derecha y
  // el retorno de tierra abajo. Antes tenía forma de L y desaprovechaba el
  // ancho; así ocupa la pantalla apaisada sin alargar una resistencia más que
  // la otra —las dos miden lo mismo, que es lo que se quiere comparar.
  const TUBO_W = 62, HUECO = 34, GRUESO = 84, LARGO = 210;
  const Y_FILA = 132;
  const X_BAT = 190;
  const X_SW = 302, SW_W = 96, SW_H = 46;   // interruptor, ahora un componente
  const X_CAN_A = 415;

  const R1 = { x: X_CAN_A + TUBO_W + HUECO, y: Y_FILA - GRUESO / 2, w: LARGO, h: GRUESO };
  const X_M = R1.x + R1.w + HUECO + TUBO_W;
  const R2 = { x: X_M - GRUESO / 2, y: Y_FILA + TUBO_W + HUECO, w: GRUESO, h: LARGO };
  const Y_CAN_B = R2.y + R2.h + HUECO + TUBO_W;

  const BAT_X = X_BAT, BAT_Y = (Y_FILA + Y_CAN_B) / 2, BAT_W = 108, BAT_H = 46;
  const X_TIERRA = 520;                     // dónde cuelga el símbolo del cable

  // Cajas de nodo: de aquí parte cada nodo al desplegarse en riel.
  const NODO_A = { x: X_CAN_A - TUBO_W / 2, y: Y_FILA - 26, w: TUBO_W, h: 52 };
  const NODO_M = { x: X_M - TUBO_W / 2, y: Y_FILA - TUBO_W / 2, w: TUBO_W, h: TUBO_W };
  const NODO_B = { x: X_M - 26, y: Y_CAN_B - TUBO_W / 2, w: 52, h: TUBO_W };

  // ── Geometría del esquemático ────────────────────────────────
  //
  // Las MISMAS coordenadas que el modelo: cada pieza se transforma donde está.
  // Eso hace que la transformación deje de mover cosas de sitio y solo cambie
  // el vocabulario —tubo a nodo, aceite a zigzag—, que es lo que de verdad se
  // quiere enseñar: no es otro circuito, es el mismo dibujado de otra forma.
  const RIEL_X = X_BAT, RIEL_SUP = Y_FILA, RIEL_INF = Y_CAN_B;
  const XM_ESQ = X_M;
  const ZIG1 = { a: R1.x, b: R1.x + R1.w };
  const ZIG2 = { a: R2.y, b: R2.y + R2.h };
  const Y_BAT_ESQ = BAT_Y;

  // ── Estado ───────────────────────────────────────────────────
  let fuente = false;
  let flujo = false;
  let seleccion = 0;         // 0 → R1 · 1 → R2
  let hacia = 0;

  let interruptor = 0, carga = 0, morphT = 0;
  let cambioT = [1, 1];
  let res = [null, null];
  let saliente = [null, null];
  let iTipo = [0, 0];

  let cargas = [], contador = 0, drenando = false;
  let camino = [null, null];     // zigzags destino
  let morphPuntos = [[], []];

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () { reset(); };

  function reset() {
    fuente = false; flujo = false; hacia = 0; seleccion = 0;
    interruptor = 0; carga = 0; morphT = 0;
    cambioT = [1, 1];
    saliente = [null, null];
    cargas = []; contador = 0; drenando = false;
    morphPuntos = [[], []];
    iTipo = [
      Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.R1_INICIAL)),
      Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.R2_INICIAL)),
    ];
    res = [nuevaR(0), nuevaR(1)];
  }

  function nuevaR(i) {
    const caja = i === 0 ? R1 : R2;
    return crearResistencia(p, CONFIG.TIPOS[iTipo[i]], caja.x, caja.y, caja.w, caja.h);
  }

  const factor = (i) => RESISTENCIAS[CONFIG.TIPOS[iTipo[i]]].factor;

  // Voltaje del nodo intermedio, normalizado 0..1. ESTE es el divisor: no lo
  // fija la fuente, sale de la proporción entre las dos resistencias.
  const nivelMedio = () => factor(1) / (factor(0) + factor(1));

  // ── Teclas ───────────────────────────────────────────────────

  // Lega las dos resistencias. TIPO_INICIAL lleva la de serie, para que al
  // volver a una escena de una sola resistencia siga siendo la misma.
  p.estado = function () {
    return {
      TIPO_INICIAL: CONFIG.TIPOS[iTipo[0]],
      R1_INICIAL: CONFIG.TIPOS[iTipo[0]],
      R2_INICIAL: CONFIG.TIPOS[iTipo[1]],
    };
  };

  p.manejarTecla = function (code) {
    switch (code) {
      case 'Space':
        fuente = !fuente;
        if (!fuente) flujo = false;
        return true;
      case 'KeyP':
        if (fuente && morphT === 0) flujo = !flujo;
        return true;
      case 'Digit1': seleccion = 0; return true;
      case 'Digit2': seleccion = 1; return true;
      case 'KeyC':
        if (morphT === 0 && cambioT[seleccion] >= 1) cambiarR(seleccion);
        return true;
      case 'KeyE':
        alternarEsquematico();
        return true;
      default:
        return false;
    }
  };

  function cambiarR(i) {
    saliente[i] = res[i];
    iTipo[i] = (iTipo[i] + 1) % CONFIG.TIPOS.length;
    res[i] = nuevaR(i);
    for (const pt of res[i].particulas) {
      pt.x = pt.rx + p.random(-15, 15);
      pt.y = pt.ry + p.random(-15, 15);
    }
    cambioT[i] = 0;
  }

  function alternarEsquematico() {
    if (hacia === 1) { hacia = 0; return; }
    if (cargas.length > 0) { drenando = true; return; }
    prepararMorph();
    hacia = 1;
  }

  // ── Recorrido de las cargas ──────────────────────────────────
  // Polilínea con un codo en el nodo intermedio: entra por la izquierda, el
  // tubo la tapa, y sale hacia abajo. Seguir un camino en vez de mover x e y a
  // mano deja el codo bien resuelto sin casos especiales.
  const RUTA = [
    { x: X_CAN_A, y: Y_FILA },
    { x: X_M, y: Y_FILA },
    { x: X_M, y: Y_CAN_B },
  ];
  const LARGO_RUTA = RUTA.slice(1).reduce(
    (a, pt, i) => a + Math.hypot(pt.x - RUTA[i].x, pt.y - RUTA[i].y), 0);

  function puntoRuta(d) {
    let resto = Math.max(0, d);
    for (let i = 1; i < RUTA.length; i++) {
      const seg = Math.hypot(RUTA[i].x - RUTA[i - 1].x, RUTA[i].y - RUTA[i - 1].y);
      if (resto <= seg) {
        const t = resto / seg;
        return { x: p.lerp(RUTA[i - 1].x, RUTA[i].x, t),
                 y: p.lerp(RUTA[i - 1].y, RUTA[i].y, t) };
      }
      resto -= seg;
    }
    return RUTA[RUTA.length - 1];
  }

  // Nivel de voltaje del SITIO. Constante en cada nodo, cayendo dentro de cada
  // resistencia: eso es lo que hace que un nodo sea equipotencial.
  function nivelEn(x, y) {
    const nM = nivelMedio();
    if (x < R1.x) return 1;
    if (x <= R1.x + R1.w) return p.lerp(1, nM, (x - R1.x) / R1.w);
    if (y < R2.y) return nM;
    if (y <= R2.y + R2.h) return p.lerp(nM, 0, (y - R2.y) / R2.h);
    return 0;
  }

  function colorNivel(n) {
    return [p.lerp(AZUL[0], AMARILLO[0], n),
            p.lerp(AZUL[1], AMARILLO[1], n),
            p.lerp(AZUL[2], AMARILLO[2], n)];
  }

  // ── Estado por frame ─────────────────────────────────────────

  function actualizarEstado() {
    const di = 1 / CONFIG.FRAMES_INTERRUPTOR;
    if (fuente && interruptor < 1) interruptor = Math.min(1, interruptor + di);
    if (!fuente && interruptor > 0) interruptor = Math.max(0, interruptor - di);

    const objetivo = fuente && interruptor >= 1 ? 1 : 0;
    const dc = 1 / CONFIG.FRAMES_CARGA;
    if (carga < objetivo) carga = Math.min(objetivo, carga + dc);
    if (carga > objetivo) carga = Math.max(objetivo, carga - dc);

    for (let i = 0; i < 2; i++) {
      if (cambioT[i] < 1) cambioT[i] = Math.min(1, cambioT[i] + 1 / CONFIG.FRAMES_CAMBIO);
    }

    if (drenando && cargas.length === 0) {
      drenando = false; prepararMorph(); hacia = 1;
    }
    const dm = 1 / CONFIG.FRAMES_MORPH;
    if (hacia === 1 && morphT < 1) morphT = Math.min(1, morphT + dm);
    if (hacia === 0 && morphT > 0) morphT = Math.max(0, morphT - dm);

    const m = suave(morphT);
    for (let i = 0; i < 2; i++) {
      for (const q of morphPuntos[i]) {
        q.pt.x = p.lerp(q.ox, q.dx, m);
        q.pt.y = p.lerp(q.oy, q.dy, m);
      }
    }
  }

  function actualizarCargas() {
    const generando = fuente && flujo && !drenando && morphT === 0 && hacia === 0;
    if (generando && contador++ % CONFIG.INTERVALO === 0) cargas.push({ d: 0 });

    for (const c of cargas) {
      const pos = puntoRuta(c.d);
      let k = 1;
      if (res[0].contiene(pos.x, pos.y)) k = res[0].retencion;
      else if (res[1].contiene(pos.x, pos.y)) k = res[1].retencion;
      c.d += CONFIG.VELOCIDAD * k;
      c.x = pos.x; c.y = pos.y;
      c.nivel = nivelEn(pos.x, pos.y);
    }
    cargas = cargas.filter((c) => c.d < LARGO_RUTA);
  }

  function suave(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Frente de color que entra desde los nodos hacia el centro de cada bloque.
  function alcanzadoPor(s) {
    const borde = 0.12;
    const frente = carga * (0.5 + borde);
    return Math.max(0, Math.min(1,
      Math.max((frente - s) / borde, (s - (1 - frente)) / borde)));
  }

  // ── Transformación al esquemático ────────────────────────────

  function caminoZigzag(x1, y1, x2, y2, dientes = 6, amplitud = 20) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const px = -uy, py = ux;
    const patilla = 34;
    const cuerpo = len - patilla * 2;
    const paso = cuerpo / dientes;

    const pts = [{ x: x1, y: y1 },
                 { x: x1 + ux * patilla, y: y1 + uy * patilla }];
    for (let i = 0; i < dientes; i++) {
      const d = patilla + paso * (i + 0.5);
      const s = i % 2 === 0 ? amplitud : -amplitud;
      pts.push({ x: x1 + ux * d + px * s, y: y1 + uy * d + py * s });
    }
    pts.push({ x: x2 - ux * patilla, y: y2 - uy * patilla }, { x: x2, y: y2 });

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
    return { x: p.lerp(cam.pts[i - 1].x, cam.pts[i].x, t),
             y: p.lerp(cam.pts[i - 1].y, cam.pts[i].y, t) };
  }

  function prepararMorph() {
    camino[0] = caminoZigzag(ZIG1.a, RIEL_SUP, ZIG1.b, RIEL_SUP);
    camino[1] = caminoZigzag(XM_ESQ, ZIG2.a, XM_ESQ, ZIG2.b);

    for (let i = 0; i < 2; i++) {
      // Ordenadas por posición de reposo a lo largo del bloque: al azar las
      // trayectorias se cruzan y el viaje parece un revoltijo.
      const orden = res[i].particulas.slice().sort((a, b) =>
        i === 0 ? (a.rx - b.rx) || (a.ry - b.ry) : (a.ry - b.ry) || (a.rx - b.rx));
      morphPuntos[i] = orden.map((pt, k) => {
        const destino = puntoEnCamino(camino[i], k / Math.max(1, orden.length - 1));
        return { pt, ox: pt.x, oy: pt.y, dx: destino.x, dy: destino.y };
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────

  p.draw = function () {
    p.background(13, 13, 26);

    actualizarEstado();
    actualizarCargas();

    const m = suave(morphT);
    const alfaPepitas = 1 - Math.max(0, (m - 0.7) / 0.3);

    dibujarNodo(NODO_A, colorNivel(1), rielDe('A'), m, 1);
    dibujarNodo(NODO_M, colorNivel(nivelMedio()), rielDe('M'), m, nivelMedio());
    dibujarNodo(NODO_B, colorNivel(0), rielDe('B'), m, 0);

    for (let i = 0; i < 2; i++) {
      if (m < 1) {
        dibujarFondoR(i, 1 - m);
        auraR(i, m);
      }
      if (morphT === 0) res[i].actualizar(cargas);
      if (saliente[i] && cambioT[i] < 1) dibujarPepitas(i, saliente[i], (1 - cambioT[i]) * alfaPepitas);
      dibujarPepitas(i, res[i], cambioT[i] * alfaPepitas);
      if (m > 0.7) dibujarZigzag(i, (m - 0.7) / 0.3);
    }

    if (m > 0) conectoresEsq(m);
    dibujarCargas();
    if (m < 1) dibujarTubos(1 - m);
    dibujarBateria(m);
    dibujarTierra();
    dibujarInterruptor();
    dibujarEtiquetas(m);
    avisoCorriente();
    dibujarLeyenda();
  };

  // Tramos verticales que unen R2 con los dos rieles. El zigzag no llega hasta
  // ellos —tiene sus patillas más cortas que el hueco—, así que sin estos
  // cables el lazo queda abierto por la derecha y el circuito no cierra.
  //
  // Cada tramo lleva el color del nodo al que pertenece: arriba el del nodo
  // intermedio, abajo el de tierra. Es la misma regla que en el resto.
  function conectoresEsq(m) {
    const vivo = 0.32 + 0.68 * carga;
    const cM = colorNivel(nivelMedio());
    p.strokeWeight(2.6);
    p.noFill();
    p.stroke(cM[0], cM[1], cM[2], 230 * m * vivo);
    p.line(XM_ESQ, RIEL_SUP, XM_ESQ, ZIG2.a);
    p.stroke(AZUL[0], AZUL[1], AZUL[2], 230 * m * vivo);
    p.line(XM_ESQ, ZIG2.b, XM_ESQ, RIEL_INF);
    p.noStroke();
  }

  // Riel destino de cada nodo en el esquemático.
  function rielDe(cual) {
    // Empieza pasado el interruptor: el tramo anterior es de la pila.
    const desde = X_SW + SW_W / 2;
    if (cual === 'A') return { x: desde, y: RIEL_SUP, w: ZIG1.a - desde };
    if (cual === 'M') return { x: ZIG1.b, y: RIEL_SUP, w: XM_ESQ - ZIG1.b };
    return { x: RIEL_X, y: RIEL_INF, w: XM_ESQ - RIEL_X };
  }

  function dibujarNodo(nodo, col, riel, m, nivel) {
    const fuerza = carga * (0.25 + 0.75 * nivel) + 0.05;
    const x = p.lerp(nodo.x, riel.x, m);
    const y = p.lerp(nodo.y, riel.y, m);
    const w = p.lerp(nodo.w, riel.w, m);
    const h = p.lerp(nodo.h, 0, m);
    const r = p.lerp(8, 0, m);

    p.noStroke();
    p.fill(col[0], col[1], col[2], (6 + fuerza * 12) * (1 - m));
    p.rect(x, y, w, h, r);

    p.noFill();
    for (let capa = 6; capa >= 1; capa--) {
      p.strokeWeight(capa * 3.4);
      p.stroke(col[0], col[1], col[2], (fuerza * 30) / capa);
      p.rect(x, y, w, h, r);
    }
    p.strokeWeight(1.6);
    p.stroke(col[0], col[1], col[2], 60 + fuerza * 165);
    p.rect(x, y, w, h, r);
    p.noStroke();
  }

  function cajaDe(i) { return i === 0 ? R1 : R2; }

  function dibujarFondoR(i, alfa) {
    const caja = cajaDe(i);
    const [cr, cg, cb] = res[i].def.color;
    p.noStroke();
    p.fill(cr, cg, cb, 16 * alfa);
    p.rect(caja.x, caja.y, caja.w, caja.h, 6);
    p.noFill();
    p.stroke(cr, cg, cb, 120 * alfa * (1 - carga * 0.6));
    p.strokeWeight(1.8);
    p.rect(caja.x, caja.y, caja.w, caja.h, 6);
    p.noStroke();

    // Marca de selección: cuál cambia la tecla C.
    if (i === seleccion) {
      p.stroke(230, 230, 245, 150 * alfa);
      p.strokeWeight(1.4);
      p.noFill();
      p.rect(caja.x - 7, caja.y - 7, caja.w + 14, caja.h + 14, 9);
      p.noStroke();
    }
  }

  // Aura del bloque: degradado entre los voltajes de sus dos extremos.
  function auraR(i, m) {
    const fuerza = carga * (1 - m);
    if (fuerza <= 0.01) return;
    const caja = cajaDe(i);
    const horizontal = i === 0;
    const nA = horizontal ? 1 : nivelMedio();
    const nB = horizontal ? nivelMedio() : 0;
    const cA = colorNivel(nA).map(Math.round);
    const cB = colorNivel(nB).map(Math.round);

    const ctx = p.drawingContext;
    p.push();
    p.noFill();
    const trazar = (ancho, alfa) => {
      const g = horizontal
        ? ctx.createLinearGradient(caja.x, 0, caja.x + caja.w, 0)
        : ctx.createLinearGradient(0, caja.y, 0, caja.y + caja.h);
      g.addColorStop(0, `rgba(${cA.join(',')},${alfa})`);
      g.addColorStop(1, `rgba(${cB.join(',')},${alfa})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = ancho;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(caja.x, caja.y, caja.w, caja.h, 6);
      else ctx.rect(caja.x, caja.y, caja.w, caja.h);
      ctx.stroke();
    };
    for (let capa = 6; capa >= 1; capa--) trazar(capa * 3.2, (fuerza * 28) / capa / 255);
    trazar(1.8, (55 + fuerza * 170) / 255);
    p.pop();
  }

  function dibujarPepitas(i, r, alfa) {
    if (alfa <= 0.01) return;
    const caja = cajaDe(i);
    const [cr, cg, cb] = r.def.color;
    const radio = Math.max(2.6, r.def.espaciado * 0.38);
    p.noStroke();
    for (const pt of r.particulas) {
      const disp = Math.hypot(pt.x - pt.rx, pt.y - pt.ry);
      const t2 = Math.min(disp / 14, 1);
      let rr = p.lerp(cr, 255, t2 * 0.75);
      let gg = p.lerp(cg, 220, t2 * 0.75);
      let bb = p.lerp(cb, 120, t2 * 0.75);

      const s = i === 0 ? (pt.rx - caja.x) / caja.w : (pt.ry - caja.y) / caja.h;
      const cubierto = alcanzadoPor(s);
      const mezcla = CONFIG.MEZCLA_GRADIENTE * cubierto;
      if (mezcla > 0.01) {
        const c = colorNivel(nivelEn(pt.rx, pt.ry));
        rr = p.lerp(rr, c[0], mezcla);
        gg = p.lerp(gg, c[1], mezcla);
        bb = p.lerp(bb, c[2], mezcla);
      }
      const frente = cubierto * (1 - cubierto) * 4;
      if (frente > 0.01) {
        rr = p.lerp(rr, 255, frente * 0.8);
        gg = p.lerp(gg, 245, frente * 0.8);
        bb = p.lerp(bb, 200, frente * 0.8);
      }

      const aa = p.lerp(150, 250, t2) * alfa;
      if (t2 > 0.25 || frente > 0.2) {
        p.fill(rr, gg, bb, aa * 0.18 + frente * 40);
        p.circle(pt.x, pt.y, radio * 3);
      }
      p.fill(rr, gg, bb, aa);
      p.circle(pt.x, pt.y, p.lerp(radio, radio * 1.45, t2) * (1 + frente * 0.5));
    }
  }

  function dibujarZigzag(i, alfa) {
    const [cr, cg, cb] = res[i].def.color;
    const mezcla = CONFIG.MEZCLA_GRADIENTE * carga;
    const nA = i === 0 ? 1 : nivelMedio();
    const nB = i === 0 ? nivelMedio() : 0;
    const mez = (n) => {
      const c = colorNivel(n);
      return [Math.round(p.lerp(cr, c[0], mezcla)), Math.round(p.lerp(cg, c[1], mezcla)),
              Math.round(p.lerp(cb, c[2], mezcla))];
    };
    const cam = camino[i];
    const ctx = p.drawingContext;
    p.push();
    p.noFill();
    const g = i === 0
      ? ctx.createLinearGradient(ZIG1.a, 0, ZIG1.b, 0)
      : ctx.createLinearGradient(0, ZIG2.a, 0, ZIG2.b);
    g.addColorStop(0, `rgba(${mez(nA).join(',')},${alfa})`);
    g.addColorStop(1, `rgba(${mez(nB).join(',')},${alfa})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.4;
    ctx.globalAlpha = 0.34 + 0.66 * carga;
    ctx.beginPath();
    cam.pts.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.stroke();
    p.pop();
    p.noStroke();

    p.fill(cr, cg, cb, 210 * alfa);
    p.textAlign(p.LEFT);
    p.textSize(14);
    if (i === 0) p.text('R1', (ZIG1.a + ZIG1.b) / 2 - 8, RIEL_SUP - 30);
    else p.text('R2', XM_ESQ + 30, (ZIG2.a + ZIG2.b) / 2);
  }

  // ── Cargas ───────────────────────────────────────────────────

  function dibujarCargas() {
    p.noStroke();
    const R = 9;
    for (const c of cargas) {
      const [cr, cg, cb] = colorNivel(c.nivel);
      p.fill(cr, cg, cb, 34); p.circle(c.x, c.y, R * 3.4);
      p.fill(cr, cg, cb, 70); p.circle(c.x, c.y, R * 2.5);
      p.fill(cr, cg, cb); p.circle(c.x, c.y, R * 2);
      p.fill(p.lerp(cr, 255, 0.55), p.lerp(cg, 255, 0.55), p.lerp(cb, 255, 0.55), 210);
      p.circle(c.x - R * 0.3, c.y - R * 0.3, R * 0.55);
    }
  }

  // ── Tubos ────────────────────────────────────────────────────
  // Todos con la misma forma. El del nodo intermedio son DOS piezas que
  // comparten base: una mira a R1 y otra a R2, así el codo se lee como hecho
  // con el mismo material que los extremos.

  function dibujarTubo(x, y, ang, alfa) {
    p.push();
    p.translate(x, y);
    p.rotate(ang);
    p.noStroke();
    p.fill(70, 70, 95, 255 * alfa); p.circle(0, 0, 50);
    p.fill(50, 50, 72, 255 * alfa); p.circle(0, 0, 28);
    p.fill(95, 95, 125, 255 * alfa); p.rect(0, -19, TUBO_W - 6, 38, 5);
    p.fill(120, 120, 150, 255 * alfa); p.rect(TUBO_W - 12, -21, 10, 42, 3);
    p.pop();
  }

  function dibujarTubos(alfa) {
    dibujarTubo(X_CAN_A, Y_FILA, 0, alfa);                 // alimentación →
    dibujarTubo(X_M, Y_FILA, Math.PI, alfa);               // codo: mira a R1
    dibujarTubo(X_M, Y_FILA, Math.PI / 2, alfa);           // codo: baja a R2
    dibujarTubo(X_M, Y_CAN_B, -Math.PI / 2, alfa);         // tierra ↑
  }

  // ── Batería, interruptor, tierra ─────────────────────────────

  // La pila va SIEMPRE vertical a la izquierda, en las dos vistas: como ya
  // ocupa su sitio de esquemático, la transformación no tiene que moverla.
  function dibujarBateria(m) {
    const viva = carga > 0.05;
    const alfa = viva ? 255 : 110;
    const vivo = 0.32 + 0.68 * carga;
    const borne = BAT_W / 2;

    // Tramos de la pila a las esquinas del lazo. El de arriba llega hasta el
    // interruptor; de ahí en adelante ya es el nodo de alimentación.
    p.strokeWeight(2.6);
    p.noFill();
    p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 230 * vivo);
    p.beginShape();
    p.vertex(X_BAT, BAT_Y - borne);
    p.vertex(X_BAT, Y_FILA);
    p.vertex(X_SW - SW_W / 2, Y_FILA);
    p.endShape();

    // El retorno de tierra solo se dibuja aquí mientras el nodo B no se haya
    // desplegado en su riel; con el riel puesto, dibujarlo dos veces engorda
    // la línea y se nota.
    if (m < 1) {
      p.stroke(AZUL[0], AZUL[1], AZUL[2], 230 * vivo * (1 - m));
      p.beginShape();
      p.vertex(X_BAT, BAT_Y + borne);
      p.vertex(X_BAT, Y_CAN_B);
      p.vertex(X_M, Y_CAN_B);
      p.endShape();
    } else {
      p.stroke(AZUL[0], AZUL[1], AZUL[2], 230 * vivo);
      p.line(X_BAT, BAT_Y + borne, X_BAT, Y_CAN_B);
    }
    p.noStroke();

    p.push();
    p.translate(BAT_X, BAT_Y);
    p.rotate(p.HALF_PI);
    p.fill(46, 46, 68, alfa);
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.stroke(120, 200, 255, viva ? 120 : 60);
    p.strokeWeight(1.4); p.noFill();
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.noStroke();
    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], alfa); p.rect(-16, -15, 3, 30);
    p.fill(AZUL[0], AZUL[1], AZUL[2], alfa); p.rect(13, -8, 3, 16);
    p.pop();

    p.textAlign(p.CENTER);
    p.textSize(11);
    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], alfa);
    p.text('+', BAT_X + 30, BAT_Y - 26);
    p.fill(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.text('−', BAT_X + 30, BAT_Y + 34);
    p.fill(170, 170, 195, alfa);
    p.text(`${CONFIG.V_FUENTE} V`, BAT_X - 40, BAT_Y + 4);
  }

  // Interruptor como COMPONENTE, no como dos puntitos: es una de las cosas que
  // el instructor va a señalar, así que tiene que ocupar sitio y verse desde
  // el fondo del aula.
  function dibujarInterruptor() {
    const x = X_SW, y = Y_FILA;
    const medio = SW_W / 2;

    // Corta el cable por debajo: sin esto la palanca se levanta pero el
    // conductor sigue entero y el circuito parece cerrado igual.
    p.noStroke();
    p.fill(13, 13, 26);
    p.rect(x - medio - 2, y - SW_H / 2 - 2, SW_W + 4, SW_H + 4);

    // Placa
    p.fill(40, 40, 60, 230);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);
    p.noFill();
    p.stroke(110, 110, 140, 150);
    p.strokeWeight(1.4);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);

    // Palanca: pivota sobre el borne izquierdo
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

  const RIEL_W_SUP = () => XM_ESQ - RIEL_X;

  // Cuelga del cable de retorno, a media distancia entre la pila y el nodo de
  // tierra: es el único elemento del tramo de abajo, como debe ser.
  function dibujarTierra() {
    const x = X_TIERRA, y = Y_CAN_B;
    const alfa = 90 + carga * 150;
    p.stroke(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.strokeWeight(2.2);
    p.line(x, y, x, y + 12);
    [26, 16, 8].forEach((w, i) => p.line(x - w / 2, y + 12 + i * 6, x + w / 2, y + 12 + i * 6));
    p.noStroke();
  }

  // ── Etiquetas ────────────────────────────────────────────────

  function dibujarEtiquetas(m) {
    const nM = nivelMedio();
    const vM = CONFIG.V_FUENTE * nM * carga;

    p.noStroke();
    p.textAlign(p.CENTER);

    // Voltaje de cada nodo, viajando con él
    etiquetaNodo(NODO_A, rielDe('A'), m, colorNivel(1), CONFIG.V_FUENTE * carga, 'alimentación');
    // Sin cifra a propósito: si el valor está escrito, la pregunta "¿sube o
    // baja al cambiar la resistencia?" ya viene contestada. El color sigue
    // diciéndolo, que es la lectura que interesa entrenar.
    etiquetaNodo(NODO_M, rielDe('M'), m, colorNivel(nM), null, 'nodo intermedio');
    // El de tierra va a la DERECHA de su cañón: encima lo aplastaban R2 por
    // arriba y el cañón por abajo, y a la izquierda caía sobre el cable de
    // retorno. A la derecha queda libre.
    // Desplazada del centro del riel: ahí está el símbolo de tierra.
    etiquetaNodo(NODO_B, rielDe('B'), m, colorNivel(0), 0, 'tierra', true, 0.80);

    if (m < 1) {
      p.textSize(12);
      const alfa = 255 * (1 - m);
      for (let i = 0; i < 2; i++) {
        const caja = cajaDe(i);
        const [cr, cg, cb] = res[i].def.color;
        p.fill(cr, cg, cb, alfa);
        if (i === 0) p.text(`R1 · ${CONFIG.TIPOS[iTipo[0]]}`, caja.x + caja.w / 2, caja.y - 14);
        else {
          p.textAlign(p.LEFT);
          p.text(`R2 · ${CONFIG.TIPOS[iTipo[1]]}`, caja.x + caja.w + 16, caja.y + caja.h / 2);
          p.textAlign(p.CENTER);
        }
      }
    }
  }

  function etiquetaNodo(nodo, riel, m, col, voltaje, nombre, aLaDerecha = false,
                        fraccion = 0.5) {
    const arriba = riel.y < 300;
    // En el esquemático todas las etiquetas vuelven sobre su riel; el desvío
    // lateral es solo cosa de la vista de modelo.
    const cx = p.lerp(aLaDerecha ? nodo.x + nodo.w + 48 : nodo.x + nodo.w / 2,
                      riel.x + riel.w * fraccion, m);
    const cy = p.lerp(aLaDerecha ? nodo.y + nodo.h / 2 : nodo.y - 20,
                      riel.y + (arriba ? -16 : 30), m);
    p.textAlign(p.CENTER);
    if (voltaje !== null) {
      p.fill(col[0], col[1], col[2], 120 + carga * 135);
      p.textSize(p.lerp(18, 15, m));
      p.text(`${voltaje.toFixed(1)} V`, cx, cy);
    }
    if (m < 1) {
      p.textSize(11);
      p.fill(170, 170, 195, 190 * (1 - m));
      p.text(nombre, cx, aLaDerecha ? cy - 20 : nodo.y - 42);
    }
  }

  // Aviso en pantalla, no solo en la nota del instructor: la lectura errónea
  // ("va más lento, luego pasa menos corriente") la hacen los estudiantes en
  // el momento en que ven las cargas moverse, no cuando alguien la explica.
  // Solo aparece con las cargas en marcha, que es cuando el riesgo existe.
  function avisoCorriente() {
    if (!flujo || morphT > 0) return;
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textSize(11);
    p.fill(150, 150, 178, 190);
    p.text('la corriente es la MISMA en R1 y R2 · aquí la velocidad no representa la corriente',
           W / 2, H - 44);
  }

  function dibujarLeyenda() {
    const items = [
      { tecla: 'ESPACIO', etiqueta: 'circuito',
        valor: fuente ? 'cerrado' : 'abierto', col: AMARILLO },
      { tecla: 'P', etiqueta: 'cargas', valor: flujo ? 'ON' : 'OFF', col: [255, 120, 60] },
      { tecla: '1/2', etiqueta: 'elegida', valor: seleccion === 0 ? 'R1' : 'R2',
        col: [230, 230, 245] },
      { tecla: 'C', etiqueta: 'cambiar', valor: CONFIG.TIPOS[iTipo[seleccion]],
        col: res[seleccion].def.color },
      { tecla: 'E', etiqueta: 'esquemático', valor: hacia === 1 ? 'ON' : 'OFF', col: AZUL },
    ];

    p.textSize(11);
    const anchos = items.map((it) => p.textWidth(`${it.tecla} ${it.etiqueta}: ${it.valor}`));
    const sep = 22;
    let x = W / 2 - (anchos.reduce((a, b) => a + b, 0) + sep * (items.length - 1)) / 2;

    p.noStroke();
    p.textAlign(p.LEFT);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      p.fill(150, 150, 178);
      const tw = p.textWidth(it.tecla + ' ');
      p.text(it.tecla, x, H - 20);
      p.fill(120, 120, 145);
      const ew = p.textWidth(it.etiqueta + ': ');
      p.text(it.etiqueta + ':', x + tw, H - 20);
      p.fill(it.col[0], it.col[1], it.col[2], 235);
      p.text(it.valor, x + tw + ew, H - 20);
      x += anchos[i] + sep;
    }
  }
});

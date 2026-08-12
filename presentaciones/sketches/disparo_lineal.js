// Modelo energético en versión lineal.
//
// Un cañón dispara una carga que atraviesa la resistencia en línea recta, con
// el mismo lenguaje visual del modelo circuital: cañón a la entrada, cañón a la
// salida, y el medio de la biblioteca compartida en medio.
//
//   ESPACIO  disparar    C  cambiar de resistencia
//
// Si ya hay una carga en pista, ESPACIO la desvanece antes de disparar la
// siguiente: dos cargas a la vez invitarían a compararlas entre sí, cuando lo
// que hay que comparar es la MISMA carga contra medios distintos.
//
// Marco conceptual (idéntico en todas las escenas del bloque):
//   pelota = portador de carga → nunca desaparece; si se queda sin energía se
//                                para, pero sigue ahí
//   resistencia                → cobra ENERGÍA, no existencia

registrarSketch('disparo_lineal', {
  ancho: 900,
  alto: 400,
  pista: 'ESPACIO disparar · C resistencia · R reiniciar',
}, function (p, opciones) {

  const CONFIG_BASE = {
    // Energía del disparo. El alcance dentro del medio es energía/factor y el
    // bloque mide 300, así que con los factores actuales:
    //   media  520/1.4 = 371 → cruza por poco
    //   fuerte 520/3   = 173 → se queda dentro
    E_DISPARO: 520,
    VELOCIDAD: 3.2,

    // 'leve' existe en la biblioteca pero está fuera de las diapositivas:
    // no aparece en el guion ni la alcanza la tecla C.
    TIPOS: ['media', 'fuerte'],
    TIPO_INICIAL: 'media',

    FRAMES_CAMBIO: 34,     // relevo entre resistencias
    FRAMES_DESVANECE: 22,  // lo que tarda en irse la carga anterior
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 900, H = 400;
  const ZY = 130, ZH = 140;
  const Y_CARRIL = ZY + ZH / 2;

  // Huecos IGUALES a los dos lados: así el bloque queda centrado en el lienzo y
  // el montaje entero también. Con huecos distintos había que elegir cuál de
  // las dos cosas centrar, y el bloque es lo que mira el ojo.
  const RES_W = 300;
  const TUBO_W = 62, HUECO = 70;

  const RES = { x: (W - RES_W) / 2, w: RES_W };
  const CANON_IZQ = RES.x - TUBO_W - HUECO;
  const CANON_DER = RES.x + RES.w + TUBO_W + HUECO;
  const X_BOCA_DER = CANON_DER - TUBO_W;    // boca del cañón de llegada
  const BALL_R = 10;

  // La carga que cruza entra DENTRO del cañón de salida, que la tapa: se lee
  // como recogida al final del recorrido. Pararla en la boca dejaba el cruce a
  // medias, como si se hubiera quedado a las puertas.
  const X_PARADA = CANON_DER - TUBO_W / 2;

  const NARANJA = [255, 85, 40];

  let iTipo = 0;
  let resistencia = null;
  let saliente = null;      // resistencia que se va, durante el relevo
  let cambioT = 1;

  let bala = null;          // la carga en pista
  let apagandose = null;    // la carga anterior, desvaneciéndose
  let disparoPendiente = false;

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () { reset(); };

  function reset() {
    iTipo = Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.TIPO_INICIAL));
    resistencia = nuevaResistencia();
    saliente = null;
    cambioT = 1;
    bala = null;
    apagandose = null;
    disparoPendiente = false;
  }

  function nuevaResistencia() {
    return crearResistencia(p, CONFIG.TIPOS[iTipo], RES.x, ZY, RES.w, ZH);
  }

  const FACTOR = () => RESISTENCIAS[CONFIG.TIPOS[iTipo]].factor;

  // ── Teclas ───────────────────────────────────────────────────

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
        // Si ya hay una carga, primero se va y luego sale la nueva.
        if (bala) {
          apagandose = { ...bala, alfa: 1 };
          bala = null;
          disparoPendiente = true;
        } else if (!apagandose) {
          disparar();
        }
        return true;

      case 'KeyC':
        if (cambioT >= 1) cambiarResistencia();
        return true;

      default:
        return false;
    }
  };

  function disparar() {
    const x0 = CANON_IZQ + TUBO_W / 2;
    bala = {
      x: x0,
      // La biblioteca mide la distancia partícula-carga en dos ejes. Sin `y`
      // el cálculo daba NaN y el aceite no reaccionaba nunca al paso.
      y: Y_CARRIL,
      v: CONFIG.VELOCIDAD,
      energia: CONFIG.E_DISPARO,
      recorrido: 0,
      drag: 0,
      fase: 'vuelo',        // vuelo | dentro | fuera | atascada | llego
      cruzo: false,
    };
  }

  // El medio nuevo entra desordenado y los resortes lo acomodan a la vista.
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

  // ── Física ───────────────────────────────────────────────────
  //
  // Fuera del medio la carga va a velocidad constante. Dentro se le resta
  // energía, y cada píxel recorrido cuesta FACTOR veces más en un medio más
  // resistivo. Al agotarse la energía se para donde esté — no desaparece.

  function energiaRestante(b) {
    return Math.max(0, b.energia - b.recorrido * FACTOR());
  }

  function actualizar() {
    if (cambioT < 1) cambioT = Math.min(1, cambioT + 1 / CONFIG.FRAMES_CAMBIO);

    if (apagandose) {
      apagandose.alfa -= 1 / CONFIG.FRAMES_DESVANECE;
      if (apagandose.alfa <= 0) {
        apagandose = null;
        if (disparoPendiente) { disparar(); disparoPendiente = false; }
      }
    }

    if (!bala || bala.fase === 'atascada' || bala.fase === 'llego') return;

    const b = bala;
    const der = RES.x + RES.w;
    const dentro = b.x >= RES.x && b.x <= der;

    if (b.fase === 'vuelo' && dentro) {
      b.fase = 'dentro';
      // Frenado constante para que se detenga justo al agotarse la energía:
      // el alcance dentro del medio es energía/FACTOR.
      b.drag = (b.v * b.v * FACTOR()) / (2 * b.energia);
    }
    if (b.fase === 'dentro' && !dentro) {
      b.fase = 'fuera';
      // Solo cuenta como cruzar si salió por el lado lejano.
      if (b.x > der) b.cruzo = true;
    }

    if (b.fase === 'dentro') {
      b.v = Math.max(0, b.v - b.drag);
      b.recorrido += b.v;
      if (energiaRestante(b) <= 0 || b.v <= 0.02) {
        b.fase = 'atascada';
        b.v = 0;
        return;
      }
    }

    b.x += b.v;
    // Se estaciona pasado el bloque, para que el cuadro final diga cómo acabó
    // en vez de quedarse vacío. La comprobación exige haber SALIDO del medio:
    // parar dentro y darlo por llegado marcaría como fallido un cruce bueno.
    if (b.x > RES.x + RES.w && b.x >= X_PARADA) { b.x = X_PARADA; b.fase = 'llego'; }
  }

  // ── Render ───────────────────────────────────────────────────

  p.draw = function () {
    p.background(13, 13, 26);

    actualizar();

    dibujarCarril();
    resistencia.dibujarFondo();
    resistencia.actualizar(bala ? [bala] : []);
    if (saliente && cambioT < 1) dibujarPepitasDe(saliente, 1 - cambioT);
    dibujarPepitasDe(resistencia, cambioT);

    if (apagandose) dibujarCarga(apagandose, apagandose.alfa);
    if (bala) dibujarCarga(bala, 1);

    dibujarCanon(CANON_IZQ, 1);
    dibujarCanon(CANON_DER, -1);

    dibujarTitulo();
    dibujarBarra();
    dibujarLeyenda();
  };

  function dibujarCarril() {
    // Guía tenue que une los dos cañones: sin ella el montaje se ve como tres
    // piezas sueltas en vez de un recorrido.
    p.stroke(150, 160, 200, 34);
    p.strokeWeight(1.2);
    p.line(CANON_IZQ + TUBO_W, Y_CARRIL, CANON_DER - TUBO_W, Y_CARRIL);
    p.noStroke();
  }

  function dibujarPepitasDe(res, alfa) {
    if (alfa <= 0.01) return;
    const [cr, cg, cb] = res.def.color;
    const radio = Math.max(2.6, res.def.espaciado * 0.38);
    p.noStroke();
    for (const pt of res.particulas) {
      const disp = Math.hypot(pt.x - pt.rx, pt.y - pt.ry);
      const t = Math.min(disp / 14, 1);
      const r = p.lerp(cr, 255, t * 0.75);
      const g = p.lerp(cg, 220, t * 0.75);
      const b = p.lerp(cb, 120, t * 0.75);
      const a = p.lerp(150, 250, t) * alfa;
      if (t > 0.25) { p.fill(r, g, b, a * 0.18); p.circle(pt.x, pt.y, radio * 3); }
      p.fill(r, g, b, a);
      p.circle(pt.x, pt.y, p.lerp(radio, radio * 1.45, t));
    }
  }

  // El brillo de la carga sigue a la energía que le queda: se apaga a medida
  // que el medio se la cobra, sin dejar de estar ahí.
  function dibujarCarga(b, alfa) {
    const frac = b.energia ? energiaRestante(b) / b.energia : 0;
    const k = 0.35 + 0.65 * frac;
    const cr = NARANJA[0] * k, cg = NARANJA[1] * k, cb = NARANJA[2] * k;

    p.noStroke();
    p.fill(cr, cg, cb, 26 * alfa);
    p.circle(b.x, Y_CARRIL, BALL_R * 3.4);
    p.fill(cr, cg, cb, 255 * alfa);
    p.circle(b.x, Y_CARRIL, BALL_R * 2);
    p.fill(255, 200, 150, 200 * alfa * (0.4 + 0.6 * frac));
    p.circle(b.x - BALL_R * 0.3, Y_CARRIL - BALL_R * 0.3, BALL_R * 0.55);

    if (alfa < 1) return;
    if (b.fase === 'atascada') {
      etiqueta('se quedó sin energía', b.x, Y_CARRIL - BALL_R - 15, NARANJA);
    } else if (b.fase === 'llego') {
      // Junto al cañón: la carga ya está dentro y no se ve, así que rotularla
      // sobre su posición dejaría el texto flotando encima del tubo.
      etiqueta('cruzó', CANON_DER - TUBO_W / 2, Y_CARRIL - 38, [120, 200, 255]);
    }
  }

  // Texto con respaldo: encima de las partículas, sin fondo no se lee.
  function etiqueta(txt, x, y, col) {
    p.textAlign(p.CENTER);
    p.textSize(11);
    const w = p.textWidth(txt) + 12;
    p.noStroke();
    p.fill(13, 13, 26, 232);
    p.rect(x - w / 2, y - 11, w, 16, 3);
    p.fill(col[0], col[1], col[2], 230);
    p.text(txt, x, y);
  }

  // Mismos cañones que el resto del bloque, dibujados DESPUÉS de la carga para
  // que la tapen mientras está dentro y se vea salir por la boca.
  function dibujarCanon(xBase, sentido) {
    p.push();
    p.translate(xBase, Y_CARRIL);
    p.scale(sentido, 1);
    p.noStroke();
    p.fill(70, 70, 95);
    p.circle(0, 0, 50);
    p.fill(50, 50, 72);
    p.circle(0, 0, 28);
    p.fill(95, 95, 125);
    p.rect(0, -19, TUBO_W - 6, 38, 5);
    p.fill(120, 120, 150);
    p.rect(TUBO_W - 12, -21, 10, 42, 3);
    p.pop();
  }

  function dibujarTitulo() {
    const [cr, cg, cb] = resistencia.def.color;
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textSize(12);
    p.fill(cr, cg, cb, 210);
    p.text(`resistencia ${CONFIG.TIPOS[iTipo]}`, RES.x + RES.w / 2, ZY - 14);
  }

  // Debajo del montaje y centrada. A un lado, además de descolocar el conjunto,
  // obligaba a mirar a otro sitio para leer lo que le pasa a la carga.
  function dibujarBarra() {
    const barW = 190, barH = 8;
    const x = W / 2 - barW / 2, y = ZY + ZH + 46;
    const frac = bala ? energiaRestante(bala) / bala.energia : (apagandose ? 0 : 1);

    p.noStroke();
    p.fill(40, 40, 60);
    p.rect(x, y, barW, barH, 4);
    p.fill(p.lerp(60, 255, 1 - frac), p.lerp(220, 80, 1 - frac), 60);
    p.rect(x, y, barW * frac, barH, 4);

    p.fill(140, 140, 168);
    p.textAlign(p.CENTER);
    p.textSize(9);
    p.text('energía del disparo', W / 2, y - 7);
  }

  function dibujarLeyenda() {
    const items = [
      { tecla: 'ESPACIO', etiqueta: 'disparar',
        valor: bala ? 'otra vez' : 'listo', col: NARANJA, on: true },
      { tecla: 'C', etiqueta: 'resistencia',
        valor: CONFIG.TIPOS[iTipo], col: resistencia.def.color, on: true },
    ];

    p.textSize(11);
    const anchos = items.map((it) =>
      p.textWidth(`${it.tecla} ${it.etiqueta}: ${it.valor}`));
    const sep = 30;
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

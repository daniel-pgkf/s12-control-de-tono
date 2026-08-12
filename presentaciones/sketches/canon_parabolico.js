// Modelo energético: tiro parabólico contra una resistencia.
//
// Un cañón, un disparo, una resistencia en el vértice de la parábola. La escena
// arranca QUIETA; el primer ESPACIO dispara, el segundo pasa a la siguiente.
// (Ver p.avanzarPaso: el protocolo lo maneja el player.)
//
// La comparación es ENTRE escenas, no dentro: el guion monta esta misma escena
// una vez por tipo de resistencia, con la MISMA energía. Cuanto más resistivo
// el medio, antes se queda sin energía y antes cae. La bala fantasma marca
// dónde habría caído sin resistencia: sin esa vara de medir, el efecto del
// medio se queda en "algo pasó".
//
// El tipo de resistencia sale de la biblioteca compartida (resistencias.js),
// la misma que usa el modelo circuital. Cada píxel recorrido dentro cuesta
// FACTOR veces más energía; con la energía fija, eso decide hasta dónde llega:
//   energía/factor > GROSOR → cruza y aterriza al otro lado
//   energía/factor < GROSOR → se queda sin energía dentro y cae a plomo
//
// Marco conceptual (idéntico en todas las escenas del bloque):
//   pelota = portador de carga → nunca desaparece; termina en el suelo, visible
//   resistencia                → cobra ENERGÍA, no existencia
// Cae porque fue un disparo único y nadie la sigue empujando; en cuanto haya
// fuente siempre llega.

registrarSketch('canon_parabolico', {
  ancho: 900,
  alto: 430,
  pista: 'ESPACIO dispara · R reinicia',
}, function (p, opciones) {

  const CONFIG_BASE = {
    // Energía del disparo, la MISMA en las tres escenas. La distancia que la
    // bala logra recorrer DENTRO de la resistencia es energía/factor, así que
    // contra un medio más resistivo se queda corta antes.
    // El bloque mide GROSOR=170:
    //   energía/factor > 170 → lo atraviesa
    //   energía/factor < 170 → se queda sin energía adentro
    E_DISPARO: 260,
    GROSOR: 170,

    // Tipo de resistencia, de la biblioteca: 'media' | 'fuerte'.
    // 'leve' sigue definida pero está fuera de las diapositivas.
    TIPO_RESISTENCIA: 'media',

    // Tope de la barra de energía. En null se normaliza a E_DISPARO, que es lo
    // correcto cuando las escenas comparten energía: las barras arrancan
    // iguales y lo único que cambia es a qué ritmo se vacían.
    E_ESCALA: null,

    GRAVEDAD: 0.12,
    ALTURA_VERTICE: 190,   // altura del vértice sobre la boca del cañón
    ALCANCE_VERTICE: 340,  // distancia horizontal hasta el vértice
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 900, H = 430;
  const BALL_R = 11;
  const X_CANON = 60;
  const LARGO_TUBO = 46;

  // Cuánto cuesta atravesar este medio. Sale de la biblioteca compartida, así
  // que ajustar allí un tipo cambia a la vez esta escena y la circuital.
  const FACTOR = RESISTENCIAS[CONFIG.TIPO_RESISTENCIA].factor;

  // Un solo disparo. La comparación ya no vive DENTRO de la escena sino entre
  // escenas: misma energía contra cada resistencia, y se ve cuál llega y cuál
  // no. Dos carriles aquí sobraban y competían con esa lectura.
  const CARRILES = [
    { energia: 'E_DISPARO', suelo: 360 },
  ];

  // Velocidad inicial derivada de la geometría deseada del tiro, para que el
  // vértice caiga exactamente sobre el bloque de resistencia.
  //   altura = vy0²/(2g)      alcance = vx·vy0/g
  const VY0 = Math.sqrt(2 * CONFIG.GRAVEDAD * CONFIG.ALTURA_VERTICE);
  const VX0 = (CONFIG.ALCANCE_VERTICE * CONFIG.GRAVEDAD) / VY0;
  const ANGULO = Math.atan2(VY0, VX0);

  // La bala sale por la BOCA del tubo, no por la base del cañón: si no, se ve
  // brotar desde atrás del cañón. Todo el tiro se mide desde ese punto.
  const DX_BOCA = Math.cos(ANGULO) * LARGO_TUBO;
  const DY_BOCA = -Math.sin(ANGULO) * LARGO_TUBO;
  const X_SALIDA = X_CANON + DX_BOCA;

  const X_VERTICE = X_SALIDA + CONFIG.ALCANCE_VERTICE;
  const OIL_X = X_VERTICE - CONFIG.GROSOR / 2;

  // Escala de la barra de energía.
  const E_MAX = CONFIG.E_ESCALA || CONFIG.E_DISPARO;

  let carriles = [];
  let disparado = false;

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () { reset(); };

  function reset() {
    disparado = false;
    carriles = CARRILES.map((def) => {
      const yBoca = def.suelo - 8 + DY_BOCA;
      const yVertice = yBoca - CONFIG.ALTURA_VERTICE;
      const c = {
        def,
        energia: CONFIG[def.energia],
        yBoca,
        // El bloque cubre el tramo plano del vuelo alrededor del vértice.
        oilTop: yVertice - 30,
        oilBot: yVertice + 50,
        ball: { x: X_SALIDA, y: yBoca, vx: 0, vy: 0 },
        // Bala fantasma: el MISMO disparo si la resistencia no existiera.
        // Sirve de vara de medir — sin ella no hay con qué comparar y el
        // efecto de la resistencia queda en "algo pasó".
        fantasma: { x: X_SALIDA, y: yBoca, vx: 0, vy: 0, activa: false },
        rutaFantasma: trayectoriaLibre(yBoca, def.suelo),
        trail: [],
        fase: 'cargado',   // cargado | vuelo | dentro | fuera | sin_energia | suelo
        recorrido: 0,      // px recorridos dentro de la resistencia
        drag: 0,
        // Si salió o no por el otro lado. Es un HECHO que se registra al
        // ocurrir, no algo que se deduzca de la energía sobrante: con frenados
        // altos la bala se para por velocidad≈0 dejando una brizna de energía,
        // y eso se leía como "cruzó" cuando se había quedado dentro.
        cruzo: false,
        res: crearResistencia(p, CONFIG.TIPO_RESISTENCIA,
                              OIL_X, yVertice - 30, CONFIG.GROSOR, 80),
      };
      return c;
    });
  }

  // Parábola que seguiría la bala si nada la frenara. Se calcula una vez, al
  // crear el carril, integrando con el mismo paso que usa la simulación real
  // para que las dos curvas coincidan exactamente donde deben coincidir.
  function trayectoriaLibre(yBoca, suelo) {
    const puntos = [];
    let x = X_SALIDA, y = yBoca, vy = -VY0;
    while (y < suelo - BALL_R && x < W + 40) {
      puntos.push({ x, y });
      vy += CONFIG.GRAVEDAD;
      x += VX0;
      y += vy;
    }
    puntos.push({ x, y: Math.min(y, suelo - BALL_R) });
    return puntos;
  }

  function disparar() {
    disparado = true;
    for (const c of carriles) {
      c.ball.vx = VX0;
      c.ball.vy = -VY0;
      c.fase = 'vuelo';
      c.fantasma.vx = VX0;
      c.fantasma.vy = -VY0;
      c.fantasma.activa = true;
    }
  }

  // ── Protocolo de sub-pasos con el player ─────────────────────
  // Devuelve true mientras la escena tenga algo pendiente que hacer con la
  // barra espaciadora; cuando ya disparó, devuelve false y el player avanza.
  p.avanzarPaso = function () {
    if (!disparado) { disparar(); return true; }
    return false;
  };

  p.draw = function () {
    p.background(13, 13, 26);

    for (const c of carriles) {
      actualizarBala(c);
      actualizarFantasma(c);
      c.res.actualizar([c.ball]);
      dibujarSuelo(c);
      dibujarRutaFantasma(c);
      c.res.dibujarFondo();
      etiquetaResistencia(c);
      dibujarFantasma(c);
      dibujarEstela(c);
      c.res.dibujarParticulas();
      // La bala va ANTES del cañón: así el tubo la tapa mientras está cargada
      // y se ve salir por la boca, en vez de flotar por delante del cañón.
      dibujarBala(c);
      dibujarCanon(c);
      dibujarEtiqueta(c);
    }

    dibujarLeyenda();
  };

  // ── Física ───────────────────────────────────────────────────
  //
  // Fuera de la resistencia: tiro parabólico limpio (solo gravedad).
  // Dentro: además se le resta energía, y cada píxel recorrido cuesta FACTOR
  // veces más en un medio más resistente. Cuando la energía se agota la bala
  // cae a plomo — sigue existiendo, solo que ya no avanza.
  //
  // De ahí sale la relación que la escena tiene que dejar ver: para cruzar el
  // mismo bloque contra el triple de resistencia hace falta el triple de
  // energía.

  function energiaRestante(c) {
    return Math.max(0, c.energia - c.recorrido * FACTOR);
  }

  function actualizarBala(c) {
    if (c.fase === 'cargado' || c.fase === 'suelo') return;

    const b = c.ball;
    const oilDer = OIL_X + CONFIG.GROSOR;
    const dentroX = b.x >= OIL_X && b.x <= oilDer;
    const dentroY = b.y >= c.oilTop && b.y <= c.oilBot;

    if (c.fase === 'vuelo' && dentroX && dentroY) {
      c.fase = 'dentro';
      // Frenado constante calibrado con la velocidad de entrada para que la
      // bala se detenga justo cuando se acabe la energía. El alcance dentro
      // del medio es energía/FACTOR:  drag = v²·FACTOR/(2·E)
      const v = Math.hypot(b.vx, b.vy);
      c.drag = (v * v * FACTOR) / (2 * c.energia);
    }
    if (c.fase === 'dentro' && (!dentroX || !dentroY)) {
      c.fase = 'fuera';
      // Solo cuenta como cruzar si salió por el lado lejano.
      if (b.x >= oilDer) c.cruzo = true;
    }

    if (c.fase === 'dentro') {
      const v = Math.hypot(b.vx, b.vy);
      const vNuevo = Math.max(0, v - c.drag);
      if (v > 0.001) { b.vx *= vNuevo / v; b.vy *= vNuevo / v; }
      c.recorrido += vNuevo;

      if (energiaRestante(c) <= 0 || vNuevo <= 0.05) {
        // Perdió toda la energía del disparo: deja de avanzar y cae.
        c.fase = 'sin_energia';
        b.vx = 0; b.vy = 0;
      }
    }

    b.vy += CONFIG.GRAVEDAD;

    // Una bala sin impulso propio sigue DENTRO del medio mientras cae, y el
    // medio se opone también a eso. Sin este frenado el bloque solo resistía el
    // avance horizontal y la bala lo atravesaba a plomo como si fuera aire.
    // No se aplica en fase 'dentro' porque allí ya frena el gasto de energía,
    // y sumar los dos descalibraría el alcance.
    if (c.fase === 'sin_energia' && c.res.contiene(b.x, b.y)) c.res.frenar(b);

    b.x += b.vx;
    b.y += b.vy;

    // Trayectoria COMPLETA, sin recortar: el cuadro final tiene que contar la
    // historia entera (subida, resistencia, desenlace) sin haber visto el vuelo.
    c.trail.push({ x: b.x, y: b.y });

    if (b.y >= c.def.suelo - BALL_R) {
      b.y = c.def.suelo - BALL_R;
      c.fase = 'suelo';
      b.vx = 0; b.vy = 0;
    }
  }

  // El nombre del tipo va en la etiqueta: al recorrer las tres escenas
  // seguidas hay que poder decir cuál se está viendo sin mirar el guion.
  function etiquetaResistencia(c) {
    p.noStroke();
    p.fill(c.res.def.color[0], c.res.def.color[1], c.res.def.color[2], 190);
    p.textAlign(p.CENTER);
    p.textSize(11);
    p.text(`resistencia ${c.res.def.nombre}`,
           OIL_X + CONFIG.GROSOR / 2, c.oilTop - 9);
  }

  // ── Bala fantasma ────────────────────────────────────────────
  // Mismo disparo, solo gravedad. Nunca entra en la resistencia.

  function actualizarFantasma(c) {
    const f = c.fantasma;
    if (!f.activa) return;
    f.vy += CONFIG.GRAVEDAD;
    f.x += f.vx;
    f.y += f.vy;
    if (f.y >= c.def.suelo - BALL_R) {
      f.y = c.def.suelo - BALL_R;
      f.activa = false;
    }
  }

  function dibujarRutaFantasma(c) {
    if (!disparado) return;
    p.noFill();
    p.stroke(150, 160, 200, 42);
    p.strokeWeight(1.4);
    p.beginShape();
    for (const pt of c.rutaFantasma) p.vertex(pt.x, pt.y);
    p.endShape();
    p.noStroke();

    const fin = c.rutaFantasma[c.rutaFantasma.length - 1];
    p.fill(150, 160, 200, 70);
    p.textAlign(p.CENTER);
    p.textSize(9);
    p.text('sin resistencia', fin.x, fin.y - 20);
  }

  function dibujarFantasma(c) {
    if (!disparado) return;
    const f = c.fantasma;
    p.noStroke();
    p.fill(160, 170, 210, 30);
    p.circle(f.x, f.y, BALL_R * 2.6);
    p.noFill();
    p.stroke(170, 180, 220, 95);
    p.strokeWeight(1.3);
    p.circle(f.x, f.y, BALL_R * 2);
    p.noStroke();
  }

  // ── Render ───────────────────────────────────────────────────

  function dibujarSuelo(c) {
    p.noStroke();
    p.fill(30, 30, 48);
    p.rect(0, c.def.suelo, W, 10);
    p.stroke(90, 90, 120, 90);
    p.strokeWeight(1);
    p.line(0, c.def.suelo, W, c.def.suelo);
  }

  // Dos capas: el recorrido entero tenue (para poder señalarlo al final) y
  // los últimos frames encendidos (para leer la dirección durante el vuelo).
  function dibujarEstela(c) {
    if (c.trail.length < 2) return;

    p.noFill();
    p.stroke(255, 120, 50, 60);
    p.strokeWeight(2);
    p.beginShape();
    for (const pt of c.trail) p.vertex(pt.x, pt.y);
    p.endShape();

    p.noStroke();
    const desde = Math.max(0, c.trail.length - 26);
    for (let i = desde; i < c.trail.length; i++) {
      const t = (i - desde) / Math.max(1, c.trail.length - desde);
      p.fill(255, 120, 50, 20 + t * 60);
      p.circle(c.trail[i].x, c.trail[i].y, p.lerp(2, BALL_R * 1.1, t));
    }
  }

  function dibujarCanon(c) {
    p.push();
    p.translate(X_CANON, c.def.suelo - 8);
    // Base
    p.noStroke();
    p.fill(70, 70, 95);
    p.circle(0, 0, 42);
    p.fill(50, 50, 72);
    p.circle(0, 0, 24);
    // Tubo, orientado con el ángulo real del disparo. Más grueso que el halo de
    // la bala para taparla del todo mientras está cargada; el LARGO no cambia,
    // porque de él sale la posición de la boca y con ella toda la balística.
    p.rotate(-ANGULO);
    p.fill(95, 95, 125);
    p.rect(0, -17, LARGO_TUBO, 34, 5);
    p.fill(120, 120, 150);
    p.rect(LARGO_TUBO - 6, -19, 10, 38, 3);
    p.pop();
  }

  function dibujarBala(c) {
    const b = c.ball;
    p.noStroke();
    if (c.fase === 'cargado') {
      // En reposo dentro de la boca: la escena espera el ESPACIO.
      p.fill(255, 100, 40, 18);
      p.circle(b.x, b.y, BALL_R * 3);
      p.fill(210, 80, 40);
      p.circle(b.x, b.y, BALL_R * 2);
      return;
    }

    const apagada = c.fase === 'sin_energia' || (c.fase === 'suelo' && !c.cruzo);
    p.fill(255, 100, 40, apagada ? 18 : 25);
    p.circle(b.x, b.y, BALL_R * 3.4);
    p.fill(apagada ? 175 : 255, 85, 40);
    p.circle(b.x, b.y, BALL_R * 2);
    p.fill(255, 200, 150, apagada ? 90 : 200);
    p.circle(b.x - BALL_R * 0.28, b.y - BALL_R * 0.28, BALL_R * 0.55);

    if (c.fase === 'sin_energia') {
      etiqueta('se quedó sin energía', b.x, b.y - BALL_R - 15, [255, 85, 40]);
    } else if (c.fase === 'suelo') {
      etiqueta(c.cruzo ? 'cruzó' : 'se quedó sin energía',
               b.x, b.y - BALL_R - 15,
               c.cruzo ? [120, 200, 255] : [255, 85, 40]);
    }
  }

  // Texto con respaldo opaco: sobre las partículas del aceite, sin fondo
  // no se lee.
  function etiqueta(txt, x, y, color) {
    p.textAlign(p.CENTER);
    p.textSize(11);
    const w = p.textWidth(txt) + 12;
    p.noStroke();
    p.fill(13, 13, 26, 232);
    p.rect(x - w / 2, y - 11, w, 16, 3);
    p.fill(color[0], color[1], color[2], 230);
    p.text(txt, x, y);
  }

  // Etiqueta y barra van arriba a la izquierda, a la altura de la resistencia:
  // junto al cañón se montaban encima del tubo y la barra parecía una tarima.
  function dibujarEtiqueta(c) {
    const x = 18, y = c.oilTop + 4;

    p.noStroke();
    p.fill(170, 170, 190);
    p.textAlign(p.LEFT);
    p.textSize(12);
    p.text(c.def.etiqueta, x, y);

    // Las dos barras se miden contra la MISMA escala (la energía mayor). Si
    // cada una se normaliza a la suya, ambas arrancan llenas y no se puede
    // predecir cuál pasa, que es justo la pregunta antes de disparar.
    const barW = 108, barH = 6, barY = y + 10;
    const ratio = energiaRestante(c) / E_MAX;
    p.fill(40, 40, 60);
    p.rect(x, barY, barW, barH, 3);
    p.fill(p.lerp(60, 255, 1 - ratio), p.lerp(220, 80, 1 - ratio), 60);
    p.rect(x, barY, barW * ratio, barH, 3);

    p.fill(120, 120, 148);
    p.textSize(9);
    p.text('energía del disparo', x, barY + 18);
  }

  function dibujarLeyenda() {
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textSize(11);
    if (!disparado) {
      p.fill(140, 140, 170);
      p.text('la misma energía contra cada resistencia · ESPACIO para disparar',
             W / 2, H - 12);
    } else {
      p.fill(110, 110, 135);
      p.text('un solo disparo · nadie la sigue empujando', W / 2, H - 12);
    }
  }
});

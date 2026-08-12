// Escena 2 del bloque de voltaje: la energía se gasta al atravesar.
//
// Dos carriles, MISMO bloque de aceite, misma pelota, distinta energía inicial,
// disparadas a la vez. Arriba cruza; abajo se queda adentro.
//
// Por qué un solo sketch y no dos instancias de energia_configurable: hacen
// falta un reloj y un reset COMPARTIDOS. Dos instancias independientes se
// desincronizan tras el primer ciclo y la comparación deja de leerse.
//
// Marco conceptual (mantener consistente en las 3 escenas del bloque):
//   pelota = portador de carga   → nunca desaparece ni se consume
//   aceite = resistencia         → le cuesta ENERGÍA, no existencia
//   la de abajo se atasca porque es un disparo único y nadie la empuja;
//   en cuanto haya fuente (escena 3) siempre llega.
//
// Colores tomados de paleta.json: energia #ff5528, aceite #c8a032, nodo #78c8ff.

registrarSketch('comparativa_energia', {
  ancho: 780,
  alto: 580,
  pista: 'misma carga, distinta energía · click o R para repetir',
}, function (p, opciones) {

  const CONFIG_BASE = {
    // Píxeles que cada pelota puede recorrer dentro del aceite antes de parar.
    // Con GROSOR=200: arriba sobra energía, abajo no alcanza.
    E_ARRIBA: 320,
    E_ABAJO: 120,
    GROSOR: 200,

    // Fluido (mismos valores afinados en energia_configurable)
    K_SPRING: 0.04,
    K_NEIGHBOR: 0.03,
    F_DAMPING: 0.93,
    PUSH_R: 25,
    PUSH_F: 18,

    // Frames que la escena se queda quieta al final antes de repetir.
    // Da tiempo a discutir el cuadro final sin tener que pausar.
    HOLD: 150,
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 780, H = 580;
  const BALL_R = 14;
  const V0 = 5;
  const OIL_X = 260;
  const X_META = W - 58;          // dónde se estaciona la que cruza
  const F_SPACING = 11;

  // Geometría de los dos carriles.
  const CARRILES = [
    { etiqueta: 'mucha energía', energia: 'E_ARRIBA', top: 68, bot: 258, bar: 274 },
    { etiqueta: 'poca energía', energia: 'E_ABAJO', top: 320, bot: 510, bar: 526 },
  ];

  let carriles = [];
  let holdTimer = 0;

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () { reset(); };

  function reset() {
    holdTimer = 0;
    carriles = CARRILES.map((def) => {
      const eBola = CONFIG[def.energia];
      const cy = (def.top + def.bot) / 2;
      const carril = {
        def,
        cy,
        eBola,
        // Desaceleración constante que hace parar la bola justo a los
        // eBola px de recorrido dentro del aceite:  DRAG = V0² / (2·E)
        drag: (V0 * V0) / (2 * eBola),
        ball: { x: 40, v: V0 },
        trail: [],
        fase: 'antes',          // antes | dentro | despues | atascada | llego
        recorrido: 0,
        grid: [],
        particulas: [],
        cols: 0,
        rows: 0,
      };
      initFluido(carril);
      return carril;
    });
  }

  function initFluido(c) {
    c.cols = Math.max(2, Math.floor(CONFIG.GROSOR / F_SPACING) + 1);
    c.rows = Math.floor((c.def.bot - c.def.top) / F_SPACING) + 1;
    const ox = OIL_X + (CONFIG.GROSOR - (c.cols - 1) * F_SPACING) / 2;
    const oy = c.def.top + ((c.def.bot - c.def.top) - (c.rows - 1) * F_SPACING) / 2;
    c.grid = [];
    c.particulas = [];
    for (let r = 0; r < c.rows; r++) {
      c.grid[r] = [];
      for (let col = 0; col < c.cols; col++) {
        const rx = ox + col * F_SPACING;
        const ry = oy + r * F_SPACING;
        const pt = { x: rx, y: ry, rx, ry, vx: 0, vy: 0 };
        c.grid[r][col] = pt;
        c.particulas.push(pt);
      }
    }
  }

  p.draw = function () {
    p.background(13, 13, 26);
    dibujarZonas();

    for (const c of carriles) {
      actualizarBola(c);
      actualizarFluido(c);
      dibujarAceite(c);
      dibujarEstela(c);
      dibujarFluido(c);
      dibujarBola(c);
      dibujarBarra(c);
      dibujarEtiquetaCarril(c);
    }

    dibujarLeyenda();

    // Repetir solo cuando AMBOS carriles terminaron: el ciclo se mantiene
    // sincronizado indefinidamente.
    if (carriles.every((c) => c.fase === 'atascada' || c.fase === 'llego')) {
      if (++holdTimer > CONFIG.HOLD) reset();
    }
  };

  // ── Física de la pelota ───────────────────────────────────────
  // Fuera del aceite: velocidad constante. Dentro: desaceleración constante.
  // La pelota NO desaparece nunca; si se queda sin energía se queda quieta
  // donde llegó, que es justo lo que hay que poder señalar en clase.

  function actualizarBola(c) {
    if (c.fase === 'atascada' || c.fase === 'llego') return;

    const oilDer = OIL_X + CONFIG.GROSOR;
    if (c.ball.x >= OIL_X && c.fase === 'antes') c.fase = 'dentro';
    if (c.ball.x >= oilDer && c.fase === 'dentro') c.fase = 'despues';

    if (c.fase === 'dentro') {
      c.ball.v = Math.max(0, c.ball.v - c.drag);
      c.recorrido += c.ball.v;
      if (c.ball.v === 0) { c.fase = 'atascada'; return; }
    }

    c.ball.x += c.ball.v;
    c.trail.push({ x: c.ball.x });
    if (c.trail.length > 35) c.trail.shift();

    if (c.ball.x >= X_META) { c.ball.x = X_META; c.fase = 'llego'; }
  }

  // ── Fluido (lattice de resortes, igual que energia_configurable) ──
  function actualizarFluido(c) {
    for (let r = 0; r < c.rows; r++) {
      for (let col = 0; col < c.cols; col++) {
        const pt = c.grid[r][col];
        let fx = -CONFIG.K_SPRING * (pt.x - pt.rx);
        let fy = -CONFIG.K_SPRING * (pt.y - pt.ry);

        const vecinos = [[r - 1, col], [r + 1, col], [r, col - 1], [r, col + 1]];
        for (const [nr, nc] of vecinos) {
          if (nr < 0 || nr >= c.rows || nc < 0 || nc >= c.cols) continue;
          const nb = c.grid[nr][nc];
          fx -= CONFIG.K_NEIGHBOR * ((pt.x - nb.x) - (pt.rx - nb.rx));
          fy -= CONFIG.K_NEIGHBOR * ((pt.y - nb.y) - (pt.ry - nb.ry));
        }

        const dx = pt.x - c.ball.x;
        const dy = pt.y - c.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.PUSH_R && dist > 0.1) {
          const mag = CONFIG.PUSH_F * Math.pow(1 - dist / CONFIG.PUSH_R, 1.5);
          fx += (dx / dist) * mag;
          fy += (dy / dist) * mag;
        }

        pt.vx = (pt.vx + fx) * CONFIG.F_DAMPING;
        pt.vy = (pt.vy + fy) * CONFIG.F_DAMPING;
        pt.x += pt.vx;
        pt.y += pt.vy;
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────

  function dibujarZonas() {
    const oilDer = OIL_X + CONFIG.GROSOR;
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textSize(13);
    p.fill(120, 200, 255, 180);
    p.text('A', OIL_X / 2, 48);
    p.text('B', oilDer + (W - oilDer) / 2, 48);

    // Fronteras del aceite, comunes a los dos carriles: dejan ver que el
    // obstáculo es idéntico y lo único distinto es la energía.
    p.stroke(80, 80, 120, 50);
    p.strokeWeight(1);
    p.line(OIL_X, 30, OIL_X, H - 40);
    p.line(oilDer, 30, oilDer, H - 40);

    // Separador entre carriles
    p.stroke(80, 80, 120, 28);
    p.line(20, 294, W - 20, 294);
  }

  function dibujarAceite(c) {
    p.noStroke();
    p.fill(120, 85, 10, 25);
    p.rect(OIL_X, c.def.top, CONFIG.GROSOR, c.def.bot - c.def.top);
    p.stroke(200, 160, 50, 70);
    p.strokeWeight(1.5);
    p.noFill();
    p.rect(OIL_X, c.def.top, CONFIG.GROSOR, c.def.bot - c.def.top, 3);
  }

  function dibujarFluido(c) {
    p.noStroke();
    for (const pt of c.particulas) {
      const disp = Math.sqrt((pt.x - pt.rx) ** 2 + (pt.y - pt.ry) ** 2);
      const t = Math.min(disp / 14, 1);
      const r = p.lerp(200, 255, t);
      const g = p.lerp(140, 220, t);
      const b = p.lerp(30, 90, t);
      const a = p.lerp(150, 255, t);
      if (t > 0.25) {
        p.fill(r, g, b, a * 0.18);
        p.circle(pt.x, pt.y, 14);
      }
      p.fill(r, g, b, a);
      p.circle(pt.x, pt.y, p.lerp(4.5, 7, t));
    }
  }

  function dibujarEstela(c) {
    p.noStroke();
    for (let i = 0; i < c.trail.length; i++) {
      const alpha = p.map(i, 0, c.trail.length, 0, 50);
      const r2 = p.map(i, 0, c.trail.length, 2, BALL_R * 0.7);
      p.fill(255, 120, 50, alpha);
      p.circle(c.trail[i].x, c.cy, r2 * 2);
    }
  }

  function dibujarBola(c) {
    p.noStroke();
    if (c.fase === 'atascada') {
      const pulse = 0.5 + 0.5 * Math.sin(p.frameCount * 0.06);
      p.fill(200, 60, 30, 20 + pulse * 20);
      p.circle(c.ball.x, c.cy, BALL_R * 4.5);
    } else {
      p.fill(255, 100, 40, 25);
      p.circle(c.ball.x, c.cy, BALL_R * 3.5);
    }
    // Atascada = más apagada, pero SIGUE AHÍ. La carga no se consumió.
    p.fill(c.fase === 'atascada' ? 170 : 255, 85, 40);
    p.circle(c.ball.x, c.cy, BALL_R * 2);
    p.fill(255, 200, 150, c.fase === 'atascada' ? 90 : 200);
    p.circle(c.ball.x - BALL_R * 0.28, c.cy - BALL_R * 0.28, BALL_R * 0.55);

    if (c.fase === 'atascada') {
      etiquetaSobreFondo('se quedó sin energía', c.ball.x, c.cy - BALL_R - 16,
                         [255, 85, 40]);
    } else if (c.fase === 'llego') {
      etiquetaSobreFondo('llegó', c.ball.x, c.cy - BALL_R - 16, [120, 200, 255]);
    }
  }

  // Texto con respaldo opaco: la etiqueta de "atascada" cae justo encima de
  // las partículas del aceite y sin fondo no se lee.
  function etiquetaSobreFondo(txt, x, y, color) {
    p.textAlign(p.CENTER);
    p.textSize(11);
    const w = p.textWidth(txt) + 12;
    p.noStroke();
    p.fill(13, 13, 26, 232);
    p.rect(x - w / 2, y - 11, w, 16, 3);
    p.fill(color[0], color[1], color[2], 230);
    p.text(txt, x, y);
  }

  function dibujarBarra(c) {
    const barW = 150, barH = 7;
    const barX = OIL_X + CONFIG.GROSOR / 2 - barW / 2;
    // Las dos barras contra la MISMA escala (la energía mayor). Normalizada
    // cada una a la suya, ambas arrancan llenas y no se puede predecir cuál
    // pasa, que es justo la pregunta antes de que salgan.
    const eMax = Math.max(CONFIG.E_ARRIBA, CONFIG.E_ABAJO);
    const ratio = Math.max(0, c.eBola - c.recorrido) / eMax;

    p.noStroke();
    p.fill(40, 40, 60);
    p.rect(barX, c.def.bar, barW, barH, 4);
    p.fill(p.lerp(60, 255, 1 - ratio), p.lerp(220, 80, 1 - ratio), 60);
    p.rect(barX, c.def.bar, barW * ratio, barH, 4);

    p.fill(140, 140, 165);
    p.textAlign(p.CENTER);
    p.textSize(9);
    p.text('energía restante', OIL_X + CONFIG.GROSOR / 2, c.def.bar - 4);
  }

  function dibujarEtiquetaCarril(c) {
    p.noStroke();
    p.fill(170, 170, 190);
    p.textAlign(p.LEFT);
    p.textSize(12);
    p.text(c.def.etiqueta, 18, c.def.top + 8);
  }

  // La frase que evita la idea equivocada: no llegó porque nadie la empuja,
  // no porque la carga "se gaste". La escena 3 introduce la fuente.
  function dibujarLeyenda() {
    p.noStroke();
    p.fill(110, 110, 135);
    p.textAlign(p.CENTER);
    p.textSize(11);
    p.text('un solo disparo · nadie las sigue empujando', W / 2, H - 14);
  }
});

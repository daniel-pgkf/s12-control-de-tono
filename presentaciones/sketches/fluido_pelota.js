// Generado por extraer.py desde analogia-voltaje/fluido_pelota.html
// No edites este encabezado a mano; el cuerpo del sketch sí es editable.
registrarSketch('fluido_pelota', {
  ancho: 780,
  alto: 520,
  pista: 'click para reiniciar',
}, function(p, opciones) {


  // ── Fluid config ──────────────────────────────────────
  const COLS        = 14;
  const ROWS        = 14;
  const SPACING     = 8;        // px entre partículas en reposo → fluido ~104px
  const FLUID_CX    = 460;      // centro del cuadrado de fluido
  const FLUID_CY    = 260;

  // ── Physics ───────────────────────────────────────────
  const K_SPRING    = 0.04;     // rigidez del resorte de retorno al equilibrio
  const K_NEIGHBOR  = 0.035;    // acoplamiento entre partículas vecinas (propagación de ondas)
  const DAMPING     = 0.93;     // amortiguación de velocidad (< 1)
  const PUSH_RADIUS = 40;       // radio de influencia de la pelota
  const PUSH_FORCE  = 13;       // fuerza de empuje máxima

  // ── Ball config ───────────────────────────────────────
  const BALL_R      = 35;       // diámetro 70px → fluido 104px ≈ 1.5×
  const BALL_SPEED  = 2.8;
  const BALL_Y      = FLUID_CY;

  // ── State ─────────────────────────────────────────────
  let particles = [];   // lista plana para dibujar
  let grid = [];        // grid[r][c] para acceder a vecinos
  let ball = {};
  let trail = [];

  // ─────────────────────────────────────────────────────
  p.setup = function() {
    let cnv = p.createCanvas(780, 520);
    cnv.parent(opciones.contenedor);
    p.colorMode(p.RGB);
    initFluid();
    resetBall();
  };

  function initFluid() {
    particles = [];
    grid = [];
    let ox = FLUID_CX - (COLS - 1) * SPACING / 2;
    let oy = FLUID_CY - (ROWS - 1) * SPACING / 2;
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        let rx = ox + c * SPACING;
        let ry = oy + r * SPACING;
        let pt = { x: rx, y: ry, rx, ry, vx: 0, vy: 0 };
        grid[r][c] = pt;
        particles.push(pt);
      }
    }
  }

  function resetBall() {
    ball = { x: -BALL_R - 10, y: BALL_Y };
    trail = [];
  }

  // ─────────────────────────────────────────────────────
  p.draw = function() {
    p.background(13, 13, 26);

    updateBall();
    updateParticles();

    drawTrail();
    drawFluid();
    drawBall();
  };

  // ── Ball ─────────────────────────────────────────────
  function updateBall() {
    ball.x += BALL_SPEED;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 28) trail.shift();
    if (ball.x > p.width + BALL_R + 20) resetBall();
  }

  function drawTrail() {
    p.noFill();
    for (let i = 0; i < trail.length; i++) {
      let alpha = p.map(i, 0, trail.length, 0, 60);
      let r2    = p.map(i, 0, trail.length, 2, BALL_R * 0.8);
      p.fill(255, 120, 60, alpha);
      p.noStroke();
      p.circle(trail[i].x, trail[i].y, r2 * 2);
    }
  }

  function drawBall() {
    // halo exterior suave
    p.noStroke();
    p.fill(255, 100, 50, 30);
    p.circle(ball.x, ball.y, BALL_R * 3.8);
    // cuerpo
    p.fill(255, 90, 45);
    p.circle(ball.x, ball.y, BALL_R * 2);
    // brillo
    p.fill(255, 200, 160, 180);
    p.circle(ball.x - BALL_R * 0.3, ball.y - BALL_R * 0.3, BALL_R * 0.6);
  }

  // ── Fluid ─────────────────────────────────────────────
  function updateParticles() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let pt = grid[r][c];

        // resorte de retorno al equilibrio
        let fx = -K_SPRING * (pt.x - pt.rx);
        let fy = -K_SPRING * (pt.y - pt.ry);

        // acoplamiento con vecinos (4-conectado) → propaga ondas al borde
        const nbCoords = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
        for (let [nr, nc] of nbCoords) {
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          let nb = grid[nr][nc];
          // elongación del resorte respecto a distancia de reposo
          fx -= K_NEIGHBOR * ((pt.x - nb.x) - (pt.rx - nb.rx));
          fy -= K_NEIGHBOR * ((pt.y - nb.y) - (pt.ry - nb.ry));
        }

        // empuje radial desde la pelota
        let dx   = pt.x - ball.x;
        let dy   = pt.y - ball.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PUSH_RADIUS && dist > 0.1) {
          let mag = PUSH_FORCE * Math.pow(1 - dist / PUSH_RADIUS, 1.5);
          fx += (dx / dist) * mag;
          fy += (dy / dist) * mag;
        }

        pt.vx = (pt.vx + fx) * DAMPING;
        pt.vy = (pt.vy + fy) * DAMPING;
        pt.x += pt.vx;
        pt.y += pt.vy;
      }
    }
  }

  function drawFluid() {
    p.noStroke();
    for (let pt of particles) {
      let disp = Math.sqrt((pt.x - pt.rx) ** 2 + (pt.y - pt.ry) ** 2);
      let t    = Math.min(disp / 22, 1);

      // reposo: azul frío / perturbado: cian brillante
      let r = p.lerp(30,  180, t);
      let g = p.lerp(100, 230, t);
      let b = p.lerp(210, 255, t);
      let a = p.lerp(170, 255, t);

      // halo cuando muy perturbado
      if (t > 0.35) {
        p.fill(r, g, b, a * 0.25);
        p.circle(pt.x, pt.y, 14);
      }

      p.fill(r, g, b, a);
      p.circle(pt.x, pt.y, p.lerp(5.5, 7.5, t));
    }
  }

  // ── Reiniciar con click ───────────────────────────────
  p.mousePressed = function() {
    initFluid();
    resetBall();
  };
});

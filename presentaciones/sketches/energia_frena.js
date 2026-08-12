// Generado por extraer.py desde analogia-voltaje/energia_frena.html
// No edites este encabezado a mano; el cuerpo del sketch sí es editable.
registrarSketch('energia_frena', {
  ancho: 750,
  alto: 320,
  pista: 'modelo energético · la bola no tiene energía suficiente · click para reiniciar',
}, function(p, opciones) {


  const W          = 750;
  const H          = 320;
  const BALL_R     = 16;
  const BALL_Y     = H / 2 + 10;

  // bloque de aceite
  const OIL_X      = 270;
  const OIL_W      = 210;
  const OIL_TOP    = 80;
  const OIL_BOT    = H - 60;

  // física de la pelota
  const V0         = 2.8;
  const DRAG       = 0.019;

  // física del fluido
  const F_COLS     = 19;
  const F_ROWS     = 15;
  const F_SPACING  = 11;
  const K_SPRING   = 0.04;
  const K_NEIGHBOR = 0.03;
  const F_DAMPING  = 0.92;
  const PUSH_R     = 48;
  const PUSH_F     = 18;

  let ball = {}, trail = [];
  let phase = 'before';
  let stopTimer = 0;
  let fParticles = [], fGrid = [];

  p.setup = function() {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  function reset() {
    ball      = { x: 40, v: V0 };
    trail     = [];
    phase     = 'before';
    stopTimer = 0;
    initFluid();
  }

  function initFluid() {
    fParticles = [];
    fGrid      = [];
    let ox = OIL_X + (OIL_W - (F_COLS - 1) * F_SPACING) / 2;
    let oy = OIL_TOP + ((OIL_BOT - OIL_TOP) - (F_ROWS - 1) * F_SPACING) / 2;
    for (let r = 0; r < F_ROWS; r++) {
      fGrid[r] = [];
      for (let c = 0; c < F_COLS; c++) {
        let rx = ox + c * F_SPACING;
        let ry = oy + r * F_SPACING;
        let pt = { x: rx, y: ry, rx, ry, vx: 0, vy: 0 };
        fGrid[r][c] = pt;
        fParticles.push(pt);
      }
    }
  }

  p.draw = function() {
    p.background(13, 13, 26);
    drawOilBg();
    drawZoneLabels();
    updateBall();
    updateFluid();
    drawTrail();
    drawFluid();
    drawBall();
    drawSpeedBar();
    if (phase === 'stopped') drawStoppedLabel();
  };

  // ── Pelota ────────────────────────────────────────────
  function updateBall() {
    if (ball.x >= OIL_X && phase === 'before') phase = 'inside';

    if (phase === 'inside') {
      ball.v = Math.max(0, ball.v - DRAG);
      if (ball.v === 0) phase = 'stopped';
    }

    if (phase !== 'stopped') {
      ball.x += ball.v;
      trail.push({ x: ball.x });
      if (trail.length > 35) trail.shift();
    } else {
      stopTimer++;
      if (stopTimer > 150) reset();
    }
  }

  function drawTrail() {
    p.noStroke();
    for (let i = 0; i < trail.length; i++) {
      let alpha = p.map(i, 0, trail.length, 0, 45);
      let r2    = p.map(i, 0, trail.length, 2, BALL_R * 0.7);
      p.fill(255, 120, 50, alpha);
      p.circle(trail[i].x, BALL_Y, r2 * 2);
    }
  }

  function drawBall() {
    p.noStroke();
    if (phase === 'stopped') {
      let pulse = 0.5 + 0.5 * Math.sin(p.frameCount * 0.06);
      p.fill(200, 60, 30, 20 + pulse * 20);
      p.circle(ball.x, BALL_Y, BALL_R * 4.5);
    } else {
      p.fill(255, 100, 40, 25);
      p.circle(ball.x, BALL_Y, BALL_R * 3.5);
    }
    let bright = phase === 'stopped' ? 160 : 255;
    p.fill(bright, 75, 35);
    p.circle(ball.x, BALL_Y, BALL_R * 2);
    p.fill(255, 200, 150, phase === 'stopped' ? 80 : 200);
    p.circle(ball.x - BALL_R * 0.28, BALL_Y - BALL_R * 0.28, BALL_R * 0.55);
  }

  function drawStoppedLabel() {
    let alpha = Math.min(255, (stopTimer - 10) * 8);
    p.noStroke();
    p.fill(255, 80, 60, alpha);
    p.textAlign(p.CENTER);
    p.textSize(12);
    p.text('sin energía suficiente', ball.x, BALL_Y - BALL_R - 14);
  }

  // ── Fluido ────────────────────────────────────────────
  function updateFluid() {
    for (let r = 0; r < F_ROWS; r++) {
      for (let c = 0; c < F_COLS; c++) {
        let pt = fGrid[r][c];

        let fx = -K_SPRING * (pt.x - pt.rx);
        let fy = -K_SPRING * (pt.y - pt.ry);

        const nb4 = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
        for (let [nr, nc] of nb4) {
          if (nr < 0 || nr >= F_ROWS || nc < 0 || nc >= F_COLS) continue;
          let nb = fGrid[nr][nc];
          fx -= K_NEIGHBOR * ((pt.x - nb.x) - (pt.rx - nb.rx));
          fy -= K_NEIGHBOR * ((pt.y - nb.y) - (pt.ry - nb.ry));
        }

        // solo empujar si la pelota se está moviendo (no presionar estando quieta)
        if (phase !== 'stopped' || stopTimer < 5) {
          let dx = pt.x - ball.x, dy = pt.y - BALL_Y;
          let dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < PUSH_R && dist > 0.1) {
            let mag = PUSH_F * Math.pow(1 - dist / PUSH_R, 1.5);
            fx += (dx / dist) * mag;
            fy += (dy / dist) * mag;
          }
        }

        pt.vx = (pt.vx + fx) * F_DAMPING;
        pt.vy = (pt.vy + fy) * F_DAMPING;
        pt.x += pt.vx;
        pt.y += pt.vy;
      }
    }
  }

  function drawFluid() {
    p.noStroke();
    for (let pt of fParticles) {
      let disp = Math.sqrt((pt.x-pt.rx)**2 + (pt.y-pt.ry)**2);
      let t    = Math.min(disp / 18, 1);
      let r    = p.lerp(200, 255, t);
      let g    = p.lerp(140, 220, t);
      let b    = p.lerp(30,  80,  t);
      let a    = p.lerp(150, 255, t);
      if (t > 0.3) {
        p.fill(r, g, b, a * 0.2);
        p.circle(pt.x, pt.y, 13);
      }
      p.fill(r, g, b, a);
      p.circle(pt.x, pt.y, p.lerp(4.5, 6.5, t));
    }
  }

  // ── UI ────────────────────────────────────────────────
  function drawOilBg() {
    p.noStroke();
    p.fill(120, 85, 10, 25);
    p.rect(OIL_X, OIL_TOP, OIL_W, OIL_BOT - OIL_TOP);
    p.stroke(200, 160, 50, 70);
    p.strokeWeight(1.5);
    p.noFill();
    p.rect(OIL_X, OIL_TOP, OIL_W, OIL_BOT - OIL_TOP, 3);
    p.noStroke();
    p.fill(200, 160, 50, 130);
    p.textAlign(p.CENTER);
    p.textSize(11);
    p.text('aceite', OIL_X + OIL_W / 2, OIL_TOP - 10);
  }

  function drawZoneLabels() {
    p.textAlign(p.CENTER);
    p.textSize(13);
    p.noStroke();
    p.fill(120, 200, 255, 180);
    p.text('A', OIL_X / 2, OIL_TOP - 10);
    p.fill(120, 200, 255, 60);
    p.text('B', OIL_X + OIL_W + (W - OIL_X - OIL_W) / 2, OIL_TOP - 10);
    p.stroke(80, 80, 120, 50);
    p.strokeWeight(1);
    p.line(OIL_X,          OIL_TOP - 30, OIL_X,          OIL_BOT + 20);
    p.line(OIL_X + OIL_W,  OIL_TOP - 30, OIL_X + OIL_W,  OIL_BOT + 20);
  }

  function drawSpeedBar() {
    let barW = 160, barH = 8;
    let barX = W / 2 - barW / 2, barY = H - 28;
    let ratio = ball.v / V0;
    p.noStroke();
    p.fill(40, 40, 60);
    p.rect(barX, barY, barW, barH, 4);
    let r = p.lerp(60, 255, 1 - ratio);
    let g = p.lerp(220, 80, 1 - ratio);
    p.fill(r, g, 60);
    p.rect(barX, barY, barW * Math.max(ratio, 0), barH, 4);
    p.fill(160, 160, 180);
    p.textAlign(p.CENTER);
    p.textSize(10);
    p.text('velocidad', W / 2, barY - 5);
  }

  p.mousePressed = function() { reset(); };
});

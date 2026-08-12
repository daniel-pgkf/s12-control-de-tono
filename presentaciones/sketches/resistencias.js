// Biblioteca de resistencias, compartida por el modelo circuital y el energético.
//
// Tres tipos ordenados de menos a más resistente. Cuánto más resistente es cada
// uno lo dice su `factor`, y de ahí se derivan la retención de velocidad (modelo
// circuital) y el gasto de energía (modelo energético). No se escribe a mano en
// cada campo: así cambiar un factor cambia el comportamiento de golpe en las dos
// escenas, sin que puedan quedar desincronizadas.
//
// La mayor resistencia se evidencia por tres vías simultáneas:
//   1. COLOR      naranja claro (leve) → naranja oscuro (fuerte)
//   2. DENSIDAD   menos separación entre partículas = medio más apretado
//   3. ELASTICIDAD  la leve ondea con olas amplias y lentas; la fuerte apenas
//                   cede y vuelve de golpe (más rígida = cuesta más pasar)
//
// Uso:
//   const r = crearResistencia(p, 'media', x, y, w, h);
//   r.actualizar(pelotas);                        // el fluido reacciona
//   r.dibujar();
//   if (r.contiene(b.x, b.y)) v *= r.retencion;   // frena el avance propio
//   if (r.contiene(b.x, b.y)) r.frenar(b);        // frena la caída, en 2 ejes

const RESISTENCIAS = {
  leve: {
    nombre: 'leve',
    factor: 1,
    color: [250, 186, 110],     // naranja claro
    espaciado: 16,              // poca densidad
    kSpring: 0.015,             // blanda: se deforma mucho
    kNeighbor: 0.018,
    damping: 0.960,             // la onda tarda en calmarse
    empujeR: 30,
    empujeF: 20,
  },
  media: {
    nombre: 'media',
    factor: 1.4,
    color: [214, 141, 58],
    espaciado: 11,
    kSpring: 0.020,
    kNeighbor: 0.032,
    damping: 0.930,
    empujeR: 26,
    empujeF: 15,
  },
  fuerte: {
    nombre: 'fuerte',
    factor: 3,
    color: [156, 92, 28],       // naranja oscuro
    espaciado: 8,               // muy densa
    kSpring: 0.035,             // rígida: apenas cede
    kNeighbor: 0.025,
    damping: 0.880,             // vuelve de golpe
    empujeR: 22,
    empujeF: 10,
  },
};

// Fracción de velocidad que conserva una carga DENTRO de la resistencia leve.
// Las demás se derivan dividiendo por su `factor`: "el triple de resistente"
// significa literalmente "un tercio de la velocidad".
//
// Subirla acelera las cargas dentro de LOS TRES tipos a la vez y conserva las
// proporciones entre ellos. Con los factores actuales (1 · 1.5 · 3):
//   0.75 → leve 0.750 · media 0.500 · fuerte 0.250
const RETENCION_BASE = 0.75;

function retencionDe(tipo) {
  return RETENCION_BASE / RESISTENCIAS[tipo].factor;
}

// Amortiguación por frame que sufre un cuerpo que se HUNDE en el medio, en
// cualquier dirección. Sin esto el bloque solo se oponía al avance horizontal:
// una bala sin energía caía a plomo atravesándolo como si fuera aire, que es
// justo lo que un medio viscoso no hace.
//
// Se deriva del factor, así que un medio más resistivo frena más la caída. Con
// gravedad g, la velocidad límite dentro del medio queda en g/viscosidad.
const VISCOSIDAD_BASE = 0.022;

function viscosidadDe(tipo) {
  return Math.min(0.14, VISCOSIDAD_BASE * RESISTENCIAS[tipo].factor);
}

/**
 * Crea una resistencia dibujable y simulable en el rectángulo dado.
 */
function crearResistencia(p, tipo, x, y, w, h) {
  const def = RESISTENCIAS[tipo];
  if (!def) throw new Error(`Tipo de resistencia desconocido: ${tipo}`);

  const cols = Math.max(2, Math.floor(w / def.espaciado) + 1);
  const rows = Math.max(2, Math.floor(h / def.espaciado) + 1);
  const ox = x + (w - (cols - 1) * def.espaciado) / 2;
  const oy = y + (h - (rows - 1) * def.espaciado) / 2;

  const grid = [];
  const particulas = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const rx = ox + c * def.espaciado, ry = oy + r * def.espaciado;
      const pt = { x: rx, y: ry, rx, ry, vx: 0, vy: 0 };
      grid[r][c] = pt;
      particulas.push(pt);
    }
  }

  // El tamaño del punto acompaña a la densidad: si no, la fuerte se ve como una
  // mancha sólida y se pierde la sensación de medio granular.
  const radioPunto = Math.max(2.6, def.espaciado * 0.38);

  // Cuánto puede alejarse una partícula de su posición de reposo.
  const maxDesplazamiento = def.espaciado * 1.15;

  return {
    tipo,
    def,
    x, y, w, h,
    retencion: retencionDe(tipo),
    viscosidad: viscosidadDe(tipo),

    // Se exponen para que una escena pueda tomarlas y llevarlas a otro sitio
    // (p. ej. la transformación al esquemático, donde las pepitas se juntan
    // para formar el zigzag). Mientras alguien las mueva por fuera, no llames
    // a actualizar(): los resortes pelearían contra el morph.
    particulas,

    /**
     * Frena un cuerpo que se mueve por el medio, en los dos ejes. Se aplica
     * cuando el cuerpo ya no tiene impulso propio y solo lo mueve la gravedad.
     */
    frenar(cuerpo) {
      const k = 1 - this.viscosidad;
      cuerpo.vx *= k;
      cuerpo.vy *= k;
    },

    contiene(px, py) {
      if (px < x || px > x + w) return false;
      if (py === undefined) return true;
      return py >= y && py <= y + h;
    },

    actualizar(pelotas) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pt = grid[r][c];
          let fx = -def.kSpring * (pt.x - pt.rx);
          let fy = -def.kSpring * (pt.y - pt.ry);

          const vec = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
          for (const [nr, nc] of vec) {
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const nb = grid[nr][nc];
            fx -= def.kNeighbor * ((pt.x - nb.x) - (pt.rx - nb.rx));
            fy -= def.kNeighbor * ((pt.y - nb.y) - (pt.ry - nb.ry));
          }

          for (const b of pelotas) {
            const dx = pt.x - b.x, dy = pt.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < def.empujeR && dist > 0.1) {
              const mag = def.empujeF * Math.pow(1 - dist / def.empujeR, 1.5);
              fx += (dx / dist) * mag;
              fy += (dy / dist) * mag;
            }
          }

          pt.vx = (pt.vx + fx) * def.damping;
          pt.vy = (pt.vy + fy) * def.damping;
          pt.x += pt.vx;
          pt.y += pt.vy;

          // Tope de desplazamiento: sin él la resistencia leve, por ser blanda,
          // lanza partículas fuera del bloque y el borde deja de leerse. Se
          // limita el alejamiento del reposo, no la elasticidad: las olas
          // amplias se conservan, solo no se desbordan.
          const dx = pt.x - pt.rx, dy = pt.y - pt.ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > maxDesplazamiento) {
            const k = maxDesplazamiento / d;
            pt.x = pt.rx + dx * k;
            pt.y = pt.ry + dy * k;
            pt.vx *= 0.5;
            pt.vy *= 0.5;
          }
        }
      }
    },

    dibujarFondo() {
      const [cr, cg, cb] = def.color;
      p.noStroke();
      p.fill(cr, cg, cb, 16);
      p.rect(x, y, w, h, 6);
      p.noFill();
      p.stroke(cr, cg, cb, 120);
      p.strokeWeight(1.8);
      p.rect(x, y, w, h, 6);
      p.noStroke();
    },

    dibujarParticulas() {
      const [cr, cg, cb] = def.color;
      p.noStroke();
      for (const pt of particulas) {
        const disp = Math.sqrt((pt.x - pt.rx) ** 2 + (pt.y - pt.ry) ** 2);
        const t = Math.min(disp / 14, 1);
        const r = p.lerp(cr, 255, t * 0.75);
        const g = p.lerp(cg, 220, t * 0.75);
        const b = p.lerp(cb, 120, t * 0.75);
        const a = p.lerp(150, 250, t);
        if (t > 0.25) { p.fill(r, g, b, a * 0.18); p.circle(pt.x, pt.y, radioPunto * 3); }
        p.fill(r, g, b, a);
        p.circle(pt.x, pt.y, p.lerp(radioPunto, radioPunto * 1.45, t));
      }
    },

    dibujar() {
      this.dibujarFondo();
      this.dibujarParticulas();
    },
  };
}
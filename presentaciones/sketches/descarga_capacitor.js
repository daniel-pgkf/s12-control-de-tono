// Descarga de un capacitor: el capacitor YA está cargado (viene de
// carga_capacitor) y se le conecta una resistencia en paralelo, a través de
// un interruptor propio. Al cerrarlo, las cargas de la placa se van por esa
// resistencia nueva — no hay fuente en este lazo, solo el capacitor
// devolviendo lo que tenía guardado.
//
// La lógica es la misma que en carga_capacitor, pero AL REVÉS:
//   - Ahí las cargas NACÍAN en un cañón y se POSABAN en la placa (posadas
//     sube con el tiempo). Acá ya están todas posadas desde el principio y
//     se VAN despegando una por una (restantes baja con el tiempo).
//   - Ahí no hacía falta un "targetD" para las que llegan a la placa: viajan
//     a velocidad constante y se detienen todas en el mismo sitio. Acá pasa
//     lo mismo pero al destino contrario: todas viajan a velocidad constante
//     desde su lugar en la placa hasta disiparse en la resistencia nueva —
//     tampoco hace falta evitar que se crucen, porque la que se despega
//     después nace más atrás y nunca alcanza a la de adelante.
//   - No existe la "cola clavada en el cable" de la carga: ahí esa cola
//     salía de que la placa tiene capacidad limitada y algunas cargas no
//     llegan a tiempo. Acá TODAS las que se despegan llegan a disiparse
//     tarde o temprano — no hay límite de capacidad que las frene a mitad de
//     camino, así que el total de cargas es exactamente `capacidad`, ni una
//     más.
//   - El voltaje que se GRAFICA (vC) sigue sin ser una física en vivo: se
//     precalcula en qué frame se despega la primera carga y en qué frame se
//     despega la última (precalcularTiempos), y entre esos dos instantes se
//     dibuja una curva cerrada en forma de V_INICIAL·(1−x)³ — empinada al
//     principio, se aplana cerca de 0, la forma de una descarga RC real.
//
// Se despegan de DERECHA a IZQUIERDA: la fila se ve completa al principio y
// se va acortando desde el extremo más lejano del nodo de salida — nunca
// hace falta reordenar nada, la última en nacer (la del extremo derecho)
// siempre es la primera en despegar.

registrarSketch('descarga_capacitor', {
  ancho: 1080,
  alto: 760,
  pista: 'menú: C resistencia · T capacitor · ESPACIO empezar (después, ESPACIO abre/cierra)',
}, function (p, opciones) {

  const CONFIG_BASE = {
    V_INICIAL: 9,   // voltaje al que arranca el capacitor — no hay fuente en este lazo

    TAU_BASE: 180,
    VELOCIDADES: { media: 2, fuerte: 4 },
    INFLA_DISPARO: 1.03,   // mismo motivo que en carga_capacitor: sin esto, la última nunca se despega del todo

    FRAMES_INTERRUPTOR: 10,
    FRAMES_CAMBIO: 34,

    TIPOS: ['media', 'fuerte'],
    TIPO_INICIAL: 'fuerte',

    TAMANOS: ['chico', 'grande'],
    TAMANO_INICIAL: 'chico',
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 1080, H = 760;
  const AMARILLO = [255, 214, 70];
  const AZUL = [120, 200, 255];
  const GRIS_HIST = [92, 96, 122];   // lazo de carga histórico: ya no conduce, solo da contexto

  const RAD_CARGA = 9, DIAM_CARGA = RAD_CARGA * 2;

  const CAPACITORES = {
    chico: { capacidad: 7 },
    grande: { capacidad: 11 },
  };

  // ── Geometría del lazo histórico (idéntica a carga_capacitor) ──────
  const TUBO_W = 56, HUECO = 30, GRUESO = 78, LARGO = 190;
  const Y_FILA = 110;
  const X_BAT = 150;
  const X_SW = 250, SW_W = 90, SW_H = 42;
  const X_CAN_A = 350;

  const R = { x: X_CAN_A + TUBO_W + HUECO, y: Y_FILA - GRUESO / 2, w: LARGO, h: GRUESO };
  const ALTO_R_HIST = GRUESO * 0.35;   // fijo: esta resistencia ya no es interactiva, solo da contexto

  const HUECO_A_CAP = 60;
  const X_M = R.x + R.w + HUECO_A_CAP + TUBO_W;

  const CAP_GAP = 120;
  const BAJADA_CAP = 90;
  const CAP = {
    x: X_M,
    yTop: Y_FILA + TUBO_W + HUECO + BAJADA_CAP,
    yBot: Y_FILA + TUBO_W + HUECO + BAJADA_CAP + CAP_GAP,
  };

  const Y_CAN_B = CAP.yBot + HUECO + TUBO_W;
  const BAT_Y = (Y_FILA + Y_CAN_B) / 2;
  const BAT_W = 108, BAT_H = 46;
  const X_TIERRA = (X_BAT + X_M) / 2 + 40;

  const NODO_A = { x: X_CAN_A - TUBO_W / 2, y: Y_FILA - 26, w: TUBO_W, h: 52 };
  const NODO_M = { x: X_M - TUBO_W / 2, y: Y_FILA - TUBO_W / 2, w: TUBO_W, h: TUBO_W };

  // ── Geometría de la rama de descarga (nueva, en paralelo al capacitor) ──
  // No sale de la placa: sale del segundo cañón (el codo en X_M, Y_FILA),
  // con un tercer pico apuntando a la derecha — el mismo nodo que ya recibe
  // de R y ya baja al capacitor gana una tercera salida. De ahí un cable
  // baja TODA la altura del lazo histórico (Y_FILA → Y_CAN_B, la misma
  // fila de tierra) y cierra ahí mismo, contra el retorno que ya existe.
  // Eléctricamente da lo mismo que salir de la placa —el tramo X_M→CAP.yTop
  // y CAP.yBot→Y_CAN_B ya conectaba esos puntos con cable ideal— pero así
  // se ve lo que se pidió: dos cuadrados de la misma altura (Y_FILA a
  // Y_CAN_B) pegados por el borde común en X_M, el de la izquierda con el
  // capacitor adentro, el de la derecha con el interruptor y la resistencia
  // nueva.
  const DESCARGA_DX = 260;
  const X_D = X_M + DESCARGA_DX;

  // Interruptor y resistencia, centrados en el tramo vertical del cuadrado
  // derecho (X_D), con el mismo hueco de cable arriba y abajo. El interruptor
  // es el MISMO tipo que el de la fuente (SW_W × SW_H), solo rotado 90° para
  // quedar sobre un tramo vertical. La resistencia mide lo mismo de LARGO
  // (R.w) que la de carga — mismo componente, mismo tamaño, en paralelo.
  const SW2_LARGO = SW_W, SEG_MID = 40, R2_LARGO = R.w;
  const SEG_TOP = (Y_CAN_B - Y_FILA - SW2_LARGO - SEG_MID - R2_LARGO) / 2;
  const Y_SW2_0 = Y_FILA + SEG_TOP;
  const Y_SW2_1 = Y_SW2_0 + SW2_LARGO;
  const Y_R2_0 = Y_SW2_1 + SEG_MID;
  const Y_R2_1 = Y_R2_0 + R2_LARGO;

  const CANAL2_MAX = GRUESO * 0.55, CANAL2_MIN = GRUESO * 0.16;

  // ── Geometría de la gráfica ──────────────────────────────────────
  const GX0 = 120, GX1 = 970, GY_TOP = 520, GY_BOT = 700;
  const GW = GX1 - GX0, GH = GY_BOT - GY_TOP;

  // ── Carátula ─────────────────────────────────────────────────────
  //   'estatico'      circuito RC ya cargado — batería, R histórica, placa
  //                   llena. Todavía sin la rama de descarga. Espera tecla.
  //   'abriendo'      los dos cables horizontales crecen desde el capacitor
  //                   hacia donde va a quedar la resistencia nueva.
  //   'montando'      el interruptor y la resistencia de descarga aparecen.
  //   'pausa'         todo quieto, ya armado.
  //   'desvaneciendo' cruce hacia el menú.
  const F_ABRIENDO = 95, F_MONTANDO = 60, F_PAUSA = 40, F_DESVANECE = 40;
  let enCaratula = true;
  let faseCaratula = 'estatico';
  let caratulaT = 0;

  function conexionProgreso() {
    if (faseCaratula === 'estatico') return 0;
    if (faseCaratula === 'abriendo') return Math.min(1, caratulaT / F_ABRIENDO);
    return 1;
  }
  function montajeProgreso() {
    if (faseCaratula === 'montando') return Math.min(1, caratulaT / F_MONTANDO);
    if (faseCaratula === 'pausa' || faseCaratula === 'desvaneciendo') return 1;
    return 0;
  }
  function desvanecerProgreso() {
    return faseCaratula === 'desvaneciendo' ? Math.min(1, caratulaT / F_DESVANECE) : 0;
  }

  // ── Estado ────────────────────────────────────────────────────────
  let enMenu = false;
  let cerrado = false;       // ESPACIO — interruptor de descarga
  let interruptor = 0;
  let refCarga = 0;
  let vC = 0;
  let tGraf = 0;
  let historia = [];
  let ventanaGraf = 1;

  let iTipo = 0;
  let alturaDesde = CANAL2_MAX, cambioTR = 1;
  let iTamano = 0;
  let anchoDesde = anchoCap('chico'), cambioTC = 1;
  let cargas = [], acumSalida = 0, salidaIndex = 0;
  let corrienteActiva = false;
  let tPrimeraPred = null, tUltimaPred = null;

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  p.mousePressed = function () {
    if (enCaratula) {
      if (faseCaratula === 'estatico') { faseCaratula = 'abriendo'; caratulaT = 0; }
      else { saltarCaratula(); }
      return;
    }
    reset();
  };

  function saltarCaratula() {
    enCaratula = false;
    enMenu = true;
  }

  function reset() {
    enMenu = !enCaratula; cerrado = false; interruptor = 0;
    refCarga = 0; vC = CONFIG.V_INICIAL; tGraf = 0; historia = [{ t: 0, vC: CONFIG.V_INICIAL }];
    cargas = []; acumSalida = 0; salidaIndex = 0; corrienteActiva = false;
    tPrimeraPred = null; tUltimaPred = null;
    iTipo = Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.TIPO_INICIAL));
    cambioTR = 1;
    alturaDesde = alturaCanal2(CONFIG.TIPOS[iTipo]);
    iTamano = Math.max(0, CONFIG.TAMANOS.indexOf(CONFIG.TAMANO_INICIAL));
    cambioTC = 1;
    anchoDesde = anchoCap(CONFIG.TAMANOS[iTamano]);
  }

  function factorCapacitor(tamano) {
    const capacidades = CONFIG.TAMANOS.map((t) => CAPACITORES[t].capacidad);
    return CAPACITORES[tamano].capacidad / Math.min(...capacidades);
  }

  function tauActual() {
    return CONFIG.TAU_BASE * RESISTENCIAS[CONFIG.TIPOS[iTipo]].factor
      * factorCapacitor(CONFIG.TAMANOS[iTamano]);
  }

  function velocidadActual() {
    return CONFIG.VELOCIDADES[CONFIG.TIPOS[iTipo]];
  }

  function cargasTotalesActual() {
    return CAPACITORES[CONFIG.TAMANOS[iTamano]].capacidad;
  }

  // Corre la MISMA cuenta que actualizarCargas —despegue con inRef, viaje a
  // velocidad fija— de una sola vez, sin dibujar nada. En qué frame se
  // despega la primera carga y en qué frame la última son los dos instantes
  // fijos entre los que se dibuja la curva de vC (ver vCEnCurva) — así no
  // hay nada que perseguir en vivo, ni rizado posible.
  //
  // Acepta tipo/tamaño explícitos (en vez de leer iTipo/iTamano) para poder
  // correrla sobre CUALQUIER combinación sin tocar la selección actual —ver
  // VENTANA_FIJA, que la corre una vez por cada combinación posible para
  // encontrar la más lenta.
  function precalcularTiempos(tipo = CONFIG.TIPOS[iTipo], tamano = CONFIG.TAMANOS[iTamano]) {
    const capacidad = CAPACITORES[tamano].capacidad;
    const tau = CONFIG.TAU_BASE * RESISTENCIAS[tipo].factor * factorCapacitor(tamano);
    let refC = 0, acumS = 0, salidos = 0;
    let tPrimera = null, tUltima = null;
    const MAX_FRAMES = 20000;
    for (let f = 0; f < MAX_FRAMES; f++) {
      refC += (1 - refC) / tau;
      const ref = Math.max(0, 1 - refC);
      if (salidos < capacidad) {
        acumS += (ref * capacidad * CONFIG.INFLA_DISPARO) / tau;
        if (acumS >= 1) {
          acumS -= 1;
          if (tPrimera === null) tPrimera = f + 1;
          salidos++;
          if (salidos === capacidad) tUltima = f + 1;
        }
      }
      if (tUltima !== null) break;
    }
    return { tPrimera: tPrimera ?? 0, tUltima: tUltima ?? (tPrimera ?? 0) + tau * 4 };
  }

  // Antes la ventana del eje X se recalculaba PARA CADA combinación, así que
  // cualquier corrida —lenta o rápida— terminaba llenando el mismo 91% del
  // ancho: la relación entre R, C y la velocidad de la caída quedaba oculta,
  // porque la escala se estiraba o encogía para disimularla. Con una ventana
  // FIJA (la más lenta de las cuatro combinaciones posibles, con margen) esa
  // relación se ve directo: fuerte+grande deja la curva arriba mucho más
  // tiempo dentro de la misma ventana que media+chico, que aplana temprano y
  // deja el resto del eje plano — la comparación es visual, sin números.
  const VENTANA_FIJA = (function () {
    let maxUltima = 0;
    for (const tipo of CONFIG.TIPOS) {
      for (const tamano of CONFIG.TAMANOS) {
        maxUltima = Math.max(maxUltima, precalcularTiempos(tipo, tamano).tUltima);
      }
    }
    return Math.ceil(maxUltima * 1.1);
  })();

  function alturaCanal2(tipo) {
    const factores = CONFIG.TIPOS.map((t) => RESISTENCIAS[t].factor);
    const fMin = Math.min(...factores), fMax = Math.max(...factores);
    const t = fMax > fMin ? (RESISTENCIAS[tipo].factor - fMin) / (fMax - fMin) : 0;
    return p.lerp(CANAL2_MAX, CANAL2_MIN, t);
  }

  function alturaCanal2Actual() {
    const objetivo = alturaCanal2(CONFIG.TIPOS[iTipo]);
    return cambioTR >= 1 ? objetivo : p.lerp(alturaDesde, objetivo, cambioTR);
  }

  function anchoCap(tamano) { return CAPACITORES[tamano].capacidad * DIAM_CARGA; }

  function anchoCapActual() {
    const objetivo = anchoCap(CONFIG.TAMANOS[iTamano]);
    return cambioTC >= 1 ? objetivo : p.lerp(anchoDesde, objetivo, cambioTC);
  }

  // ── Teclas ────────────────────────────────────────────────────────

  p.estado = function () {
    return { TIPO_INICIAL: CONFIG.TIPOS[iTipo], TAMANO_INICIAL: CONFIG.TAMANOS[iTamano] };
  };

  p.manejarTecla = function (code) {
    if (enCaratula) {
      if (faseCaratula === 'estatico') { faseCaratula = 'abriendo'; caratulaT = 0; }
      else { saltarCaratula(); }
      return true;
    }
    switch (code) {
      case 'Space':
        if (enMenu) {
          enMenu = false; cerrado = true;
          const pred = precalcularTiempos();
          tPrimeraPred = pred.tPrimera;
          tUltimaPred = pred.tUltima;
          ventanaGraf = VENTANA_FIJA;   // misma escala para las 4 combinaciones — ver VENTANA_FIJA
        } else {
          cerrado = !cerrado;
        }
        return true;
      case 'KeyC':
        if (enMenu && cambioTR >= 1) cambiarResistencia();
        return true;
      case 'KeyT':
        if (enMenu && cambioTC >= 1) cambiarTamano();
        return true;
      default:
        return false;
    }
  };

  function cambiarResistencia() {
    alturaDesde = alturaCanal2Actual();
    iTipo = (iTipo + 1) % CONFIG.TIPOS.length;
    cambioTR = 0;
  }

  function cambiarTamano() {
    anchoDesde = anchoCapActual();
    iTamano = (iTamano + 1) % CONFIG.TAMANOS.length;
    cambioTC = 0;
  }

  // ── Física: un paso de Euler por frame ──────────────────────────

  function integrando() {
    return cerrado && interruptor >= 1;
  }

  function inRef() {
    if (!integrando()) return 0;
    return Math.max(0, 1 - refCarga);
  }

  function fillFrac() { return vC / CONFIG.V_INICIAL; }

  // La curva de verdad: V_INICIAL hasta que se despega la primera carga,
  // decae entre tPrimeraPred y tUltimaPred con la forma (1−x)³ —empinada al
  // principio, se aplana cerca de 0, la pinta de una descarga RC real— y
  // llega EXACTA a 0 en tUltimaPred.
  function vCEnCurva(t) {
    if (tPrimeraPred === null || t < tPrimeraPred) return CONFIG.V_INICIAL;
    if (t >= tUltimaPred) return 0;
    const x = (t - tPrimeraPred) / (tUltimaPred - tPrimeraPred);
    return CONFIG.V_INICIAL * Math.pow(1 - x, 3);
  }

  function actualizarEstado() {
    const di = 1 / CONFIG.FRAMES_INTERRUPTOR;
    if (cerrado && interruptor < 1) interruptor = Math.min(1, interruptor + di);
    if (!cerrado && interruptor > 0) interruptor = Math.max(0, interruptor - di);

    if (cambioTR < 1) cambioTR = Math.min(1, cambioTR + 1 / CONFIG.FRAMES_CAMBIO);
    if (cambioTC < 1) cambioTC = Math.min(1, cambioTC + 1 / CONFIG.FRAMES_CAMBIO);

    if (integrando()) {
      const tau = tauActual();
      refCarga += (1 - refCarga) / tau;
      refCarga = Math.min(1, refCarga);
      if (tGraf < ventanaGraf) {
        tGraf++;
        vC = vCEnCurva(tGraf);
        historia.push({ t: tGraf, vC });
      }
    }
  }

  // ── Cargas viajando de la placa a la resistencia de descarga ──────
  // Cada una nace sabiendo su propia ruta completa (posición en la placa →
  // nodo de salida → dentro de la resistencia, donde se disipa) — no hace
  // falta un targetD compartido como en carga_capacitor porque acá no hay
  // cola ni límite de capacidad: TODAS llegan a disiparse tarde o temprano.
  // Sube por el mismo cable por el que entraron durante la carga (placa →
  // X_M,CAP.yTop → X_M,Y_FILA, el segundo cañón) y de ahí sale por el pico
  // nuevo hacia la resistencia — mismo cable, corriente al revés.
  function rutaDescarga(indice) {
    const inicio = posicionEnPlaca(indice);
    return [
      { x: inicio.x, y: inicio.y },
      { x: X_M, y: CAP.yTop },
      { x: X_M, y: Y_FILA },
      { x: X_D, y: Y_FILA },
      { x: X_D, y: Y_R2_1 },
    ];
  }

  function largoRuta(ruta) {
    return ruta.slice(1).reduce(
      (a, pt, i) => a + Math.hypot(pt.x - ruta[i].x, pt.y - ruta[i].y), 0);
  }

  function puntoEnRuta(ruta, d) {
    let resto = Math.max(0, d);
    for (let i = 1; i < ruta.length; i++) {
      const seg = Math.hypot(ruta[i].x - ruta[i - 1].x, ruta[i].y - ruta[i - 1].y);
      if (resto <= seg) {
        const t = seg > 0 ? resto / seg : 0;
        return { x: p.lerp(ruta[i - 1].x, ruta[i].x, t), y: p.lerp(ruta[i - 1].y, ruta[i].y, t) };
      }
      resto -= seg;
    }
    return ruta[ruta.length - 1];
  }

  function colorNivel(n) {
    return [p.lerp(AZUL[0], AMARILLO[0], n), p.lerp(AZUL[1], AMARILLO[1], n),
            p.lerp(AZUL[2], AMARILLO[2], n)];
  }

  // Se despegan de derecha a izquierda: la k-ésima en despegarse sale del
  // slot (capacidad-1-k), el más lejano del nodo de salida entre los que
  // quedan — así la fila se ve acortarse desde el extremo, nunca por el
  // medio, sin tener que reordenar nada.
  function actualizarCargas() {
    const ref = inRef();
    const capacidad = cargasTotalesActual();
    const generando = integrando() && salidaIndex < capacidad;
    if (generando) {
      const tau = tauActual();
      acumSalida += (ref * capacidad * CONFIG.INFLA_DISPARO) / tau;
      if (acumSalida >= 1) {
        acumSalida -= 1;
        const origen = capacidad - 1 - salidaIndex;
        const ruta = rutaDescarga(origen);
        cargas.push({ d: 0, ruta, largo: largoRuta(ruta) });
        salidaIndex++;
      }
    }

    const enMovimiento = integrando() ? 1 : 0;
    const velocidad = velocidadActual();
    const col = colorNivel(fillFrac());

    const siguen = [];
    for (const c of cargas) {
      c.d = Math.min(c.largo, c.d + enMovimiento * velocidad);
      if (c.d >= c.largo) {
        // llegó a la resistencia: se disipa, deja de existir
      } else {
        const pt = puntoEnRuta(c.ruta, c.d);
        c.x = pt.x; c.y = pt.y; c.col = col;
        siguen.push(c);
      }
    }
    cargas = siguen;

    corrienteActiva = generando || cargas.length > 0;
  }

  function restantesActual() {
    return cargasTotalesActual() - salidaIndex;
  }

  // Antes de la simulación (carátula y menú) la placa se ve SIEMPRE llena:
  // el capacitor ya está cargado, todavía no se abrió el interruptor de
  // descarga. Recién al cerrar el interruptor empieza a vaciarse de verdad.
  function posadasVisibles() {
    return (enCaratula || enMenu) ? cargasTotalesActual() : restantesActual();
  }

  function posicionEnPlaca(indice) {
    const ancho = anchoCapActual();
    return {
      x: X_M - ancho / 2 + DIAM_CARGA / 2 + indice * DIAM_CARGA,
      y: CAP.yTop - DIAM_CARGA / 2 - 2,
    };
  }

  // ── Render ────────────────────────────────────────────────────────

  p.draw = function () {
    p.background(13, 13, 26);

    if (enCaratula && faseCaratula !== 'estatico') {
      caratulaT++;
      if (faseCaratula === 'abriendo' && caratulaT > F_ABRIENDO) {
        faseCaratula = 'montando'; caratulaT = 0;
      } else if (faseCaratula === 'montando' && caratulaT > F_MONTANDO) {
        faseCaratula = 'pausa'; caratulaT = 0;
      } else if (faseCaratula === 'pausa' && caratulaT > F_PAUSA) {
        faseCaratula = 'desvaneciendo'; caratulaT = 0;
      } else if (faseCaratula === 'desvaneciendo' && caratulaT > F_DESVANECE) {
        enCaratula = false;
        enMenu = true;
      }
    }

    actualizarEstado();
    actualizarCargas();

    // Lazo histórico: batería, interruptor y resistencia de carga, siempre
    // fijos y atenuados — ya cumplieron su función, quedan como contexto.
    dibujarNodo(NODO_A, GRIS_HIST, 0.3);
    dibujarNodo(NODO_M, colorNivel(fillFrac()), 0.15 + 0.85 * fillFrac());
    dibujarCanalHistorico();
    dibujarCableCapacitor();
    dibujarPlacas();
    dibujarPosadas();
    if (!enCaratula) etiquetaCapacitor();
    dibujarRetorno();
    dibujarTierra();
    dibujarTubo(X_CAN_A, Y_FILA, 0);
    dibujarTubo(X_M, Y_FILA, Math.PI);
    dibujarTubo(X_M, Y_FILA, Math.PI / 2);
    dibujarBateriaFija();
    dibujarInterruptorFijo();

    // Rama de descarga: animada durante la carátula, fija después.
    if (enCaratula) {
      dibujarRamaDescarga(conexionProgreso(), montajeProgreso());
    } else {
      dibujarRamaDescarga(1, 1);
      etiquetaBajoR2();
    }

    dibujarCargas();

    dibujarGrafica();
    dibujarLeyenda();

    if (enCaratula) {
      const d = desvanecerProgreso();
      if (d > 0) dibujarMenu(d);
      dibujarCaratula(1 - d);
    }
    if (enMenu) dibujarMenu();
  };

  // El cuadrado derecho: sale del segundo cañón (apuntador nuevo hacia la
  // derecha), baja toda la altura del lazo por el borde en X_D —con el
  // interruptor y la resistencia nueva en el medio— y cierra abajo contra
  // la misma fila de tierra que ya usa el retorno del lazo histórico.
  function dibujarRamaDescarga(conexion, montaje) {
    const c = colorNivel(fillFrac());
    if (conexion > 0) dibujarTubo(X_M, Y_FILA, 0, conexion);

    p.stroke(c[0], c[1], c[2], 120 + fillFrac() * 100);
    p.strokeWeight(2.4);
    const xExtremo = p.lerp(X_M, X_D, conexion);
    p.line(X_M, Y_FILA, xExtremo, Y_FILA);
    p.noStroke();

    if (conexion < 1 || montaje <= 0) return;

    p.push();
    p.drawingContext.globalAlpha = montaje;
    p.stroke(c[0], c[1], c[2], 120 + fillFrac() * 100);
    p.strokeWeight(2.4);
    p.line(X_D, Y_FILA, X_D, Y_SW2_0);
    p.line(X_D, Y_SW2_1, X_D, Y_R2_0);
    p.line(X_D, Y_R2_1, X_D, Y_CAN_B);
    p.line(X_D, Y_CAN_B, X_M, Y_CAN_B);
    p.noStroke();
    dibujarCanal2();
    dibujarInterruptor2();
    p.pop();
  }

  function halo(x, y, w, h, col, fuerza, radio = 8) {
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

  function dibujarNodo(nodo, col, fuerza) {
    p.noStroke();
    p.fill(col[0], col[1], col[2], 6 + fuerza * 12);
    p.rect(nodo.x, nodo.y, nodo.w, nodo.h, 8);
    halo(nodo.x, nodo.y, nodo.w, nodo.h, col, fuerza, 8);
  }

  // Resistencia de carga: ya no conduce (el interruptor de la fuente está
  // fijo abierto), pero se dibuja con el mismo estilo que en carga_capacitor
  // — mismo color de resistencias.js, mismo rectángulo — para que se
  // reconozca de un vistazo como la misma pieza, solo que ahora inactiva.
  const TIPO_R_HIST = 'fuerte';
  function dibujarCanalHistorico() {
    const y0 = Y_FILA - ALTO_R_HIST / 2;
    const [cr, cg, cb] = RESISTENCIAS[TIPO_R_HIST].color;

    p.noStroke();
    p.fill(cr, cg, cb, 55);
    p.rect(R.x, y0, R.w, ALTO_R_HIST, 6);

    p.noFill();
    p.stroke(cr, cg, cb, 110);   // sin el aporte del interruptor: siempre abierto
    p.strokeWeight(2.4);
    p.rect(R.x, y0, R.w, ALTO_R_HIST, 6);
    p.noStroke();

    p.fill(cr, cg, cb, 200);
    p.textAlign(p.CENTER); p.textSize(13);
    p.text('R', R.x + R.w / 2, y0 - 12);
  }

  // Resistencia de descarga: esta sí es interactiva (C la cambia en el menú).
  function dibujarCanal2() {
    const ancho = alturaCanal2Actual();
    const x0 = X_D - ancho / 2;
    const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;

    p.noStroke();
    p.fill(cr, cg, cb, 55);
    p.rect(x0, Y_R2_0, ancho, R2_LARGO, 6);
    p.noFill();
    p.stroke(cr, cg, cb, 110 + interruptor * 130);
    p.strokeWeight(2.4);
    p.rect(x0, Y_R2_0, ancho, R2_LARGO, 6);
    p.noStroke();

    p.fill(cr, cg, cb, 200);
    p.textAlign(p.LEFT); p.textSize(13);
    p.text('R', X_D + ancho / 2 + 10, Y_R2_0 + R2_LARGO / 2 + 5);
  }

  function etiquetaBajoR2() {
    if (interruptor <= 0.05) return;
    const txt = 'aquí se disipa la carga';
    const x = X_D, y = Y_R2_1 + 20;
    p.textAlign(p.CENTER); p.textSize(10);
    const w = p.textWidth(txt) + 14;
    p.noStroke();
    p.fill(13, 13, 26, 220 * interruptor);
    p.rect(x - w / 2, y - 10, w, 15, 3);
    const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;
    p.fill(cr, cg, cb, 210 * interruptor);
    p.text(txt, x, y);
  }

  function dibujarPlacas() {
    const ancho = anchoCapActual();
    const x0 = X_M - ancho / 2, x1 = X_M + ancho / 2;
    p.stroke(AZUL[0], AZUL[1], AZUL[2], 235);
    p.strokeWeight(5);
    p.line(x0, CAP.yTop, x1, CAP.yTop);
    p.line(x0, CAP.yBot, x1, CAP.yBot);
    p.noStroke();

    p.fill(AZUL[0], AZUL[1], AZUL[2], 200);
    p.textAlign(p.RIGHT); p.textSize(13);
    p.text('C', x0 - 16, (CAP.yTop + CAP.yBot) / 2 + 5);
  }

  function dibujarCableCapacitor() {
    const c = colorNivel(fillFrac());
    p.stroke(c[0], c[1], c[2], 120 + fillFrac() * 135);
    p.strokeWeight(2.4);
    p.line(X_M, Y_FILA, X_M, CAP.yTop);
    p.noStroke();
  }

  function etiquetaCapacitor() {
    if (restantesActual() === 0) return;
    const txt = 'aquí se libera la carga';
    const x = X_M, y = CAP.yBot + 20;
    p.textAlign(p.CENTER); p.textSize(10);
    const w = p.textWidth(txt) + 14;
    p.noStroke();
    p.fill(13, 13, 26, 220);
    p.rect(x - w / 2, y - 10, w, 15, 3);
    p.fill(AZUL[0], AZUL[1], AZUL[2], 220);
    p.text(txt, x, y);
  }

  function dibujarRetorno() {
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 90);
    p.strokeWeight(2.4);
    p.noFill();
    p.beginShape();
    p.vertex(X_M, CAP.yBot);
    p.vertex(X_M, Y_CAN_B);
    p.vertex(X_BAT, Y_CAN_B);
    p.vertex(X_BAT, BAT_Y + BAT_W / 2);
    p.endShape();
    p.noStroke();
  }

  function dibujarTierra() {
    const x = X_TIERRA, y = Y_CAN_B;
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 110);
    p.strokeWeight(2.2);
    p.line(x, y, x, y + 12);
    [26, 16, 8].forEach((w, i) => p.line(x - w / 2, y + 12 + i * 6, x + w / 2, y + 12 + i * 6));
    p.noStroke();
  }

  function dibujarTubo(x, y, ang, alfa = 1) {
    p.push();
    p.translate(x, y);
    p.rotate(ang);
    if (alfa < 1) p.drawingContext.globalAlpha = alfa;
    p.noStroke();
    p.fill(70, 70, 95); p.circle(0, 0, 50);
    p.fill(50, 50, 72); p.circle(0, 0, 28);
    p.fill(95, 95, 125); p.rect(0, -19, TUBO_W - 6, 38, 5);
    p.fill(120, 120, 150); p.rect(TUBO_W - 12, -21, 10, 42, 3);
    p.pop();
  }

  function dibujarBola(x, y, col) {
    const [cr, cg, cb] = col;
    const RAD = RAD_CARGA;
    p.noStroke();
    p.fill(cr, cg, cb, 34); p.circle(x, y, RAD * 3.4);
    p.fill(cr, cg, cb, 70); p.circle(x, y, RAD * 2.5);
    p.fill(cr, cg, cb); p.circle(x, y, RAD * 2);
    p.fill(p.lerp(cr, 255, 0.55), p.lerp(cg, 255, 0.55), p.lerp(cb, 255, 0.55), 210);
    p.circle(x - RAD * 0.3, y - RAD * 0.3, RAD * 0.55);
  }

  // Todas las posadas comparten el color del nivel ACTUAL del capacitor —
  // son el estado presente de vC, no un recuerdo de cuándo llegaron.
  function dibujarPosadas() {
    const n = posadasVisibles();
    if (n === 0) return;
    const col = colorNivel(fillFrac());
    for (let i = 0; i < n; i++) {
      const { x, y } = posicionEnPlaca(i);
      dibujarBola(x, y, col);
    }
  }

  function dibujarCargas() {
    for (const c of cargas) dibujarBola(c.x, c.y, c.col);
  }

  function dibujarBateriaFija() {
    const borne = BAT_W / 2;
    p.strokeWeight(2.6);
    p.noFill();
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 160);
    p.beginShape();
    p.vertex(X_BAT, BAT_Y - borne);
    p.vertex(X_BAT, Y_FILA);
    p.vertex(X_SW - SW_W / 2, Y_FILA);
    p.endShape();
    p.noStroke();

    p.push();
    p.translate(X_BAT, BAT_Y);
    p.rotate(p.HALF_PI);
    p.fill(46, 46, 68, 200);
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 120);
    p.strokeWeight(1.4); p.noFill();
    p.rect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H, 5);
    p.noStroke();
    p.fill(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 200); p.rect(-16, -15, 3, 30);
    p.fill(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 200); p.rect(13, -8, 3, 16);
    p.pop();
  }

  // Interruptor de carga: siempre cerrado, ya no responde a teclado — la
  // captura que se cerró en algún momento pasado es lo único que importa.
  // Interruptor de la fuente: fijo ABIERTO — la fuente ya cumplió su parte,
  // el capacitor quedó cargado y ahora está desconectada. Misma palanca
  // angulada que el interruptor abierto de carga_capacitor, solo que acá no
  // responde a tecla: siempre queda en ese ángulo.
  function dibujarInterruptorFijo() {
    const x = X_SW, y = Y_FILA;
    const medio = SW_W / 2;
    p.noStroke();
    p.fill(13, 13, 26);
    p.rect(x - medio - 2, y - SW_H / 2 - 2, SW_W + 4, SW_H + 4);
    p.fill(34, 34, 50, 200);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);
    p.noFill();
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 110);
    p.strokeWeight(1.4);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);

    const bx = x - medio + 14, dx = SW_W - 28;
    const ang = -Math.PI / 3.4;
    p.stroke(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 130);
    p.strokeWeight(4);
    p.line(bx, y, bx + Math.cos(ang) * dx, y + Math.sin(ang) * dx);
    p.noStroke();
    p.fill(GRIS_HIST[0], GRIS_HIST[1], GRIS_HIST[2], 150);
    p.circle(bx, y, 9);
    p.circle(bx + dx, y, 9);
  }

  // Interruptor de descarga: el MISMO tipo que el de la fuente (idéntico
  // dibujo, SW_W × SW_H), solo que va rotado 90° para quedar sobre el tramo
  // vertical del cuadrado derecho — sí responde a ESPACIO.
  function dibujarInterruptor2() {
    const midY = (Y_SW2_0 + Y_SW2_1) / 2;
    const medio = SW_W / 2;

    p.push();
    p.translate(X_D, midY);
    p.rotate(p.HALF_PI);

    p.noStroke();
    p.fill(13, 13, 26);
    p.rect(-medio - 2, -SW_H / 2 - 2, SW_W + 4, SW_H + 4);
    p.fill(40, 40, 60, 230);
    p.rect(-medio, -SW_H / 2, SW_W, SW_H, 6);
    p.noFill();
    p.stroke(110, 110, 140, 150);
    p.strokeWeight(1.4);
    p.rect(-medio, -SW_H / 2, SW_W, SW_H, 6);

    const bx = -medio + 14, dx = SW_W - 28;
    const ang = p.lerp(-Math.PI / 3.4, 0, interruptor);
    p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 90 + interruptor * 165);
    p.strokeWeight(4);
    p.line(bx, 0, bx + Math.cos(ang) * dx, Math.sin(ang) * dx);
    p.noStroke();

    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], 110 + interruptor * 145);
    p.circle(bx, 0, 9);
    p.circle(bx + dx, 0, 9);
    p.pop();
  }

  // ── Gráfica: V_C(t), decayendo desde V_INICIAL hasta 0 ─────────────
  // Una sola curva: la resistencia de descarga está en paralelo con el
  // capacitor, así que en todo instante V_R2 = V_C — no hay dos curvas que
  // sumen a un techo, como en la carga.

  function dibujarPunteada(x0, y0, x1, y1, col, alfa) {
    const largo = Math.hypot(x1 - x0, y1 - y0);
    const paso = 9, hueco = 6;
    const ux = (x1 - x0) / largo, uy = (y1 - y0) / largo;
    p.stroke(col[0], col[1], col[2], alfa);
    p.strokeWeight(1.4);
    let d = 0;
    while (d < largo) {
      const d2 = Math.min(largo, d + paso);
      p.line(x0 + ux * d, y0 + uy * d, x0 + ux * d2, y0 + uy * d2);
      d += paso + hueco;
    }
    p.noStroke();
  }

  function dibujarCurva(getter, col) {
    p.noFill();
    p.stroke(col[0], col[1], col[2], 235);
    p.strokeWeight(2.6);
    p.beginShape();
    for (const s of historia) {
      const x = GX0 + (s.t / ventanaGraf) * GW;
      const y = GY_BOT - (getter(s) / CONFIG.V_INICIAL) * GH;
      p.vertex(x, y);
    }
    p.endShape();
    p.noStroke();
  }

  function dibujarGrafica() {
    p.stroke(90, 90, 110, 180);
    p.strokeWeight(1.2);
    p.line(GX0, GY_TOP, GX0, GY_BOT);
    p.line(GX0, GY_BOT, GX1, GY_BOT);
    p.noStroke();

    dibujarPunteada(GX0, GY_TOP, GX1, GY_TOP, AZUL, 150);

    if (historia.length > 1) {
      dibujarCurva((s) => s.vC, AZUL);

      const ult = historia[historia.length - 1];
      const x = GX0 + (ult.t / ventanaGraf) * GW;
      const y = GY_BOT - (ult.vC / CONFIG.V_INICIAL) * GH;
      p.fill(AZUL[0], AZUL[1], AZUL[2], 255); p.circle(x, y, 7);
    }

    p.textAlign(p.CENTER); p.textSize(11);
    p.fill(150, 150, 178, 200);
    p.text('tiempo →', (GX0 + GX1) / 2, GY_BOT + 24);

    p.push();
    p.translate(GX0 - 30, (GY_TOP + GY_BOT) / 2);
    p.rotate(-p.HALF_PI);
    p.text('voltaje del capacitor', 0, 0);
    p.pop();
  }

  // ── Leyenda ──────────────────────────────────────────────────────

  function dibujarLeyenda() {
    if (enMenu || enCaratula) return;
    const corriente = !cerrado ? '—' : (corrienteActiva ? 'fluyendo' : 'detenida');
    const items = [
      { tecla: 'ESPACIO', etiqueta: 'interruptor', valor: cerrado ? 'cerrado' : 'abierto', col: AMARILLO },
      { tecla: 'C', etiqueta: 'resistencia', valor: CONFIG.TIPOS[iTipo], col: RESISTENCIAS[CONFIG.TIPOS[iTipo]].color },
      { tecla: 'T', etiqueta: 'capacitor', valor: CONFIG.TAMANOS[iTamano], col: AZUL },
      { tecla: '', etiqueta: 'corriente', valor: corriente, col: [200, 200, 220] },
    ];

    p.textSize(11);
    const anchos = items.map((it) => p.textWidth(`${it.tecla} ${it.etiqueta}: ${it.valor}`));
    const sep = 26;
    let x = W / 2 - (anchos.reduce((a, b) => a + b, 0) + sep * (items.length - 1)) / 2;

    p.noStroke();
    p.textAlign(p.LEFT);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      p.fill(150, 150, 178);
      const tw = p.textWidth(it.tecla + (it.tecla ? ' ' : ''));
      p.text(it.tecla, x, H - 18);
      p.fill(120, 120, 145);
      const ew = p.textWidth(it.etiqueta + ': ');
      p.text(it.etiqueta + ':', x + tw, H - 18);
      p.fill(it.col[0], it.col[1], it.col[2], 235);
      p.text(it.valor, x + tw + ew, H - 18);
      x += anchos[i] + sep;
    }
  }

  // ── Carátula y menú ──────────────────────────────────────────────

  function dibujarCaratula(alfa = 1) {
    p.push();
    p.drawingContext.globalAlpha = alfa;

    p.noStroke();
    p.fill(13, 13, 26, 210);
    p.rect(0, 0, W, 50);

    p.textAlign(p.CENTER);
    p.fill(230, 230, 245, 235);
    p.textSize(22);
    p.text('Descarga de un capacitor', W / 2, 24);

    p.fill(150, 150, 178, 210);
    p.textSize(12);
    const sub = {
      estatico: 'circuito cargado — falta la resistencia de descarga',
      abriendo: 'conectando la resistencia de descarga...',
      montando: 'montando el interruptor...',
      pausa: 'listo',
      desvaneciendo: 'listo',
    }[faseCaratula];
    p.text(sub, W / 2, 44);

    p.fill(120, 120, 145, 180);
    p.textSize(11);
    p.text(
      faseCaratula === 'estatico' ? 'cualquier tecla para continuar' : 'cualquier tecla para saltar',
      W / 2, H - 16,
    );

    p.pop();
  }

  function dibujarMenu(alfa = 1) {
    p.push();
    p.drawingContext.globalAlpha = alfa;

    p.noStroke();
    p.fill(13, 13, 26, 195);
    p.rect(0, 0, W, H);

    const cx = W / 2, cy = H / 2 - 40;
    p.textAlign(p.CENTER);
    p.fill(220, 220, 235);
    p.textSize(20);
    p.text('Elegí la resistencia y el capacitor', cx, cy - 60);

    const [crR, cgR, cbR] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;
    p.textSize(16);
    p.fill(crR, cgR, cbR);
    p.text('C   resistencia:  ' + CONFIG.TIPOS[iTipo], cx, cy - 15);
    p.fill(AZUL[0], AZUL[1], AZUL[2]);
    p.text('T   capacitor:  ' + CONFIG.TAMANOS[iTamano], cx, cy + 20);

    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2]);
    p.textSize(15);
    p.text('ESPACIO para empezar', cx, cy + 70);

    p.pop();
  }
});

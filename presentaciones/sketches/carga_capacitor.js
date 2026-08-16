// Carga de un capacitor: fuente → resistencia → capacitor.
//
// Circuito en serie, un solo lazo. Al cerrar el interruptor, la corriente NO
// es constante: es máxima en el instante en que el capacitor está vacío (toda
// la diferencia de potencial cae en R) y decae a medida que el capacitor se
// llena, porque le queda cada vez menos voltaje por repartir. Por KVL, en TODO
// instante  V_fuente = V_R(t) + V_C(t)  — no solo al final.
//
// TODAS las cargas de una misma corrida se mueven a una velocidad fija
// (velocidadActual, CONFIG.VELOCIDADES) — nunca cambia a mitad de camino,
// ni con el tiempo, ni con la corriente, ni con qué tan cerca está la carga
// de adelante. Es simulación para quien recién arranca con esto: una
// velocidad que cambia por dos o tres motivos a la vez es difícil de leer.
// Lo único que existe es "se mueve a SU velocidad" o "está clavada" — nada
// de frenados progresivos. Esa velocidad SÍ difiere entre resistencias
// (fuerte un poco más rápida, media más lenta) — es una elección de ritmo,
// no una física en vivo.
//
// El efecto principal de la resistencia está en un ESPACIADO fijo, no en la
// velocidad: con una resistencia más resistente, cuando una carga se clava,
// deja más hueco vacío detrás suyo antes de que se clave la siguiente (ver
// espaciadoLibre). Como se sabe de antemano cuánto mide el camino y cuánto
// hueco deja cada resistencia, se puede calcular EXACTO
// cuántas cargas van a terminar clavadas en el cable antes de llegar al
// capacitor — no hace falta ninguna física de colas en vivo. Esa es la
// cuenta de totalCargasActual: la capacidad de la placa MÁS cuántas caben
// clavadas en el resto del cable a ese espaciado. Por eso R y C solo se
// pueden cambiar con el interruptor ABIERTO (teclas C/T bloqueadas mientras
// carga): son el "menú de inicio" que fija esa cuenta antes de arrancar.
//
// Cada carga nace sabiendo su propio destino final (targetD, según el orden
// en que nació): las primeras `capacidad` van hasta la placa y se posan ahí
// (posicionEnPlaca); las que siguen se clavan en el cable, cada vez más
// cerca del cañón. Como el destino de cada una es MENOR o IGUAL al de la
// anterior, y todas viajan a la misma velocidad desde el mismo cañón, nunca
// se cruzan ni se pisan — no hace falta impedírselo, sale solo del orden.
//
// El voltaje que se GRAFICA y se usa para todo el color del sketch (vC) es
// una LECTURA directa de cuántas se posaron en la placa, no una física
// aparte: vC = V_fuente · (posadas / capacidad). Arranca en 0, sube con cada
// carga que se acuesta, y llega exacto a V_fuente cuando la última completa
// la fila — ni antes ni después. Las que se clavan en el cable NO cuentan
// para esto: son las que no alcanzaron a llegar antes de que la corriente
// cesara del todo.
//
// Lo que SÍ decae con el tiempo es el RITMO al que nacen cargas nuevas
// (inRef, una referencia interna — no lo que se grafica ni lo que mueve a
// las cargas): rápido al principio, cada vez más espaciado, así que el
// cañón sigue disparando mientras el capacitor se sigue cargando, no solo
// en una ráfaga inicial.
//
// τ = R·C sale de dos factores multiplicados: el de la resistencia puesta
// (biblioteca compartida resistencias.js) y el del tamaño de capacitor
// puesto (CAPACITORES, local a este sketch) — más grande cualquiera de los
// dos, más lento carga.
//
// Sin cifras en pantalla a propósito: la lectura es la FORMA de la curva y el
// hueco entre las dos curvas (V_C sube, V_R baja, la suma siempre llega al
// techo punteado) — no un número que alguien pueda copiar sin mirar el dibujo.

registrarSketch('carga_capacitor', {
  ancho: 1080,
  alto: 760,
  pista: 'menú: C resistencia · T capacitor · ESPACIO empezar (después, ESPACIO abre/cierra)',
}, function (p, opciones) {

  const CONFIG_BASE = {
    V_FUENTE: 9,

    // τ en frames para una resistencia de factor 1 (referencia). El τ real de
    // cada tipo sale de multiplicar esto por su `factor` en resistencias.js —
    // así un factor "3 veces más resistente" da un τ 3 veces más largo, que es
    // exactamente lo que dice τ = R·C.
    TAU_BASE: 180,

    // Velocidad de tránsito por tipo de resistencia — CONSTANTE dentro de
    // una misma corrida (una carga nunca acelera ni frena a mitad de
    // camino, ver actualizarCargas), pero el NÚMERO cambia según qué
    // resistencia esté puesta: fuerte un poco más rápida, media más lenta.
    VELOCIDADES: { media: 2, fuerte: 4 },

    // El ritmo de disparo (ver actualizarCargas) sigue una referencia que
    // decae como 1−e^(−t/τ), y esa exponencial nunca llega EXACTO al 100%
    // en tiempo finito — solo se le acerca para siempre. Inflando la tasa
    // un 3% de más, el acumulador sí cruza el total exacto (totalCargasActual)
    // en un tiempo finito y razonable (~3.5τ) en vez de asintóticamente. Sin
    // esto, la última carga de la fila —y por lo tanto la curva del
    // capacitor— nunca terminaría de llegar al 100%.
    INFLA_DISPARO: 1.03,

    FRAMES_INTERRUPTOR: 10,
    FRAMES_CAMBIO: 34,     // animación del canal / la placa al cambiar resistencia o tamaño

    TIPOS: ['media', 'fuerte'],
    TIPO_INICIAL: 'fuerte',

    TAMANOS: ['chico', 'grande'],
    TAMANO_INICIAL: 'chico',
  };
  const CONFIG = Object.assign({}, CONFIG_BASE, opciones.config || {});

  const W = 1080, H = 760;
  const AMARILLO = [255, 214, 70];   // fuente / alta
  const AZUL = [120, 200, 255];      // capacitor / referencia baja

  const RAD_CARGA = 9, DIAM_CARGA = RAD_CARGA * 2;   // tamaño de UNA carga — la unidad "c" del capacitor

  // Tamaños de capacitor disponibles, en unidades de DIAM_CARGA: la placa
  // mide exactamente `capacidad` diámetros de carga, así que esa es también
  // la cantidad MÁXIMA que le cabe en una sola fila — nunca se apilan hacia
  // arriba porque nunca se genera más carga total que eso (ver
  // cargasTotalesActual). Un capacitor más grande también tarda más en
  // cargarse (τ = R·C) — ver tauActual.
  const CAPACITORES = {
    chico: { capacidad: 7 },
    grande: { capacidad: 11 },
  };

  // ── Geometría del circuito (un solo lazo) ───────────────────────
  const TUBO_W = 56, HUECO = 30, GRUESO = 78, LARGO = 190;
  const Y_FILA = 110;
  const X_BAT = 150;
  const X_SW = 250, SW_W = 90, SW_H = 42;
  const X_CAN_A = 350;

  const R = { x: X_CAN_A + TUBO_W + HUECO, y: Y_FILA - GRUESO / 2, w: LARGO, h: GRUESO };

  // Hueco propio (no el HUECO general) entre R y el codo: tiene que sobrar
  // sitio para la mitad del capacitor más grande sin pisar el rectángulo de
  // la resistencia. Con capacidad 11 y DIAM_CARGA 18, la mitad de la placa
  // mide 99px — el HUECO general (30) se quedaba corto.
  const HUECO_A_CAP = 60;
  const X_M = R.x + R.w + HUECO_A_CAP + TUBO_W;

  // Ancho del canal según qué tan resistente sea el tipo puesto: el más
  // resistente de la lista queda en CANAL_MIN, el menos resistente en
  // CANAL_MAX, y cualquiera intermedio se interpola por su factor.
  const CANAL_MAX = GRUESO * 0.55, CANAL_MIN = GRUESO * 0.16;

  const CAP_GAP = 120;
  const BAJADA_CAP = 90;   // cuánto más abajo queda el capacitor, respecto a como estaba
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

  // ── Geometría de la gráfica ──────────────────────────────────────
  const GX0 = 120, GX1 = 970, GY_TOP = 520, GY_BOT = 700;
  const GW = GX1 - GX0, GH = GY_BOT - GY_TOP;

  // ── Carátula ─────────────────────────────────────────────────────
  // Se ve UNA sola vez, al abrir la página. Cinco fases, en orden:
  //
  //   'estatico'      imagen quieta: el circuito YA cerrado, pero sin
  //                   capacitor — un cable puentea ese tramo. Espera una
  //                   tecla; no avanza sola.
  //   'abriendo'      ese cable se abre lento, retrocediendo desde el medio
  //                   hacia los dos extremos, hasta dejar el hueco exacto
  //                   del capacitor.
  //   'montando'      las placas aparecen en ese hueco.
  //   'pausa'         todo quieto, ya armado.
  //   'desvaneciendo' la carátula se apaga mientras el menú se enciende
  //                   encima — un cruce, no un corte.
  //
  // Cualquier tecla en 'estatico' arranca 'abriendo'; en cualquier fase
  // posterior, salta directo al menú. `enCaratula`/`faseCaratula` NO se
  // tocan en reset() — reiniciar la simulación (click) vuelve al menú, no
  // repite la intro.
  const F_ABRIENDO = 140, F_MONTANDO = 90, F_PAUSA = 70, F_DESVANECE = 60;
  let enCaratula = true;
  let faseCaratula = 'estatico';
  let caratulaT = 0;   // frames dentro de la fase actual (no acumulado)

  function aperturaProgreso() {
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
  let enMenu = false;        // menú de inicio: elegís R y C antes de arrancar (arranca después de la carátula)
  let cerrado = false;       // ESPACIO — interruptor
  let interruptor = 0;       // 0 abierto · 1 cerrado (animación de la palanca)
  let refCarga = 0;          // 0→1, referencia INTERNA que decide el ritmo de disparo — no se grafica
  let vC = 0;                 // lo que SÍ se grafica: V_fuente·(posadas/capacidad), ver actualizarEstado
  let tGraf = 0;              // tiempo acumulado mientras integra, para el eje x
  let historia = [];          // muestras {t, vC} para trazar la curva
  let ventanaGraf = 1;        // cuántos frames entran en el eje X — se fija en manejarTecla al salir del menú

  let iTipo = 0;
  let alturaDesde = CANAL_MAX, cambioTR = 1;
  let iTamano = 0;
  let anchoDesde = anchoCap('chico'), cambioTC = 1;
  let cargas = [], acumSpawn = 0, posadasCount = 0, spawnIndex = 0;
  let corrienteActiva = false;   // para la leyenda: ¿queda algo por nacer o por llegar a su destino?
  let tPrimeraPred = null, tUltimaPred = null;   // ver precalcularTiempos

  p.setup = function () {
    p.createCanvas(W, H).parent(opciones.contenedor);
    reset();
  };

  // Un click en 'estatico' arranca la animación; en cualquier fase
  // posterior de la carátula, salta directo al menú. Pasada la carátula,
  // un click reinicia la simulación de vuelta al menú (comportamiento de
  // siempre).
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
    // No toca enCaratula/faseCaratula/caratulaT: reiniciar la simulación
    // vuelve al menú, no repite la intro. Si reset() se llama ANTES de que
    // la carátula termine (el primer reset(), desde p.setup), enMenu se
    // deja en false para no pisarla — saltarCaratula() es quien lo prende.
    enMenu = !enCaratula; cerrado = false; interruptor = 0;
    refCarga = 0; vC = 0; tGraf = 0; historia = [{ t: 0, vC: 0 }];
    cargas = []; acumSpawn = 0; posadasCount = 0; spawnIndex = 0; corrienteActiva = false;
    tPrimeraPred = null; tUltimaPred = null;
    iTipo = Math.max(0, CONFIG.TIPOS.indexOf(CONFIG.TIPO_INICIAL));
    cambioTR = 1;
    alturaDesde = alturaCanal(CONFIG.TIPOS[iTipo]);
    iTamano = Math.max(0, CONFIG.TAMANOS.indexOf(CONFIG.TAMANO_INICIAL));
    cambioTC = 1;
    anchoDesde = anchoCap(CONFIG.TAMANOS[iTamano]);
  }

  // El capacitor más chico de la lista es la referencia (factor 1); el resto
  // escala τ = R·C en proporción a cuánta más carga le cabe.
  function factorCapacitor(tamano) {
    const capacidades = CONFIG.TAMANOS.map((t) => CAPACITORES[t].capacidad);
    return CAPACITORES[tamano].capacidad / Math.min(...capacidades);
  }

  // τ = R·C: el factor de la resistencia Y el del capacitor puesto lo alargan.
  function tauActual() {
    return CONFIG.TAU_BASE * RESISTENCIAS[CONFIG.TIPOS[iTipo]].factor
      * factorCapacitor(CONFIG.TAMANOS[iTamano]);
  }

  function velocidadActual() {
    return CONFIG.VELOCIDADES[CONFIG.TIPOS[iTipo]];
  }

  // Cuántas cargas caben EN LA PLACA: exactamente la capacidad del
  // capacitor puesto, ni una más. Es también el límite entre "esta carga va
  // a la placa" y "esta carga se clava en el cable" (ver targetD).
  function cargasTotalesActual() {
    return CAPACITORES[CONFIG.TAMANOS[iTamano]].capacidad;
  }

  // Espaciado entre cargas YA CLAVADAS en el cable (no en la placa, que usa
  // DIAM_CARGA sin más). Más resistente, más espaciado — así, en el mismo
  // tramo de cable, caben menos cargas clavadas al mismo tiempo. Es la razón
  // de que "más resistente" implique "pasan menos a la vez": no una
  // velocidad distinta, un espaciado distinto.
  //
  // En unidades del caso de referencia (cañón→cañón 12, cañón→placa 6, total
  // 18): fuerte deja 3 unidades de hueco, media deja 2. UNIDAD_PX convierte
  // eso al largo real del camino, así que da EXACTO ese ejemplo: con
  // capacidad 7, fuerte clava 6 (2+4) y media clava 9 (3+6) — 13 y 16 en
  // total. Usar el `factor` de resistencias.js directamente (3 vs 1.4, un
  // salto de más del doble) hacía que media pareciera disparar a una
  // velocidad desbocada comparada con fuerte; estas proporciones (3 vs 2)
  // son las que se pidieron.
  const UNIDADES_ESPACIADO = { media: 2, fuerte: 3 };

  // LARGO_RUTA/18 (no una const aparte): se evalúa recién cuando esta función
  // se LLAMA, no cuando el script la define — LARGO_RUTA todavía no existe en
  // ese punto del archivo (se declara más abajo, junto a RUTA).
  function espaciadoLibre(tipo) {
    return UNIDADES_ESPACIADO[tipo] * (LARGO_RUTA / 18);
  }

  // Cuántas cargas MÁS (además de las que llenan la placa) caben clavadas
  // en el resto del cable, a ese espaciado. Se redondea hacia abajo: si no
  // entra una entera, no entra.
  function colaActual() {
    return Math.floor(LARGO_RUTA / espaciadoLibre(CONFIG.TIPOS[iTipo]));
  }

  // El número EXACTO de cargas que va a nacer en todo el ciclo, con la R y
  // el C puestos en este momento: las que llenan la placa MÁS las que se
  // clavan en el cable. Se sabe de antemano — no hace falta esperar a ver
  // qué pasa.
  function totalCargasActual() {
    return cargasTotalesActual() + colaActual();
  }

  // Dónde tiene que parar la carga número `idx` (0 = la primera en nacer).
  // Las primeras `capacidad` van hasta el final de la ruta (la placa); el
  // resto se clava en el cable, cada vez más cerca del cañón. Al ser una
  // función DECRECIENTE de `idx`, y como todas nacen en el mismo punto y
  // viajan a la misma velocidad, la que nace después SIEMPRE queda más
  // cerca del cañón que la que nace antes — se ordenan solas, sin tener que
  // impedirles el paso una a la otra.
  function targetD(idx) {
    const capacidad = cargasTotalesActual();
    if (idx < capacidad) return LARGO_RUTA;
    const espaciado = espaciadoLibre(CONFIG.TIPOS[iTipo]);
    const posEnCola = idx - capacidad;   // 0 = la más cercana a la placa
    return Math.max(0, LARGO_RUTA - espaciado * (posEnCola + 1));
  }

  // Corre la MISMA cuenta que actualizarCargas —disparo con inRef, viaje a
  // velocidad fija, llegada en targetD— pero de una sola vez, en cuanto se
  // cierra el interruptor, sin dibujar nada. Todo es determinista (mismo τ,
  // misma capacidad, mismo espaciado), así que el resultado es exacto: en
  // qué frame aterriza la primera carga de la placa y en qué frame la
  // última. Con esos dos números fijos, la curva de vC se puede dibujar
  // como una curva de verdad entre ambos instantes (ver actualizarEstado),
  // en vez de perseguir cada aterrizaje en vivo — que es lo que se veía
  // como rizado: un blanco que salta antes de que el suavizado alcance a
  // asentarse.
  function precalcularTiempos() {
    const capacidad = cargasTotalesActual();
    const total = totalCargasActual();
    const tau = tauActual();
    const velocidad = velocidadActual();
    let refC = 0, acumS = 0, spawned = 0;
    const enViaje = [];
    let tPrimera = null, tUltima = null;
    const MAX_FRAMES = 20000;
    for (let f = 0; f < MAX_FRAMES; f++) {
      // Mismo orden que actualizarEstado → actualizarCargas: primero se
      // actualiza la referencia, después se lee (inRef lee refCarga YA
      // actualizada en este mismo frame). Leerla antes de actualizarla
      // corría el resultado un frame respecto al juego real.
      refC += (1 - refC) / tau;
      const ref = Math.max(0, 1 - refC);
      if (spawned < total) {
        acumS += (ref * total * CONFIG.INFLA_DISPARO) / tau;
        if (acumS >= 1) { acumS -= 1; enViaje.push({ idx: spawned, d: 0 }); spawned++; }
      }
      for (let i = enViaje.length - 1; i >= 0; i--) {
        const c = enViaje[i];
        const meta = targetD(c.idx);
        c.d = Math.min(meta, c.d + velocidad);
        if (c.d >= meta) {
          if (c.idx < capacidad) {
            // +1: tGraf en el juego real recién llega a 1 DESPUÉS del primer
            // frame procesado (arranca en 0 y se incrementa antes de leerse),
            // así que esta cuenta 0-indexada necesita el mismo corrimiento
            // para que ambos relojes coincidan exacto.
            if (tPrimera === null) tPrimera = f + 1;
            if (c.idx === capacidad - 1) tUltima = f + 1;
          }
          enViaje.splice(i, 1);
        }
      }
      if (tUltima !== null) break;
    }
    // Reserva por si algún día una configuración no completa a tiempo: no
    // debería pasar con los valores actuales, pero mejor una curva que
    // termine tarde a una que nunca termine.
    return { tPrimera: tPrimera ?? 0, tUltima: tUltima ?? (tPrimera ?? 0) + tau * 4 };
  }

  // Interpola linealmente por factor entre los dos extremos de la lista de
  // tipos disponibles: el más resistente da el canal más angosto.
  function alturaCanal(tipo) {
    const factores = CONFIG.TIPOS.map((t) => RESISTENCIAS[t].factor);
    const fMin = Math.min(...factores), fMax = Math.max(...factores);
    const t = fMax > fMin ? (RESISTENCIAS[tipo].factor - fMin) / (fMax - fMin) : 0;
    return p.lerp(CANAL_MAX, CANAL_MIN, t);
  }

  function alturaCanalActual() {
    const objetivo = alturaCanal(CONFIG.TIPOS[iTipo]);
    return cambioTR >= 1 ? objetivo : p.lerp(alturaDesde, objetivo, cambioTR);
  }

  // La placa mide exactamente `capacidad` cargas de ancho — ni un pixel de
  // sobra — así que una fila la llena justo cuando llega la última.
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
      // En 'estatico' cualquier tecla arranca la animación; en cualquier
      // fase posterior, cualquier tecla salta directo al menú.
      if (faseCaratula === 'estatico') { faseCaratula = 'abriendo'; caratulaT = 0; }
      else { saltarCaratula(); }
      return true;
    }
    switch (code) {
      case 'Space':
        // La primera vez, ESPACIO confirma el menú Y cierra el interruptor
        // en el mismo gesto — "elegí y simulá" es una sola acción. Ahí se
        // precalcula toda la línea de tiempo (ver precalcularTiempos), así
        // la curva ya sabe desde el primer frame cuándo tiene que arrancar
        // a subir y cuándo llegar arriba. Después, ya no hay menú al que
        // volver: solo abre/cierra el interruptor.
        if (enMenu) {
          enMenu = false; cerrado = true;
          const pred = precalcularTiempos();
          tPrimeraPred = pred.tPrimera;
          tUltimaPred = pred.tUltima;
          // La ventana del eje X se ajusta EXACTA a esta combinación de R y
          // C, no a un peor caso genérico — así la curva siempre ocupa la
          // misma proporción del ancho sin importar qué tan rápido o lento
          // termine. Margen chico (10%) para que se alcance a ver el tramo
          // ya plano del final, no para dejar aire de sobra.
          ventanaGraf = Math.ceil(tUltimaPred * 1.1);
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

  // R y C solo se pueden tocar DENTRO del menú de inicio (enMenu) — ni
  // siquiera reabriendo el interruptor a mitad de carga se puede volver a
  // cambiarlos, porque totalCargasActual() ya se calculó una vez a partir de
  // lo que estaba puesto, y de ahí salió exactamente cuántas cargas iban a
  // nacer. Cambiar R o C después invalidaría esa cuenta a mitad de camino.
  // Para reconfigurar hay que reiniciar (click), que vuelve a enMenu.
  function cambiarResistencia() {
    alturaDesde = alturaCanalActual();
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

  // Referencia interna que decide el RITMO de disparo (rápido al principio,
  // cada vez más espaciado) — NO es lo que se grafica ni lo que colorea el
  // sketch, eso es vC (ver fillFrac). Es un Euler normal de una exponencial
  // que decae de 1 a 0.
  function inRef() {
    if (!integrando()) return 0;
    return Math.max(0, 1 - refCarga);
  }

  function fillFrac() { return vC / CONFIG.V_FUENTE; }

  // La curva de verdad: 0 antes de tPrimeraPred, sube entre tPrimeraPred y
  // tUltimaPred con la forma 1−(1−x)³ (arranca empinada, se aplana al
  // acercarse — la misma pinta de una carga RC real) y llega EXACTA a
  // V_fuente en tUltimaPred, no asintóticamente. Ambos instantes salen de
  // precalcularTiempos, calculados una sola vez al cerrar el interruptor —
  // acá no hay nada que perseguir en vivo, por eso no hay rizado posible.
  function vCEnCurva(t) {
    if (tPrimeraPred === null || t < tPrimeraPred) return 0;
    if (t >= tUltimaPred) return CONFIG.V_FUENTE;
    const x = (t - tPrimeraPred) / (tUltimaPred - tPrimeraPred);
    return CONFIG.V_FUENTE * (1 - Math.pow(1 - x, 3));
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

  // ── Cargas viajando por el lazo ──────────────────────────────────
  // Nacen en el cañón de alimentación y viajan hasta la placa de arriba del
  // capacitor. NO cruzan el hueco entre placas — ninguna carga real lo hace;
  // por eso el camino termina justo ahí, no sigue hasta la placa de abajo.
  const RUTA = [
    { x: X_CAN_A, y: Y_FILA },
    { x: X_M, y: Y_FILA },
    { x: X_M, y: CAP.yTop },
  ];
  const LARGO_RUTA = RUTA.slice(1).reduce(
    (a, pt, i) => a + Math.hypot(pt.x - RUTA[i].x, pt.y - RUTA[i].y), 0);

  function puntoRuta(d) {
    let resto = Math.max(0, d);
    for (let i = 1; i < RUTA.length; i++) {
      const seg = Math.hypot(RUTA[i].x - RUTA[i - 1].x, RUTA[i].y - RUTA[i - 1].y);
      if (resto <= seg) {
        const t = resto / seg;
        return { x: p.lerp(RUTA[i - 1].x, RUTA[i].x, t), y: p.lerp(RUTA[i - 1].y, RUTA[i].y, t) };
      }
      resto -= seg;
    }
    return RUTA[RUTA.length - 1];
  }

  // Nivel de voltaje del sitio (0 azul/capacitor vacío .. 1 amarillo/fuente).
  // Cae dentro de R desde 1 hasta el nivel actual del capacitor; de ahí al
  // capacitor viaja plano, porque es el mismo cable ideal.
  function nivelEn(x) {
    if (x < R.x) return 1;
    if (x <= R.x + R.w) return p.lerp(1, fillFrac(), (x - R.x) / R.w);
    return fillFrac();
  }

  function colorNivel(n) {
    return [p.lerp(AZUL[0], AMARILLO[0], n), p.lerp(AZUL[1], AMARILLO[1], n),
            p.lerp(AZUL[2], AMARILLO[2], n)];
  }

  // Dispara una carga cuando la REFERENCIA ACUMULADA (inRef, no lo que se
  // grafica) llega a un cuanto — no un contador de frames contra un
  // intervalo recalculado cada vez (con eso el umbral crecía exponencialmente
  // al decaer la referencia y nunca se lo alcanzaba). La integral de inRef(t)
  // en todo el ciclo vale τ, así que escalando el incremento por
  // totalCargas·INFLA_DISPARO/τ el total emitido cruza exactamente
  // totalCargasActual() en un tiempo finito (ver CONFIG_BASE.INFLA_DISPARO)
  // en vez de acercarse para siempre sin llegar: rápido al principio, cada
  // vez más espaciado, hasta terminar — el cañón sigue disparando MIENTRAS
  // el capacitor se sigue cargando, no solo en una ráfaga inicial.
  //
  // Cada carga viaja a velocidadActual() —fija según la resistencia puesta,
  // pero SIEMPRE LA MISMA para toda carga dentro de esa corrida— y para
  // justo en su propio targetD(idx) — nunca antes, nunca después, y sin
  // mirar a las demás (ver el comentario grande al principio del archivo:
  // el orden de nacimiento ya garantiza que no se crucen). Si su índice cae
  // dentro de la capacidad de la placa, se posa (posicionEnPlaca); si no,
  // queda clavada ahí para siempre, en el cable.
  function actualizarCargas() {
    const ref = inRef();
    const generando = integrando() && spawnIndex < totalCargasActual();
    if (generando) {
      const tau = tauActual();
      acumSpawn += (ref * totalCargasActual() * CONFIG.INFLA_DISPARO) / tau;
      if (acumSpawn >= 1) {
        acumSpawn -= 1;
        cargas.push({ d: 0, idx: spawnIndex });
        spawnIndex++;
      }
    }

    const enMovimiento = integrando() ? 1 : 0;   // solo se detiene todo si el interruptor está abierto
    const capacidad = cargasTotalesActual();
    const velocidad = velocidadActual();

    const siguen = [];
    for (const c of cargas) {
      const meta = targetD(c.idx);
      c.d = Math.min(meta, c.d + enMovimiento * velocidad);

      if (c.d >= meta && c.idx < capacidad) {
        posadasCount++;   // llegó a la placa: deja de ser un punto en la RUTA
      } else {
        const p2 = puntoRuta(c.d);
        c.x = p2.x; c.y = p2.y;
        c.nivel = nivelEn(c.x);
        siguen.push(c);   // sigue viajando, o ya está clavada en el cable (c.d === meta)
      }
    }
    cargas = siguen;

    corrienteActiva = generando || cargas.some((c) => c.d < targetD(c.idx));
  }

  // Reparte las cargas ya llegadas en UNA sola fila sobre la placa de
  // arriba, nunca hacia arriba: la placa mide exactamente `capacidad`
  // diámetros de carga (anchoCap), y `capacidad` es también el máximo de
  // cargas que se generan en todo el ciclo (cargasTotalesActual) — así que
  // la fila nunca se llena antes de que la corriente ya haya cesado, y nunca
  // hace falta una segunda fila.
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

    // 'estatico' no avanza sola — espera una tecla (ver manejarTecla /
    // mousePressed). Las demás fases sí, cada una con su propia duración.
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

    dibujarNodo(NODO_A, AMARILLO, interruptor);
    dibujarNodo(NODO_M, colorNivel(fillFrac()), 0.15 + 0.85 * fillFrac());

    dibujarCanal();
    etiquetaBajoR();

    // El resto del lazo —cable a la placa de arriba, retorno, tierra— es
    // parte de un circuito que la carátula muestra CERRADO desde el
    // principio (ver dibujarCableCierre): no depende de si el capacitor ya
    // está montado, así que se dibuja siempre, carátula o no.
    dibujarCableCapacitor();
    if (enCaratula) {
      dibujarCableCierre(aperturaProgreso());
      const m = montajeProgreso();
      if (m > 0) {
        p.push();
        p.drawingContext.globalAlpha = m;
        dibujarPlacas();
        p.pop();
      }
    } else {
      dibujarPlacas();
      etiquetaCapacitor();
    }
    dibujarRetorno();
    dibujarTierra();

    dibujarCargas();
    dibujarPosadas();
    dibujarTubos();

    dibujarBateria();
    dibujarInterruptor();

    dibujarGrafica();
    dibujarLeyenda();

    if (enCaratula) {
      const d = desvanecerProgreso();
      if (d > 0) dibujarMenu(d);   // el menú se enciende debajo mientras la carátula se apaga
      dibujarCaratula(1 - d);
    }
    if (enMenu) dibujarMenu();
  };

  // El cable que puentea el lugar del capacitor cuando todavía no está
  // montado: el circuito ya está CERRADO (por eso el resto del lazo se
  // dibuja siempre, con o sin carátula), solo que este tramo es cable liso
  // en vez de dos placas con un hueco en el medio.
  //
  // `apertura` 0 → un solo tramo recto de CAP.yTop a CAP.yBot (el puente
  // completo). `apertura` 1 → nada: el hueco quedó exactamente del tamaño
  // del capacitor real. En el medio, dos muñones que retroceden cada uno
  // hacia SU extremo — por eso el corte se ve abrirse desde el centro.
  function dibujarCableCierre(apertura) {
    if (apertura >= 1) return;
    const mitad = CAP_GAP / 2;
    const topEnd = CAP.yTop + mitad * (1 - apertura);
    const botStart = CAP.yBot - mitad * (1 - apertura);
    const c = colorNivel(fillFrac());
    p.stroke(c[0], c[1], c[2], 120 + fillFrac() * 135);
    p.strokeWeight(2.4);
    p.line(X_M, CAP.yTop, X_M, topEnd);
    p.line(X_M, botStart, X_M, CAP.yBot);
    p.noStroke();
  }

  // Título de apertura. No vuelve a dibujar el circuito —eso ya lo hizo el
  // resto de p.draw()— solo superpone el texto. `alfa` es lo que la deja
  // desvanecerse en la fase final mientras el menú se enciende debajo.
  function dibujarCaratula(alfa = 1) {
    p.push();
    p.drawingContext.globalAlpha = alfa;

    // Franja de fondo detrás del título: sin esto, en 'pausa' el texto
    // queda encima de la resistencia y se vuelve ilegible.
    p.noStroke();
    p.fill(13, 13, 26, 210);
    p.rect(0, 0, W, 50);

    p.textAlign(p.CENTER);
    p.fill(230, 230, 245, 235);
    p.textSize(22);
    p.text('Carga de un capacitor', W / 2, 24);

    p.fill(150, 150, 178, 210);
    p.textSize(12);
    const sub = {
      estatico: 'circuito cerrado — falta el capacitor',
      abriendo: 'abriendo el circuito...',
      montando: 'montando el capacitor...',
      pausa: 'listo',
      desvaneciendo: 'listo',
    }[faseCaratula];
    p.text(sub, W / 2, 44);

    // Abajo, donde normalmente va la leyenda (oculta durante la carátula) —
    // lejos de la etiqueta "tiempo →" de la gráfica, que sigue visible.
    p.fill(120, 120, 145, 180);
    p.textSize(11);
    p.text(
      faseCaratula === 'estatico' ? 'cualquier tecla para continuar' : 'cualquier tecla para saltar',
      W / 2, H - 16,
    );

    p.pop();
  }

  // Menú de inicio: se ve el circuito de fondo (ya refleja la R y el C
  // elegidos, porque dibujarCanal/dibujarPlacas leen iTipo/iTamano en vivo)
  // pero atenuado, para que el foco quede en elegir, no en la escena.
  //
  // `alfa` (0..1) es lo que permite que la carátula se desvanezca CON el
  // menú ya prendiéndose debajo, en vez de un corte seco entre las dos.
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

  // ── Resistencia: un canal que se angosta ──────────────────────────
  // Nada de medio viscoso: la resistencia es el TUBO por el que las cargas
  // literalmente se estorban para pasar. Un rectángulo sólido, no dos placas
  // sueltas — esas son del capacitor, y con la misma forma se confundían.
  // Su color es el de la biblioteca compartida (resistencias.js) — mismo
  // ámbar del resto del curso — pero acá no hay partículas de material
  // propio, solo el tubo y las cargas.

  function dibujarCanal() {
    const alto = alturaCanalActual();
    const y0 = Y_FILA - alto / 2;
    const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;

    p.noStroke();
    p.fill(cr, cg, cb, 55);
    p.rect(R.x, y0, R.w, alto, 6);

    p.noFill();
    p.stroke(cr, cg, cb, 110 + interruptor * 130);
    p.strokeWeight(2.4);
    p.rect(R.x, y0, R.w, alto, 6);
    p.noStroke();

    p.fill(cr, cg, cb, 200);
    p.textAlign(p.CENTER); p.textSize(13);
    p.text('R', R.x + R.w / 2, y0 - 12);
  }

  function etiquetaBajoR() {
    if (interruptor <= 0.05) return;
    const txt = 'aquí cae el voltaje que le falta al capacitor';
    const x = R.x + R.w / 2, y = R.y + R.h + 20;
    p.textAlign(p.CENTER); p.textSize(10);
    const w = p.textWidth(txt) + 14;
    p.noStroke();
    p.fill(13, 13, 26, 220 * interruptor);
    p.rect(x - w / 2, y - 10, w, 15, 3);
    const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;
    p.fill(cr, cg, cb, 210 * interruptor);
    p.text(txt, x, y);
  }

  // ── Capacitor: dos placas ────────────────────────────────────────
  // Nada de relleno abstracto: lo que "llena" el capacitor son las cargas
  // reales apiladas contra la placa de arriba (ver actualizarCargas). Acá
  // solo se dibuja el metal — color de componente fijo, no cambia con el
  // nivel de carga.

  function dibujarPlacas() {
    const ancho = anchoCapActual();
    const x0 = X_M - ancho / 2, x1 = X_M + ancho / 2;
    p.stroke(AZUL[0], AZUL[1], AZUL[2], 235);
    p.strokeWeight(5);
    p.line(x0, CAP.yTop, x1, CAP.yTop);
    p.line(x0, CAP.yBot, x1, CAP.yBot);
    p.noStroke();

    p.fill(AZUL[0], AZUL[1], AZUL[2], 200);
    p.textAlign(p.CENTER); p.textSize(13);
    p.text('C', x1 + 16, (CAP.yTop + CAP.yBot) / 2 + 5);
  }

  function dibujarCableCapacitor() {
    const c = colorNivel(fillFrac());
    p.stroke(c[0], c[1], c[2], 120 + fillFrac() * 135);
    p.strokeWeight(2.4);
    p.line(X_M, Y_FILA, X_M, CAP.yTop);
    p.noStroke();
  }

  function etiquetaCapacitor() {
    if (posadasCount === 0) return;
    const txt = 'aquí se acumula la carga';
    const x = X_M, y = CAP.yBot + 20;
    p.textAlign(p.CENTER); p.textSize(10);
    const w = p.textWidth(txt) + 14;
    p.noStroke();
    p.fill(13, 13, 26, 220);
    p.rect(x - w / 2, y - 10, w, 15, 3);
    p.fill(AZUL[0], AZUL[1], AZUL[2], 220);
    p.text(txt, x, y);
  }

  // ── Retorno a tierra y batería ────────────────────────────────────
  // Ningún cargador visible viaja por este tramo: el modelo no anima cargas
  // "esperando" en la placa de abajo, pero el cable sigue vivo porque cierra
  // el lazo — por eso lleva el mismo tinte que el resto del circuito cuando
  // la fuente está conectada.

  function dibujarRetorno() {
    const vivo = 60 + interruptor * 170;
    p.stroke(AZUL[0], AZUL[1], AZUL[2], vivo);
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
    const alfa = 90 + interruptor * 150;
    p.stroke(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.strokeWeight(2.2);
    p.line(x, y, x, y + 12);
    [26, 16, 8].forEach((w, i) => p.line(x - w / 2, y + 12 + i * 6, x + w / 2, y + 12 + i * 6));
    p.noStroke();
  }

  // ── Tubos ────────────────────────────────────────────────────────

  function dibujarTubo(x, y, ang, alfa = 1) {
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

  function dibujarTubos(alfaCap = 1) {
    dibujarTubo(X_CAN_A, Y_FILA, 0);
    dibujarTubo(X_M, Y_FILA, Math.PI);                    // codo: recibe de R
    dibujarTubo(X_M, Y_FILA, Math.PI / 2, alfaCap);       // codo: baja al capacitor — entra con la carátula
  }

  // ── Cargas ───────────────────────────────────────────────────────

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

  function dibujarCargas() {
    for (const c of cargas) dibujarBola(c.x, c.y, colorNivel(c.nivel));
  }

  // Todas comparten el color del nivel ACTUAL del capacitor: no es que cada
  // una "recuerde" el voltaje de cuando llegó, es que todas juntas SON el
  // estado presente de vC, y por eso se atiñen juntas a medida que sube.
  function dibujarPosadas() {
    if (posadasCount === 0) return;
    const col = colorNivel(fillFrac());
    for (let i = 0; i < posadasCount; i++) {
      const { x, y } = posicionEnPlaca(i);
      dibujarBola(x, y, col);
    }
  }

  // ── Batería e interruptor ──────────────────────────────────────────

  function dibujarBateria() {
    const viva = interruptor > 0.05;
    const alfa = viva ? 255 : 110;
    const vivo = 0.32 + 0.68 * interruptor;
    const borne = BAT_W / 2;

    p.strokeWeight(2.6);
    p.noFill();
    p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 230 * vivo);
    p.beginShape();
    p.vertex(X_BAT, BAT_Y - borne);
    p.vertex(X_BAT, Y_FILA);
    p.vertex(X_SW - SW_W / 2, Y_FILA);
    p.endShape();
    p.noStroke();

    p.push();
    p.translate(X_BAT, BAT_Y);
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

    p.textAlign(p.CENTER); p.textSize(11);
    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], alfa);
    p.text('+', X_BAT + 30, BAT_Y - 26);
    p.fill(AZUL[0], AZUL[1], AZUL[2], alfa);
    p.text('−', X_BAT + 30, BAT_Y + 34);
  }

  function dibujarInterruptor() {
    const x = X_SW, y = Y_FILA;
    const medio = SW_W / 2;

    p.noStroke();
    p.fill(13, 13, 26);
    p.rect(x - medio - 2, y - SW_H / 2 - 2, SW_W + 4, SW_H + 4);

    p.fill(40, 40, 60, 230);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);
    p.noFill();
    p.stroke(110, 110, 140, 150);
    p.strokeWeight(1.4);
    p.rect(x - medio, y - SW_H / 2, SW_W, SW_H, 6);

    const bx = x - medio + 14, dx = SW_W - 28;
    const ang = p.lerp(-Math.PI / 3.4, 0, interruptor);
    p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], 90 + interruptor * 165);
    p.strokeWeight(4);
    p.line(bx, y, bx + Math.cos(ang) * dx, y + Math.sin(ang) * dx);
    p.noStroke();

    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], 110 + interruptor * 145);
    p.circle(bx, y, 9);
    p.circle(bx + dx, y, 9);
  }

  // ── Gráfica: V_C(t) y V_R(t), y su techo común ────────────────────
  //
  // Dos curvas, no una: V_C sube desde 0, V_R baja desde el techo, y la
  // distancia vertical entre la curva de V_C y el techo punteado ES V_R en
  // ese instante. Verlas juntas es lo que deja claro que la suma no cambia.

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
      const y = GY_BOT - (getter(s) / CONFIG.V_FUENTE) * GH;
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

    dibujarPunteada(GX0, GY_TOP, GX1, GY_TOP, AMARILLO, 150);

    if (historia.length > 1) {
      const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;
      dibujarCurva((s) => CONFIG.V_FUENTE - s.vC, [cr, cg, cb]);
      dibujarCurva((s) => s.vC, AZUL);

      const ult = historia[historia.length - 1];
      const x = GX0 + (ult.t / ventanaGraf) * GW;
      const yC = GY_BOT - (ult.vC / CONFIG.V_FUENTE) * GH;
      const yR = GY_BOT - ((CONFIG.V_FUENTE - ult.vC) / CONFIG.V_FUENTE) * GH;
      p.stroke(230, 230, 245, 70);
      p.strokeWeight(1);
      p.line(x, yC, x, yR);
      p.noStroke();
      p.fill(AZUL[0], AZUL[1], AZUL[2], 255); p.circle(x, yC, 7);
      p.fill(cr, cg, cb, 255); p.circle(x, yR, 7);
    }

    p.textAlign(p.CENTER); p.textSize(11);
    p.fill(150, 150, 178, 200);
    p.text('tiempo →', (GX0 + GX1) / 2, GY_BOT + 24);

    p.push();
    p.translate(GX0 - 30, (GY_TOP + GY_BOT) / 2);
    p.rotate(-p.HALF_PI);
    p.text('voltaje del capacitor', 0, 0);
    p.pop();

    p.textAlign(p.LEFT); p.textSize(10);
    p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], 190);
    p.text('voltaje de la fuente', GX1 + 8, GY_TOP + 4);

    if (historia.length > 1) {
      const [cr, cg, cb] = RESISTENCIAS[CONFIG.TIPOS[iTipo]].color;
      p.fill(AZUL[0], AZUL[1], AZUL[2], 220);
      p.text('V del capacitor', GX1 + 8, GY_TOP + 22);
      p.fill(cr, cg, cb, 220);
      p.text('V de la resistencia', GX1 + 8, GY_TOP + 38);
    }
  }

  // ── Leyenda ──────────────────────────────────────────────────────

  function dibujarLeyenda() {
    if (enMenu || enCaratula) return;   // el menú y la carátula muestran sus propias instrucciones
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
});

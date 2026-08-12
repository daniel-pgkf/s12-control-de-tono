// GUION DE LA SESIÓN
//
// Esto es lo único que editas para armar una clase. Cada entrada es un
// checkpoint: la presentación se detiene ahí hasta que presiones ESPACIO.
//
// Tipos:
//   {tipo: 'clip',   src, titulo}          → video renderizado con Manim
//   {tipo: 'sketch', id, config, titulo}   → sketch p5 interactivo
//
// En un 'sketch', `config` sobrescribe el bloque CONFIG del sketch. Por eso el
// mismo archivo sirve para el caso "no pasa" y el caso "pasa" sin duplicarlo.

const GUION = [
  // ── Modelo energético lineal: mismo lenguaje visual que el circuital ──
  {
    tipo: 'sketch',
    id: 'disparo_lineal',
    titulo: 'Un disparo en línea recta',
    nota: 'ESPACIO dispara. La carga cruza el medio o se queda sin energía '
        + 'dentro, y la barra de abajo muestra lo que le va quedando. C cambia '
        + 'el medio: pregunta ANTES de disparar si creen que va a pasar. '
        + 'ESPACIO otra vez retira la carga anterior y dispara de nuevo. '
        + 'Para salir de esta escena: flecha derecha, no ESPACIO.',
  },

  // ── Modelo circuital: UN simulador manejable con teclas ──
  //
  // Ya no son varias escenas fijas. Es una sola, y cada tecla enciende o apaga
  // una cosa; se combinan en cualquier orden y todo es reversible.
  //
  //   ESPACIO  abre/cierra el circuito   P  soltar cargas on/off
  //   C        rota la resistencia  E  transformar a esquemático (ida y vuelta)
  //
  // Ojo: aquí ESPACIO es del simulador, así que para pasar de checkpoint hay
  // que usar la flecha derecha (el player nunca cede esa tecla).
  {
    tipo: 'sketch',
    id: 'zonas_voltaje',
    config: { ESTILO: 'canones' },
    titulo: 'El voltaje es una propiedad del espacio',
    nota: 'ESPACIO cierra el interruptor: la pila siempre está ahí, lo que '
        + 'cambia es si el circuito está cerrado. Los cañones SON los nodos, y '
        + 'al cerrarse tiñen el medio desde sus dos extremos hasta encontrarse. '
        + 'P suelta las cargas: cada una toma el color del punto donde está. '
        + 'C cambia el medio en vivo — pregunta qué creen que pasará antes de '
        + 'pulsarla. E lo convierte en el esquemático y vuelve. '
        + 'Para salir de esta escena: flecha derecha, no ESPACIO.',
  },

  // ── Divisor: dos resistencias y un nodo que no fija la fuente ──
  {
    tipo: 'sketch',
    id: 'divisor_voltaje',
    titulo: 'Divisor de voltaje: R1 en serie, R2 a tierra',
    nota: 'ESPACIO cierra el circuito, P suelta las cargas. Lo que hay que '
        + 'mirar es el NODO INTERMEDIO: su voltaje no lo fija la fuente, lo '
        + 'deciden las dos resistencias entre sí. Con 1 y 2 eliges cuál '
        + 'cambiar y con C la cambias — pregunta ANTES si el nodo va a subir o '
        + 'a bajar. E lo convierte en el esquemático. '
        + 'Para salir: flecha derecha, no ESPACIO. '
        + '|| ACLARACIÓN OBLIGADA con R1 y R2 distintas: la CORRIENTE es la '
        + 'MISMA en las dos. En este modelo la velocidad NO representa la '
        + 'corriente. Las cargas van más lentas en la más resistiva, pero se '
        + 'apelotonan, así que por cualquier punto pasan las mismas por '
        + 'segundo — y eso es la corriente. Señala el apelotonamiento: es la '
        + 'prueba visual de que el caudal se conserva. Si alguien dice "por '
        + 'ahí pasa menos corriente", cuenta cargas cruzando un punto.',
  },
];

// ── Fuera del guion, pero NADA se ha borrado ──────────────────────────
// Para reponer cualquiera de estas, vuelve a añadir su entrada arriba.
//
//   'canon_parabolico'    las dos escenas de tiro parabólico (media y fuerte).
//                         El sketch sigue intacto; para reponerlas basta con
//                         una entrada  {tipo:'sketch', id:'canon_parabolico',
//                         config:{TIPO_RESISTENCIA:'media'}}
//
//   Resistencia leve      FUERA de las diapositivas por completo: ni en el
//                         guion ni en la tecla C de los simuladores. El tipo
//                         sigue definido en sketches/resistencias.js, así que
//                         para reponerla basta añadir 'leve' a los TIPOS del
//                         sketch (y, si quieres, un checkpoint con ella).
//
//   Transformación por etapas
//                         config: { ..., MORPH_POR_ETAPAS: true }
//                         tres ESPACIOs: nodos → pepitas → batería
//
//   Estilo 'zonas'        config: { ESTILO: 'zonas' } en 'zonas_voltaje'.
//                         Tres bloques contiguos en vez de cañones-nodo. Sigue
//                         funcionando entero, incluida la transformación.
//
//   'comparativa_energia'      versión horizontal de la escena de energía
//   '../clips/RCPasaBajos.mp4' el circuito RC renderizado en Manim

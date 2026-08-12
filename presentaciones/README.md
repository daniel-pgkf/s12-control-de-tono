# Presentaciones — cómo se integran Manim y p5

Una sesión es una secuencia de **checkpoints**. Cada checkpoint es o un clip
renderizado con Manim, o un sketch p5 interactivo. El player los encadena en un
mismo escenario y avanza con ESPACIO, así que en clase nunca se pierde el ritmo.

```
presentaciones/
├── paleta.json         ← fuente única de color (la leen los dos lados)
├── clips/              ← .mp4 renderizados, listos para el player
├── circuitos/          ← escenas Manim
│   ├── paleta.py       ← lee paleta.json y la aplica a Manim
│   ├── componentes.py  ← R, C, fuente, tierra, cables
│   └── rc_pasabajos.py
├── sketches/           ← sketches p5 como módulos
│   ├── registro.js     ← montar / destruir / escalar
│   ├── *.js
│   └── standalone/     ← wrappers para abrir un sketch solo
├── player/
│   ├── index.html
│   ├── guion.js        ← ⭐ esto es lo único que editas para armar una clase
│   ├── player.js
│   └── vendor/p5.min.js   ← local: la presentación corre sin internet
└── analogia-voltaje/   ← HTML originales (histórico, ya migrados)
```

## Correr la presentación

Hace falta un servidor local: el player carga los sketches como `<script>` y el
clip como `<video>`, y `file://` bloquea parte de eso.

```bash
cd presentaciones
../../s12-venv/Scripts/python.exe servidor.py
# abrir http://127.0.0.1:8000/player/
```

Usa `servidor.py`, **no** `python -m http.server`. El módulo estándar no manda
`Cache-Control`, así que el browser se queda con el `.js` viejo después de
editarlo y parece que el cambio no hizo nada (o que hay un bug donde no lo hay).

### Si un cambio no aparece en pantalla

Mira la **hora al final de la barra inferior**: es el momento en que se cargó el
player. Si recargas y esa hora no cambia, estás viendo una copia en caché y no
tu código.

`player/index.html` carga sus módulos con un token anticaché, así que los `.js`
nunca se quedan viejos. El único archivo que un browser puede tener guardado de
antes es el propio `index.html`; para saltártelo, ábrelo con cualquier query
nueva:

```
http://127.0.0.1:8000/player/?nuevo=1
```

Una URL que el browser no ha visto no tiene entrada en caché. Es más fiable que
Ctrl+Shift+R.

Teclas: **ESPACIO** avanza · **←** atrás · **R** reinicia el checkpoint ·
**N** muestra la nota del instructor · **F** pantalla completa.

`?paso=3` abre directo en ese checkpoint, para iterar sin recorrer todo.

## Armar una sesión

Editar `player/guion.js`. Cada entrada se detiene hasta que presiones ESPACIO:

```js
{tipo: 'clip',   src: '../clips/RCPasaBajos.mp4', titulo: '...', nota: '...'}
{tipo: 'sketch', id: 'energia_configurable', config: {E_BOLA: 300}, titulo: '...'}
```

`config` sobrescribe el bloque `CONFIG` del sketch. Por eso el mismo archivo
sirve para "poca energía" y "mucha energía" sin duplicarlo — así están armados
los checkpoints 2 y 3.

## Agregar un clip de Manim

```bash
cd presentaciones
../../s12-venv/Scripts/manim.exe -qh --media_dir circuitos/media \
    circuitos/rc_pasabajos.py RCPasaBajos
cp circuitos/media/videos/rc_pasabajos/1080p60/RCPasaBajos.mp4 clips/
```

Toda escena debe empezar con `aplicar_fondo(self)`. Sin eso Manim rinde sobre
negro puro y el corte contra un sketch se nota.

## Sobre el color

`paleta.json` es la única fuente. La consumen `circuitos/paleta.py` (Python) y
las variables CSS de `player/index.html`.

Los valores salieron de los sketches del aceite, no al revés: esos sketches ya
estaban afinados y funcionando, así que Manim se adaptó a ellos. El mapeo no es
arbitrario — la R usa el ámbar del aceite porque es lo que "frena", y el C usa
el azul de las zonas A/B.

> Si cambias un color en `paleta.json`, los sketches **no** lo toman solos:
> tienen sus RGB escritos a mano. Cambian Manim y el chrome del player.
> Unificar eso del todo es trabajo aparte.

## Biblioteca de resistencias

`sketches/resistencias.js` — tres tipos ordenados de menos a más resistente.
Cuánto más lo dice su `factor`, y **de ahí se derivan los dos comportamientos**:
la retención de velocidad del modelo circuital y el gasto de energía del
energético. No se escriben a mano, así que cambiar un factor cambia las dos
escenas de golpe y no pueden quedar desincronizadas.

| tipo | color | densidad | elasticidad | en las diapositivas |
|---|---|---|---|---|
| `leve` | naranja claro | baja | blanda, olas amplias | **no** |
| `media` | naranja medio | media | intermedia | sí |
| `fuerte` | naranja oscuro | alta | rígida, apenas cede | sí |

`leve` sigue definida y funcionando, pero está fuera de la presentación: no
aparece en el guion ni la alcanza la tecla `C`. Para reponerla, añádela a los
`TIPOS` del sketch correspondiente.

Los valores numéricos viven en el archivo y se ajustan a mano; aquí no se
repiten a propósito, para que esta tabla no se quede mintiendo cuando los
cambies. Para acelerar o frenar las cargas en los tres tipos a la vez, toca
`RETENCION_BASE`: las tres salen de ella divididas por su factor.

```js
const r = crearResistencia(p, 'media', x, y, w, h);
r.actualizar(pelotas);          // el fluido reacciona a las cargas
r.dibujarFondo();               // antes de las cargas
r.dibujarParticulas();          // después

// Frena el avance propio del cuerpo, solo mientras está dentro
if (r.contiene(b.x, b.y)) v *= r.retencion;

// Frena un cuerpo que se hunde sin impulso propio, en los DOS ejes
if (r.contiene(b.x, b.y)) r.frenar(b);
```

`retencion` opone resistencia al avance; `frenar()` opone resistencia a la
caída. Hacen falta las dos: con solo la primera, un cuerpo sin impulso atraviesa
el bloque a plomo como si fuera aire.

La usan **las dos escenas del bloque**: `zonas_voltaje` (la retención frena las
cargas dentro) y `canon_parabolico` (el factor multiplica el gasto de energía).
Tocar un tipo aquí cambia las dos a la vez.

Cualquier sketch que la use debe cargarla **antes** (ya está en la lista
`MODULOS` del player y en `avance-rapido.html`; en un wrapper standalone hay que
añadir su `<script>` a mano).

Para ver los tres tipos sin tocar código:

```
/sketches/avance-rapido.html?sketch=zonas_voltaje&pasos=2&f=300&cfg={"TIPO_RESISTENCIA":"fuerte"}
```

## Transiciones entre checkpoints

El player no corta en seco: monta la escena entrante en una capa propia sobre la
saliente y las funde (~320 ms). Vale para cualquier par, incluido el clip de
Manim, y **ningún sketch se entera**.

```
http://127.0.0.1:8000/player/?fundido=0
```

`?fundido=0` lo desactiva. Hace falta para **capturas automatizadas**: un browser
headless no avanza el reloj de animaciones, así que las escenas salen a medio
aparecer y parece un fallo que no existe.

## Estado que se arrastra entre escenas

Un sketch puede definir `p.estado()` y devolver un objeto con forma de `config`.
El player lo guarda al salir de la escena y lo inyecta en la siguiente:

```js
p.estado = function () {
  const tipo = CONFIG.TIPOS[iTipo];
  return { TIPO_INICIAL: tipo, R1_INICIAL: tipo };
};
```

Así, si dejas la resistencia en `fuerte`, el checkpoint siguiente arranca así en
vez de volver a su valor por defecto. Lo que el guion ponga en `config` manda
sobre lo heredado.

## Sketches con teclas propias

Un sketch puede ser un simulador en vez de una secuencia. Define
`p.manejarTecla(code)` y devuelve `true` si consume la tecla:

```js
p.manejarTecla = function (code) {
  if (code === 'KeyP') { flujo = !flujo; return true; }
  return false;
};
```

El player se reserva `→`, `←`, `R`, `N` y `F` y no las cede nunca, así que un
sketch no puede dejarte encerrado en su checkpoint. Todo lo demás, incluido
ESPACIO, se le ofrece primero al sketch.

> Si un sketch se queda con ESPACIO (como `zonas_voltaje`, donde enciende el
> voltaje), para salir de ese checkpoint hay que usar la **flecha derecha**.

## Escenas que arrancan quietas (sub-pasos)

Un sketch puede consumir la barra espaciadora antes de que el player cambie de
checkpoint. Sirve para escenas que esperan una acción del instructor — los
cañones no disparan hasta que tú lo digas.

En el sketch:

```js
p.avanzarPaso = function () {
  if (!disparado) { disparar(); return true; }  // consumí el ESPACIO
  return false;                                  // ya terminé, que avance el player
};
```

`ESPACIO` va primero al sketch; `→` siempre salta de checkpoint, como escape si
te pasaste o quieres cortar.

## Depurar un sketch sin esperar la animación

```
http://127.0.0.1:8000/sketches/avance-rapido.html?sketch=comparativa_energia&f=230
```

Salta al frame N de golpe. Sirve para revisar el cuadro final de una escena, y
es la única forma de capturarla desde un browser headless: bajo headless el
`requestAnimationFrame` de p5 no avanza, así que hay que forzar `redraw()`.

Al agregar un sketch nuevo, súmalo a la lista de `<script>` de ese archivo y a
la de `player/index.html`.

## Sobre `sketches/extraer.py`

Fue una **migración de una sola vez**, ya ejecutada: convirtió los HTML de
`analogia-voltaje/` en módulos. De ahora en adelante **editá los `.js`
directamente** — volver a correr `extraer.py` los sobrescribe y perderías los
cambios. Se deja versionado solo por si aparece otro HTML viejo que migrar.

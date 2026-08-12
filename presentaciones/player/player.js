// Motor del player: recorre GUION checkpoint por checkpoint.
//
// Reglas de reproducción:
//   ESPACIO / →  avanzar        ←  retroceder
//   R            reiniciar el checkpoint actual
//   N            mostrar/ocultar la nota del instructor
//   F            pantalla completa
//
// Un 'clip' se reproduce y se congela en su último frame esperando ESPACIO;
// nunca salta solo, para que nadie pierda el control del ritmo en clase.

(function () {
  const stage = document.getElementById('stage');
  const barra = document.getElementById('progreso');
  const tituloEl = document.getElementById('titulo');
  const notaEl = document.getElementById('nota');
  const contadorEl = document.getElementById('contador');

  // ?paso=3 abre directo en ese checkpoint (1-based). Sirve para iterar sobre
  // un punto del guion sin recorrerlo entero.
  const pasoPedido = parseInt(
    new URLSearchParams(location.search).get('paso'), 10);
  let indice = Number.isInteger(pasoPedido)
    ? Math.min(Math.max(pasoPedido - 1, 0), GUION.length - 1)
    : 0;

  let actual = null;      // handle del sketch o el <video> montado
  let capaActual = null;  // el div que lo contiene
  let saliendo = null;    // { handle, capa } mientras dura el fundido
  let notaVisible = false;

  // Duración del fundido entre checkpoints. Corto a propósito: no es un efecto,
  // es solo quitarle el golpe al corte.
  //
  // `?fundido=0` lo desactiva. Sirve para capturas automatizadas —un browser
  // headless no avanza el reloj de animaciones y las escenas salen a medio
  // aparecer— y para ensayar sin esperas.
  const FUNDIDO = Math.max(0, parseInt(
    new URLSearchParams(location.search).get('fundido') ?? '320', 10) || 0);
  document.documentElement.style.setProperty('--fundido', FUNDIDO + 'ms');

  // Configuración que se arrastra de una escena a la siguiente: si dejaste la
  // resistencia en 'fuerte', el checkpoint que entra arranca así en vez de
  // volver a su valor por defecto. Refuerza que es el mismo circuito y evita
  // reconfigurar en mitad de la clase.
  let memoria = {};

  // Sello de carga. Si al recargar la hora NO cambia, el browser te está
  // sirviendo una copia vieja y lo que ves en pantalla no es tu código.
  const sello = document.getElementById('build');
  if (sello) {
    sello.textContent = new Date(window.PLAYER_BUILD || Date.now())
      .toLocaleTimeString('es', { hour12: false });
  }

  function nuevaCapa() {
    const capa = document.createElement('div');
    capa.className = 'capa';
    stage.appendChild(capa);
    return capa;
  }

  // Cierra de golpe un fundido en curso. Si se avanza rápido de checkpoint, la
  // escena a medio desvanecer tiene que irse ya: dejar tres capas vivas a la
  // vez multiplica los p5 corriendo y descuadra el fundido siguiente.
  function cerrarFundido() {
    if (!saliendo) return;
    if (saliendo.handle && saliendo.handle.destruir) saliendo.handle.destruir();
    saliendo.capa.remove();
    saliendo = null;
  }

  function montarClip(paso, capa) {
    const video = document.createElement('video');
    video.src = paso.src;
    video.className = 'clip';
    video.autoplay = true;
    video.controls = false;
    // Sin loop: el clip termina y se queda quieto esperando al instructor.
    video.loop = false;
    video.addEventListener('error', () => {
      capa.innerHTML =
        `<div class="error">No encontré el clip:<br><code>${paso.src}</code>` +
        `<br><br>¿Lo renderizaste? Mira <code>circuitos/README.md</code></div>`;
    });
    capa.appendChild(video);
    return {
      destruir() { video.pause(); video.remove(); },
      reiniciar() { video.currentTime = 0; video.play(); },
    };
  }

  function montarSketchPaso(paso, capa) {
    // La memoria va primero: lo que el guion diga explícitamente manda sobre
    // lo que se arrastre de la escena anterior.
    const config = Object.assign({}, memoria, paso.config || {});
    const handle = montarSketch(paso.id, capa, { config });
    ajustarEscala(handle.caja, stage, handle.meta, handle.instancia);

    // Al cambiar de tamaño o entrar en pantalla completa hay que reajustar
    // también la resolución del lienzo, no solo el zoom.
    handle._resize = () =>
      ajustarEscala(handle.caja, stage, handle.meta, handle.instancia);
    window.addEventListener('resize', handle._resize);
    const destruirOriginal = handle.destruir.bind(handle);
    handle.destruir = () => {
      window.removeEventListener('resize', handle._resize);
      destruirOriginal();
    };
    return handle;
  }

  function render() {
    const paso = GUION[indice];
    if (!paso) return;

    cerrarFundido();

    // Lo que la escena saliente quiera legar, antes de destruirla.
    if (actual && actual.estado) Object.assign(memoria, actual.estado());

    const capaVieja = capaActual;
    const handleViejo = actual;

    capaActual = nuevaCapa();
    capaActual.style.opacity = '0';
    actual = paso.tipo === 'clip'
      ? montarClip(paso, capaActual)
      : montarSketchPaso(paso, capaActual);

    // Forzar un reflujo entre el 0 y el 1 para que el navegador registre el
    // estado inicial y la transición arranque. Con requestAnimationFrame la
    // capa entrante se quedaba en opacidad 0 y la escena no aparecía: el
    // callback no siempre llega antes de que el estilo se resuelva.
    void capaActual.offsetWidth;
    capaActual.style.opacity = '1';
    if (capaVieja) capaVieja.style.opacity = '0';

    if (capaVieja) {
      saliendo = { handle: handleViejo, capa: capaVieja };
      setTimeout(cerrarFundido, FUNDIDO + 40);
    }

    tituloEl.textContent = paso.titulo || '';
    notaEl.textContent = paso.nota || '';
    notaEl.style.display = notaVisible && paso.nota ? 'block' : 'none';
    contadorEl.textContent = `${indice + 1} / ${GUION.length}`;
    barra.style.width = `${((indice + 1) / GUION.length) * 100}%`;
  }

  function avanzarCheckpoint(paso) {
    const siguiente = indice + paso;
    if (siguiente < 0 || siguiente >= GUION.length) return;
    indice = siguiente;
    render();
  }

  // Teclas que el player NO cede nunca. Sin esta reserva, un sketch que se
  // quedara con las teclas podría dejarte encerrado en su checkpoint.
  const RESERVADAS = ['ArrowRight', 'ArrowLeft', 'KeyR', 'KeyN', 'KeyF'];

  document.addEventListener('keydown', (e) => {
    // El sketch tiene la primera opción sobre las teclas que no son del player.
    if (!RESERVADAS.includes(e.code) && actual && actual.tecla && actual.tecla(e.code)) {
      e.preventDefault();
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        // Si el sketch tiene sub-pasos pendientes, ESPACIO se los da a él y el
        // checkpoint no cambia. → siempre salta de checkpoint, como escape.
        if (actual && actual.avanzarPaso && actual.avanzarPaso()) break;
        avanzarCheckpoint(1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        avanzarCheckpoint(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        avanzarCheckpoint(-1);
        break;
      case 'KeyR':
        if (actual && actual.reiniciar) actual.reiniciar();
        break;
      case 'KeyN':
        notaVisible = !notaVisible;
        notaEl.style.display =
          notaVisible && notaEl.textContent ? 'block' : 'none';
        break;
      case 'KeyF':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        break;
    }
  });

  render();
})();

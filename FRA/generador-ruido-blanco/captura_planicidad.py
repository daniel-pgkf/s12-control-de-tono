"""
Captura el generador de ruido blanco por la Scarlett 2i2 y mide qué tan plano
es su espectro en la banda audible (20 Hz - 20 kHz).

Contraparte real de FRA/codigos/ruido_blanco.ipynb, que simula el ruido con
randn(). Aquí se mide el generador físico.

Uso:
    python captura_planicidad.py --list          # ver dispositivos y su índice
    python captura_planicidad.py                 # captura + analiza
    python captura_planicidad.py --device 3 --dur 10
    python captura_planicidad.py --wav captura.wav   # re-analizar sin recapturar
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import sounddevice as sd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import welch
from scipy.io import wavfile

# La consola de Windows usa cp1252 y no puede imprimir ✓ / ≈ del reporte.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        _stream.reconfigure(encoding='utf-8')

# Las salidas van a carpetas fijas junto al script, no al cwd: así el
# resultado cae siempre en el mismo lugar sin importar desde dónde se corra.
DIR_SCRIPT = Path(__file__).resolve().parent
DIR_IMG    = DIR_SCRIPT / 'imagenes'   # gráficos
DIR_WAV    = DIR_SCRIPT / 'capturas'   # audio crudo, para reanalizar

# ── Parámetros por defecto ──────────────────────────────────────────
FS       = 48_000
DURACION = 10.0
NPERSEG  = 4096
F_MIN    = 20
F_MAX    = 20_000
F_RED    = 60      # Hz — frecuencia de red (60 en América, 50 en Europa)
HUM_OK   = 10.0    # dB de exceso sobre el piso: por encima, contamina la medición
HUM_VIS  = 3.0     # dB — por debajo, la línea se confunde con el ruido
# El acople de red decae rápido con el armónico; arriba de ~2 kHz es
# despreciable. Además, a 20 kHz los armónicos de 60 Hz quedan más juntos que
# la resolución de Welch (11.7 Hz/bin @ nperseg=4096): buscarlos ahí marcaría
# casi todos los bins como "red" y vaciaría la estadística.
HUM_F_MAX = 2_000  # Hz

# Paleta — misma que ruido_blanco.ipynb
ACCENT  = '#4a9eff'
ACCENT2 = '#4ecb71'
AMBAR   = '#f0a020'
ROJO    = '#ff6060'
GRAY    = '#445566'
FONDO   = '#0d0d1a'

# Umbrales de planicidad (ref. ruido_blanco.ipynb)
STD_OK   = 3.0   # dB
RANGO_OK = 6.0   # dB
SFM_OK   = -1.0  # dB


def ruta_salida(out, carpeta):
    """Un nombre suelto cae en `carpeta`; una ruta explícita se respeta."""
    p = Path(out)
    if p.is_absolute() or len(p.parts) > 1:
        return p
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta / p.name


def listar_dispositivos():
    print(sd.query_devices())
    print('\nUsar el número de la izquierda con --device N')


def buscar_scarlett():
    """Índice de la entrada Scarlett, prefiriendo WASAPI.

    Windows expone la misma interfaz por varias host APIs. MME en modo
    compartido puede remuestrear sin avisar, lo que agrega un rolloff cerca de
    Nyquist — justo el artefacto que confundiría la medición de planicidad.
    WASAPI da el camino más directo al driver.
    """
    hostapis = sd.query_hostapis()
    candidatos = [
        (i, hostapis[dev['hostapi']]['name'])
        for i, dev in enumerate(sd.query_devices())
        if dev['max_input_channels'] > 0 and 'scarlett' in dev['name'].lower()
    ]
    if not candidatos:
        return None
    for i, api in candidatos:
        if 'wasapi' in api.lower():
            return i
    return candidatos[0][0]


def capturar(device, fs, dur, canal):
    dev_info = sd.query_devices(device)
    n_canales = int(dev_info['max_input_channels'])
    if n_canales < 1:
        sys.exit(f'El dispositivo "{dev_info["name"]}" no tiene entradas.')
    if canal > n_canales:
        sys.exit(f'Canal {canal} pedido pero el dispositivo solo tiene {n_canales}.')

    api = sd.query_hostapis()[dev_info['hostapi']]['name']
    print(f'Dispositivo : {dev_info["name"]}  [{api}]')

    # WASAPI en modo compartido rechaza un fs distinto al configurado en Windows
    # en vez de remuestrear en silencio. Preferimos ese error a un espectro falso.
    try:
        sd.check_input_settings(device=device, samplerate=fs, channels=n_canales)
    except Exception:
        nativo = dev_info['default_samplerate']
        sys.exit(
            f'\n✗ La Scarlett está configurada a {nativo/1000:.1f} kHz en Windows, '
            f'no a {fs/1000:.0f} kHz.\n\n'
            f'  Arreglo (recomendado): ponerla a {fs/1000:.0f} kHz en Windows —\n'
            f'    Panel de control de sonido → Grabación → Scarlett 2i2 →\n'
            f'    Propiedades → Opciones avanzadas → {fs} Hz\n\n'
            f'  Alternativa: capturar al rate nativo con  --fs {nativo:.0f}\n'
            f'    Ojo: a 44.1 kHz el Nyquist es 22 kHz, así que el filtro\n'
            f'    anti-alias del ADC cae justo sobre el techo de 20 kHz que\n'
            f'    querés medir. A 48 kHz el Nyquist es 24 kHz y da margen.')

    print(f'Capturando  : {dur:.0f} s @ {fs/1000:.0f} kHz, canal {canal} de {n_canales}...')

    audio = sd.rec(int(fs * dur), samplerate=fs, channels=n_canales,
                   device=device, dtype='float32', blocking=True)
    return audio[:, canal - 1].astype(np.float64)


def revisar_nivel(sig):
    """Verifica clipping y nivel utilizable. Aborta si hay clipping."""
    pico = np.max(np.abs(sig))
    rms  = np.sqrt(np.mean(sig ** 2))
    # float32 satura exactamente en 1.0; contamos lo que roza el fondo de escala
    n_sat = int(np.sum(np.abs(sig) >= 0.999))

    print(f'\n  Pico  : {pico:.4f}  ({20*np.log10(pico + 1e-12):+.1f} dBFS)')
    print(f'  RMS   : {rms:.4f}  ({20*np.log10(rms + 1e-12):+.1f} dBFS)')
    print(f'  Cresta: {20*np.log10(pico/(rms + 1e-12)):.1f} dB   (ruido gaussiano ≈ 11-13 dB)')

    if pico >= 1.0 or n_sat > 0:
        sys.exit(f'\n✗ CLIPPING: {n_sat} muestras en fondo de escala (pico {pico:.4f}).\n'
                 f'  Bajar la ganancia de la Scarlett y repetir.')
    if pico > 0.95:
        print(f'  ⚠ Pico {pico:.3f} — muy cerca del techo, considerá bajar un poco la ganancia.')
    if pico < 0.05:
        print(f'  ⚠ Pico {pico:.3f} — señal muy baja, el ruido de fondo de la interfaz\n'
              f'    puede contaminar la medición. Subir ganancia.')
    else:
        print('  ✓ Sin clipping.')
    return pico


def sfm_db(Pxx):
    """Spectral Flatness Measure en dB. 0 dB = perfectamente plano."""
    log_mean = np.mean(np.log(Pxx + 1e-30))
    lin_mean = np.mean(Pxx)
    return 10 * np.log10(np.exp(log_mean) / (lin_mean + 1e-30))


def detectar_hum(f, P_db, f_red=F_RED, ancho=2, n_vecinos=12):
    """Mide cada armónico de red contra el piso de ruido local.

    El hum es de banda angosta y el ruido blanco de banda ancha, así que se
    pueden medir por separado: el exceso de cada línea sobre la mediana de sus
    bins vecinos dice cuánto sobresale del ruido.

    Ojo: el exceso en dB depende de nperseg. La PSD de una senoide crece con la
    resolución (toda su energía cae en un bin) mientras que la del ruido no.
    Sirve para comparar capturas con el mismo nperseg, no entre distintos.
    """
    lineas = []
    tope = min(HUM_F_MAX, f[-1])
    for k in range(1, int(tope // f_red) + 1):
        fk = f_red * k
        if fk < f[0] or fk > tope:
            continue
        idx = int(np.argmin(np.abs(f - fk)))
        lo, hi = max(0, idx - ancho), min(len(f), idx + ancho + 1)
        pico = float(np.max(P_db[lo:hi]))
        vecinos = np.concatenate([P_db[max(0, idx - n_vecinos):lo],
                                  P_db[hi:idx + n_vecinos + 1]])
        if not len(vecinos):
            continue
        piso = float(np.median(vecinos))
        lineas.append({'f': fk, 'pico': pico, 'piso': piso, 'exceso': pico - piso,
                       'lo': lo, 'hi': hi})
    return lineas


def _metricas(f, P_db, Pxx, keep):
    return {
        'nivel_medio': float(np.mean(P_db[keep])),
        'std':         float(np.std(P_db[keep])),
        'rango':       float(np.max(P_db[keep]) - np.min(P_db[keep])),
        'sfm':         float(sfm_db(Pxx[keep])),
        'f_max_pico':  float(f[keep][np.argmax(P_db[keep])]),
        'f_min_pico':  float(f[keep][np.argmin(P_db[keep])]),
    }


def analizar(sig, fs, nperseg, f_red=F_RED):
    # Welch: promedia ventanas solapadas. Una FFT única de ruido tiene ~5.6 dB
    # de desviación por bin (chi² 2 gdl) y no permitiría distinguir la
    # respuesta del generador de la varianza de la propia realización.
    f, Pxx = welch(sig, fs=fs, nperseg=nperseg, noverlap=nperseg // 2,
                   window='hann', detrend='constant')
    mask   = (f >= F_MIN) & (f <= F_MAX)
    f, Pxx = f[mask], Pxx[mask]
    P_db   = 10 * np.log10(Pxx + 1e-20)

    lineas = detectar_hum(f, P_db, f_red) if f_red else []

    # Las líneas de red no son "no planicidad" del generador: son un aditivo
    # angosto. Se miden aparte y se excluyen de la estadística de banda ancha,
    # en vez de filtrarlas (un notch dejaría huecos que la métrica leería
    # como caídas del generador).
    # Sólo se excluye la línea que de verdad sobresale del piso: marcar todo
    # múltiplo de 60 Hz por decreto borraría bins limpios y falsearía la
    # planicidad hacia un resultado bueno.
    keep = np.ones(len(f), dtype=bool)
    for ln in lineas:
        if ln['exceso'] > HUM_VIS:
            keep[ln['lo']:ln['hi']] = False

    n_ventanas = max(1, (len(sig) - nperseg // 2) // (nperseg // 2))
    m = _metricas(f, P_db, Pxx, keep)
    m.update({
        'n_ventanas': n_ventanas,
        'resolucion': fs / nperseg,
        'lineas':     lineas,
        'bins_excl':  int(np.sum(~keep)),
        'con_hum':    _metricas(f, P_db, Pxx, np.ones(len(f), dtype=bool)),
    })
    return f, P_db, m


def reportar_hum(m, f_red=F_RED):
    lineas = m['lineas']
    if not lineas:
        return
    peor = max(lineas, key=lambda l: l['exceso'])
    print(f'\n{"─"*56}')
    print(f'  RED ELÉCTRICA  ({f_red:.0f} Hz y armónicos)')
    print(f'{"─"*56}')
    visibles = [ln for ln in lineas if ln['exceso'] > 3.0][:8]
    if not visibles:
        print(f'  ✓ Sin líneas de red detectables sobre el piso de ruido.')
        return
    for ln in visibles:
        marca = '✗' if ln['exceso'] > HUM_OK else '⚠'
        print(f'  {ln["f"]:6.0f} Hz : {ln["exceso"]:+5.1f} dB sobre el piso  {marca}')
    print(f'\n  Peor línea: {peor["f"]:.0f} Hz a {peor["exceso"]:+.1f} dB (ref < {HUM_OK:.0f} dB)')
    if peor['exceso'] > HUM_OK:
        print(f'  ➜  HUM SIGNIFICATIVO — ver README, sección "Zumbido de 60 Hz" ✗')
    else:
        print(f'  ➜  Hum presente pero por debajo del umbral ✓')


def reportar(m):
    ok_std = m['std']   < STD_OK
    ok_rng = m['rango'] < RANGO_OK
    ok_sfm = m['sfm']   > SFM_OK

    print(f'\n{"─"*56}')
    print(f'  PLANICIDAD  ({F_MIN} Hz – {F_MAX/1000:.0f} kHz)')
    print(f'{"─"*56}')
    print(f'  Ventanas Welch : {m["n_ventanas"]}   (resolución {m["resolucion"]:.1f} Hz/bin)')
    if m['bins_excl']:
        print(f'  Bins excluidos : {m["bins_excl"]}  (líneas de red — se miden aparte)')
        print(f'  Rango con hum  : {m["con_hum"]["rango"]:.2f} dB  → sin hum: {m["rango"]:.2f} dB')
    print(f'  Nivel medio    : {m["nivel_medio"]:.2f} dB/Hz')
    print(f'  Desv. estándar : {m["std"]:.2f} dB     {"✓" if ok_std else "✗"}  (ref < {STD_OK} dB)')
    print(f'  Rango max-min  : {m["rango"]:.2f} dB     {"✓" if ok_rng else "✗"}  (ref < {RANGO_OK} dB)')
    print(f'  SFM            : {m["sfm"]:+.2f} dB     {"✓" if ok_sfm else "✗"}  (ref > {SFM_OK} dB)')
    print(f'  Pico máximo en : {m["f_max_pico"]:.0f} Hz')
    print(f'  Valle mínimo en: {m["f_min_pico"]:.0f} Hz')
    print(f'\n  ➜  {"ESPECTRO PLANO — apto para el FRA ✓" if (ok_std and ok_rng and ok_sfm) else "NO PLANO — revisar el generador ✗"}')


def graficar(f, P_db, m, salida):
    media = m['nivel_medio']

    fig, ax = plt.subplots(figsize=(12, 5), facecolor=FONDO)
    ax.semilogx(f, P_db, color=ACCENT2, lw=0.9, alpha=0.9, label='PSD medida (Welch)')
    ax.fill_between(f, P_db, media - 30, color=ACCENT2, alpha=0.07)

    ax.axhline(media, color=AMBAR, lw=1.2, ls='--', alpha=0.8,
               label=f'nivel medio: {media:.1f} dB/Hz')
    ax.axhline(media + 3, color=AMBAR, lw=0.7, ls=':', alpha=0.6, label='±3 dB')
    ax.axhline(media - 3, color=AMBAR, lw=0.7, ls=':', alpha=0.6)
    ax.fill_between(f, media - 3, media + 3, color=AMBAR, alpha=0.05)

    # Líneas de red: marcarlas para que se vean como lo que son — aditivo
    # angosto de 60 Hz, no una respuesta del generador.
    visibles = [ln for ln in m['lineas'] if ln['exceso'] > 3.0]
    for n, ln in enumerate(visibles):
        ax.axvline(ln['f'], color=ROJO, lw=0.8, ls=':', alpha=0.55,
                   label='líneas de red (excluidas)' if n == 0 else None)
    if visibles:
        peor = max(visibles, key=lambda l: l['exceso'])
        ax.annotate(f'{peor["f"]:.0f} Hz  {peor["exceso"]:+.1f} dB',
                    xy=(peor['f'], peor['pico']),
                    xytext=(peor['f'] * 1.6, peor['pico'] + 6),
                    color=ROJO, fontsize=8,
                    arrowprops=dict(arrowstyle='->', color=ROJO, lw=0.8, alpha=0.7))

    apto  = m['std'] < STD_OK and m['rango'] < RANGO_OK
    ax.text(0.985, 0.06, '✓ PLANO' if apto else '✗ NO PLANO',
            transform=ax.transAxes, ha='right', va='bottom',
            color=ACCENT2 if apto else ROJO, fontsize=12, fontweight='bold')
    ax.text(0.985, 0.16,
            f'std {m["std"]:.2f} dB  |  rango {m["rango"]:.2f} dB  |  SFM {m["sfm"]:+.2f} dB',
            transform=ax.transAxes, ha='right', va='bottom', color='#889', fontsize=8)

    # El techo se estira para que las líneas de red entren enteras: un pico de
    # hum cortado por el borde esconde justo lo que hay que ver.
    techo = media + 20
    if visibles:
        techo = max(techo, max(ln['pico'] for ln in visibles) + 10)
    ax.set_xlim(F_MIN, F_MAX)
    ax.set_ylim(media - 20, techo)
    ax.set_xlabel('Frecuencia (Hz)', color='#aaa')
    ax.set_ylabel('PSD (dB/Hz)', color='#aaa')
    ax.set_title('Generador de ruido blanco — espectro medido por Scarlett 2i2',
                 color='#7eb8f7', fontsize=12, pad=12)
    ax.set_xticks([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000])
    ax.set_xticklabels(['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'],
                       color='#667')
    ax.tick_params(colors='#556')
    ax.legend(facecolor=FONDO, edgecolor='#1a2030', labelcolor='#aaa', fontsize=9,
              loc='upper right')
    ax.set_facecolor(FONDO)
    for spine in ax.spines.values():
        spine.set_edgecolor('#1a2030')

    plt.tight_layout()
    plt.savefig(salida, dpi=150, facecolor=FONDO, bbox_inches='tight')
    print(f'\nGráfico guardado: {salida}')


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--list', action='store_true', help='listar dispositivos de audio y salir')
    p.add_argument('--device', type=int, default=None, help='índice del dispositivo (default: autodetecta Scarlett)')
    p.add_argument('--fs', type=int, default=FS)
    p.add_argument('--dur', type=float, default=DURACION, help='segundos de captura')
    p.add_argument('--nperseg', type=int, default=NPERSEG, help='tamaño de ventana Welch')
    p.add_argument('--channel', type=int, default=1, help='canal de entrada (1 o 2)')
    p.add_argument('--wav', default=None, help='analizar un .wav existente en vez de capturar')
    p.add_argument('--red', type=float, default=F_RED,
                   help='frecuencia de red a medir y excluir; 0 desactiva (default: 60)')
    p.add_argument('--out', default='espectro_ruido.png')
    args = p.parse_args()

    if args.list:
        listar_dispositivos()
        return

    if args.wav:
        entrada = Path(args.wav)
        if not entrada.exists() and len(entrada.parts) == 1:
            entrada = DIR_WAV / entrada.name   # nombre suelto → buscar en capturas/
        if not entrada.exists():
            sys.exit(f'No existe: {args.wav}')
        fs, data = wavfile.read(entrada)
        sig = data[:, 0] if data.ndim > 1 else data
        sig = sig.astype(np.float64)
        if np.issubdtype(data.dtype, np.integer):
            sig /= np.iinfo(data.dtype).max
        print(f'Analizando {entrada}  ({len(sig)/fs:.1f} s @ {fs/1000:.1f} kHz)')
    else:
        device = args.device if args.device is not None else buscar_scarlett()
        if device is None:
            sys.exit('No se encontró ninguna Scarlett. Correr con --list y pasar --device N.')
        fs  = args.fs
        sig = capturar(device, fs, args.dur, args.channel)

        wav_out = ruta_salida(Path(args.out).stem + '.wav', DIR_WAV)
        wavfile.write(wav_out, fs, sig.astype(np.float32))
        print(f'Audio crudo guardado: {wav_out}')

    revisar_nivel(sig)
    f, P_db, metricas = analizar(sig, fs, args.nperseg, f_red=args.red)
    reportar_hum(metricas, args.red)
    reportar(metricas)
    graficar(f, P_db, metricas, ruta_salida(args.out, DIR_IMG))


if __name__ == '__main__':
    main()

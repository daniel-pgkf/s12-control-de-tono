"""
Analizador de Bode en tiempo real del FRA.

Captura los dos canales de la Scarlett 2i2 —canal 1 = entrada (ruido del
generador), canal 2 = salida (después del DUT)— y muestra en vivo la función de
transferencia H(f) = ADC₂/ADC₁ del sistema: magnitud, fase y coherencia.

La app NO reproduce audio: el ruido lo genera el hardware externo. Solo escucha.

Uso:
    python fra_bode_live.py --list         # ver dispositivos y su índice
    python fra_bode_live.py                # abrir el analizador en vivo
    python fra_bode_live.py --device 17
    python fra_bode_live.py --test         # verificar la matemática sin hardware

En la ventana:  g = guardar snapshot   ·   q = cerrar

Contraparte en tiempo real de la demo de Bode en ../codigos/ruido_blanco.ipynb.
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from scipy.signal import csd, welch, coherence

# La consola de Windows usa cp1252 y no puede imprimir ✓ / ≈ del reporte.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        _stream.reconfigure(encoding='utf-8')

# Salidas junto al script, no al cwd.
DIR_SCRIPT = Path(__file__).resolve().parent
DIR_IMG    = DIR_SCRIPT / 'imagenes'
DIR_WAV    = DIR_SCRIPT / 'capturas'

# ── Parámetros por defecto ──────────────────────────────────────────
FS        = 48_000
NPERSEG   = 4096
F_MIN     = 20
F_MAX     = 20_000
BUFFER_S  = 2.0     # segundos de historia para cada estimación
REFRESH_MS = 400    # cada cuánto se redibuja
ALPHA     = 0.7     # olvido exponencial de los espectros (estabilidad vs respuesta)
COH_MIN   = 0.9     # bajo esto, la fase no es confiable

# Paleta — misma que ruido_blanco.ipynb
ACCENT  = '#4a9eff'
ACCENT2 = '#4ecb71'
AMBAR   = '#f0a020'
ROJO    = '#ff6060'
VIOLETA = '#b060e0'
GRAY    = '#445566'
FONDO   = '#0d0d1a'


# ── Helpers de audio (copiadas de generador-ruido-blanco/captura_planicidad.py,
#    estables; se duplican a propósito para no acoplar los dos scripts) ──────
def buscar_scarlett():
    """Índice de la entrada Scarlett, prefiriendo WASAPI.

    Windows expone la misma interfaz por varias host APIs. MME en modo
    compartido puede remuestrear sin avisar; WASAPI da el camino directo al
    driver y rechaza un rate que no coincide en vez de falsear la medición.
    """
    import sounddevice as sd
    hostapis = sd.query_hostapis()
    candidatos = [
        (i, hostapis[dev['hostapi']]['name'])
        for i, dev in enumerate(sd.query_devices())
        if dev['max_input_channels'] >= 2 and 'scarlett' in dev['name'].lower()
    ]
    if not candidatos:
        return None
    for i, api in candidatos:
        if 'wasapi' in api.lower():
            return i
    return candidatos[0][0]


def verificar_rate(device, fs):
    """Aborta con instrucciones si la interfaz no está al fs pedido."""
    import sounddevice as sd
    dev_info = sd.query_devices(device)
    if int(dev_info['max_input_channels']) < 2:
        sys.exit(f'El dispositivo "{dev_info["name"]}" no tiene 2 canales de entrada.')
    api = sd.query_hostapis()[dev_info['hostapi']]['name']
    try:
        sd.check_input_settings(device=device, samplerate=fs, channels=2)
    except Exception:
        nativo = dev_info['default_samplerate']
        sys.exit(
            f'\n✗ La Scarlett está a {nativo/1000:.1f} kHz en Windows, no a {fs/1000:.0f} kHz.\n\n'
            f'  Ponerla a {fs/1000:.0f} kHz: Panel de sonido → Grabación → Scarlett 2i2 →\n'
            f'    Propiedades → Opciones avanzadas → {fs} Hz\n'
            f'  O correr con  --fs {nativo:.0f}  (a 44.1 kHz el Nyquist es 22 kHz).')
    return dev_info['name'], api


def ruta_salida(nombre, carpeta):
    p = Path(nombre)
    if p.is_absolute() or len(p.parts) > 1:
        return p
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta / p.name


# ── Núcleo de cálculo (testeable sin hardware ni pantalla) ──────────────────
def calcular_bode(x, y, fs, nperseg):
    """Estimador H1: H = Gxy/Gxx. Devuelve f, magnitud dB, fase °, coherencia,
    y los espectros crudos Gxy/Gxx para el promedio exponencial en vivo."""
    nps = min(nperseg, len(x))
    f, Gxy = csd(x, y, fs=fs, nperseg=nps, noverlap=nps // 2, window='hann')
    _, Gxx = welch(x,   fs=fs, nperseg=nps, noverlap=nps // 2, window='hann')
    _, coh = coherence(x, y, fs=fs, nperseg=nps, noverlap=nps // 2, window='hann')
    return f, Gxy, Gxx, coh


def bode_desde_espectros(f, Gxy, Gxx, coh):
    """De Gxy/Gxx (posiblemente promediados) a magnitud, fase y coherencia,
    recortado a la banda audible."""
    H    = Gxy / (Gxx + 1e-30)
    mag  = 20 * np.log10(np.abs(H) + 1e-12)
    fase = np.unwrap(np.angle(H)) * 180 / np.pi
    mask = (f >= F_MIN) & (f <= F_MAX)
    return f[mask], mag[mask], fase[mask], coh[mask]


# ── Detección del polo y predicción de R ────────────────────────────────────
def _interp_log(f1, m1, f2, m2, objetivo):
    """Interpola la frecuencia del cruce en escala log, entre dos bins."""
    if m2 == m1:
        return f1
    t = (objetivo - m1) / (m2 - m1)
    return 10 ** (np.log10(f1) + t * (np.log10(f2) - np.log10(f1)))


def estimar_polo(f, mag, coh, coh_min=COH_MIN):
    """Encuentra la fc (−3 dB) de un RC de 1er orden, sólo en la zona donde la
    coherencia es confiable. El −3 dB es relativo a la banda de paso (no a 0 dB
    absoluto), así que cualquier ganancia/pérdida fija de la cadena no lo corre.
    Devuelve dict {fc, tipo, ref} o None si no hay un codo claro."""
    ok = coh >= coh_min
    if ok.sum() < 10:
        return None
    fo, mo = f[ok], mag[ok]
    # Suavizado con padding de borde: 'same' a secas hunde los extremos
    # (promedia con ceros afuera) y corría la referencia de graves hacia abajo.
    k = min(5, len(mo) | 1)          # impar para que el pad quede simétrico
    pad = k // 2
    ms = np.convolve(np.pad(mo, pad, mode='edge'), np.ones(k) / k, mode='valid')

    # La banda de paso de un RC de 1er orden está SIEMPRE en un extremo. La
    # referencia se toma de una ventana chica en el borde: el eje es lineal en
    # bins, así que un 10% de los bins ya se mete en la caída y falsea el nivel.
    w = max(3, min(8, len(ms) // 4))
    ref_low  = float(np.median(ms[:w]))    # nivel en graves (borde inferior)
    ref_high = float(np.median(ms[-w:]))   # nivel en agudos (borde superior)

    if ref_low >= ref_high:                    # banda de paso abajo → pasa-bajos
        tipo, ref = 'pasa-bajos', ref_low
        obj = ref - 3.01
        for i in range(1, len(fo)):
            if ms[i - 1] >= obj >= ms[i]:
                return {'fc': _interp_log(fo[i - 1], ms[i - 1], fo[i], ms[i], obj),
                        'tipo': tipo, 'ref': ref}
    else:                                      # banda de paso arriba → pasa-altos
        tipo, ref = 'pasa-altos', ref_high
        obj = ref - 3.01
        for i in range(len(fo) - 2, -1, -1):
            if ms[i + 1] >= obj >= ms[i]:
                return {'fc': _interp_log(fo[i + 1], ms[i + 1], fo[i], ms[i], obj),
                        'tipo': tipo, 'ref': ref}
    return None


def parse_capacitancia(texto):
    """'100n', '100nF', '0.1u', '4.7e-9' → faradios. None si no se entiende."""
    t = texto.strip().lower().replace('µ', 'u').replace('f', '')
    if not t:
        return None
    mult = 1.0
    for suf, m in (('p', 1e-12), ('n', 1e-9), ('u', 1e-6), ('m', 1e-3)):
        if t.endswith(suf):
            mult, t = m, t[:-1]
            break
    try:
        return float(t) * mult
    except ValueError:
        return None


def predecir_R(fc, C):
    """R = 1 / (2π·fc·C), despejado del polo."""
    return 1.0 / (2 * np.pi * fc * C)


def fmt_ohm(r):
    if r >= 1e6:
        return f'{r/1e6:.2f} MΩ'
    if r >= 1e3:
        return f'{r/1e3:.2f} kΩ'
    return f'{r:.0f} Ω'


def fmt_farad(c):
    for u, s in ((1e-6, 'µF'), (1e-9, 'nF'), (1e-12, 'pF')):
        if c >= u:
            return f'{c/u:.3g} {s}'
    return f'{c:.2e} F'


# ── Verificación headless: RC conocido ──────────────────────────────────────
def _test():
    from scipy.signal import lfilter
    fs, fc = 48_000, 1_000.0
    RC = 1 / (2 * np.pi * fc)
    n = int(fs * BUFFER_S)
    np.random.seed(7)
    x = np.random.randn(n)
    a = np.exp(-1 / (RC * fs))
    y = lfilter([1 - a], [1, -a], x)                    # RC pasa-bajos discreto
    y += np.random.randn(n) * np.std(y) / 100           # SNR ~40 dB

    f, Gxy, Gxx, coh = calcular_bode(x, y, fs, NPERSEG)
    fb, mag, fase, cohb = bode_desde_espectros(f, Gxy, Gxx, coh)

    i_fc = int(np.argmin(np.abs(fb - fc)))
    print(f'{"─"*52}')
    print(f'  TEST — RC pasa-bajos, fc teórica = {fc:.0f} Hz')
    print(f'{"─"*52}')
    print(f'  Magnitud en fc : {mag[i_fc]:+.2f} dB      (teórico −3.01 dB)')
    print(f'  Fase en fc     : {fase[i_fc]:+.1f}°        (teórico −45°)')
    print(f'  Coherencia med : {np.mean(cohb):.4f}       (teórico ≈ 1)')
    # Detección automática del polo
    polo = estimar_polo(fb, mag, cohb)
    C_prueba = 100e-9
    if polo:
        R_pred = predecir_R(polo['fc'], C_prueba)
        print(f'  Polo detectado : {polo["fc"]:.0f} Hz  ({polo["tipo"]})')
        print(f'  R predicha     : con C = {fmt_farad(C_prueba)} → {fmt_ohm(R_pred)}')
        print(f'                   (R teórica para fc={fc:.0f}, C=100nF: '
              f'{fmt_ohm(predecir_R(fc, C_prueba))})')
    else:
        print('  Polo detectado : — (no se halló codo)')

    ok = (abs(mag[i_fc] + 3.01) < 1.0 and abs(fase[i_fc] + 45) < 8
          and np.mean(cohb) > 0.95
          and polo is not None and abs(polo['fc'] - fc) / fc < 0.05)
    print(f'\n  ➜  {"MATEMÁTICA OK ✓" if ok else "REVISAR ✗"}')
    return 0 if ok else 1


# ── App en vivo ─────────────────────────────────────────────────────────────
def correr_live(device, fs, nperseg, buffer_s, refresh_ms, alpha):
    import sounddevice as sd
    import matplotlib
    matplotlib.use('TkAgg')
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation
    from matplotlib.widgets import TextBox

    nombre, api = verificar_rate(device, fs)
    print(f'Dispositivo : {nombre}  [{api}]')
    print(f'Escuchando  : 2 canales @ {fs/1000:.0f} kHz  (ch1=entrada, ch2=salida DUT)')
    print(f'Ventana     : {buffer_s:.0f} s · nperseg {nperseg} · refresh {refresh_ms} ms · α {alpha}')
    print('En la ventana:  g = guardar   ·   q = cerrar')

    n_buf = int(fs * buffer_s)
    buf = np.zeros((n_buf, 2), dtype=np.float64)

    def callback(indata, frames, time_info, status):
        if status:
            print(status, file=sys.stderr)
        buf[:-frames] = buf[frames:]
        buf[-frames:] = indata

    estado = {'Gxy': None, 'Gxx': None, 'C': None}

    # ── Figura: 3 paneles + espacio abajo para el campo de C ──
    fig, (ax_m, ax_f, ax_c) = plt.subplots(3, 1, figsize=(11, 8.4), sharex=True,
                                           facecolor=FONDO)
    fig.subplots_adjust(left=0.09, right=0.97, top=0.92, bottom=0.13, hspace=0.15)
    fig.suptitle('FRA — Bode en tiempo real   H(f) = ADC₂ / ADC₁',
                 color='#7eb8f7', fontsize=13)

    f0 = np.linspace(F_MIN, F_MAX, 100)
    ln_mag,  = ax_m.semilogx(f0, np.zeros_like(f0), color=ACCENT2, lw=1.3)
    ln_fase, = ax_f.semilogx(f0, np.zeros_like(f0), color=ACCENT,  lw=1.3)
    ln_fase_lo, = ax_f.semilogx(f0, np.full_like(f0, np.nan), color=ACCENT,
                                lw=1.3, alpha=0.15)   # tramos de baja coherencia
    ln_coh,  = ax_c.semilogx(f0, np.zeros_like(f0), color=VIOLETA, lw=1.3)
    ax_c.axhline(COH_MIN, color=ACCENT2, lw=0.8, ls='--', alpha=0.6)
    ax_c.fill_between(f0, 0, COH_MIN, color=ROJO, alpha=0.04)

    ax_m.set_ylabel('Magnitud (dB)', color='#aaa')
    ax_f.set_ylabel('Fase (°)', color='#aaa')
    ax_c.set_ylabel('Coherencia γ²', color='#aaa')
    ax_c.set_xlabel('Frecuencia (Hz)', color='#aaa')
    ax_m.set_ylim(-60, 10)
    ax_f.set_ylim(-200, 200)
    ax_c.set_ylim(0, 1.05)

    txt = ax_m.text(0.01, 0.05, '', transform=ax_m.transAxes, color='#889',
                    fontsize=8, va='bottom', family='monospace')

    # Marca del polo detectado: línea vertical en fc (magnitud y fase) + rótulo.
    ln_fc_m = ax_m.axvline(np.nan, color=AMBAR, lw=1.0, ls='--', alpha=0.8)
    ln_fc_f = ax_f.axvline(np.nan, color=AMBAR, lw=1.0, ls='--', alpha=0.8)
    txt_polo = ax_m.text(0.99, 0.92, '', transform=ax_m.transAxes, color=AMBAR,
                         fontsize=10, va='top', ha='right', family='monospace',
                         fontweight='bold')

    for ax in (ax_m, ax_f, ax_c):
        ax.set_xlim(F_MIN, F_MAX)
        ax.set_facecolor(FONDO)
        ax.tick_params(colors='#556')
        ax.grid(True, which='both', color='#1a2030', lw=0.5)
        ax.set_xticks([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000])
        ax.set_xticklabels(['20', '50', '100', '200', '500', '1k', '2k', '5k',
                            '10k', '20k'], color='#667', fontsize=8)
        for spine in ax.spines.values():
            spine.set_edgecolor('#1a2030')

    # ── Campo para escribir la capacitancia ──
    ax_box = fig.add_axes([0.15, 0.03, 0.16, 0.045])
    ax_box.set_facecolor('#141420')
    box_C = TextBox(ax_box, 'C = ', initial='', color='#141420',
                    hovercolor='#1c1c2c', label_pad=0.08)
    box_C.label.set_color('#aaa')
    box_C.text_disp.set_color('#e0e0e0')
    fig.text(0.32, 0.045, "  ej: 100n · 0.1u · 4.7n   (Enter para fijar)",
             color='#667', fontsize=8, va='center')

    def submit_C(text):
        estado['C'] = parse_capacitancia(text)
        if text.strip() and estado['C'] is None:
            print(f'No entendí la capacitancia: {text!r}', file=sys.stderr)
    box_C.on_submit(submit_C)

    def actualizar(_):
        x, y = buf[:, 0].copy(), buf[:, 1].copy()
        pico_x, pico_y = np.max(np.abs(x)), np.max(np.abs(y))

        f, Gxy, Gxx, coh = calcular_bode(x, y, fs, nperseg)
        # Promedio exponencial de los espectros complejos → Bode estable en vivo.
        if estado['Gxy'] is None:
            estado['Gxy'], estado['Gxx'] = Gxy, Gxx
        else:
            estado['Gxy'] = alpha * estado['Gxy'] + (1 - alpha) * Gxy
            estado['Gxx'] = alpha * estado['Gxx'] + (1 - alpha) * Gxx

        fb, mag, fase, cohb = bode_desde_espectros(f, estado['Gxy'], estado['Gxx'], coh)

        ln_mag.set_data(fb, mag)
        ln_coh.set_data(fb, cohb)
        # Fase: sólida donde la coherencia es buena, fantasma donde no.
        conf = cohb >= COH_MIN
        ln_fase.set_data(fb, np.where(conf, fase, np.nan))
        ln_fase_lo.set_data(fb, np.where(~conf, fase, np.nan))

        clip = ''
        if pico_x >= 0.999 or pico_y >= 0.999:
            clip = '  ⚠ CLIPPING'
        txt.set_text(
            f'ch1 {20*np.log10(pico_x+1e-9):+5.1f} dBFS   '
            f'ch2 {20*np.log10(pico_y+1e-9):+5.1f} dBFS   '
            f'γ² med {np.mean(cohb):.2f}{clip}')
        txt.set_color(ROJO if clip else '#889')

        # Polo detectado + predicción de R
        polo = estimar_polo(fb, mag, cohb)
        if polo:
            fc_v = polo['fc']
            ln_fc_m.set_xdata([fc_v, fc_v])
            ln_fc_f.set_xdata([fc_v, fc_v])
            linea = f'{polo["tipo"]}   fc = {fc_v:.0f} Hz'
            if estado['C']:
                R = predecir_R(fc_v, estado['C'])
                linea += f'\nC = {fmt_farad(estado["C"])} → R ≈ {fmt_ohm(R)}'
            txt_polo.set_text(linea)
        else:
            ln_fc_m.set_xdata([np.nan, np.nan])
            ln_fc_f.set_xdata([np.nan, np.nan])
            txt_polo.set_text('fc: —  (sin codo claro en zona confiable)')

        return ln_mag, ln_fase, ln_fase_lo, ln_coh, txt, ln_fc_m, ln_fc_f, txt_polo

    def on_key(event):
        if event.key == 'g':
            DIR_IMG.mkdir(parents=True, exist_ok=True)
            from datetime import datetime
            out = DIR_IMG / f'bode_{datetime.now():%Y%m%d_%H%M%S}.png'
            fig.savefig(out, dpi=150, facecolor=FONDO, bbox_inches='tight')
            print(f'Snapshot guardado: {out}')
        elif event.key == 'q':
            plt.close(fig)

    fig.canvas.mpl_connect('key_press_event', on_key)

    with sd.InputStream(samplerate=fs, channels=2, device=device,
                        dtype='float32', callback=callback):
        _anim = FuncAnimation(fig, actualizar, interval=refresh_ms,
                              blit=False, cache_frame_data=False)
        plt.show()


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--list', action='store_true', help='listar dispositivos y salir')
    p.add_argument('--test', action='store_true', help='verificar la matemática sin hardware')
    p.add_argument('--device', type=int, default=None, help='índice (default: autodetecta Scarlett)')
    p.add_argument('--fs', type=int, default=FS)
    p.add_argument('--nperseg', type=int, default=NPERSEG)
    p.add_argument('--buffer', type=float, default=BUFFER_S, help='segundos de historia')
    p.add_argument('--refresh', type=int, default=REFRESH_MS, help='ms entre redibujos')
    p.add_argument('--alpha', type=float, default=ALPHA, help='olvido exponencial 0-1')
    args = p.parse_args()

    if args.list:
        import sounddevice as sd
        print(sd.query_devices())
        print('\nUsar el número de la izquierda con --device N')
        return
    if args.test:
        sys.exit(_test())

    device = args.device if args.device is not None else buscar_scarlett()
    if device is None:
        sys.exit('No se encontró Scarlett con 2 canales. Correr con --list y pasar --device N.')
    correr_live(device, args.fs, args.nperseg, args.buffer, args.refresh, args.alpha)


if __name__ == '__main__':
    main()

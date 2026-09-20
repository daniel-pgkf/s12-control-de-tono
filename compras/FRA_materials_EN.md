# Control de Tono — S12 — Bill of Materials (FRA)

## Project description

Control de Tono is a project that aims to introduce cross-cutting electronic engineering concepts in a technical but didactic way, for first-semester electronic engineering students. Audio systems are used as the case study: through them, students discover and learn to read tools such as Bode plots and filters.

Methodologically, the project centers on the design of a Frequency Response Analyzer (FRA) that generates visualizations of audio characteristics throughout the course, covering the full audible range (20 Hz – 20 kHz).

You can learn more about the project in the repository below, as well as in our Notion.

* [github.com/daniel-pgkf/s12-control-de-tono](https://github.com/daniel-pgkf/s12-control-de-tono)
* [app.notion.com/p/S12-Control-de-Tono-118f673dc6af8283b432819cb4957f24?source=copy_link](https://app.notion.com/p/S12-Control-de-Tono-118f673dc6af8283b432819cb4957f24?source=copy_link)

### Hardware architecture

- **Input chain**: 1/4" mono jack → high-impedance buffer (~1 MΩ) with gain pot → mode switch (guitar / white noise) → ADC₁ (96 kSps, I²S)
- **DUT slot**: 4-terminal modular connector for the network under test
- **Output chain**: ADC₂ (96 kSps, synchronized) → output buffer + speaker driver → 1/4" mono jack
- **Microcontroller**: captures both ADCs over I²S, computes input/output FFTs, computes H(f) = FFT(output)/FFT(input), drives the mode switch, footswitch and 6 programmable buttons, and streams data to the PC over USB
- **White noise generator**: excitation signal used to obtain the frequency response and Bode plot (flat spectrum, so the whole range is measured in a single 500 ms to 1 s capture)

---

## Bill of materials

Exchange rate used for the item priced in COP: 1 USD ≈ 3.445 COP (current rate, subject to change).

| Component | Function in the FRA | Qty to order | Unit price | Subtotal | Link |
| --- | --- | --- | --- | --- | --- |
| 1/4" stereo female PCB-mount jack (DAIERTEK, 18 pcs) | Input and output jacks | 1 | US$13.99 | US$13.99 | https://www.amazon.com/dp/B097BDHV5Y |
| ESP32-S3 N16R8 WROOM-1 (Hosyond, 3-pack) | Microcontroller (the doc specifies ESP32-C3 Mini) | 1 | US$18.99 | US$18.99 | https://www.amazon.com/dp/B0F5QCK6X5 |
| PCM1808 ADC 24-bit/105 dB (GODIYMODULES) | ADC₁ and ADC₂, 96 kSps I²S | 4 | US$6.99 | US$27.96 | https://www.amazon.com/dp/B0D9LNGBD1 |
| PCM5102A I²S DAC (GODIYMODULES, 2 units/listing) | Digital-to-analog conversion for monitoring/output | 2 | US$8.88 | US$17.76 | https://www.amazon.com/dp/B0DNW32Y46 |
| NE5532P, low-noise dual op-amp | High-impedance input buffer / output buffer | 1 | US$6.99 | US$6.99 | https://www.amazon.com/dp/B0FPQLWVSD |
| TLE2426CLP, TO-92 rail splitter | Supply midpoint (bias) for analog stages on a single supply | 1 (5 units/lot) | ≈US$7.74 ($26.674 COP) | ≈US$7.74 | https://es.aliexpress.com/item/1005010260337368.html |
| 3PDT footswitch + PCB + washer (5 pcs) | Pedal/Bode mode switch, true bypass | 1 | US$15.90 | US$15.90 | https://www.amazon.com/dp/B01HJDJ1PA |
| Taiss MTS-202, mini toggle DPDT 6-pin ON/ON, 6 A 125 VAC (10 pcs) | MANUAL mode switch (guitar / noise) and power; DPDT switches signal and return together | 1 | US$8.66 | US$8.66 | https://www.amazon.com/dp/B0799KM8T6 |
| PAM8302, 2.5 W class-D amplifier (JESSINIE, 5 units) | Speaker driver in the output chain | 1 | US$9.95 | US$9.95 | https://www.amazon.com/dp/B0BG2F3LMP |
| Tactile button kit 12x12x7.3 mm, 8 values (EGSCST, 120 pcs) | 6 programmable buttons | 1 | US$8.99 | US$8.99 | https://www.amazon.com/dp/B0G2CRTDPX |
| Linear 50K potentiometer, single shaft (Ferwooh, 10 pcs/lot) | Input gain pot (10K/50K/250K/500K for testing) | 4 | US$6.99 | US$27.96 | https://www.amazon.com/dp/B0CZ73Z347 |
| Resistor kit, 25 values, 1000 pcs (BOJACK) | Assorted passives / test DUT networks | 1 | US$9.99 | US$9.99 | https://www.amazon.com/dp/B08FD1XVL6 |
| Electrolytic capacitor kit, 24 values, 240 pcs (ALLECIN) | Assorted passives / test DUT networks | 1 | US$9.99 | US$9.99 | https://www.amazon.com/dp/B0C1VBXCQM |
| Mini breadboard, 170 points (CHANZON, 6 pcs) | Prototyping the input/output chains | 3 | US$7.99 | US$23.97 | https://www.amazon.com/dp/B07LF71ZTS |

**Total: US$208.84** (excluding shipping; shipping varies depending on whether orders are grouped under the same Amazon seller)

import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// Neonhorisontti: tumma avaruus ja musta aukko, jonka kertymäkiekko pyörii ja
// jonka painovoima taittaa kiekon takaosan ja taustatähdet kaariksi. Koko ruudun
// peittää harva bittikenttä, jonka yli valoaalto liukuu kohti aukkoa, ja muutama
// bitti valuu kierteellä aukkoon.
// Vain tumma tila.
//
// Keveys (0.5.0): tausta on yksi SVG, ja jokainen liikkuva osa pakottaa
// piirtämään oman alueensa uudelleen. Siksi isot pinnat (bittikentän aalto,
// linssikaaret ja aukon vaellus) vaihtuvat vain TICK-tahdissa ja kaikki samalla
// ruudunpäivityksellä. Sumennussuodattimet on korvattu liukuväreillä, ja iso
// syaani sumu on paikallaan. Sulavasti liikkuvat vain pienet osat.
//
// Ruudun säästö (0.5.0): aukko vaeltaa hitaasti noin 90 × 70 yksikön alueella,
// yksikön kerrallaan, jotta kirkkaat renkaat eivät pala näyttöön aina samaan
// kohtaan. Valkoisimmat renkaat on himmennetty hieman.
const { theme, problems } = makeColors({
  label: 'Neonhorisontti',
  only: 'dark',
  roles: { accent: '#00c8e8', danger: '#ff4d6a', success: '#2fd98a', warning: '#f5b43c', pro: '#d14bff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#070a12',
        'surface-1': '#0b101b',
        'surface-2': '#101624',
        'surface-3': '#131b2b',
        'text-primary': '#e4f1ff',
        'text-secondary': '#b4c6dc',
        'text-muted': '#8ea2bb',
      },
    },
  },
})

const CYAN = '#22e0ff'
const MAGENTA = '#e04bff'
const HOT = '#eaffff'

// Isojen pintojen päivitystahti sekunteina. Aallon, linssin ja vaelluksen
// kestot ja viiveet ovat sen monikertoja, joten ne vaihtuvat samalla hetkellä.
const TICK = 1 / 3

// Aukon paikka, varjon säde ja kiekon kallistus.
const PX = 1180
const PY = 540
const R = 112
const TILT = -20
const SQUASH = 0.2
const HOLE = `translate(${PX} ${PY}) rotate(${TILT})`

// Vaellus: aukko siirtyy yksikön kerrallaan edestakaisin kummallakin akselilla.
// Eri pituiset kierrokset (704 s ja 476 s) kattavat koko alueen tasaisesti.
const DRIFT_X = 44 // yksikköä keskeltä kumpaankin suuntaan
const DRIFT_Y = 34
const DRIFT_X_STEP = 8 // sekuntia yksikköä kohden, TICKin monikerta
const DRIFT_Y_STEP = 7

// Linssikaarten hidas kierto, askel TICKin välein.
const LENS_SECONDS = 400

// Sama "satunnainen" kuvio joka kerta.
let seed = 23
const rand = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648

  return seed / 2147483648
}

// Tähdet: aukon lähellä ei pisteitä, siellä ne näkyvät taipuneina kaarina.
const stars: string[] = []
for (let i = 0; i < 70; i++) {
  const x = Math.round(rand() * 1600)
  const y = Math.round(rand() * 1000)
  const r = (0.5 + rand() * 1.0).toFixed(1)

  if (Math.hypot(x - PX, y - PY) > 390) {
    stars.push(`<circle class="tw tw${i % 4}" cx="${x}" cy="${y}" r="${r}" fill="#dcecff"/>`)
  }
}

// Linssikaaret: mitä lähempänä aukkoa, sitä pidemmäksi tähti venyy.
const arcs: string[] = []
for (let i = 0; i < 26; i++) {
  const rho = 188 + rand() * 180
  const a0 = rand() * Math.PI * 2
  const span = ((38 - ((rho - 188) / 180) * 32) * Math.PI) / 180
  const a1 = a0 + span
  const pt = (a: number): string => `${(rho * Math.cos(a)).toFixed(1)} ${(rho * Math.sin(a)).toFixed(1)}`
  const op = (0.25 + rand() * 0.45).toFixed(2)
  const width = (0.8 + rand() * 0.9).toFixed(1)
  arcs.push(
    `<path class="tw tw${i % 4}" d="M${pt(a0)} A${rho.toFixed(1)} ${rho.toFixed(1)} 0 0 1 ${pt(a1)}" fill="none" stroke="#dcecff" stroke-width="${width}" stroke-opacity="${op}" stroke-linecap="round"/>`,
  )
}

// Piste kiekon tasossa (kallistettu ellipsi) ruudun koordinaatteina.
const tilt = (TILT * Math.PI) / 180
const onDisk = (r: number, a: number): [string, string] => {
  const ex = r * Math.cos(a)
  const ey = r * SQUASH * Math.sin(a)

  return [
    (PX + ex * Math.cos(tilt) - ey * Math.sin(tilt)).toFixed(1),
    (PY + ex * Math.sin(tilt) + ey * Math.cos(tilt)).toFixed(1),
  ]
}

// Kuuma kohta kiertää kiekossa. Etupuolen kopio näkyy vain radan etupuoliskolla.
const STEPS = 36
const spotFrames: string[] = []
const spotFrontFrames: string[] = []
for (let k = 0; k <= STEPS; k++) {
  const a = (k / STEPS) * Math.PI * 2
  const [x, y] = onDisk(245, a)
  const pct = ((k / STEPS) * 100).toFixed(2)
  spotFrames.push(`${pct}% { transform: translate(${x}px, ${y}px); }`)
  spotFrontFrames.push(`${pct}% { transform: translate(${x}px, ${y}px); opacity: ${Math.sin(a) >= 0 ? 1 : 0}; }`)
}

// Bitit valuvat kierteellä aukkoon: säde pienenee, kulma kiihtyy, lopuksi ne himmenevät.
const FALL_STEPS = 48
const fallFrames: string[] = []
const fallFrontFrames: string[] = []
for (let k = 0; k <= FALL_STEPS; k++) {
  const t = k / FALL_STEPS
  const a = 1.7 * Math.PI * 2 * Math.pow(t, 1.6)
  const [x, y] = onDisk(500 - 345 * t, a)
  const fade = t < 0.08 ? t / 0.08 : t > 0.82 ? Math.max(0, (1 - t) / 0.18) : 1
  const env = 0.75 * fade
  const move = `transform: translate(${x}px, ${y}px) scale(${(1 - 0.5 * t).toFixed(2)});`
  const pct = (t * 100).toFixed(2)
  fallFrames.push(`${pct}% { ${move} opacity: ${env.toFixed(2)}; }`)
  fallFrontFrames.push(`${pct}% { ${move} opacity: ${(Math.sin(a) >= 0 ? env : 0).toFixed(2)}; }`)
}
const FALL_COUNT = 10
const FALL_SECONDS = 30
const fallBits = (cls: string): string => {
  const out: string[] = []
  for (let i = 0; i < FALL_COUNT; i++) {
    const delay = (-(i * FALL_SECONDS) / FALL_COUNT - (i % 3) * 0.7).toFixed(1)
    const fill = i % 4 === 3 ? MAGENTA : CYAN
    const bit = (i * 7) % 3 === 0 ? 0 : 1
    out.push(`<g class="${cls}" style="animation-delay:${delay}s"><text fill="${fill}">${bit}</text></g>`)
  }

  return out.join('')
}

// Bittikenttä: koko ruudun harva ruudukko, kaikki bitit samoissa riveissä ja
// sarakkeissa. Bitit on ryhmitelty vinoriveittäin, ja valoaalto liukuu ryhmästä
// toiseen kohti aukkoa: syaani yhtä vinosuuntaa pitkin ja harvempi magenta
// ristiin sen yli. Aukon ja kiekon kohdalla ruudukko harvenee tyhjäksi.
// Aalto ajetaan fill-opacityllä, joka periytyy biteille ilman välikerroksia.
// Jokainen vinorivi kattaa lähes koko ruudun, joten aalto etenee portaittain:
// vinorivi per TICK, kaikki ryhmät samalla ruudunpäivityksellä. Sulava aalto
// piirsi koko ruudun uudelleen joka ruudunpäivitys. Vain osa biteistä kääntyy.
const PITCH_X = 24
const PITCH_Y = 26
const GRID_COLS = 67
const GRID_ROWS = 39
const DENSITY = 0.5
const FLIPPING = 0.22
const WAVE_SECONDS = 24
const WAVE_LENGTH = 72 // vinorivejä harjalta seuraavalle; jaollinen neljällä, SECONDS / LENGTH = TICK
const CROSS_SECONDS = 36
const CROSS_LENGTH = 108

// Etäisyys aukosta kiekon suuntaisena soikiona: alle 1 on aukon omaa aluetta.
const fromHole = (x: number, y: number): number => {
  const dx = x - PX
  const dy = y - PY

  return Math.hypot(
    (dx * Math.cos(tilt) + dy * Math.sin(tilt)) / 440,
    (dy * Math.cos(tilt) - dx * Math.sin(tilt)) / 330,
  )
}

const DIAGONALS = GRID_COLS + GRID_ROWS - 1
const mainWave: string[][] = Array.from({ length: DIAGONALS }, (): string[] => [])
const crossWave: string[][] = Array.from({ length: DIAGONALS }, (): string[] => [])
for (let c = 0; c < GRID_COLS; c++) {
  for (let r = 0; r < GRID_ROWS; r++) {
    const x = 6 + c * PITCH_X
    const y = 18 + r * PITCH_Y
    const keep = DENSITY * Math.min(1, Math.max(0, (fromHole(x + 4, y - 5) - 1) / 0.5))

    if (rand() >= keep) {
      continue
    }
    const bit = rand() < 0.5 ? 0 : 1
    const cell =
      rand() < FLIPPING
        ? `<g class="d${Math.floor(rand() * 6)} e${Math.floor(rand() * 5)}" transform="translate(${x} ${y})"><text class="a">${bit}</text><text class="z">${1 - bit}</text></g>`
        : `<text x="${x}" y="${y}">${bit}</text>`

    if (rand() < 0.14) {
      crossWave[c + GRID_ROWS - 1 - r]?.push(cell)
    } else {
      mainWave[c + r]?.push(cell)
    }
  }
}

// Mitä pienempi vinorivin numero, sitä aiemmin aalto ehtii sille: valo kulkee
// vasemmalta kohti aukkoa. Viive on TICKin monikerta, joten askeleet osuvat yhteen.
const waveGroups = (rows: string[][], cls: string, seconds: number, length: number): string =>
  rows
    .map((cells, k) =>
      cells.length === 0
        ? ''
        : `<g class="${cls}" style="animation-delay:${(-((rows.length - k) * seconds) / length).toFixed(3)}s">${cells.join('')}</g>`,
    )
    .join('')

const bits = `<g fill="${CYAN}">${waveGroups(mainWave, 'w', WAVE_SECONDS, WAVE_LENGTH)}</g>
<g fill="${MAGENTA}">${waveGroups(crossWave, 'w x', CROSS_SECONDS, CROSS_LENGTH)}</g>`

// Kertymäkiekko: takaa koko rengas, edestä vain etupuolisko, joka kulkee varjon yli.
const diskParts = (front: boolean): string => {
  const shape = (r: number, attrs: string): string =>
    front
      ? `<path d="M${r} 0 A${r} ${r} 0 0 1 ${-r} 0" fill="none" ${attrs}/>`
      : `<circle cx="0" cy="0" r="${r}" fill="none" ${attrs}/>`

  return `<g transform="${HOLE} scale(1 ${SQUASH})">
    ${shape(272, `stroke="url(#disk)" stroke-width="216" stroke-opacity="0.3"`)}
    ${shape(300, `class="spin" stroke="${MAGENTA}" stroke-width="56" stroke-opacity="0.4" stroke-dasharray="5 11"`)}
    ${shape(346, `class="spin slow" stroke="${MAGENTA}" stroke-width="30" stroke-opacity="0.3" stroke-dasharray="2 14"`)}
    ${shape(222, `class="spin fast" stroke="${CYAN}" stroke-width="40" stroke-opacity="0.5" stroke-dasharray="6 10"`)}
    ${shape(182, `class="spin faster" stroke="${HOT}" stroke-width="18" stroke-opacity="0.6" stroke-dasharray="3 5"`)}
    ${shape(166, `stroke="${HOT}" stroke-width="3" stroke-opacity="0.7"`)}
    ${shape(258, `stroke="${CYAN}" stroke-width="2" stroke-opacity="0.5"`)}
    ${shape(378, `class="spin slow" stroke="${CYAN}" stroke-width="2" stroke-opacity="0.45" stroke-dasharray="2 14"`)}
  </g>`
}

// ─── Kaikkinäkevä silmä (1.3.0) ─────────────────────────────────────────────
// Harvoin (kerran PYRAMID_CYCLE sekunnissa) aukko välähtää ja siitä nousee
// bittirivejä, jotka pinoutuvat sen yläpuolelle pyramidiksi. Viimeisenä nousee
// huippukivi, jonka silmä avautuu, katsoo ympärilleen ja räpäyttää. Lopuksi
// aukko nielee kaiken takaisin. Vain CSS-animaatioita (opacity ja pienten
// ryhmien siirto), ei SMILiä eikä @propertya. Kuvan aika alkaa jokaisesta
// piirrosta, joten ensimmäinen esitys arvotaan: 2 min – kierroksen loppu.
const PYRAMID_CYCLE = 900
const PYRAMID_FIRST = 120 + Math.floor(Math.random() * (PYRAMID_CYCLE - 120))
const PYR_ROWS = 8
const PYR_BASE_Y = 318
const PYR_ROW_H = 17
const PYR_PITCH = 13
const CAP_Y = 157 // silmän keskikohta
const CAP_APEX = 112
const CAP_BASE = 180
const CAP_HALF = 40

type Frame = [number, string]
const pyrKeyframes = (name: string, frames: Frame[]): string =>
  `@keyframes ${name} { ${frames.map(([s, css]) => `${((s / PYRAMID_CYCLE) * 100).toFixed(3)}% { ${css} }`).join(' ')} 100% { ${frames[0]?.[1] ?? ''} } }`

// Nousu aukosta paikalleen (start) ja paluu aukkoon (end); dy = matka aukkoon.
const rise = (dy: number, start: number, end: number, opacity: number): Frame[] => {
  const at = (o: number, f: number): string => `opacity: ${o}; transform: translateY(${(dy * f).toFixed(1)}px);`

  return [
    [0, at(0, 1)],
    [start, at(0, 1)],
    [start + 0.4, at(opacity, 0.8)],
    [start + 1.6, at(opacity, 0)],
    [end, at(opacity, 0)],
    [end + 1.2, at(opacity, 0.8)],
    [end + 1.6, at(0, 1)],
  ]
}
const fade = (points: [number, number][]): Frame[] => points.map(([s, o]): Frame => [s, `opacity: ${o};`])

// Pyramidin bitit (1.3.2) kertovat tekstin OSIRIS-001 ASCII-koodeina, luettuna kuin
// tekstiä: ylimmästä rivistä alas, vasemmalta oikealle. 10 merkkiä × 8 bittiä = 80
// bittiä, täsmälleen pyramidin koko (3 + 5 + … + 17). Jokaisen merkin ensimmäinen
// bitti on magenta, joten merkit erottuvat toisistaan.
const PYR_MESSAGE = 'OSIRIS-001'
const PYR_BITS = [...PYR_MESSAGE].map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0')).join('')

// Pyramidin bittirivit: ylin 3 bittiä, alin 17. Alin nousee ensin, ylin palaa ensin.
const pyrRows: string[] = []
const pyrFrames: string[] = []
let pyrBit = 0
for (let i = 0; i < PYR_ROWS; i++) {
  const k = PYR_ROWS - 1 - i // 0 = alin rivi
  const y = PYR_BASE_Y - k * PYR_ROW_H
  const count = 3 + 2 * i
  const cells: string[] = []
  for (let j = 0; j < count; j++) {
    const x = PX + (j - (count - 1) / 2) * PYR_PITCH
    const fill = pyrBit % 8 === 0 ? ` fill="${MAGENTA}"` : ''
    cells.push(`<text x="${x.toFixed(1)}" y="${y}"${fill}>${PYR_BITS.charAt(pyrBit % PYR_BITS.length)}</text>`)
    pyrBit += 1
  }
  pyrRows.push(`<g class="pyr pr${k}">${cells.join('')}</g>`)
  pyrFrames.push(`.pr${k} { animation-name: pr${k}; }`, pyrKeyframes(`pr${k}`, rise(PY - (y - 4), 1 + 0.55 * k, 30 + 0.4 * i, 0.85)))
}

// Säteet huippukiven ympärillä; alaspäin osoittavat jätetään pois pyramidin kohdalta.
const rays: string[] = []
for (let a = 0; a < 24; a++) {
  const deg = a * 15
  if (deg > 35 && deg < 145) {
    continue
  }
  const rad = (deg * Math.PI) / 180
  const r2 = a % 2 === 0 ? 76 : 63
  const p = (r: number): string => `${(PX + r * Math.cos(rad)).toFixed(1)} ${(CAP_Y + r * Math.sin(rad)).toFixed(1)}`
  rays.push(`<path d="M${p(50)} L${p(r2)}" stroke="${a % 3 === 0 ? HOT : CYAN}"/>`)
}

const PYRAMID = `<g text-anchor="middle" fill="${CYAN}">
  <circle class="flare" cx="${PX}" cy="${PY}" r="210" fill="url(#capGlow)"/>
  ${pyrRows.join('\n  ')}
  <path class="pe" d="M${PX - 116} 324 L${PX - 23} 185 M${PX + 23} 185 L${PX + 116} 324 M${PX - 116} 324 H${PX + 116}" fill="none" stroke="${CYAN}" stroke-width="1.2" stroke-linecap="round"/>
  <g class="capFx">
    <circle cx="${PX}" cy="${CAP_Y}" r="82" fill="url(#capGlow)"/>
    <g stroke-width="1.3" stroke-opacity="0.6" stroke-linecap="round">${rays.join('')}</g>
  </g>
  <g class="cap">
    <path d="M${PX} ${CAP_APEX} L${PX + CAP_HALF} ${CAP_BASE} L${PX - CAP_HALF} ${CAP_BASE} Z" fill="#050913" fill-opacity="0.88" stroke="${CYAN}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M${PX - CAP_HALF + 9} ${CAP_BASE - 6} H${PX + CAP_HALF - 9}" stroke="${MAGENTA}" stroke-width="1" stroke-opacity="0.7"/>
    <g transform="translate(${PX} ${CAP_Y})"><g class="lid">
      <path d="M-16 0 Q0 -11 16 0 Q0 11 -16 0 Z" fill="#02040a" stroke="${HOT}" stroke-width="1.4" stroke-linejoin="round"/>
      <g class="look">
        <circle r="6" fill="${CYAN}" fill-opacity="0.3" stroke="${CYAN}" stroke-width="1.6"/>
        <circle r="2.5" fill="#000"/>
        <circle cx="-1.6" cy="-1.8" r="1" fill="${HOT}"/>
      </g>
    </g></g>
  </g>
</g>`

// Aikataulu sekunteina esityksen alusta; viive siirtää esityksen kohtaan `first`.
const pyramidStyle = (first: number): string => `
  .flare, .pyr, .pe, .capFx, .cap, .lid, .look {
    animation-duration: ${PYRAMID_CYCLE}s; animation-timing-function: ease-in-out;
    animation-iteration-count: infinite; animation-delay: ${first - PYRAMID_CYCLE}s;
  }
  .flare, .pyr, .pe, .capFx, .cap { opacity: 0; }
  .flare { animation-name: flare; }
  .pe { animation-name: pe; }
  .capFx { animation-name: capFx; }
  .cap { animation-name: cap; }
  .lid { animation-name: lid; }
  .look { animation-name: look; }
  ${pyrFrames.join('\n  ')}
  ${pyrKeyframes('flare', fade([[0, 0], [1.2, 0.7], [4, 0.7], [6.5, 0], [30, 0], [31.5, 0.7], [34.5, 0.7], [36.5, 0]]))}
  ${pyrKeyframes('pe', fade([[0, 0], [5.6, 0], [6.6, 0.4], [29, 0.4], [30, 0]]))}
  ${pyrKeyframes('capFx', fade([[0, 0], [10, 0], [11.5, 1], [16, 0.6], [21, 1], [26.5, 1], [28, 0]]))}
  ${pyrKeyframes('cap', rise(PY - CAP_Y, 6.2, 28.4, 1))}
  ${pyrKeyframes('lid', [[0, 'transform: scaleY(0.06);'], [9, 'transform: scaleY(0.06);'], [10, 'transform: scaleY(1);'], [18, 'transform: scaleY(1);'], [18.15, 'transform: scaleY(0.08);'], [18.4, 'transform: scaleY(1);'], [26.5, 'transform: scaleY(1);'], [27.4, 'transform: scaleY(0.06);']])}
  ${pyrKeyframes('look', [[0, 'transform: translateX(0px);'], [12, 'transform: translateX(0px);'], [12.6, 'transform: translateX(-5px);'], [14.5, 'transform: translateX(-5px);'], [15.3, 'transform: translateX(5px);'], [17, 'transform: translateX(5px);'], [17.5, 'transform: translateX(0px);']])}
`

const scene = (first: number): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
  <radialGradient id="capGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${HOT}" stop-opacity="0.5"/>
    <stop offset="0.35" stop-color="${CYAN}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#04060d"/>
    <stop offset="1" stop-color="#0a0f20"/>
  </linearGradient>
  <radialGradient id="nebM" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${MAGENTA}" stop-opacity="0.16"/>
    <stop offset="1" stop-color="${MAGENTA}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="nebC" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${CYAN}" stop-opacity="0.2"/>
    <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
  </radialGradient>
  <!-- kiekko: meitä kohti pyörivä vasen laita on kirkkaampi -->
  <linearGradient id="disk" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${HOT}"/>
    <stop offset="0.35" stop-color="${CYAN}"/>
    <stop offset="1" stop-color="${MAGENTA}"/>
  </linearGradient>
  <!-- kiekon takaosan taittunut kuva varjon ympärillä -->
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.6" stop-color="${HOT}" stop-opacity="0.75"/>
    <stop offset="0.76" stop-color="${CYAN}" stop-opacity="0.55"/>
    <stop offset="0.9" stop-color="${MAGENTA}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${MAGENTA}" stop-opacity="0"/>
  </radialGradient>
  <!-- hehkut liukuväreinä: sama näkymä kuin sumennetuilla muodoilla, mutta
       kevyt piirtää joka ruudunpäivitys -->
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.62" stop-color="${CYAN}" stop-opacity="0.5"/>
    <stop offset="0.71" stop-color="${CYAN}" stop-opacity="0.42"/>
    <stop offset="0.79" stop-color="${CYAN}" stop-opacity="0.25"/>
    <stop offset="0.88" stop-color="${CYAN}" stop-opacity="0.08"/>
    <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="rimGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.78" stop-color="${CYAN}" stop-opacity="0"/>
    <stop offset="0.85" stop-color="${CYAN}" stop-opacity="0.34"/>
    <stop offset="0.89" stop-color="${CYAN}" stop-opacity="0.52"/>
    <stop offset="0.93" stop-color="${CYAN}" stop-opacity="0.34"/>
    <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="spotGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${CYAN}" stop-opacity="0.95"/>
    <stop offset="0.35" stop-color="${CYAN}" stop-opacity="0.83"/>
    <stop offset="0.55" stop-color="${CYAN}" stop-opacity="0.45"/>
    <stop offset="0.77" stop-color="${CYAN}" stop-opacity="0.14"/>
    <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
  </radialGradient>
</defs>
<style>
  .tw { animation: tw 6s ease-in-out infinite; }
  .tw1 { animation-duration: 9s; animation-delay: -3s; }
  .tw2 { animation-duration: 4.5s; animation-delay: -1s; }
  .tw3 { animation-duration: 11s; animation-delay: -5s; }
  @keyframes tw { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }

  .breath { animation: breath 7s ease-in-out infinite; }
  @keyframes breath { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .spin { animation: dash 5s linear infinite; }
  .slow { animation-duration: 14s; }
  .fast { animation-duration: 3s; }
  .faster { animation-duration: 1.8s; }
  .back { animation-direction: reverse; }
  @keyframes dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -160; } }

  .lens { animation: lens ${LENS_SECONDS}s steps(${Math.round(LENS_SECONDS / TICK)}) infinite; }
  @keyframes lens { to { transform: rotate(360deg); } }

  .driftX { animation: driftX ${2 * DRIFT_X * DRIFT_X_STEP}s steps(${2 * DRIFT_X}) ${-DRIFT_X * DRIFT_X_STEP}s infinite alternate; }
  .driftY { animation: driftY ${2 * DRIFT_Y * DRIFT_Y_STEP}s steps(${2 * DRIFT_Y}) ${-DRIFT_Y * DRIFT_Y_STEP}s infinite alternate; }
  @keyframes driftX { from { transform: translate(${-DRIFT_X}px, 0px); } to { transform: translate(${DRIFT_X}px, 0px); } }
  @keyframes driftY { from { transform: translate(0px, ${-DRIFT_Y}px); } to { transform: translate(0px, ${DRIFT_Y}px); } }

  .spot { animation: spot 11s linear infinite; }
  .spotFront { animation: spotFront 11s linear infinite; }
  @keyframes spot { ${spotFrames.join(' ')} }
  @keyframes spotFront { ${spotFrontFrames.join(' ')} }

  text { font: 13px ui-monospace, Consolas, Menlo, monospace; }
  .fall, .fallFront { opacity: 0; animation: fall ${FALL_SECONDS}s linear infinite; }
  .fallFront { animation-name: fallFront; }
  .fall text, .fallFront text { font-size: 17px; }
  @keyframes fall { ${fallFrames.join(' ')} }
  @keyframes fallFront { ${fallFrontFrames.join(' ')} }

  .w { fill-opacity: 0.16; animation: w ${WAVE_SECONDS}s steps(${WAVE_LENGTH / 4}) infinite; }
  .x { animation-duration: ${CROSS_SECONDS}s; animation-timing-function: steps(${CROSS_LENGTH / 4}); }
  @keyframes w { 0%, 50%, 100% { fill-opacity: 0.11; } 75% { fill-opacity: 0.6; } }
  .a, .z { animation: fa 2.3s steps(1) infinite; }
  .z { opacity: 0; animation-name: fz; }
  @keyframes fa { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes fz { 0% { opacity: 0; } 50% { opacity: 1; } }
  .d1 text { animation-duration: 3.1s; }
  .d2 text { animation-duration: 4.3s; }
  .d3 text { animation-duration: 5.9s; }
  .d4 text { animation-duration: 7.3s; }
  .d5 text { animation-duration: 1.7s; }
  .e1 text { animation-delay: -0.6s; }
  .e2 text { animation-delay: -1.3s; }
  .e3 text { animation-delay: -2.1s; }
  .e4 text { animation-delay: -3.4s; }
${pyramidStyle(first)}

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }
</style>

<rect width="1600" height="1000" fill="url(#sky)"/>
<ellipse cx="300" cy="760" rx="560" ry="380" fill="url(#nebM)"/>
<ellipse cx="${PX}" cy="${PY}" rx="620" ry="480" fill="url(#nebC)"/>
${stars.join('')}

<!-- bittikenttä koko ruudulla -->
${bits}

<!-- aukko ja kaikki sen ympärillä vaeltaa hitaasti, ettei rengas pala ruutuun -->
<g class="driftX"><g class="driftY">

<!-- taustatähdet taipuvat kaariksi aukon ympärillä -->
<g transform="translate(${PX} ${PY})">
  <circle cx="0" cy="0" r="${R + 64}" fill="none" stroke="${CYAN}" stroke-width="1" stroke-opacity="0.14"/>
  <g class="lens">${arcs.join('')}</g>
</g>

<!-- takana: koko kiekko, kuuma kohta ja aukkoon valuvat bitit -->
${diskParts(false)}
<g class="spot"><circle cx="0" cy="0" r="6" fill="${HOT}"/></g>
${fallBits('fall')}

<!-- aukko: kiekon takaosan taittunut kuva, varjo ja fotonirengas -->
<g transform="${HOLE}">
  <circle cx="0" cy="-10" r="${R + 80}" fill="url(#glow)" class="breath"/>
  <circle cx="0" cy="-14" r="${R + 46}" fill="url(#halo)"/>
  <circle cx="0" cy="-9" r="${R + 20}" fill="none" class="spin fast back" stroke="${HOT}" stroke-width="26" stroke-opacity="0.16" stroke-dasharray="14 18"/>
  <circle cx="0" cy="0" r="${R}" fill="#000"/>
  <circle cx="0" cy="0" r="${R + 16}" fill="url(#rimGlow)" class="breath"/>
  <circle cx="0" cy="0" r="${R + 2}" fill="none" stroke="${HOT}" stroke-width="2.5" stroke-opacity="0.85"/>
</g>

<!-- kaikkinäkevä silmä: harvoin aukosta nouseva pyramidi -->
${PYRAMID}

<!-- edessä: kiekon etupuolisko, kuuma kohta ja bitit radan etupuolella -->
${diskParts(true)}
<g class="spotFront">
  <circle cx="0" cy="0" r="22" fill="url(#spotGlow)"/>
  <circle cx="0" cy="0" r="6" fill="${HOT}"/>
</g>
${fallBits('fallFront')}

</g></g>
</svg>`

const SCENE_NAME = 'musta-aukko'
const look = (name: string): ThemeSetArgs => ({
  colors: theme,
  backdrop: { scene: name, glass: { blur: 0, tint: '#070a12', opacity: 0.6 } },
})

// Tavallinen kuva ja /pyramidi-komennon kuvat (esitys 3 s päästä), nimen mukaan.
const scenes = new Map<string, string>([[SCENE_NAME, scene(PYRAMID_FIRST)]])
let testRuns = 0
let lastPyramidAt = 0
const PYRAMID_COOLDOWN_MS = 45_000

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(look(SCENE_NAME))

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    try {
      await $.command.register({
        name: 'pyramidi',
        description: 'Nostaa kaikkinäkevän silmän pyramidin mustasta aukosta heti (muuten se nousee harvoin itsestään)',
      })
    } catch (error) {
      $.ui.toast(`Neonhorisontti: /pyramidi-komennon rekisteröinti epäonnistui (${String(error)})`)
    }

    return next(e)
  })

  on('command.run', { command: 'pyramidi' }, async $ => {
    // Uusi kuva kesken edellisen latauksen voi pysäyttää taustan (käyttäjä 16.11.: kaksi
    // komentoa peräkkäin). Siksi uutta kuvaa ei tehdä, ennen kuin edellinen esitys on ohi.
    const now = await $.clock.now()
    if (now - lastPyramidAt < PYRAMID_COOLDOWN_MS) {
      const left = Math.ceil((PYRAMID_COOLDOWN_MS - (now - lastPyramidAt)) / 1000)

      return { text: `Pyramidi on jo nousemassa. Uuden voi kutsua ${left} sekunnin päästä.` }
    }
    lastPyramidAt = now
    testRuns += 1
    const name = `${SCENE_NAME}-pyramidi-${testRuns}`
    scenes.set(name, scene(3))
    const set = await $.theme.set(look(name))
    for (const key of [...scenes.keys()]) {
      if (key !== SCENE_NAME && key !== name) {
        scenes.delete(key)
      }
    }

    return set.isDrawn
      ? { text: 'Pyramidi nousee mustasta aukosta noin 3 sekunnin kuluttua. Esitys kestää noin 37 sekuntia.' }
      : { text: `Teema ei piirry nyt: ${set.reason}` }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={scenes.get(e.props.scene) ?? scenes.get(SCENE_NAME) ?? scene(PYRAMID_FIRST)}
        alt="Musta aukko, jonka hohtava kertymäkiekko taittuu sen ympäri; koko taustan yli liukuu himmeä bittikenttä, ja harvoin aukosta nousee pyramidi, jonka bitit kertovat binäärinä OSIRIS-001 ja jonka huippukiven silmä katsoo ympärilleen"
        isInteractive
      />
    )
  })
}

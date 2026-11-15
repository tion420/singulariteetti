import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// Singulariteetti (0.6.0): sama musta aukko kuin ennen, mutta vihaisempi.
// Kertymäkiekko hehkuu hiilloksen ja veren värisenä ja pyörii kiivaammin, aukon
// ympärys sykkii kuin sydän, ja joka lyönnillä bittikenttä himmenee hetkeksi,
// kuin aukko imaisisi valon. Silloin tällöin varjon sisällä käynnistyy robotin
// näkö (0.7.0): digitaalinen iiris hehkuvista säikeistä, pupilli ja linssin
// heijastus, pyörivä datakehä ja tähtäinkaaret, ja oikealle lähtevät piirilevyn
// johtimet, joita pitkin valopulssit juoksevat. Silmä välähtää päälle, tarkentaa,
// vilkaisee vasemmalle tekstiä kohti ja sammuu.
// Silmä on kylmän syaani punaisen hehkun keskellä (0.8.0), ja siinä on
// mikrorenkaat, aukkorengas pupillin ympärillä, kimaltavia pisteitä, reunan
// liitinnastat ja skannausviiva, joka pyyhkäisee iiriksen yli käynnistyessä ja
// uudelleen, kun katse lukittuu.
// Rauhallisemmat bitit (0.8.1): vain harva bitti kääntyy, hitaasti ja TICK-tahdissa,
// ja sykkeen imaisu on pehmeä hengähdys eikä nykäisy. Bittien joukossa on harvoja
// syaaneja verkkobittejä, jotka kirkastuvat silmän ollessa auki.
// Epäsäännöllinen silmä (0.9.0): tauko esitysten välillä vaihtelee 50–120 s.
// Satunnainen aloituskohta (0.9.2): jokainen istunto aloittaa silmän jakson eri
// kohdasta, joten ensimmäinen silmä ei tule aina samaan aikaan.
// Harvoin ruudun poikki välähtää ohut häiriöviiva. Vain tumma tila.
//
// Keveys (0.5.0): tausta on yksi SVG, ja jokainen liikkuva osa pakottaa
// piirtämään oman alueensa uudelleen. Siksi isot pinnat (bittikentän aalto ja
// syke, linssikaaret ja aukon vaellus) vaihtuvat vain TICK-tahdissa ja kaikki
// samalla ruudunpäivityksellä. Sumennussuodattimet on korvattu liukuväreillä.
// Sulavasti liikkuvat vain pienet osat ja aukon oma hehku.
//
// Ruudun säästö (0.5.0): aukko vaeltaa hitaasti noin 90 × 70 yksikön alueella,
// yksikön kerrallaan, jotta kirkkaat renkaat eivät pala näyttöön aina samaan
// kohtaan. Myös silmä vaeltaa aukon mukana. Kuumin väri on himmeä, ei valkoinen.
const { theme, problems } = makeColors({
  label: 'Singulariteetti',
  only: 'dark',
  roles: { accent: '#ff6a2a', danger: '#ff2d4f', success: '#3fd08a', warning: '#f2b43a', pro: '#b04cff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a0607',
        'surface-1': '#100a0b',
        'surface-2': '#160e10',
        'surface-3': '#1a1113',
        'text-primary': '#f5e8e6',
        'text-secondary': '#d3bdb9',
        'text-muted': '#ad9591',
      },
    },
  },
})

const EMBER = '#ff5a1f' // kiekon sisäosa ja hehku
const BLOOD = '#d8102e' // kiekon ulko-osa ja bittikenttä
const VIOLET = '#6d1cc4' // vain kaukainen sumu
const HOT = '#ffe2c4' // kuumin reuna, himmeä hiilloksen valkoinen
const STAR = '#f0dcd8'

// Konesilmän kylmät värit: kuumin keskellä, syvä sininen ulkoreunalla.
const ICE = '#22e0ff'
const ICE_HOT = '#dcf9ff'
const ICE_DEEP = '#2f7dff'
const GLINT = '#f2fdff'

// Isojen pintojen päivitystahti sekunteina. Aallon, sykkeen, linssin ja
// vaelluksen kestot ja viiveet ovat sen monikertoja, joten ne vaihtuvat samalla hetkellä.
const TICK = 1 / 3

// Aukon paikka, varjon säde ja kiekon kallistus.
const PX = 1180
const PY = 540
const R = 118
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

// Syke: 16 TICKiä, kaksoislyönti (lub-dub) alussa. Hehku leimahtaa, bittikenttä himmenee.
const BEAT_SECONDS = 16 * TICK

// Silmän tahti (0.9.0) on epäsäännöllinen. Yksi esitys kestää 25 TICKiä (noin 8 s),
// ja tauko ennen kutakin esitystä on 50–120 s. CSS ei osaa arpoa, joten kuuden
// esityksen jakso (noin 9,4 min) toistuu samanlaisena, mutta tahti ei tunnu ajastimelta.
const EYE_SHOW_TICKS = 25
const EYE_PAUSES = [64, 112, 51, 95, 73, 118] // sekuntia, kukin 50–120
const EYE_STARTS: number[] = [] // esitysten alut TICKeinä jakson alusta
let eyeClock = 0
for (const pause of EYE_PAUSES) {
  eyeClock += Math.round(pause / TICK)
  EYE_STARTS.push(eyeClock)
  eyeClock += EYE_SHOW_TICKS
}
const EYE_SECONDS = eyeClock * TICK

// Satunnainen aloituskohta: moduuli ajetaan jokaisen istunnon alussa uudestaan,
// joten arvotaan silloin, mistä kohtaa jaksoa silmä aloittaa. Kohta osuu aina
// johonkin taukoon (ei kesken esityksen), ja seuraavaan silmään jää vähintään
// EYE_FIRST_MIN sekuntia. Kaikki seitsemän silmän animaatiota saavat saman
// negatiivisen viiveen, joten ne pysyvät tahdissa. Kohta on TICKin monikerta.
const EYE_FIRST_MIN = 20
const eyeStartPause = Math.floor(Math.random() * EYE_PAUSES.length)
const eyeStartPauseTicks = Math.round((EYE_PAUSES[eyeStartPause] ?? 60) / TICK)
const eyeStartRoomTicks = Math.max(0, eyeStartPauseTicks - Math.round(EYE_FIRST_MIN / TICK))
const EYE_OFFSET =
  ((EYE_STARTS[eyeStartPause] ?? 0) - eyeStartPauseTicks + Math.floor(Math.random() * (eyeStartRoomTicks + 1))) * TICK
const EYE_DELAY = `${(-EYE_OFFSET).toFixed(3)}s`

// Avainkehykset koko jaksolle: lepotila esitysten välissä ja jokaisen esityksen
// kohdalla sama kulku. Kulun ajat ovat sekunteja esityksen alusta.
type EyeStep = [number, string]
const eyeKeyframes = (name: string, rest: string, steps: EyeStep[]): string => {
  const at = (seconds: number): string => `${((seconds / EYE_SECONDS) * 100).toFixed(4)}%`
  const frames = [`0% { ${rest} }`]
  for (const startTick of EYE_STARTS) {
    const start = startTick * TICK
    frames.push(`${at(start)} { ${rest} }`)
    for (const [t, css] of steps) {
      frames.push(`${at(start + t)} { ${css} }`)
    }
    frames.push(`${at(start + EYE_SHOW_TICKS * TICK)} { ${rest} }`)
  }
  frames.push(`100% { ${rest} }`)

  return `@keyframes ${name} { ${frames.join(' ')} }`
}

// Silmän renkaat: säde, ja katkoviiva, joka jakaa kehän tasaisiin osiin.
const segments = (r: number, count: number, fill: number): string => {
  const step = (2 * Math.PI * r) / count

  return `${(step * fill).toFixed(2)} ${(step * (1 - fill)).toFixed(2)}`
}
const EYE_TICKS = segments(87, 90, 0.2) // iiriksen ulkokehän hienot asteviivat
const EYE_HUD = segments(109, 3, 0.2) // kolme tähtäinkaarta varjon reunalla
const EYE_HUD_FINE = segments(103, 24, 0.08) // niiden välissä lyhyet merkit
const EYE_MICRO = segments(58, 48, 0.55) // katkottu mikrorengas iiriksen keskellä
const EYE_APERTURE = segments(28, 6, 0.75) // kuusiosainen aukkorengas pupillin ympärillä

// Silmällä on oma "satunnainen" kuvionsa, ettei tähtien ja bittien paikka muutu.
let eyeSeed = 7
const eyeRand = (): number => {
  eyeSeed = (eyeSeed * 1103515245 + 12345) % 2147483648

  return eyeSeed / 2147483648
}

// Iiriksen säikeet: lyhyet ja kirkkaimmat pupillin vieressä, pidemmät syaanit
// ja syvän siniset ulompana. Yksi polku per väri, ettei elementtejä tule satoja.
const fibers = { inner: [] as string[], mid: [] as string[], outer: [] as string[] }
const FIBER_COUNT = 280
for (let i = 0; i < FIBER_COUNT; i++) {
  const a = (i / FIBER_COUNT) * Math.PI * 2 + (eyeRand() - 0.5) * 0.03
  const pick = eyeRand()
  const kind = pick < 0.3 ? 'inner' : pick < 0.72 ? 'mid' : 'outer'
  const r0 = kind === 'inner' ? 18 + eyeRand() * 4 : 22 + eyeRand() * 14
  const r1 = kind === 'inner' ? 36 + eyeRand() * 12 : kind === 'mid' ? 58 + eyeRand() * 16 : 68 + eyeRand() * 10
  const p = (r: number): string => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
  fibers[kind].push(`M${p(r0)}L${p(r1)}`)
}

// Datakehä: bittejä ympyrän kehällä.
const EYE_DATA = Array.from({ length: 104 }, (): string => (eyeRand() < 0.5 ? '0' : '1')).join('')

// Piirilevyn johtimet: iiriksen oikeasta reunasta vaakaan, viuhkana ulos, päässä läpivienti.
const traceParts: string[] = []
const viaParts: string[] = []
const pulseParts: string[] = []
const TRACE_ANGLES = [-30, -18, -7, 5, 16, 28]
const TRACE_ENDS = [300, 236, 352, 268, 330, 214]
TRACE_ANGLES.forEach((deg, i) => {
  const a = (deg * Math.PI) / 180
  const x0 = 82 * Math.cos(a)
  const y0 = 82 * Math.sin(a)
  const bend = 128
  const rise = deg * 0.5
  const y1 = y0 + rise
  const end = TRACE_ENDS[i] ?? 260
  const d = `M${x0.toFixed(1)} ${y0.toFixed(1)}L${bend} ${y0.toFixed(1)}L${(bend + Math.abs(rise)).toFixed(1)} ${y1.toFixed(1)}L${end} ${y1.toFixed(1)}`
  traceParts.push(`<path d="${d}"/>`)
  viaParts.push(`<circle cx="${end + 3}" cy="${y1.toFixed(1)}" r="3"/>`)
  pulseParts.push(`<path class="pulse" style="animation-delay:${(i * 0.3 - EYE_OFFSET).toFixed(3)}s" d="${d}" pathLength="100"/>`)
})

// Kimaltavat pisteet iiriksessä.
const speckParts: string[] = []
for (let i = 0; i < 30; i++) {
  const a = eyeRand() * Math.PI * 2
  const r = 28 + eyeRand() * 50
  const size = (0.5 + eyeRand() * 0.8).toFixed(1)
  const alpha = (0.35 + eyeRand() * 0.55).toFixed(2)
  speckParts.push(
    `<circle cx="${(r * Math.cos(a)).toFixed(1)}" cy="${(r * Math.sin(a)).toFixed(1)}" r="${size}" fill-opacity="${alpha}"/>`,
  )
}

// Liitinnastat iiriksen reunalla: lyhyt viiva ulospäin ja piste päässä.
const pinSegs: string[] = []
const pinDots: string[] = []
for (let i = 0; i < 12; i++) {
  const a = ((i * 30 + 8 + eyeRand() * 14) * Math.PI) / 180
  const p = (r: number): string => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
  pinSegs.push(`M${p(90)}L${p(93.5)}`)
  pinDots.push(`<circle cx="${(95 * Math.cos(a)).toFixed(1)}" cy="${(95 * Math.sin(a)).toFixed(1)}" r="1.1"/>`)
}

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
    stars.push(`<circle class="tw tw${i % 4}" cx="${x}" cy="${y}" r="${r}" fill="${STAR}"/>`)
  }
}

// Linssikaaret: mitä lähempänä aukkoa, sitä pidemmäksi tähti venyy.
const arcs: string[] = []
for (let i = 0; i < 26; i++) {
  const rho = 194 + rand() * 180
  const a0 = rand() * Math.PI * 2
  const span = ((38 - ((rho - 194) / 180) * 32) * Math.PI) / 180
  const a1 = a0 + span
  const pt = (a: number): string => `${(rho * Math.cos(a)).toFixed(1)} ${(rho * Math.sin(a)).toFixed(1)}`
  const op = (0.2 + rand() * 0.4).toFixed(2)
  const width = (0.8 + rand() * 0.9).toFixed(1)
  arcs.push(
    `<path class="tw tw${i % 4}" d="M${pt(a0)} A${rho.toFixed(1)} ${rho.toFixed(1)} 0 0 1 ${pt(a1)}" fill="none" stroke="${STAR}" stroke-width="${width}" stroke-opacity="${op}" stroke-linecap="round"/>`,
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
  const env = 0.8 * fade
  const move = `transform: translate(${x}px, ${y}px) scale(${(1 - 0.5 * t).toFixed(2)});`
  const pct = (t * 100).toFixed(2)
  fallFrames.push(`${pct}% { ${move} opacity: ${env.toFixed(2)}; }`)
  fallFrontFrames.push(`${pct}% { ${move} opacity: ${(Math.sin(a) >= 0 ? env : 0).toFixed(2)}; }`)
}
const FALL_COUNT = 12
const FALL_SECONDS = 26
const fallBits = (cls: string): string => {
  const out: string[] = []
  for (let i = 0; i < FALL_COUNT; i++) {
    const delay = (-(i * FALL_SECONDS) / FALL_COUNT - (i % 3) * 0.7).toFixed(1)
    const fill = i % 4 === 3 ? ICE : i % 3 === 2 ? EMBER : BLOOD
    const bit = (i * 7) % 3 === 0 ? 0 : 1
    out.push(`<g class="${cls}" style="animation-delay:${delay}s"><text fill="${fill}">${bit}</text></g>`)
  }

  return out.join('')
}

// Bittikenttä: koko ruudun harva ruudukko, kaikki bitit samoissa riveissä ja
// sarakkeissa. Bitit on ryhmitelty vinoriveittäin, ja valoaalto liukuu ryhmästä
// toiseen kohti aukkoa: verenpunainen yhtä vinosuuntaa pitkin ja harvempi
// hiillos ristiin sen yli. Aukon ja kiekon kohdalla ruudukko harvenee tyhjäksi.
// Aalto ajetaan fill-opacityllä, joka periytyy biteille ilman välikerroksia.
// Jokainen vinorivi kattaa lähes koko ruudun, joten aalto etenee portaittain:
// vinorivi per TICK, kaikki ryhmät samalla ruudunpäivityksellä. Vain osa biteistä kääntyy.
const PITCH_X = 24
const PITCH_Y = 26
const GRID_COLS = 67
const GRID_ROWS = 39
const DENSITY = 0.5
const FLIPPING = 0.06
const NET_SHARE = 0.11 // osuus biteistä, jotka ovat silmän syaaneja verkkobittejä
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
const netBits: string[] = []
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

    // Verkkobitit arvotaan silmän omalla arvontafunktiolla, ettei muu kuvio muutu.
    if (eyeRand() < NET_SHARE) {
      netBits.push(cell)
    } else if (rand() < 0.14) {
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

const bits = `<g fill="${BLOOD}">${waveGroups(mainWave, 'w', WAVE_SECONDS, WAVE_LENGTH)}</g>
<g fill="${EMBER}">${waveGroups(crossWave, 'w x', CROSS_SECONDS, CROSS_LENGTH)}</g>
<g fill="${ICE}" class="net">${netBits.join('')}</g>`

// Kertymäkiekko: takaa koko rengas, edestä vain etupuolisko, joka kulkee varjon yli.
const diskParts = (front: boolean): string => {
  const shape = (r: number, attrs: string): string =>
    front
      ? `<path d="M${r} 0 A${r} ${r} 0 0 1 ${-r} 0" fill="none" ${attrs}/>`
      : `<circle cx="0" cy="0" r="${r}" fill="none" ${attrs}/>`

  return `<g transform="${HOLE} scale(1 ${SQUASH})">
    ${shape(276, `stroke="url(#disk)" stroke-width="216" stroke-opacity="0.32"`)}
    ${shape(304, `class="spin" stroke="${BLOOD}" stroke-width="56" stroke-opacity="0.45" stroke-dasharray="5 11"`)}
    ${shape(350, `class="spin slow" stroke="${BLOOD}" stroke-width="30" stroke-opacity="0.32" stroke-dasharray="2 14"`)}
    ${shape(226, `class="spin fast" stroke="${EMBER}" stroke-width="40" stroke-opacity="0.5" stroke-dasharray="6 10"`)}
    ${shape(186, `class="spin faster" stroke="${HOT}" stroke-width="18" stroke-opacity="0.5" stroke-dasharray="3 5"`)}
    ${shape(170, `stroke="${HOT}" stroke-width="3" stroke-opacity="0.6"`)}
    ${shape(262, `stroke="${EMBER}" stroke-width="2" stroke-opacity="0.45"`)}
    ${shape(382, `class="spin slow" stroke="${BLOOD}" stroke-width="2" stroke-opacity="0.5" stroke-dasharray="2 14"`)}
  </g>`
}

const pct = (ticks: number, total: number): string => `${((ticks / total) * 100).toFixed(2)}%`
const BEAT_TICKS = Math.round(BEAT_SECONDS / TICK)
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#040203"/>
    <stop offset="1" stop-color="#0d0507"/>
  </linearGradient>
  <radialGradient id="nebV" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${VIOLET}" stop-opacity="0.14"/>
    <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="nebR" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${BLOOD}" stop-opacity="0.22"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <!-- kiekko: meitä kohti pyörivä vasen laita on kuumempi -->
  <linearGradient id="disk" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ff9a66"/>
    <stop offset="0.35" stop-color="${EMBER}"/>
    <stop offset="1" stop-color="${BLOOD}"/>
  </linearGradient>
  <!-- kiekon takaosan taittunut kuva varjon ympärillä -->
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.6" stop-color="${HOT}" stop-opacity="0.6"/>
    <stop offset="0.76" stop-color="${EMBER}" stop-opacity="0.5"/>
    <stop offset="0.9" stop-color="${BLOOD}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <!-- hehkut liukuväreinä: kevyt piirtää joka ruudunpäivitys -->
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.62" stop-color="${EMBER}" stop-opacity="0.55"/>
    <stop offset="0.71" stop-color="${BLOOD}" stop-opacity="0.45"/>
    <stop offset="0.79" stop-color="${BLOOD}" stop-opacity="0.28"/>
    <stop offset="0.88" stop-color="${BLOOD}" stop-opacity="0.09"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="rimGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.78" stop-color="${EMBER}" stop-opacity="0"/>
    <stop offset="0.85" stop-color="${EMBER}" stop-opacity="0.36"/>
    <stop offset="0.89" stop-color="${EMBER}" stop-opacity="0.55"/>
    <stop offset="0.93" stop-color="${BLOOD}" stop-opacity="0.34"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="spotGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${EMBER}" stop-opacity="0.95"/>
    <stop offset="0.35" stop-color="${EMBER}" stop-opacity="0.8"/>
    <stop offset="0.55" stop-color="${BLOOD}" stop-opacity="0.45"/>
    <stop offset="0.77" stop-color="${BLOOD}" stop-opacity="0.14"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <!-- silmä: iiriksen hehku, pupillin kuuma reuna ja johtimien häivytys -->
  <radialGradient id="iris" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.2" stop-color="${ICE_HOT}" stop-opacity="0.5"/>
    <stop offset="0.42" stop-color="${ICE}" stop-opacity="0.4"/>
    <stop offset="0.72" stop-color="${ICE_DEEP}" stop-opacity="0.24"/>
    <stop offset="1" stop-color="${ICE_DEEP}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="pupil" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.68" stop-color="#000" stop-opacity="1"/>
    <stop offset="0.82" stop-color="${ICE}" stop-opacity="0.85"/>
    <stop offset="0.9" stop-color="${ICE_HOT}" stop-opacity="0.6"/>
    <stop offset="1" stop-color="${ICE}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="trace" gradientUnits="userSpaceOnUse" x1="70" y1="0" x2="360" y2="0">
    <stop offset="0" stop-color="${ICE}" stop-opacity="0.8"/>
    <stop offset="1" stop-color="${ICE_DEEP}" stop-opacity="0.12"/>
  </linearGradient>
  <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ICE}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ICE}" stop-opacity="0.35"/>
    <stop offset="1" stop-color="${ICE}" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="eyeClip"><circle cx="0" cy="0" r="84"/></clipPath>
  <path id="eyeData" d="M-97 0A97 97 0 1 1 97 0A97 97 0 1 1 -97 0"/>
</defs>
<style>
  .tw { animation: tw 6s ease-in-out infinite; }
  .tw1 { animation-duration: 9s; animation-delay: -3s; }
  .tw2 { animation-duration: 4.5s; animation-delay: -1s; }
  .tw3 { animation-duration: 11s; animation-delay: -5s; }
  @keyframes tw { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.8; } }

  /* syke: hehku leimahtaa kahdesti ja raukeaa */
  .beat { animation: beat ${BEAT_SECONDS.toFixed(4)}s ease-out infinite; }
  @keyframes beat {
    0% { opacity: 0.45; }
    3% { opacity: 1; }
    9% { opacity: 0.6; }
    14% { opacity: 0.95; }
    32%, 100% { opacity: 0.45; }
  }
  /* samoilla lyönneillä bittikenttä hengähtää hiukan himmeämmäksi, kuin valo
     imaistaisiin: pienin askelin TICKin tahdissa, ei nykäisynä */
  .suck { animation: suck ${BEAT_SECONDS.toFixed(4)}s steps(1) infinite; }
  @keyframes suck {
    0% { opacity: 0.93; }
    ${pct(1, BEAT_TICKS)} { opacity: 0.88; }
    ${pct(2, BEAT_TICKS)} { opacity: 0.86; }
    ${pct(3, BEAT_TICKS)} { opacity: 0.9; }
    ${pct(4, BEAT_TICKS)} { opacity: 0.95; }
    ${pct(5, BEAT_TICKS)}, 100% { opacity: 1; }
  }
  /* verkkobitit: himmeitä, kunnes silmä aukeaa; silloin ne kirkastuvat portaittain */
  .net { fill-opacity: 0.1; animation: net ${EYE_SECONDS.toFixed(3)}s steps(1) ${EYE_DELAY} infinite; }
  ${eyeKeyframes('net', 'fill-opacity: 0.1;', [
    [1 * TICK, 'fill-opacity: 0.22;'],
    [2 * TICK, 'fill-opacity: 0.34;'],
    [3 * TICK, 'fill-opacity: 0.42;'],
    [17 * TICK, 'fill-opacity: 0.34;'],
    [20 * TICK, 'fill-opacity: 0.24;'],
    [23 * TICK, 'fill-opacity: 0.16;'],
  ])}

  .spin { animation: dash 4s linear infinite; }
  .slow { animation-duration: 11s; }
  .fast { animation-duration: 2.4s; }
  .faster { animation-duration: 1.4s; }
  .back { animation-direction: reverse; }
  @keyframes dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -160; } }

  .lens { animation: lens ${LENS_SECONDS}s steps(${Math.round(LENS_SECONDS / TICK)}) infinite; }
  @keyframes lens { to { transform: rotate(360deg); } }

  .driftX { animation: driftX ${2 * DRIFT_X * DRIFT_X_STEP}s steps(${2 * DRIFT_X}) ${-DRIFT_X * DRIFT_X_STEP}s infinite alternate; }
  .driftY { animation: driftY ${2 * DRIFT_Y * DRIFT_Y_STEP}s steps(${2 * DRIFT_Y}) ${-DRIFT_Y * DRIFT_Y_STEP}s infinite alternate; }
  @keyframes driftX { from { transform: translate(${-DRIFT_X}px, 0px); } to { transform: translate(${DRIFT_X}px, 0px); } }
  @keyframes driftY { from { transform: translate(0px, ${-DRIFT_Y}px); } to { transform: translate(0px, ${DRIFT_Y}px); } }

  .spot { animation: spot 8s linear infinite; }
  .spotFront { animation: spotFront 8s linear infinite; }
  @keyframes spot { ${spotFrames.join(' ')} }
  @keyframes spotFront { ${spotFrontFrames.join(' ')} }

  /* robotin näkö välähtää päälle, tarkentaa, vilkaisee vasemmalle tekstiä kohti ja sammuu */
  .eye { opacity: 0; animation: eye ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  ${eyeKeyframes('eye', 'opacity: 0; transform: translate(0px, 0px) scale(0.86);', [
    [0.26, 'opacity: 0.85; transform: translate(0px, 0px) scale(0.95);'],
    [0.62, 'opacity: 0.2;'],
    [0.88, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
    [2.39, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
    [3.17, 'opacity: 1; transform: translate(-12px, 2px) scale(1);'],
    [6.29, 'opacity: 0.95; transform: translate(-12px, 2px) scale(1);'],
    [7.59, 'opacity: 0; transform: translate(-6px, 1px) scale(1.06);'],
  ])}
  /* datakehä kiertää hitaasti koko ajan, kun silmä on auki */
  .eyeTurn { animation: eyeTurn ${EYE_SECONDS.toFixed(3)}s linear ${EYE_DELAY} infinite; }
  ${eyeKeyframes('eyeTurn', 'transform: rotate(-30deg);', [[7.6, 'transform: rotate(30deg);']])}
  /* tähtäinkaaret lukittuvat paikalleen ja nytkähtävät, kun katse kääntyy */
  .eyeTurnBack { animation: eyeTurnBack ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  ${eyeKeyframes('eyeTurnBack', 'transform: rotate(70deg);', [
    [0.31, 'transform: rotate(70deg);'],
    [1.6, 'transform: rotate(0deg);'],
    [2.65, 'transform: rotate(0deg);'],
    [3.43, 'transform: rotate(-24deg);'],
    [7.6, 'transform: rotate(-24deg);'],
  ])}
  /* pupilli supistuu terävästi juuri kun katse kääntyy tekstiin */
  .pupil { animation: pupil ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  ${eyeKeyframes('pupil', 'transform: scale(1.35);', [
    [0.83, 'transform: scale(1.35);'],
    [2.39, 'transform: scale(1.25);'],
    [3.17, 'transform: scale(0.7);'],
    [6.29, 'transform: scale(0.8);'],
    [7.59, 'transform: scale(1.3);'],
  ])}
  /* valopulssit juoksevat johtimia pitkin ulos, kolme kertaa silmän ollessa auki */
  .pulse { stroke-dasharray: 7 200; stroke-dashoffset: 8; animation: pulse ${EYE_SECONDS.toFixed(3)}s linear ${EYE_DELAY} infinite; }
  ${eyeKeyframes('pulse', 'stroke-dashoffset: 8;', [
    [1.35, 'stroke-dashoffset: 8;'],
    [2.39, 'stroke-dashoffset: -100;'],
    [2.392, 'stroke-dashoffset: 8;'],
    [3.69, 'stroke-dashoffset: -100;'],
    [3.692, 'stroke-dashoffset: 8;'],
    [4.99, 'stroke-dashoffset: -100;'],
    [4.992, 'stroke-dashoffset: 8;'],
  ])}
  /* skannausviiva: alas silmän käynnistyessä, ylös kun katse lukittuu */
  .scan { opacity: 0; animation: scan ${EYE_SECONDS.toFixed(3)}s linear ${EYE_DELAY} infinite; }
  ${eyeKeyframes('scan', 'transform: translate(0px, -90px); opacity: 0;', [
    [0.88, 'transform: translate(0px, -90px); opacity: 0;'],
    [0.9, 'transform: translate(0px, -90px); opacity: 1;'],
    [1.74, 'transform: translate(0px, 90px); opacity: 1;'],
    [1.76, 'transform: translate(0px, 90px); opacity: 0;'],
    [3.17, 'transform: translate(0px, 90px); opacity: 0;'],
    [3.19, 'transform: translate(0px, 90px); opacity: 0.8;'],
    [3.9, 'transform: translate(0px, -90px); opacity: 0.8;'],
    [3.92, 'transform: translate(0px, -90px); opacity: 0;'],
  ])}
  .eyeData { font-size: 7px; letter-spacing: 1.6px; }

  /* harva häiriöviiva */
  .gl { opacity: 0; animation: gl 17s steps(1) infinite; }
  .gl2 { animation-duration: 29s; animation-delay: -12s; }
  @keyframes gl {
    0% { opacity: 0.4; transform: translate(0px, 0px); }
    0.5% { opacity: 0.28; transform: translate(0px, 120px); }
    1%, 100% { opacity: 0; transform: translate(0px, 0px); }
  }

  text { font: 13px ui-monospace, Consolas, Menlo, monospace; }
  .fall, .fallFront { opacity: 0; animation: fall ${FALL_SECONDS}s linear infinite; }
  .fallFront { animation-name: fallFront; }
  .fall text, .fallFront text { font-size: 17px; }
  @keyframes fall { ${fallFrames.join(' ')} }
  @keyframes fallFront { ${fallFrontFrames.join(' ')} }

  .w { fill-opacity: 0.14; animation: w ${WAVE_SECONDS}s steps(${WAVE_LENGTH / 4}) infinite; }
  .x { animation-duration: ${CROSS_SECONDS}s; animation-timing-function: steps(${CROSS_LENGTH / 4}); }
  @keyframes w { 0%, 50%, 100% { fill-opacity: 0.14; } 75% { fill-opacity: 0.7; } }
  /* harvat kääntyvät bitit: kesto parillinen sekuntimäärä, joten käännös osuu aina TICKiin */
  .a, .z { animation: fa 10s steps(1) infinite; }
  .z { opacity: 0; animation-name: fz; }
  @keyframes fa { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes fz { 0% { opacity: 0; } 50% { opacity: 1; } }
  .d1 text { animation-duration: 12s; }
  .d2 text { animation-duration: 14s; }
  .d3 text { animation-duration: 16s; }
  .d4 text { animation-duration: 18s; }
  .d5 text { animation-duration: 8s; }
  .e1 text { animation-delay: -1s; }
  .e2 text { animation-delay: -3s; }
  .e3 text { animation-delay: -5s; }
  .e4 text { animation-delay: -7s; }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }
</style>

<rect width="1600" height="1000" fill="url(#sky)"/>
<ellipse cx="320" cy="780" rx="600" ry="400" fill="url(#nebV)"/>
<ellipse cx="${PX}" cy="${PY}" rx="640" ry="500" fill="url(#nebR)"/>
${stars.join('')}

<!-- bittikenttä koko ruudulla; himmenee sykkeen tahdissa -->
<g class="suck">
${bits}
</g>

<!-- aukko ja kaikki sen ympärillä vaeltaa hitaasti, ettei rengas pala ruutuun -->
<g class="driftX"><g class="driftY">

<!-- taustatähdet taipuvat kaariksi aukon ympärillä -->
<g transform="translate(${PX} ${PY})">
  <circle cx="0" cy="0" r="${R + 64}" fill="none" stroke="${EMBER}" stroke-width="1" stroke-opacity="0.12"/>
  <g class="lens">${arcs.join('')}</g>
</g>

<!-- takana: koko kiekko, kuuma kohta ja aukkoon valuvat bitit -->
${diskParts(false)}
<g class="spot"><circle cx="0" cy="0" r="6" fill="${HOT}"/></g>
${fallBits('fall')}

<!-- aukko: kiekon takaosan taittunut kuva, varjo ja fotonirengas -->
<g transform="${HOLE}">
  <circle cx="0" cy="-10" r="${R + 84}" fill="url(#glow)" class="beat"/>
  <circle cx="0" cy="-14" r="${R + 46}" fill="url(#halo)"/>
  <circle cx="0" cy="-9" r="${R + 20}" fill="none" class="spin fast back" stroke="${HOT}" stroke-width="26" stroke-opacity="0.14" stroke-dasharray="14 18"/>
  <circle cx="0" cy="0" r="${R}" fill="#000"/>
  <circle cx="0" cy="0" r="${R + 16}" fill="url(#rimGlow)" class="beat"/>
  <circle cx="0" cy="0" r="${R + 2}" fill="none" stroke="${HOT}" stroke-width="2.5" stroke-opacity="0.75"/>
</g>

<!-- robotin näkö varjon sisällä: kylmän syaani säieiiris, mikrorenkaat ja
     kimallus, pupilli ja heijastus, datakehä, tähtäinkaaret, skannausviiva ja
     oikealle lähtevät johtimet -->
<g transform="translate(${PX} ${PY})">
  <g class="eye">
    <g fill="none" stroke-width="1.2">
      <g stroke="url(#trace)">${traceParts.join('')}</g>
      <g stroke="${ICE}" stroke-opacity="0.65">${viaParts.join('')}</g>
    </g>
    <g fill="none" stroke="${ICE_HOT}" stroke-width="2.2" stroke-linecap="round">${pulseParts.join('')}</g>
    <circle cx="0" cy="0" r="92" fill="url(#iris)"/>
    <path d="${fibers.outer.join('')}" fill="none" stroke="${ICE_DEEP}" stroke-width="1.1" stroke-opacity="0.85"/>
    <path d="${fibers.mid.join('')}" fill="none" stroke="${ICE}" stroke-width="0.9" stroke-opacity="0.75"/>
    <path d="${fibers.inner.join('')}" fill="none" stroke="${ICE_HOT}" stroke-width="0.7" stroke-opacity="0.75"/>
    <g fill="none" stroke="${ICE}" stroke-width="0.6">
      <circle cx="0" cy="0" r="46" stroke-opacity="0.3"/>
      <circle cx="0" cy="0" r="58" stroke-opacity="0.5" stroke-dasharray="${EYE_MICRO}"/>
      <circle cx="0" cy="0" r="70" stroke-opacity="0.3"/>
    </g>
    <g fill="${ICE_HOT}">${speckParts.join('')}</g>
    <circle cx="0" cy="0" r="35" fill="none" stroke="${ICE_HOT}" stroke-width="0.8" stroke-opacity="0.4"/>
    <circle cx="0" cy="0" r="80" fill="none" stroke="${ICE}" stroke-width="1" stroke-opacity="0.7"/>
    <circle cx="0" cy="0" r="87" fill="none" stroke="${ICE}" stroke-width="5" stroke-opacity="0.35" stroke-dasharray="${EYE_TICKS}"/>
    <path d="${pinSegs.join('')}" fill="none" stroke="${ICE}" stroke-width="1" stroke-opacity="0.6"/>
    <g fill="${ICE}" fill-opacity="0.8">${pinDots.join('')}</g>
    <g clip-path="url(#eyeClip)"><g class="scan">
      <rect x="-92" y="-9" width="184" height="18" fill="url(#scanGlow)"/>
      <rect x="-92" y="-0.6" width="184" height="1.2" fill="${ICE_HOT}" fill-opacity="0.85"/>
    </g></g>
    <g class="eyeTurn">
      <text class="eyeData" fill="${ICE}" fill-opacity="0.6"><textPath href="#eyeData">${EYE_DATA}</textPath></text>
    </g>
    <g class="eyeTurnBack" fill="none" stroke="${ICE}">
      <circle cx="0" cy="0" r="109" stroke-width="2" stroke-opacity="0.75" stroke-dasharray="${EYE_HUD}"/>
      <circle cx="0" cy="0" r="103" stroke-width="4" stroke-opacity="0.45" stroke-dasharray="${EYE_HUD_FINE}"/>
      <circle cx="0" cy="0" r="28" stroke="${ICE_HOT}" stroke-width="1.4" stroke-opacity="0.65" stroke-dasharray="${EYE_APERTURE}"/>
    </g>
    <circle class="pupil" cx="0" cy="0" r="22" fill="url(#pupil)"/>
    <path d="M-66 -26A71 71 0 0 1 -34 -62" fill="none" stroke="${GLINT}" stroke-width="5" stroke-opacity="0.18" stroke-linecap="round"/>
    <path d="M58 30A66 66 0 0 1 36 54" fill="none" stroke="${GLINT}" stroke-width="3" stroke-opacity="0.1" stroke-linecap="round"/>
    <ellipse cx="-9" cy="-12" rx="6.5" ry="4" transform="rotate(-35 -9 -12)" fill="${GLINT}" fill-opacity="0.9"/>
    <circle cx="9" cy="10" r="2" fill="${GLINT}" fill-opacity="0.55"/>
  </g>
</g>

<!-- edessä: kiekon etupuolisko, kuuma kohta ja bitit radan etupuolella -->
${diskParts(true)}
<g class="spotFront">
  <circle cx="0" cy="0" r="22" fill="url(#spotGlow)"/>
  <circle cx="0" cy="0" r="6" fill="${HOT}"/>
</g>
${fallBits('fallFront')}

</g></g>

<rect class="gl" x="-100" y="300" width="1800" height="2" fill="${BLOOD}"/>
<rect class="gl gl2" x="-100" y="690" width="1800" height="1" fill="${EMBER}"/>
<rect x="-100" y="-100" width="1800" height="1200" fill="url(#vignette)"/>
</svg>`

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'singulariteetti', glass: { blur: 0, tint: '#0a0607', opacity: 0.6 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={SCENE}
        alt="Musta singulariteetti, jonka punahehkuinen kertymäkiekko pyörii ja sykkii; varjon sisällä käynnistyy välillä robotin kylmän syaani digitaalinen silmä piirilevyn johtimineen, ja taustan bittikenttä himmenee joka lyönnillä"
        isInteractive
      />
    )
  })
}

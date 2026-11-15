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
// Finaali (1.1.0): kierroksen viimeinen silmä ei sulkeudu. Pupilli seuraa
// kursoria (tai katsoo laidasta laitaan), binäärisade jähmettyy, ja bitit valuvat
// aukon viereen pyramidiksi, jonka 64 bittiä kertovat kahdeksan merkin viestin.
// Huippukivi syttyy rungon yläpuolelle, silmä siirtyy siihen gravitaatiolinssin
// läpi ja katselee ympärilleen. Sitten pyramidi murenee takaisin sateeksi, silmä
// palaa ja aukko syö kiekolla kiertävän kuuman pisteen. Joka kymmenes kierros
// (keskimäärin) aukko onkin valkoinen ja sylkäisee uuden pisteen radalle.
// Finaalin käynnistää SVG:n oma SMIL-ajastin, ja sen animaatiot ovat olemassa
// vain finaalin ajan. Kierroksen pituus pyöristetään 48 sekunnin monikertaan,
// jotta jähmettynyt sade on täsmälleen samassa vaiheessa kuin elävä.
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

type Viestilahde = 'paallaoloaika' | 'kellonaika' | 'teksti'
type Testitila = 'pois' | 'finaali' | 'valkoinen' | 'silma'

// ═══ Säädettävät arvot ═══════════════════════════════════════════════════════

// Avausväli: tauko ennen kutakin silmän avausta, sekunteina. Kierros ottaa
// listasta AVAUKSIA arvoa järjestyksessä (ja aloittaa listan alusta, jos se loppuu).
const AVAUSVALIT = [64, 112, 51, 95, 73, 118]

// Silmän avauksia kierroksella. Viimeisen avauksen tilalla on finaali.
const AVAUKSIA = 6

// Finaalin vaiheiden kestot sekunteina, tässä järjestyksessä (yhteensä noin 10,7 s).
const FINAALI = {
  avautuminen: 0.9, // silmä aukeaa singulariteetissa kuten tavallisesti
  seuranta: 2, // 1. silmä jää auki ja pupilli seuraa kursoria
  jahmettyminen: 0.3, // 2. binäärisade pysähtyy
  kasautuminen: 1.5, // 3. bitit valuvat pyramidiksi
  huippukivi: 0.6, // 4. huippukivi syttyy ja nousee leijumaan
  siirtyma: 0.5, // 5. silmä siirtyy huippukiveen gravitaatiolinssin läpi...
  katselu: 2.4, //    ...ja katselee siellä ympärilleen
  purku: 1, // 6. pyramidi murenee sateeksi, silmä palaa singulariteettiin
  ateria: 1.5, // 7. aukko syö kiekon kuuman pisteen (tai sylkee uuden)
}

// Todennäköisyys, että kierroksen ateria onkin valkoinen aukko (0–1).
const VALKOISEN_AUKON_TODENNAKOISYYS = 0.1

// Pyramidin viesti, 8 merkkiä eli 64 bittiä:
//   'paallaoloaika'  aika teeman latautumisesta finaalin hetkellä, HH:MM:SS
//   'kellonaika'     kellonaika finaalin hetkellä, HH:MM:SS
//   'teksti'         VIESTI_TEKSTI (8 ASCII-merkkiä; lyhyempi täytetään välilyönneillä)
const VIESTIN_LAHDE: Viestilahde = 'paallaoloaika'
const VIESTI_TEKSTI = 'SINGULAR'

// Testitila: 'finaali' tai 'valkoinen' aloittaa finaalin 3 s teeman latautumisen
// jälkeen, 'silma' kierroksen ensimmäisen tavallisen silmän, ja kierros jatkuu siitä
// normaalisti. Saman tekee istunnossa komento /singulariteetti-testi (perään
// "valkoinen" valkoisen aukon varianttiin tai "silmä" tavalliseen silmään).
const TESTITILA: Testitila = 'pois'

// Pyramidin pohjarivin keskikohta suhteessa aukon keskipisteeseen (ruutu on
// 1600 × 1000 yksikköä). Oletus on suoraan aukon yläpuolella, aukon tyhjällä
// alueella: oikealla se jäisi sovelluksen oikean reunan paneelin alle.
const PYRAMIDI_DX = 0
const PYRAMIDI_DY = -228

// Bittikentän leijunta: kun kirkas aalto ohittaa bitin, bitti leijuu näin monta
// yksikköä oikealle, aukkoa ja reunaa kohti, ja himmenee pois. 0 = ei leijuntaa.
const LEIJUNTA = 10

// Kiekon renkaiden liike: askelta sekunnissa (kuuma kohta liikkuu kaksi kertaa
// tiheämmin). Jokainen askel piirtää renkaat uudelleen. Sovelluksessa 1440p:llä
// 12 toimi, mutta sulava liike (0) pysäytti taustan heti, joten älä nosta tätä
// testaamatta (/singulariteetti-testi raskas yli minuutin).
const KIEKON_ASKELEET = 12

// ═════════════════════════════════════════════════════════════════════════════

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

// Pienet jatkuvat liikkeet (tähtien tuike, syke ja aukkoon valuvat bitit) etenevät
// portaittain näin monta askelta sekunnissa, kaikki samoilla hetkillä. Silloin
// selain kokoaa kuvan uudelleen vain askelten kohdalla eikä joka ruudunpäivityksellä.
// Kiekon renkaat etenevät KIEKON_ASKELEET ja kuuma kohta kaksi kertaa niin monta
// askelta sekunnissa, samoilla hetkillä. TICK on askeleiden monikerta.
const FRAME_RATE = 12

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

// Kiekon kuuma kohta kiertää kerran tässä ajassa.
const SPOT_SECONDS = 8

// Bittikentän valoaallot (ks. bittikenttä alempana).
const WAVE_SECONDS = 24
const WAVE_LENGTH = 72 // vinorivejä harjalta seuraavalle; jaollinen neljällä, SECONDS / LENGTH = TICK

// Luku lyhyeksi merkkijonoksi (enintään kolme desimaalia).
const num = (v: number, digits = 3): string => String(Number(v.toFixed(digits)) + 0)

// ─── Kierros ─────────────────────────────────────────────────────────────────
// Silmän tavallinen esitys kestää 25 TICKiä (noin 8 s), finaali FIN_TICKS.
// Tauot ovat AVAUSVALIT. CSS ei osaa arpoa, joten kierros toistuu samanlaisena,
// mutta tahti ei tunnu ajastimelta.

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b
const ticksOf = (seconds: number): number => Math.round(seconds / TICK)

// Finaalin aikamerkit sekunteina finaalin alusta. Jähmettyminen osuu TICKin
// keskelle, jotta jähmettynyt kuva ja elävä kenttä ovat varmasti samassa askeleessa.
const F = FINAALI
const midTick = (seconds: number): number => (Math.floor(seconds / TICK) + 0.5) * TICK
const T_FOLLOW = F.avautuminen
const T_FREEZE = midTick(T_FOLLOW + F.seuranta)
const T_BUILD = T_FREEZE + F.jahmettyminen
const T_CAP = T_BUILD + F.kasautuminen
const T_MOVE = T_CAP + F.huippukivi
const T_LOOK = T_MOVE + F.siirtyma
const T_CRUMBLE = T_LOOK + F.katselu
const T_MEAL = T_CRUMBLE + F.purku
const T_END = T_MEAL + F.ateria
const FIN_TICKS = Math.ceil((T_END + 0.3) / TICK)
const FIN_SECONDS = FIN_TICKS * TICK
const WHITE_TAIL = 5 // valkoisen aukon uusi piste jäähtyy radalla vielä näin kauan
const WHITE_SECONDS = FIN_SECONDS + WHITE_TAIL

const SHOWS = Math.max(1, Math.round(AVAUKSIA))
const EYE_SHOW_TICKS = 25
const showTicks = (i: number): number => (i === SHOWS - 1 ? FIN_TICKS : EYE_SHOW_TICKS)

// Kierros on aaltojen, sykkeen ja kuuman kohdan yhteisen jakson (48 s) monikerta:
// silloin jähmettynyt sade ja aterian piste osuvat joka kierroksella kohdalleen.
// Pyöristyksen lisä jaetaan tasaisesti taukoihin.
const SYNC_TICKS = [WAVE_SECONDS, BEAT_SECONDS, SPOT_SECONDS].map(ticksOf).reduce(lcm)
const pauseTicks = Array.from({ length: SHOWS }, (_, i): number =>
  ticksOf(AVAUSVALIT.length > 0 ? (AVAUSVALIT[i % AVAUSVALIT.length] ?? 60) : 60),
)
let rawTicks = 0
for (let i = 0; i < SHOWS; i++) {
  rawTicks += (pauseTicks[i] ?? 0) + showTicks(i)
}
const CYCLE_TICKS = Math.ceil(rawTicks / SYNC_TICKS) * SYNC_TICKS
for (let extra = CYCLE_TICKS - rawTicks, i = 0; extra > 0; extra--, i++) {
  const j = i % SHOWS
  pauseTicks[j] = (pauseTicks[j] ?? 0) + 1
}
const EYE_STARTS: number[] = [] // esitysten alut TICKeinä jakson alusta
let eyeClock = 0
for (let i = 0; i < SHOWS; i++) {
  eyeClock += pauseTicks[i] ?? 0
  EYE_STARTS.push(eyeClock)
  eyeClock += showTicks(i)
}
const EYE_SECONDS = eyeClock * TICK
const FIN_START = (EYE_STARTS[SHOWS - 1] ?? 0) * TICK
// Aukkoon valuvat bitit: noin 26 s kierros, mutta tasan kierroksen osa, ja jokainen
// avainkehysväli on kokonainen määrä askelia (FRAME_RATE).
const FALL_STEPS = 48
const fallDivisor = (): number => {
  const near = Math.max(1, Math.round(EYE_SECONDS / 26))
  for (let d = 0; d <= 12; d++) {
    for (const n of [near - d, near + d]) {
      const frames = (EYE_SECONDS * FRAME_RATE) / (n * FALL_STEPS)
      if (n >= 1 && Math.abs(frames - Math.round(frames)) < 1e-6) {
        return n
      }
    }
  }

  return near
}
const FALL_SECONDS = EYE_SECONDS / fallDivisor()
const FALL_FRAMES = Math.max(1, Math.round((FALL_SECONDS * FRAME_RATE) / FALL_STEPS)) // askeleita välillä

// Satunnainen aloituskohta: joka teeman piirrolla arvotaan, mistä kohtaa jaksoa
// silmä aloittaa. Kohta osuu aina johonkin taukoon (ei kesken esityksen), ja
// seuraavaan silmään jää vähintään EYE_FIRST_MIN sekuntia. Testitilassa finaali
// alkaa TEST_LEAD sekunnin kuluttua. Kohta on TICKin monikerta.
const EYE_FIRST_MIN = 20
const TEST_LEAD = 3
const eyeOffset = (test: Testitila): number => {
  if (test === 'silma') {
    return (EYE_STARTS[0] ?? 0) * TICK - TEST_LEAD
  }
  if (test !== 'pois') {
    return FIN_START - TEST_LEAD
  }
  const i = Math.floor(Math.random() * SHOWS)
  const pause = pauseTicks[i] ?? 0
  const room = Math.max(0, pause - ticksOf(EYE_FIRST_MIN))

  return ((EYE_STARTS[i] ?? 0) - pause + Math.floor(Math.random() * (room + 1))) * TICK
}

// Avainkehykset koko jaksolle: lepotila esitysten välissä ja jokaisen esityksen
// kohdalla sama kulku; viimeisellä esityksellä finaalin kulku. Kulun ajat ovat
// sekunteja esityksen alusta.
type Step = [number, string]
const eyeKeyframes = (name: string, rest: string, steps: Step[], finale: Step[] = steps): string => {
  const at = (seconds: number): string => `${((seconds / EYE_SECONDS) * 100).toFixed(4)}%`
  const frames = [`0% { ${rest} }`]
  EYE_STARTS.forEach((startTick, i) => {
    const start = startTick * TICK
    frames.push(`${at(start)} { ${rest} }`)
    for (const [t, css] of i === SHOWS - 1 ? finale : steps) {
      frames.push(`${at(start + t)} { ${css} }`)
    }
    frames.push(`${at(start + showTicks(i) * TICK)} { ${rest} }`)
  })
  frames.push(`100% { ${rest} }`)

  return `@keyframes ${name} { ${frames.join(' ')} }`
}

// Finaalin omat avainkehykset: ajat sekunteina finaalin alusta, kesto `total`.
// Saman hetken askeleet yhdistetään.
const frames = (name: string, total: number, ...lists: Step[][]): string => {
  const byTime = new Map<string, string[]>()
  for (const [t, css] of lists.flat()) {
    const key = `${num(Math.min(100, Math.max(0, (t / total) * 100)))}%`
    byTime.set(key, [...(byTime.get(key) ?? []), css])
  }

  return `@keyframes ${name} { ${[...byTime].map(([key, css]) => `${key} { ${css.join(' ')} }`).join(' ')} }`
}
// Portaittaiset avainkehykset: kohdat ovat osuuksia kestosta, ja ne pyöristetään
// askeliin (FRAME_RATE), jolloin jokainen väli etenee kokonaisin askelin.
const stepKeyframes = (name: string, seconds: number, points: [number, string][]): string => {
  const total = Math.round(seconds * FRAME_RATE)
  const at = points.map(([share, css]): [number, string] => [Math.round(share * total), css])

  return `@keyframes ${name} { ${at
    .map(([frame, css], i) => {
      const next = at[i + 1]
      const timing = next === undefined ? '' : ` animation-timing-function: steps(${Math.max(1, next[0] - frame)});`

      return `${num((frame / total) * 100, 4)}% { ${css}${timing} }`
    })
    .join(' ')} }`
}
// Näkyvissä vain välillä [a, b]. Näkyvyys (ei display) pitää animaatiot käynnissä
// koko finaalin ajan, joten kaikkien viiveet lasketaan finaalin alusta.
const win = (a: number, b: number, total: number): Step[] => [
  [0, 'visibility: hidden;'],
  [a - 0.001, 'visibility: hidden;'],
  [a, 'visibility: visible;'],
  [b, 'visibility: visible;'],
  [b + 0.001, 'visibility: hidden;'],
  [total, 'visibility: hidden;'],
]

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
const pulsePaths: string[] = []
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
  pulsePaths.push(d)
})
// Valopulssit porrastetaan johtimittain. Niiden animaatio on olemassa vain silmän
// esityksen ajan (luokka pon SMIL-ajastimelta, finaalissa on), koska katkoviivan
// siirto pakottaa selaimen käsittelemään kuvan joka ruudunpäivityksellä.
const pulseParts = pulsePaths
  .map((d, i) => `<path class="pulse" style="animation-delay:${num(i * 0.3)}s" d="${d}" pathLength="100"/>`)
  .join('')
const PULSE_SHOW: Step[] = [
  [0, 'stroke-dashoffset: 8;'],
  [1.35, 'stroke-dashoffset: 8;'],
  [2.39, 'stroke-dashoffset: -100;'],
  [2.392, 'stroke-dashoffset: 8;'],
  [3.69, 'stroke-dashoffset: -100;'],
  [3.692, 'stroke-dashoffset: 8;'],
  [4.99, 'stroke-dashoffset: -100;'],
  [4.992, 'stroke-dashoffset: 8;'],
]

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
// Saman tuikeryhmän tähdet tuikkivat samassa tahdissa, joten animoitu on ryhmä,
// ei jokainen tähti erikseen.
const TWINKLES = 4
const TWINKLE_TIMES: [number, number][] = [
  [6, 0], // kesto ja viive sekunteina; puolikas kesto on kokonainen määrä askelia
  [9, -3],
  [4.5, -1],
  [11, -5],
]
const twinkleGroups = (lists: string[][], attrs: string): string =>
  lists.map((list, i) => `<g class="tw tw${i}" ${attrs}>${list.join('')}</g>`).join('')
const stars: string[][] = Array.from({ length: TWINKLES }, (): string[] => [])
for (let i = 0; i < 70; i++) {
  const x = Math.round(rand() * 1600)
  const y = Math.round(rand() * 1000)
  const r = (0.5 + rand() * 1.0).toFixed(1)

  if (Math.hypot(x - PX, y - PY) > 390) {
    stars[i % TWINKLES]?.push(`<circle cx="${x}" cy="${y}" r="${r}"/>`)
  }
}

// Linssikaaret: mitä lähempänä aukkoa, sitä pidemmäksi tähti venyy.
const arcs: string[][] = Array.from({ length: TWINKLES }, (): string[] => [])
for (let i = 0; i < 26; i++) {
  const rho = 194 + rand() * 180
  const a0 = rand() * Math.PI * 2
  const span = ((38 - ((rho - 194) / 180) * 32) * Math.PI) / 180
  const a1 = a0 + span
  const pt = (a: number): string => `${(rho * Math.cos(a)).toFixed(1)} ${(rho * Math.sin(a)).toFixed(1)}`
  const op = (0.2 + rand() * 0.4).toFixed(2)
  const width = (0.8 + rand() * 0.9).toFixed(1)
  arcs[i % TWINKLES]?.push(
    `<path d="M${pt(a0)} A${rho.toFixed(1)} ${rho.toFixed(1)} 0 0 1 ${pt(a1)}" stroke-width="${width}" stroke-opacity="${op}"/>`,
  )
}

// Piste kiekon tasossa (kallistettu ellipsi) ruudun koordinaatteina.
const tilt = (TILT * Math.PI) / 180
const diskPoint = (r: number, a: number): [number, number] => {
  const ex = r * Math.cos(a)
  const ey = r * SQUASH * Math.sin(a)

  return [PX + ex * Math.cos(tilt) - ey * Math.sin(tilt), PY + ex * Math.sin(tilt) + ey * Math.cos(tilt)]
}
const onDisk = (r: number, a: number): [string, string] => {
  const [x, y] = diskPoint(r, a)

  return [x.toFixed(1), y.toFixed(1)]
}

// Kuuma kohta kiertää kiekossa. Etupuolen kopio näkyy vain radan etupuoliskolla.
const SPOT_R = 245
const STEPS = 32 // avainkehyksiä kierroksella; väli (1/4 s) on kokonainen määrä askelia
const SPOT_TIMING =
  KIEKON_ASKELEET > 0 ? `steps(${Math.max(1, Math.round((SPOT_SECONDS / STEPS) * KIEKON_ASKELEET * 2))})` : 'linear'
const spotFrames: string[] = []
const spotFrontFrames: string[] = []
for (let k = 0; k <= STEPS; k++) {
  const a = (k / STEPS) * Math.PI * 2
  const [x, y] = onDisk(SPOT_R, a)
  const pct = num((k / STEPS) * 100, 4)
  spotFrames.push(`${pct}% { transform: translate(${x}px, ${y}px); }`)
  spotFrontFrames.push(`${pct}% { transform: translate(${x}px, ${y}px); opacity: ${Math.sin(a) >= 0 ? 1 : 0}; }`)
}
// Kuuman kohdan kulma hetkellä t (sekunteja teeman piirrosta).
const spotAngle = (t: number): number => (2 * Math.PI * (((t % SPOT_SECONDS) + SPOT_SECONDS) % SPOT_SECONDS)) / SPOT_SECONDS

// Bitit valuvat kierteellä aukkoon: säde pienenee, kulma kiihtyy, lopuksi ne himmenevät.
// Etupuolen kopio näkyy vain radan etupuoliskolla. Se on yksi animoitu elementti
// bittiä kohden: selain käsittelee animoidut elementit joka ruudulla (renkaiden takia).
const fallFrames: string[] = []
const fallFrontFrames: string[] = []
for (let k = 0; k <= FALL_STEPS; k++) {
  const t = k / FALL_STEPS
  const a = 1.7 * Math.PI * 2 * Math.pow(t, 1.6)
  const [x, y] = onDisk(500 - 345 * t, a)
  const fade = t < 0.08 ? t / 0.08 : t > 0.82 ? Math.max(0, (1 - t) / 0.18) : 1
  const env = 0.8 * fade
  const move = `transform: translate(${x}px, ${y}px) scale(${(1 - 0.5 * t).toFixed(2)});`
  const pct = num(t * 100, 4)
  fallFrames.push(`${pct}% { ${move} opacity: ${env.toFixed(2)}; }`)
  fallFrontFrames.push(`${pct}% { ${move} opacity: ${(Math.sin(a) >= 0 ? env : 0).toFixed(2)}; }`)
}
const FALL_COUNT = 12
const fallBits = (cls: string): string => {
  const out: string[] = []
  for (let i = 0; i < FALL_COUNT; i++) {
    const delay = num(-(i * FALL_SECONDS) / FALL_COUNT - (i % 3) * 0.75)
    const fill = i % 4 === 3 ? ICE : i % 3 === 2 ? EMBER : BLOOD
    const bit = (i * 7) % 3 === 0 ? 0 : 1
    out.push(`<g class="${cls}" style="--d:${delay}s"><text fill="${fill}">${bit}</text></g>`)
  }

  return out.join('')
}

// Bittikenttä: koko ruudun harva ruudukko, kaikki bitit samoissa riveissä ja
// sarakkeissa. Bitit on ryhmitelty vinoriveittäin, ja valoaalto liukuu ryhmästä
// toiseen kohti oikeaa alakulmaa. Verenpunaisten joukossa on harvoja hiilloksen
// värisiä bittejä samassa aallossa (1.1.0: ennen ne kulkivat ristiin omana aaltonaan,
// mikä näytti liikkeeltä kahteen suuntaan). Aukon ja kiekon kohdalla ruudukko
// harvenee tyhjäksi.
// Aalto ajetaan fill-opacityllä, joka periytyy biteille ilman välikerroksia.
// Jokainen vinorivi kattaa lähes koko ruudun, joten aalto etenee portaittain:
// vinorivi per TICK, kaikki ryhmät samalla ruudunpäivityksellä. Vain osa biteistä kääntyy.
// Ryhmän tavalliset bitit ovat yksi tekstielementti, jolla on jokaiselle merkille
// oma paikka (1.1.0): sama kuva, mutta paljon vähemmän elementtejä ja merkkejä.
const PITCH_X = 24
const PITCH_Y = 26
const GRID_COLS = 67
const GRID_ROWS = 39
const DENSITY = 0.5
const FLIPPING = 0.06
const NET_SHARE = 0.11 // osuus biteistä, jotka ovat silmän syaaneja verkkobittejä

// Etäisyys aukosta kiekon suuntaisena soikiona: alle 1 on aukon omaa aluetta.
const fromHole = (x: number, y: number): number => {
  const dx = x - PX
  const dy = y - PY

  return Math.hypot(
    (dx * Math.cos(tilt) + dy * Math.sin(tilt)) / 440,
    (dy * Math.cos(tilt) - dx * Math.sin(tilt)) / 330,
  )
}

// Kentän bitti. `flip` on kääntyvän bitin puolijakso ja vaihe TICKeinä,
// `departs` pyramidiin lähtevän bitin lähtöhetki finaalissa.
type Flip = { half: number; phase: number }
type Cell = { x: number; y: number; bit: number; flip?: Flip; departs?: number }

// Kääntyvien bittien puolijaksot TICKeinä (4–12 s, jakso 8–24 s). Vaihe lasketaan
// aallon kellosta, joten jokaisen täyden jakson pitää jakaa aallon kierros (72 TICKiä).
const FLIP_HALVES = [18, 18, 12, 36, 18, 12]
const flipOf = (x: number, y: number, kind: number, start: number): Flip => {
  const half = FLIP_HALVES[kind] ?? 18

  return { half, phase: (start * 7 + x * 3 + y * 5) % (2 * half) }
}

const DIAGONALS = GRID_COLS + GRID_ROWS - 1
const mainWave: Cell[][] = Array.from({ length: DIAGONALS }, (): Cell[] => [])
const emberWave: Cell[][] = Array.from({ length: DIAGONALS }, (): Cell[] => [])
const netBits: Cell[] = []
for (let c = 0; c < GRID_COLS; c++) {
  for (let r = 0; r < GRID_ROWS; r++) {
    const x = 6 + c * PITCH_X
    const y = 18 + r * PITCH_Y
    const keep = DENSITY * Math.min(1, Math.max(0, (fromHole(x + 4, y - 5) - 1) / 0.5))

    if (rand() >= keep) {
      continue
    }
    const bit = rand() < 0.5 ? 0 : 1
    const cell: Cell =
      rand() < FLIPPING ? { x, y, bit, flip: flipOf(x, y, Math.floor(rand() * 6), Math.floor(rand() * 5)) } : { x, y, bit }

    // Verkkobitit arvotaan silmän omalla arvontafunktiolla, ettei muu kuvio muutu.
    if (eyeRand() < NET_SHARE) {
      netBits.push(cell)
    } else if (rand() < 0.14) {
      emberWave[c + r]?.push(cell)
    } else {
      mainWave[c + r]?.push(cell)
    }
  }
}

// ─── Pyramidi ────────────────────────────────────────────────────────────────
// Runko: 8 riviä, leveydet 1, 3, 5 … 15 merkkiä, yhteensä 64 bittiä. Bitit
// luetaan riveittäin vasemmalta oikealle, eniten merkitsevä bitti ensin, joten
// bitti k kuuluu merkkiin k / 8 ja sen paino on 2^(7 - k % 8).
const PCX = PX + PYRAMIDI_DX
const PBY = PY + PYRAMIDI_DY
const PYR_ROWS = 8
const PITCH_PX = 12
const PITCH_PY = 15
const PYR_MID_Y = PBY - ((PYR_ROWS - 1) * PITCH_PY) / 2
const ROW_FILLS = ['#ffe2c4', '#ffcfa6', '#ffb689', '#ff9a66', '#ff7a45', '#ff5a1f', '#f03a26', '#e0202a']

// Huippukivi: erillinen kolmio rungon yläpuolella. Silmä istuu sen sisäympyrässä.
const CAP_W = 40 // puolileveys
const CAP_H = 50
const CAP_RISE = 10
const CAP_Y = PBY - (PYR_ROWS - 1) * PITCH_PY - 21 // pohjan korkeus ennen nousua
const CAP_IN = (CAP_W * CAP_H) / (CAP_W + Math.hypot(CAP_W, CAP_H)) // sisäympyrän säde
const CAP_EYE_Y = CAP_Y - CAP_RISE - CAP_IN // silmän paikka nousun jälkeen
const CAP_EYE_SCALE = (CAP_IN - 3) / 92

type Slot = { x: number; y: number; row: number; k: number }
const slots: Slot[] = []
for (let row = 0, k = 0; row < PYR_ROWS; row++) {
  for (let i = 0; i <= 2 * row; i++, k++) {
    slots.push({ x: PCX + (i - row) * PITCH_PX, y: PBY - (PYR_ROWS - 1 - row) * PITCH_PY, row, k })
  }
}

// Lähdebitit: kentän tavallisia bittejä pyramidin ympäriltä, lähimmät ensin
// pienellä satunnaisuudella. Ne paritetaan paikkoihin kulman mukaan, jotta
// virtaukset eivät risteä.
let srcSeed = 41
const srcRand = (): number => {
  srcSeed = (srcSeed * 1103515245 + 12345) % 2147483648

  return srcSeed / 2147483648
}
const angleAround = (x: number, y: number): number => Math.atan2(y - PYR_MID_Y, x - PCX)
const sources = [...mainWave.flat(), ...emberWave.flat()]
  .filter(cell => cell.flip === undefined && Math.hypot(cell.x - PCX, cell.y - PYR_MID_Y) > 130)
  .map(cell => ({ cell, rank: Math.hypot(cell.x - PCX, cell.y - PYR_MID_Y) * (0.7 + 0.6 * srcRand()) }))
  .sort((a, b) => a.rank - b.rank)
  .slice(0, slots.length)
  .map(({ cell }) => cell)
  .sort((a, b) => angleAround(a.x, a.y) - angleAround(b.x, b.y))
const slotsByAngle = [...slots].sort((a, b) => angleAround(a.x, a.y) - angleAround(b.x, b.y))

const FLOW_SECONDS = F.kasautuminen * 0.55
const CRUMBLE_SECONDS = F.purku * 0.65
const cellParts = new Map<number, string>()
slotsByAngle.forEach((slot, i) => {
  const src = sources[i]
  const departs = T_BUILD + ((PYR_ROWS - 1 - slot.row) / (PYR_ROWS - 1)) * F.kasautuminen * 0.4 + srcRand() * 0.05
  const from: [number, number] =
    src === undefined ? [slot.x + (srcRand() - 0.5) * 400, slot.y - 200 - srcRand() * 100] : [src.x, src.y]
  if (src !== undefined) {
    src.departs = departs
  }
  const crumbles = T_CRUMBLE + srcRand() * F.purku * 0.3
  const fall: [number, number] = [(slot.x - PCX) * 0.3 + (srcRand() - 0.5) * 50, 60 + srcRand() * 90]
  cellParts.set(
    slot.k,
    `<g class="pb q${Math.floor(slot.k / 8)} j${slot.k % 8}" style="translate:${slot.x}px ${slot.y}px;--fx:${num(from[0] - slot.x, 0)}px;--fy:${num(from[1] - slot.y, 0)}px;--dl:${num(departs, 2)}s;--cl:${num(crumbles, 2)}s;--cx:${num(fall[0], 0)}px;--cy:${num(fall[1], 0)}px"><text>0</text><text>1</text></g>`,
  )
})
const pyramidCells = Array.from({ length: PYR_ROWS }, (_, row): string => {
  const cells = slots.filter(slot => slot.row === row).map(slot => cellParts.get(slot.k) ?? '')

  return `<g fill="${ROW_FILLS[row] ?? EMBER}">${cells.join('')}</g>`
}).join('')

// Kentän bitit merkinnöiksi: ryhmän tavalliset bitit yhtenä tekstinä, kääntyvät ja
// pyramidiin lähtevät omina elementteinään. Kääntyvä bitti laskee vaiheensa
// kentän kellosta (ks. .fl), joten sillä ei ole omaa animaatiota.
const cellsMarkup = (cells: Cell[]): string => {
  const plain = cells.filter(cell => cell.flip === undefined && cell.departs === undefined)
  const list =
    plain.length === 0
      ? ''
      : `<text x="${plain.map(cell => cell.x).join(' ')}" y="${plain.map(cell => cell.y).join(' ')}">${plain.map(cell => cell.bit).join('')}</text>`
  const own = cells.map(cell =>
    cell.flip !== undefined
      ? `<g class="fl" style="--h:${cell.flip.half};--o:${cell.flip.phase}" transform="translate(${cell.x} ${cell.y})"><text class="b0">${cell.bit}</text><text class="b1">${1 - cell.bit}</text></g>`
      : cell.departs !== undefined
        ? `<text class="s" style="--sd:${num(cell.departs, 2)}s" x="${cell.x}" y="${cell.y}">${cell.bit}</text>`
        : '',
  )

  return list + own.join('')
}

// Mitä pienempi vinorivin numero, sitä aiemmin aalto ehtii sille: valo kulkee
// vasemmalta ylhäältä kohti oikeaa alakulmaa. Vinorivin --k on sen vaihe-ero
// TICKeinä; kentän kello (--p) kertoo aallon vaiheen, ja vinorivi laskee
// kirkkautensa ja leijuntansa niistä (ks. .w). Kello on SMIL-ajastin (ks.
// waveClock): kenttä lasketaan uudelleen vain TICKin välein. Sovellus herättää
// SMIL-ajastimet ajallaan vain, kun jokin CSS-animaatio pitää kuvan hereillä
// (kiekon renkaat, ks. diskParts); muuten noin 10 sekunnin välein.
// Saman vinorivin verenpunaiset ja hiilloksen väriset bitit ovat samassa ryhmässä.
const waveGroups = (main: Cell[][], ember: Cell[][]): string =>
  main
    .map((cells, k) => {
      const hot = ember[k] ?? []

      return cells.length + hot.length === 0
        ? ''
        : `<g class="w" style="--k:${(DIAGONALS - k) % WAVE_LENGTH}">${cellsMarkup(cells)}${hot.length === 0 ? '' : `<g class="em">${cellsMarkup(hot)}</g>`}</g>`
    })
    .join('')

// Kentän kello: --p on aallon vaihe (0–71, yksi askel per TICK). Jokainen <set>
// antaa kentälle luokan pK omalla TICKillään ja käynnistää itsensä uudelleen
// kierroksen päästä; viimeksi alkanut voittaa. Toisin kuin CSS-animaatio, <set>
// ei vaadi selainta käsittelemään kuvaa joka ruudunpäivityksellä. Jähmettynyt
// kopio saa vaiheensa muuttujasta --pf (ks. frozen).
const waveClock = Array.from(
  { length: WAVE_LENGTH },
  (_, k): string => `<set id="p${k}" attributeName="class" to="p${k}" begin="${num(k * TICK)}s;p${k}.begin+${WAVE_SECONDS}s"/>`,
).join('')
const wavePhase = (seconds: number): number => (Math.floor(seconds / TICK + 1e-6) % WAVE_LENGTH + WAVE_LENGTH) % WAVE_LENGTH

const bits = `<g class="wc" fill="${BLOOD}">${waveClock}${waveGroups(mainWave, emberWave)}
<g fill="${ICE}" class="net">${cellsMarkup(netBits)}</g></g>`

const QUARTER = WAVE_LENGTH / 4 // 18 TICKiä; jaollinen kolmella (syttymisen askeleet)
const LIFT_X = num((LEIJUNTA * 0.74) / (2 * QUARTER), 4)
const LIFT_Y = num((LEIJUNTA * 0.68) / (2 * QUARTER), 4)
const FIELD_CSS = `
  .w, .fl { --p: var(--pf, var(--pl, 0)); }
  ${Array.from({ length: WAVE_LENGTH }, (_, k) => `.p${k}{--pl:${k}}`).join('')}
  /* aalto: bitti syttyy hiljaa (3 askelta), pysyy himmeänä, kirkastuu ja leijuu
     aallon suuntaan kohti oikeaa alakulmaa (LEIJUNTA), himmenee leijuessaan pois ja
     palaa näkymättömänä paikalleen. Neljännes = 18 TICKiä. Näkyvä liike vain yhteen suuntaan. */
  .w { --q: mod(var(--p) + var(--k), ${WAVE_LENGTH}); --r1: clamp(0, var(--q) - ${2 * QUARTER}, ${QUARTER}); --r2: clamp(0, var(--q) - ${3 * QUARTER}, ${QUARTER});
    fill-opacity: calc(0.14 * min(3, round(down, var(--q) / ${QUARTER / 3})) / 3 + (0.56 * var(--r1) - 0.7 * var(--r2)) / ${QUARTER});
    transform: translate(calc((var(--r1) + var(--r2)) * ${LIFT_X}px), calc((var(--r1) + var(--r2)) * ${LIFT_Y}px)); }
  .em { fill: ${EMBER}; }
  /* harvat kääntyvät bitit: vaihtavat merkkiä puolijakson välein, aina TICKin kohdalla */
  .fl { --f: mod(round(down, (var(--p) + var(--o)) / var(--h)), 2); }
  .b0 { opacity: calc(1 - var(--f)); }
  .b1 { opacity: var(--f); }`

// Kertymäkiekko: takaa koko rengas, edestä vain etupuolisko, joka kulkee varjon yli.
// Katkoviiva siirtyy renkaalla (stroke-dashoffset) KIEKON_ASKELEET askelta sekunnissa,
// ja selain piirtää renkaat taustakuvaan. Kiertoliike (transform) olisi selaimessa
// halvempi, mutta sovelluksessa 1440p:llä se pysäytti taustan heti, samoin sulava
// katkoviiva; 12 askelta/s toimi (15.11.2026). Nopeus: 160 yksikköä kehää pitkin
// `seconds` sekunnissa. Askel saa olla korkeintaan noin kolmannes katkoviivan
// jaksosta, ettei kuvio näytä pyörivän väärään suuntaan: siksi sisin kuuma rengas
// kiertää 5 s:ssa (ennen 1,4 s). Tämä on kuvan ainoa joka ruudulla käsiteltävä
// animaatio, ja se pitää myös SMIL-ajastimet ajassa: ilman sitä sovellus herättää
// ne vain noin 10 sekunnin välein.
const dashTiming = (seconds: number, reverse = false): string => {
  const end = reverse ? ' reverse' : ''
  if (KIEKON_ASKELEET <= 0) {
    return `animation:dash ${seconds}s linear infinite${end}`
  }
  const steps = Math.max(1, Math.round(seconds * KIEKON_ASKELEET))

  return `animation:dash ${num(steps / KIEKON_ASKELEET, 6)}s steps(${steps}) infinite${end}`
}
const diskParts = (front: boolean): string => {
  const shape = (r: number, attrs: string): string =>
    front
      ? `<path d="M${r} 0 A${r} ${r} 0 0 1 ${-r} 0" fill="none" ${attrs}/>`
      : `<circle cx="0" cy="0" r="${r}" fill="none" ${attrs}/>`
  const ring = (seconds: number): string => `class="sp" style="${dashTiming(seconds)}"`

  return `<g transform="${HOLE} scale(1 ${SQUASH})">
    ${shape(276, `stroke="url(#disk)" stroke-width="216" stroke-opacity="0.32"`)}
    ${shape(304, `${ring(4)} stroke="${BLOOD}" stroke-width="56" stroke-opacity="0.45" stroke-dasharray="5 11"`)}
    ${shape(350, `${ring(11)} stroke="${BLOOD}" stroke-width="30" stroke-opacity="0.32" stroke-dasharray="2 14"`)}
    ${shape(226, `${ring(2.5)} stroke="${EMBER}" stroke-width="40" stroke-opacity="0.5" stroke-dasharray="6 10"`)}
    ${shape(186, `${ring(5)} stroke="${HOT}" stroke-width="18" stroke-opacity="0.5" stroke-dasharray="3 5"`)}
    ${shape(170, `stroke="${HOT}" stroke-width="3" stroke-opacity="0.6"`)}
    ${shape(262, `stroke="${EMBER}" stroke-width="2" stroke-opacity="0.45"`)}
    ${shape(382, `${ring(11)} stroke="${BLOOD}" stroke-width="2" stroke-opacity="0.5" stroke-dasharray="2 14"`)}
    ${shape(276, `class="f nv dfl" stroke="${HOT}" stroke-width="216"`)}
  </g>`
}

// ─── Silmän seuranta ─────────────────────────────────────────────────────────
// Kursorin paikka tulee näkymättömiltä ruuduilta, joiden :hover kääntää pupillia.
// Jos kehys ei saa hiiren liikettä (sovellus päästää painallukset taustan läpi),
// pupilli katsoo hitaasti laidasta laitaan. Vaikuttaa vain finaalin seurantavaiheessa.
const ZONE_COLS = 8
const ZONE_ROWS = 5
const zoneRects: string[] = []
const zoneRules: string[] = []
for (let j = 0, n = 0; j < ZONE_ROWS; j++) {
  for (let i = 0; i < ZONE_COLS; i++, n++) {
    const w = 1600 / ZONE_COLS
    const h = 1000 / ZONE_ROWS
    const dx = (i + 0.5) * w - PX
    const dy = (j + 0.5) * h - PY
    const len = Math.max(1, Math.hypot(dx, dy))
    const reach = (13 * Math.min(1, len / 320)) / len
    zoneRects.push(`<rect class="z z${n}" x="${i * w}" y="${j * h}" width="${w}" height="${h}" fill="none"/>`)
    zoneRules.push(`.z${n}:hover ~ .stage .aimHost { --hx: ${num(dx * reach, 1)}px; --hy: ${num(dy * reach, 1)}px; }`)
  }
}

// ─── Finaalin silmä (tavallisen silmän animaatioiden viimeinen esitys) ──────
const FOLLOW_END = T_FREEZE
const eyeFinale: Step[] = [
  [0.26, 'opacity: 0.85; transform: translate(0px, 0px) scale(0.95);'],
  [0.62, 'opacity: 0.2;'],
  [0.88, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
  [FOLLOW_END, 'transform: translate(0px, 0px) scale(1);'],
  [T_BUILD + 0.4, 'transform: translate(7px, -7px) scale(1);'],
  [T_MOVE, 'opacity: 1; transform: translate(7px, -7px) scale(1);'],
  [T_MOVE + 0.25, 'opacity: 0; transform: translate(12px, -14px) scale(0.8);'],
  [T_CRUMBLE + 0.3, 'opacity: 0; transform: translate(0px, 0px) scale(0.86);'],
  [T_CRUMBLE + 0.55, 'opacity: 0.85; transform: translate(0px, 0px) scale(0.95);'],
  [T_CRUMBLE + 0.8, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
  [T_MEAL + F.ateria * 0.6, 'opacity: 1; transform: translate(0px, 0px) scale(1.03);'],
  [T_END - 0.05, 'opacity: 0; transform: translate(-4px, 1px) scale(1.06);'],
]

// Silmän animaatiot (jakso EYE_SECONDS). Viive annetaan rakennettaessa.
const EYE_CSS = [
  // Verkkobittien kirkkaus on ryhmän opacity (ei fill-opacity), jotta selain voi
  // vaihtaa sen valmiiseen kuvaan ilman uudelleenpiirtoa.
  eyeKeyframes(
    'net',
    'opacity: 0.1;',
    [
      [1 * TICK, 'opacity: 0.22;'],
      [2 * TICK, 'opacity: 0.34;'],
      [3 * TICK, 'opacity: 0.42;'],
      [17 * TICK, 'opacity: 0.34;'],
      [20 * TICK, 'opacity: 0.24;'],
      [23 * TICK, 'opacity: 0.16;'],
    ],
    [
      [1 * TICK, 'opacity: 0.22;'],
      [2 * TICK, 'opacity: 0.34;'],
      [3 * TICK, 'opacity: 0.42;'],
      [T_MOVE + 0.3, 'opacity: 0.3;'],
      [T_MOVE + 0.6, 'opacity: 0.2;'],
      [T_CRUMBLE + 0.6, 'opacity: 0.3;'],
      [T_CRUMBLE + 0.9, 'opacity: 0.42;'],
      [T_END - 0.5, 'opacity: 0.24;'],
      [T_END - 0.2, 'opacity: 0.16;'],
    ],
  ),
  eyeKeyframes(
    'eye',
    'opacity: 0; transform: translate(0px, 0px) scale(0.86);',
    [
      [0.26, 'opacity: 0.85; transform: translate(0px, 0px) scale(0.95);'],
      [0.62, 'opacity: 0.2;'],
      [0.88, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
      [2.39, 'opacity: 1; transform: translate(0px, 0px) scale(1);'],
      [3.17, 'opacity: 1; transform: translate(-12px, 2px) scale(1);'],
      [6.29, 'opacity: 0.95; transform: translate(-12px, 2px) scale(1);'],
      [7.59, 'opacity: 0; transform: translate(-6px, 1px) scale(1.06);'],
    ],
    eyeFinale,
  ),
  eyeKeyframes('eyeTurn', 'transform: rotate(-30deg);', [[7.6, 'transform: rotate(30deg);']], [
    [T_END - 0.1, 'transform: rotate(70deg);'],
  ]),
  eyeKeyframes(
    'eyeTurnBack',
    'transform: rotate(70deg);',
    [
      [0.31, 'transform: rotate(70deg);'],
      [1.6, 'transform: rotate(0deg);'],
      [2.65, 'transform: rotate(0deg);'],
      [3.43, 'transform: rotate(-24deg);'],
      [7.6, 'transform: rotate(-24deg);'],
    ],
    [
      [0.31, 'transform: rotate(70deg);'],
      [1.6, 'transform: rotate(0deg);'],
      [T_MOVE, 'transform: rotate(0deg);'],
      [T_MOVE + 0.3, 'transform: rotate(-40deg);'],
      [T_CRUMBLE + 0.3, 'transform: rotate(70deg);'],
      [T_CRUMBLE + 1, 'transform: rotate(0deg);'],
      [T_END - 0.1, 'transform: rotate(-24deg);'],
    ],
  ),
  eyeKeyframes(
    'pupil',
    'transform: scale(1.35);',
    [
      [0.83, 'transform: scale(1.35);'],
      [2.39, 'transform: scale(1.25);'],
      [3.17, 'transform: scale(0.7);'],
      [6.29, 'transform: scale(0.8);'],
      [7.59, 'transform: scale(1.3);'],
    ],
    [
      [0.83, 'transform: scale(1.35);'],
      [1.6, 'transform: scale(1.15);'],
      [FOLLOW_END, 'transform: scale(1);'],
      [T_BUILD + 0.4, 'transform: scale(0.8);'],
      [T_MOVE, 'transform: scale(0.85);'],
      [T_MOVE + 0.25, 'transform: scale(1.3);'],
      [T_CRUMBLE + 0.8, 'transform: scale(1.15);'],
      [T_MEAL + F.ateria * 0.35, 'transform: scale(1);'],
      [T_MEAL + F.ateria * 0.45, 'transform: scale(0.55);'],
      [T_END, 'transform: scale(1.3);'],
    ],
  ),
  frames('pulse', EYE_SHOW_TICKS * TICK, PULSE_SHOW),
  frames('pulseF', FIN_SECONDS, [
    ...PULSE_SHOW.slice(0, 4),
    [T_BUILD, 'stroke-dashoffset: 8;'],
    [T_BUILD + 1, 'stroke-dashoffset: -100;'],
    [T_BUILD + 1.002, 'stroke-dashoffset: 8;'],
    [T_CRUMBLE + 0.8, 'stroke-dashoffset: 8;'],
    [T_CRUMBLE + 1.8, 'stroke-dashoffset: -100;'],
    [T_CRUMBLE + 1.802, 'stroke-dashoffset: 8;'],
  ]),
  eyeKeyframes(
    'scan',
    'transform: translate(0px, -90px); opacity: 0;',
    [
      [0.88, 'transform: translate(0px, -90px); opacity: 0;'],
      [0.9, 'transform: translate(0px, -90px); opacity: 1;'],
      [1.74, 'transform: translate(0px, 90px); opacity: 1;'],
      [1.76, 'transform: translate(0px, 90px); opacity: 0;'],
      [3.17, 'transform: translate(0px, 90px); opacity: 0;'],
      [3.19, 'transform: translate(0px, 90px); opacity: 0.8;'],
      [3.9, 'transform: translate(0px, -90px); opacity: 0.8;'],
      [3.92, 'transform: translate(0px, -90px); opacity: 0;'],
    ],
    [
      [0.88, 'transform: translate(0px, -90px); opacity: 0;'],
      [0.9, 'transform: translate(0px, -90px); opacity: 1;'],
      [1.74, 'transform: translate(0px, 90px); opacity: 1;'],
      [1.76, 'transform: translate(0px, 90px); opacity: 0;'],
      [T_CRUMBLE + 0.6, 'transform: translate(0px, -90px); opacity: 0;'],
      [T_CRUMBLE + 0.62, 'transform: translate(0px, -90px); opacity: 0.8;'],
      [T_CRUMBLE + 1.3, 'transform: translate(0px, 90px); opacity: 0.8;'],
      [T_CRUMBLE + 1.32, 'transform: translate(0px, 90px); opacity: 0;'],
    ],
  ),
].join('\n  ')

// ─── Finaalin pysyvät osat (eivät riipu arvonnasta) ─────────────────────────
const FS = FIN_SECONDS
const sky = '#07040a'

// Gravitaatiolinssi kulkee aukon keskeltä huippukiven silmään. Sisällä näkyy
// jähmettynyt kenttä ja pyramidi suurennettuna.
const LENS_R = 46
const LENS_MAG = 1.55
const lensSteps = (inner: boolean): Step[] => {
  const out: Step[] = []
  for (let i = 0; i <= 6; i++) {
    const u = i / 6
    const e = u * u * (3 - 2 * u)
    const x = PX + (PCX - PX) * e
    const y = PY + (CAP_EYE_Y - PY) * e
    const t = T_MOVE + u * F.siirtyma
    out.push([
      t,
      inner
        ? `transform: scale(${LENS_MAG}) translate(${num(-x, 1)}px, ${num(-y, 1)}px);`
        : `transform: translate(${num(x, 1)}px, ${num(y, 1)}px); opacity: ${num(Math.min(1, u * 3.5, (1 - u) * 6), 2)};`,
    ])
  }

  return out
}

const PYR_FLOW_CSS = `
  .pb text { font-size: 14px; font-weight: 700; text-anchor: middle; }
  .pb text:first-child { opacity: calc(1 - var(--b)); }
  .pb text + text { opacity: var(--b); }
  ${Array.from({ length: 8 }, (_, i) => `.q${i} { --c: var(--c${i}); } .j${i} { --b: mod(round(down, var(--c) / ${2 ** (7 - i)}), 2); }`).join('\n  ')}
  .pb { --mx: calc(var(--fx) * 0.42 - var(--fy) * 0.3); --my: calc(var(--fy) * 0.42 + var(--fx) * 0.3); }
  .on .pb { animation: flow ${num(FLOW_SECONDS)}s cubic-bezier(0.5, 0, 0.3, 1) var(--dl) both, crumble ${num(CRUMBLE_SECONDS)}s cubic-bezier(0.5, 0, 0.9, 0.6) var(--cl) forwards; }
  @keyframes flow {
    0% { transform: translate(var(--fx), var(--fy)); opacity: 0; }
    12% { opacity: 0.9; }
    55% { transform: translate(var(--mx), var(--my)); }
    100% { transform: translate(0px, 0px); opacity: 1; }
  }
  @keyframes crumble {
    0% { transform: translate(0px, 0px); opacity: 1; }
    100% { transform: translate(var(--cx), var(--cy)); opacity: 0; }
  }`

const FINALE_FIXED_CSS = `
  .stage { pointer-events: none; }
  .z { pointer-events: all; }
  ${zoneRules.join('\n  ')}
  /* 1. pupilli: --fw avaa seurantaikkunan; ilman kursoria pSweep katsoo laidasta laitaan.
     Ei rekisteröityjä CSS-muuttujia: ne pysäyttivät sovelluksen taustan. */
  .pAim { translate: calc(var(--fw, 0) * var(--hx, 0px)) calc(var(--fw, 0) * var(--hy, 0px)); transition: translate 0.35s ease-out; }
  .z:hover ~ .stage .pSweep { animation: none; }
  .on .aimHost { animation: fw ${num(FS)}s linear both; }
  ${frames('fw', FS, [
    [0, '--fw: 0;'],
    [T_FOLLOW + 0.2 - 0.002, '--fw: 0;'],
    [T_FOLLOW + 0.2, '--fw: 1;'],
    [FOLLOW_END - 0.25, '--fw: 1;'],
    [FOLLOW_END - 0.248, '--fw: 0;'],
    [FS, '--fw: 0;'],
  ])}
  .on .pSweep { animation: sweep ${num(FS)}s ease-in-out both; }
  ${frames('sweep', FS, [
    [0, 'translate: 0px 0px;'],
    [T_FOLLOW + 0.2, 'translate: 0px 0px;'],
    [T_FOLLOW + F.seuranta * 0.3, 'translate: -13px 0px;'],
    [T_FOLLOW + F.seuranta * 0.78, 'translate: 13px 0px;'],
    [FOLLOW_END, 'translate: 0px 0px;'],
    [FS, 'translate: 0px 0px;'],
  ])}

  /* finaalin osat ovat olemassa vain finaalin aikana (luokka "on" SMIL-ajastimelta) */
  .f { display: none; }
  .on .f { display: inline; }
  .on:not(.white) .wv, .on.white .nv { display: none; }

  /* 2. sade jähmettyy: elävä kenttä vaihtuu pysäytettyyn kopioon samalla hetkellä */
  .on .live { animation: live ${num(FS)}s linear both; }
  ${frames('live', FS, [
    [0, 'opacity: 1;'],
    [T_FREEZE, 'opacity: 1;'],
    [T_FREEZE + 0.001, 'opacity: 0;'],
    [T_CRUMBLE + 0.15, 'opacity: 0;'],
    [T_CRUMBLE + 0.85, 'opacity: 1;'],
    [FS, 'opacity: 1;'],
  ])}
  .on .frz { animation: frz ${num(FS)}s linear both; }
  ${frames('frz', FS, win(T_FREEZE, T_CRUMBLE + 0.85, FS), [
    [0, 'opacity: 1;'],
    [T_CRUMBLE + 0.15, 'opacity: 1;'],
    [T_CRUMBLE + 0.85, 'opacity: 0;'],
    [FS, 'opacity: 0;'],
  ])}
  .on .frzField { --srcAnim: srcOut; }
  .s { opacity: var(--srcOp, 1); animation: var(--srcAnim, none) 0.25s ease var(--sd) both; }
  @keyframes srcOut { to { opacity: 0; } }

  /* 3. pyramidi */
  .on .pyr { animation: pyr ${num(FS)}s linear both; }
  ${frames('pyr', FS, win(T_BUILD, T_MEAL + 0.1, FS))}
  .on .pglow { animation: pglow ${num(FS)}s linear both; }
  ${frames('pglow', FS, win(T_BUILD, T_MEAL, FS), [
    [0, 'opacity: 0;'],
    [T_BUILD, 'opacity: 0;'],
    [T_CAP, 'opacity: 0.8;'],
    [T_CRUMBLE, 'opacity: 0.8;'],
    [T_CRUMBLE + 0.8, 'opacity: 0;'],
    [FS, 'opacity: 0;'],
  ])}
  ${PYR_FLOW_CSS}

  /* 4. huippukivi syttyy, nousee ja leijuu */
  .on .cap { animation: cap ${num(FS)}s linear both; }
  ${frames('cap', FS, win(T_CAP, T_MEAL, FS))}
  .on .capT { animation: capT ${num(FS)}s ease-in-out both; }
  ${frames('capT', FS, [
    [0, 'opacity: 0; transform: translate(0px, 6px) scale(0.85);'],
    [T_CAP, 'opacity: 0; transform: translate(0px, 6px) scale(0.85);'],
    [T_CAP + 0.15, 'opacity: 1; transform: translate(0px, 2px) scale(1.05);'],
    [T_MOVE, `opacity: 1; transform: translate(0px, ${-CAP_RISE}px) scale(1);`],
    [T_LOOK + F.katselu * 0.25, `transform: translate(0px, ${-CAP_RISE - 2}px) scale(1);`],
    [T_LOOK + F.katselu * 0.55, `transform: translate(0px, ${-CAP_RISE + 1.5}px) scale(1);`],
    [T_LOOK + F.katselu * 0.85, `transform: translate(0px, ${-CAP_RISE - 2}px) scale(1);`],
    [T_CRUMBLE, `opacity: 1; transform: translate(0px, ${-CAP_RISE}px) scale(1);`],
    [T_CRUMBLE + F.purku * 0.7, 'opacity: 0; transform: translate(0px, 30px) scale(0.9);'],
    [FS, 'opacity: 0; transform: translate(0px, 30px) scale(0.9);'],
  ])}
  .on .capFlash { animation: capFlash ${num(FS)}s ease-out both; }
  ${frames('capFlash', FS, [
    [0, 'opacity: 0;'],
    [T_CAP, 'opacity: 0;'],
    [T_CAP + 0.12, 'opacity: 1;'],
    [T_CAP + 0.5, 'opacity: 0;'],
    [FS, 'opacity: 0;'],
  ])}

  /* 5. silmä siirtyy huippukiveen gravitaatiolinssin läpi ja katselee ympärilleen */
  .on .lens { animation: lens ${num(FS)}s linear both; }
  ${frames('lens', FS, win(T_MOVE, T_LOOK, FS), [[0, 'opacity: 0;'], [FS, 'opacity: 0;']], lensSteps(false))}
  .on .lensMag { animation: lensMag ${num(FS)}s linear both; }
  ${frames('lensMag', FS, lensSteps(true))}
  .on .ceO { animation: ceO ${num(FS)}s ease-out both; }
  ${frames('ceO', FS, [
    [0, 'opacity: 0; transform: scale(0.5);'],
    [T_LOOK - 0.05, 'opacity: 0; transform: scale(0.5);'],
    [T_LOOK + 0.2, 'opacity: 1; transform: scale(1);'],
    [T_CRUMBLE, 'opacity: 1; transform: scale(1);'],
    [T_CRUMBLE + 0.3, 'opacity: 0; transform: scale(0.6);'],
    [FS, 'opacity: 0; transform: scale(0.6);'],
  ])}
  .on .ceP { animation: ceP ${num(FS)}s ease-in-out both; }
  ${frames('ceP', FS, [
    [0, 'transform: translate(0px, 0px);'],
    [T_LOOK + F.katselu * 0.1, 'transform: translate(0px, 0px);'],
    [T_LOOK + F.katselu * 0.3, 'transform: translate(-30px, 6px);'],
    [T_LOOK + F.katselu * 0.52, 'transform: translate(30px, -5px);'],
    [T_LOOK + F.katselu * 0.72, 'transform: translate(0px, 30px);'],
    [T_LOOK + F.katselu * 0.9, 'transform: translate(-14px, -18px);'],
    [T_CRUMBLE, 'transform: translate(0px, 0px);'],
    [FS, 'transform: translate(0px, 0px);'],
  ])}`

// ─── Testejä varten: viesti tietyllä kierroksella ───────────────────────────
type SceneOptions = {
  test: Testitila
  message: Viestilahde
  text: string
  whiteChance: number
  now: number // millisekunteja, piirron hetki
  loadedAt: number // millisekunteja, teeman latautuminen
}

const textCodes = (text: string): number[] =>
  Array.from(text.padEnd(8).slice(0, 8), (ch): number => {
    const code = ch.charCodeAt(0)

    return code >= 32 && code < 127 ? code : 63
  })

const dayClock = (ms: number): number => {
  try {
    const d = new Date(ms)

    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
  } catch {
    return Math.floor(ms / 1000) % 86400
  }
}

// Viestin sekuntiarvo ensimmäisessä finaalissa (seuraavissa + k kierrosta).
const messageBase = (o: SceneOptions, firstFinale: number): number =>
  Math.round((o.message === 'kellonaika' ? dayClock(o.now) : (o.now - o.loadedAt) / 1000) + firstFinale + T_BUILD)

const formatMessage = (o: SceneOptions, firstFinale: number, k: number): string => {
  if (o.message === 'teksti') {
    return String.fromCharCode(...textCodes(o.text))
  }
  const u = messageBase(o, firstFinale) + k * EYE_SECONDS
  const pad = (v: number): string => String(Math.floor(v)).padStart(2, '0')

  return `${pad((u / 3600) % (o.message === 'kellonaika' ? 24 : 100))}:${pad((u / 60) % 60)}:${pad(u % 60)}`
}

// ─── Koko kuva ───────────────────────────────────────────────────────────────
const pct = (ticks: number, total: number): string => `${((ticks / total) * 100).toFixed(2)}%`
const BEAT_TICKS = Math.round(BEAT_SECONDS / TICK)

const buildScene = (o: SceneOptions): { svg: string; firstFinale: number; whiteCycles: number[] } => {
  const offset = eyeOffset(o.test)
  const EYE_DELAY = `${num(-offset)}s`
  const t0 = FIN_START - offset // ensimmäisen finaalin alku piirrosta, s
  const shift = -(t0 + T_FREEZE) // jähmettyneen kopion viive: sama hetki kuin elävässä

  // Valkoinen aukko arvotaan valmiiksi jokaiselle kierrokselle (noin 48 tuntia).
  const whiteCycles: number[] = []
  const horizon = Math.ceil((48 * 3600) / EYE_SECONDS)
  for (let k = 0; k < horizon; k++) {
    const forced = k === 0 && o.test !== 'pois'
    if (forced ? o.test === 'valkoinen' : Math.random() < o.whiteChance) {
      whiteCycles.push(k)
    }
  }

  // Pyramidin viesti: kahdeksan merkkikoodia muuttujina --c0 … --c7.
  // Ajan viestissä kierrokset lasketaan SMIL-ajastimilla: ykköset (--m1) ja kymmenet
  // (--m10) vaihtuvat kierrosten puolivälissä, ei finaalin aikana, ja laskuri alkaa
  // alusta vuorokauden jälkeen. Ajastin ei vaadi selainta käsittelemään kuvaa joka
  // ruudunpäivityksellä, toisin kuin CSS-muuttujan animaatio.
  const timeMessage = o.message !== 'teksti'
  const tens = Math.ceil(Math.ceil(86400 / EYE_SECONDS) / 10)
  const digitSets = (name: string, base: string, count: number, span: number): string =>
    Array.from(
      { length: count },
      (_, j): string =>
        `<set id="${name}${j}" attributeName="class" to="${base} ${name}${j}" begin="${num(t0 + (j * span - 0.5) * EYE_SECONDS)}s;${name}${j}.begin+${num(count * span * EYE_SECONDS)}s"/>`,
    ).join('')
  const clockUnits = timeMessage ? digitSets('cu', 'clk', 10, 1) : ''
  const clockTens = timeMessage ? digitSets('ct', 'clk2', tens, 10) : ''
  const codes = !timeMessage
    ? `.clk { ${textCodes(o.text)
        .map((code, i) => `--c${i}: ${code};`)
        .join(' ')} }`
    : `.clk2 { --u: calc(${messageBase(o, t0)} + ${num(EYE_SECONDS)} * (var(--m1, 0) + 10 * var(--m10, 0)));
    --hh: mod(round(down, var(--u) / 3600), ${o.message === 'kellonaika' ? 24 : 100}); --mm: mod(round(down, var(--u) / 60), 60); --ss: mod(var(--u), 60);
    --c0: calc(48 + round(down, var(--hh) / 10)); --c1: calc(48 + mod(var(--hh), 10)); --c2: 58;
    --c3: calc(48 + round(down, var(--mm) / 10)); --c4: calc(48 + mod(var(--mm), 10)); --c5: 58;
    --c6: calc(48 + round(down, var(--ss) / 10)); --c7: calc(48 + mod(var(--ss), 10)); }
  ${Array.from({ length: 10 }, (_, j) => `.cu${j}{--m1:${j}}`).join('')}${Array.from({ length: tens }, (_, j) => `.ct${j}{--m10:${j}}`).join('')}`

  // 7. Ateria: kuuma kohta kiertyy spiraalina aukkoon, kiekko välähtää, aukko
  // sykähtää ja radalle syttyy uusi piste. Kuuman kohdan kulma tunnetaan, koska
  // kierros on sen jakson monikerta.
  const A = F.ateria
  const EAT = A * 0.45
  const RELIGHT = A * 0.7
  const omega = (2 * Math.PI) / SPOT_SECONDS
  const mealA0 = spotAngle(t0 + T_MEAL)
  const mealSteps = (front: boolean): Step[] => {
    const out: Step[] = []
    for (let i = 0; i <= 14; i++) {
      const u = i / 14
      const r = SPOT_R - (SPOT_R - R + 6) * u * u
      const a = mealA0 + omega * u * EAT + 1.6 * Math.PI * u * u
      const [x, y] = diskPoint(r, a)
      const fade = u > 0.8 ? (1 - u) / 0.2 : 1
      const shown = front && Math.sin(a) < 0 ? 0 : fade
      out.push([T_MEAL + u * EAT, `transform: translate(${num(x, 1)}px, ${num(y, 1)}px) scale(${num(1 - 0.5 * u, 2)}); opacity: ${num(shown, 2)};`])
    }

    return out
  }
  const orbitDelay = (lead: number): string => `${num(-((((t0 + lead) % SPOT_SECONDS) + SPOT_SECONDS) % SPOT_SECONDS))}s`

  // Valkoinen aukko: välähdys, uusi piste purkautuu keskeltä spiraalina radalle
  // kohtaan, joka on kiekon etupuolella ja erossa vanhasta pisteestä, ja kiertää
  // sitten radalla jäähtyen.
  const EMERGE = A * 0.6
  const settle = T_MEAL + 0.1 + EMERGE
  const spotAtSettle = spotAngle(t0 + settle)
  const delta =
    [Math.PI, 0.8 * Math.PI, 1.2 * Math.PI, 0.6 * Math.PI, 1.4 * Math.PI, 0.4 * Math.PI, 1.6 * Math.PI].find(
      d => Math.sin(spotAtSettle + d) > 0.35,
    ) ?? Math.PI
  const settleA = spotAtSettle + delta
  const emergeSteps: Step[] = []
  for (let i = 0; i <= 12; i++) {
    const u = i / 12
    const r = SPOT_R * (1 - (1 - u) * (1 - u))
    const a = settleA - omega * EMERGE * (1 - u) - 1.4 * Math.PI * (1 - u) * (1 - u)
    const [x, y] = diskPoint(r, a)
    emergeSteps.push([
      T_MEAL + 0.1 + u * EMERGE,
      `transform: translate(${num(x, 1)}px, ${num(y, 1)}px) scale(${num(0.4 + 0.6 * u, 2)}); opacity: ${num(Math.min(1, u * 6), 2)};`,
    ])
  }

  const FW = WHITE_SECONDS
  const finaleCss = `
  ${codes}
  /* 7. ateria (tavallinen) */
  .on:not(.white) .spotW { animation: spotHide ${num(FS)}s linear both; }
  ${frames('spotHide', FS, [
    [0, 'opacity: 1;'],
    [T_MEAL, 'opacity: 1;'],
    [T_MEAL + 0.02, 'opacity: 0;'],
    [T_MEAL + RELIGHT, 'opacity: 0;'],
    [T_MEAL + RELIGHT + 0.35, 'opacity: 1;'],
    [FS, 'opacity: 1;'],
  ])}
  .on .mealB { animation: mealB ${num(FS)}s linear both; }
  ${frames('mealB', FS, win(T_MEAL, T_MEAL + EAT, FS), mealSteps(false))}
  .on .mealF { animation: mealF ${num(FS)}s linear both; }
  ${frames('mealF', FS, win(T_MEAL, T_MEAL + EAT, FS), mealSteps(true))}
  .on .dfl { animation: dfl ${num(FS)}s ease-out both; }
  ${frames('dfl', FS, [
    [0, 'stroke-opacity: 0;'],
    [T_MEAL + EAT - 0.02, 'stroke-opacity: 0;'],
    [T_MEAL + EAT + 0.06, 'stroke-opacity: 0.22;'],
    [T_MEAL + EAT + 0.45, 'stroke-opacity: 0;'],
    [FS, 'stroke-opacity: 0;'],
  ])}
  .on .hgulp { animation: hgulp ${num(FS)}s ease-in-out both; }
  ${frames('hgulp', FS, [
    [0, 'transform: scale(1);'],
    [T_MEAL + EAT, 'transform: scale(1);'],
    [T_MEAL + EAT + 0.18, 'transform: scale(1.08);'],
    [T_MEAL + EAT + 0.55, 'transform: scale(1);'],
    [FS, 'transform: scale(1);'],
  ])}
  .on .hglow { animation: hglow ${num(FS)}s ease-out both; }
  ${frames('hglow', FS, [
    [0, 'opacity: 0; transform: scale(1);'],
    [T_MEAL + EAT, 'opacity: 0; transform: scale(1);'],
    [T_MEAL + EAT + 0.12, 'opacity: 1; transform: scale(1.12);'],
    [T_MEAL + EAT + 0.6, 'opacity: 0; transform: scale(1.22);'],
    [FS, 'opacity: 0; transform: scale(1);'],
  ])}
  .on .orbB { animation: spot ${SPOT_SECONDS}s ${SPOT_TIMING} ${orbitDelay(0)} infinite; }
  .on .orbF { animation: spotFront ${SPOT_SECONDS}s ${SPOT_TIMING} ${orbitDelay(0)} infinite; }
  .on .relit { animation: relit ${num(FS)}s ease-out both; }
  ${frames('relit', FS, [
    [0, 'opacity: 0; transform: scale(0.3);'],
    [T_MEAL + RELIGHT, 'opacity: 0; transform: scale(0.3);'],
    [T_MEAL + RELIGHT + 0.12, 'opacity: 1; transform: scale(1.4);'],
    [T_MEAL + RELIGHT + 0.5, 'opacity: 0; transform: scale(1);'],
    [FS, 'opacity: 0; transform: scale(1);'],
  ])}

  /* 7. valkoinen aukko */
  .on .wflash { animation: wflash ${num(FW)}s ease-out both; }
  ${frames('wflash', FW, [
    [0, 'opacity: 0; transform: scale(0.2);'],
    [T_MEAL + 0.05, 'opacity: 0; transform: scale(0.2);'],
    [T_MEAL + 0.14, 'opacity: 1; transform: scale(0.9);'],
    [T_MEAL + 0.55, 'opacity: 0; transform: scale(1.35);'],
    [FW, 'opacity: 0; transform: scale(1.35);'],
  ])}
  .on .wdot { animation: wdot ${num(FW)}s linear both; }
  ${frames('wdot', FW, win(T_MEAL + 0.1, settle, FW), emergeSteps)}
  .on .worbB { animation: spot ${SPOT_SECONDS}s ${SPOT_TIMING} ${orbitDelay(delta / omega)} infinite; }
  .on .worbF { animation: spotFront ${SPOT_SECONDS}s ${SPOT_TIMING} ${orbitDelay(delta / omega)} infinite; }
  .on .wcool { animation: wcool ${num(FW)}s linear both; }
  ${frames('wcool', FW, win(settle, settle + WHITE_TAIL, FW), [
    [0, 'opacity: 0;'],
    [settle, 'opacity: 1;'],
    [settle + WHITE_TAIL * 0.3, 'opacity: 0.85;'],
    [settle + WHITE_TAIL, 'opacity: 0;'],
    [FW, 'opacity: 0;'],
  ])}`

  // SMIL-ajastin antaa kuvalle luokan "on" (ja valkoisella kierroksella "white")
  // finaalin ajaksi. Se on kuvan oma kello, samassa tahdissa CSS-animaatioiden kanssa.
  // Tavallisten silmän esitysten ajastin johtimien valopulsseille (luokka pon).
  // Alut siirretään ensimmäiselle kierrokselle: SMIL ohittaa menneisyyteen jääneet
  // jaksot, eikä niiden toistoa (pon.begin + kierros) silloin synny. Satunnainen
  // aloituskohta osuu aina taukoon, joten mikään esitys ei ole kesken alussa.
  const showBegins = EYE_STARTS.slice(0, SHOWS - 1)
    .map(tick => (((tick * TICK - offset) % EYE_SECONDS) + EYE_SECONDS) % EYE_SECONDS)
    .sort((a, b) => a - b)
    .map(seconds => `${num(seconds)}s`)
  const pulseTimer =
    showBegins.length === 0
      ? ''
      : `<set id="pon" attributeName="class" to="pw pon" begin="${showBegins.join(';')};pon.begin+${num(EYE_SECONDS)}s" dur="${num(EYE_SHOW_TICKS * TICK)}s"/>`
  const timers = `<set id="fin" attributeName="class" to="stage on" begin="${num(t0)}s;fin.begin+${num(EYE_SECONDS)}s" dur="${num(FS)}s"/>${
    whiteCycles.length === 0
      ? ''
      : `<set attributeName="class" to="stage on white" begin="${whiteCycles.map(k => `${num(t0 + k * EYE_SECONDS)}s`).join(';')}" dur="${num(FW)}s"/>`
  }`

  // Jähmettynyt kopio: CSS-animaatiot pysäytetään samaan hetkeen (--ps, --shift)
  // ja aallon kello samaan vaiheeseen (--pf). Kierros on aallon jakson monikerta,
  // joten vaihe on joka finaalissa sama.
  const frozen = (id: string, extra = ''): string =>
    `<use href="#${id}" style="--ps:paused;--shift:${num(shift)}s;--pf:${wavePhase(t0 + T_FREEZE)}${extra}"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
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
  <!-- finaali: pyramidin hehku, huippukivi, valkoisen aukon välähdys -->
  <radialGradient id="pyrGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${EMBER}" stop-opacity="0.22"/>
    <stop offset="0.6" stop-color="${BLOOD}" stop-opacity="0.1"/>
    <stop offset="1" stop-color="${BLOOD}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="capFill" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="${ICE}" stop-opacity="0.34"/>
    <stop offset="1" stop-color="${ICE_HOT}" stop-opacity="0.12"/>
  </linearGradient>
  <radialGradient id="capGlow" cx="0.5" cy="0.6" r="0.5">
    <stop offset="0" stop-color="${ICE}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${ICE}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="wburst" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
    <stop offset="0.35" stop-color="${ICE_HOT}" stop-opacity="0.85"/>
    <stop offset="0.7" stop-color="${HOT}" stop-opacity="0.35"/>
    <stop offset="1" stop-color="${HOT}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="wGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
    <stop offset="0.4" stop-color="${ICE_HOT}" stop-opacity="0.6"/>
    <stop offset="1" stop-color="${ICE}" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="eyeClip"><circle cx="0" cy="0" r="84"/></clipPath>
  <clipPath id="lensClip"><circle cx="0" cy="0" r="${LENS_R}"/></clipPath>
  <path id="eyeData" d="M-97 0A97 97 0 1 1 97 0A97 97 0 1 1 -97 0"/>
</defs>
<style>
  /* tähdet tuikkivat ryhmittäin, portaittain (FRAME_RATE) */
  ${TWINKLE_TIMES.map(([seconds, delay], i) => `.tw${i} { animation: tw ${seconds}s steps(${Math.round((seconds / 2) * FRAME_RATE)}) ${delay}s infinite; }`).join('\n  ')}
  @keyframes tw { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.8; } }

  /* syke: hehku leimahtaa kahdesti ja raukeaa, portaittain */
  .beat { animation: beat ${num(BEAT_SECONDS, 6)}s linear infinite; }
  ${stepKeyframes('beat', BEAT_SECONDS, [
    [0, 'opacity: 0.45;'],
    [0.03, 'opacity: 1;'],
    [0.09, 'opacity: 0.6;'],
    [0.14, 'opacity: 0.95;'],
    [0.32, 'opacity: 0.45;'],
    [1, 'opacity: 0.45;'],
  ])}
  /* samoilla lyönneillä bittikenttä hengähtää hiukan himmeämmäksi, kuin valo
     imaistaisiin: pienin askelin TICKin tahdissa, ei nykäisynä. Kentän
     animaatioilla on --shift ja --ps, joilla jähmettynyt kopio pysäytetään
     täsmälleen samaan hetkeen kuin elävä kenttä. */
  .suck { animation: suck ${BEAT_SECONDS.toFixed(6)}s steps(1) infinite; animation-delay: var(--shift, 0s); animation-play-state: var(--ps, running); }
  @keyframes suck {
    0% { opacity: 0.93; }
    ${pct(1, BEAT_TICKS)} { opacity: 0.88; }
    ${pct(2, BEAT_TICKS)} { opacity: 0.86; }
    ${pct(3, BEAT_TICKS)} { opacity: 0.9; }
    ${pct(4, BEAT_TICKS)} { opacity: 0.95; }
    ${pct(5, BEAT_TICKS)}, 100% { opacity: 1; }
  }
  /* verkkobitit: himmeitä, kunnes silmä aukeaa; silloin ne kirkastuvat portaittain */
  .net { opacity: 0.1; animation: net ${EYE_SECONDS.toFixed(3)}s steps(1) infinite; animation-delay: calc(${EYE_DELAY} + var(--shift, 0s)); animation-play-state: var(--ps, running); }

  /* kiekon renkaiden kesto ja askeleet ovat kunkin renkaan omassa tyylissä */
  @keyframes dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -160; } }

  .lensArcs { animation: lensArcs ${LENS_SECONDS}s steps(${Math.round(LENS_SECONDS / TICK)}) infinite; }
  @keyframes lensArcs { to { transform: rotate(360deg); } }

  .driftX { animation: driftX ${2 * DRIFT_X * DRIFT_X_STEP}s steps(${2 * DRIFT_X}) ${-DRIFT_X * DRIFT_X_STEP}s infinite alternate; }
  .driftY { animation: driftY ${2 * DRIFT_Y * DRIFT_Y_STEP}s steps(${2 * DRIFT_Y}) ${-DRIFT_Y * DRIFT_Y_STEP}s infinite alternate; }
  @keyframes driftX { from { transform: translate(${-DRIFT_X}px, 0px); } to { transform: translate(${DRIFT_X}px, 0px); } }
  @keyframes driftY { from { transform: translate(0px, ${-DRIFT_Y}px); } to { transform: translate(0px, ${DRIFT_Y}px); } }

  .spot { animation: spot ${SPOT_SECONDS}s ${SPOT_TIMING} infinite; }
  .spotFront { animation: spotFront ${SPOT_SECONDS}s ${SPOT_TIMING} infinite; }
  @keyframes spot { ${spotFrames.join(' ')} }
  @keyframes spotFront { ${spotFrontFrames.join(' ')} }

  /* robotin näkö välähtää päälle, tarkentaa, vilkaisee vasemmalle tekstiä kohti ja sammuu;
     kierroksen viimeisellä kerralla se jää auki finaaliin */
  .eye { opacity: 0; animation: eye ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  /* datakehä kiertää hitaasti koko ajan, kun silmä on auki */
  .eyeTurn { animation: eyeTurn ${EYE_SECONDS.toFixed(3)}s linear ${EYE_DELAY} infinite; }
  /* tähtäinkaaret lukittuvat paikalleen ja nytkähtävät, kun katse kääntyy */
  .eyeTurnBack { animation: eyeTurnBack ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  /* pupilli supistuu terävästi juuri kun katse kääntyy tekstiin */
  .pupil { animation: pupil ${EYE_SECONDS.toFixed(3)}s ease-in-out ${EYE_DELAY} infinite; }
  /* valopulssit juoksevat johtimia pitkin ulos, kolme kertaa silmän ollessa auki */
  .pulse { stroke-dasharray: 7 200; stroke-dashoffset: 8; }
  .pon .pulse { animation: pulse ${num(EYE_SHOW_TICKS * TICK)}s linear both; }
  .on .pulse { animation: pulseF ${num(FIN_SECONDS)}s linear both; }
  /* skannausviiva: alas silmän käynnistyessä, ylös kun katse lukittuu */
  .scan { opacity: 0; animation: scan ${EYE_SECONDS.toFixed(3)}s linear ${EYE_DELAY} infinite; }
  ${EYE_CSS}
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
  .fall, .fallFront { opacity: 0; animation: fall ${num(FALL_SECONDS, 6)}s steps(${FALL_FRAMES}) infinite; animation-delay: calc(var(--d) + var(--shift, 0s)); animation-play-state: var(--ps, running); }
  .fallFront { animation-name: fallFront; }
  .fall text, .fallFront text { font-size: 17px; }
  @keyframes fall { ${fallFrames.join(' ')} }
  @keyframes fallFront { ${fallFrontFrames.join(' ')} }

  ${FIELD_CSS}
  ${FINALE_FIXED_CSS}
  ${finaleCss}

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .f { display: none !important; }
  }
</style>
${zoneRects.join('')}
<g class="stage">
${timers}
<rect width="1600" height="1000" fill="url(#sky)"/>
<ellipse cx="320" cy="780" rx="600" ry="400" fill="url(#nebV)"/>
<ellipse cx="${PX}" cy="${PY}" rx="640" ry="500" fill="url(#nebR)"/>
${twinkleGroups(stars, `fill="${STAR}"`)}

<!-- bittikenttä koko ruudulla; himmenee sykkeen tahdissa. Finaalissa se vaihtuu
     pysäytettyyn kopioon (jähmettyminen) ja palaa purun aikana. -->
<g class="live"><g class="suck" id="field">
${bits}
</g></g>
<g class="f frz frzField">${frozen('field')}</g>

<!-- aukko ja kaikki sen ympärillä vaeltaa hitaasti, ettei rengas pala ruutuun -->
<g class="driftX"><g class="driftY">

<!-- taustatähdet taipuvat kaariksi aukon ympärillä -->
<g transform="translate(${PX} ${PY})">
  <circle cx="0" cy="0" r="${R + 64}" fill="none" stroke="${EMBER}" stroke-width="1" stroke-opacity="0.12"/>
  <g class="lensArcs">${twinkleGroups(arcs, `fill="none" stroke="${STAR}" stroke-linecap="round"`)}</g>
</g>

<!-- takana: koko kiekko, kuuma kohta ja aukkoon valuvat bitit -->
${diskParts(false)}
<g class="spotW"><g class="spot"><circle cx="0" cy="0" r="6" fill="${HOT}"/></g></g>
<g class="f nv mealB"><circle cx="0" cy="0" r="6" fill="${HOT}"/></g>
<g class="f nv orbB"><circle class="relit" cx="0" cy="0" r="30" fill="url(#spotGlow)"/></g>
<g class="f wv worbB"><g class="wcool"><circle cx="0" cy="0" r="6" fill="#fff"/></g></g>
<g class="live"><g id="fallsB">${fallBits('fall')}</g></g>
<g class="f frz">${frozen('fallsB')}</g>

<!-- aukko: kiekon takaosan taittunut kuva, varjo ja fotonirengas -->
<g transform="${HOLE}">
  <circle cx="0" cy="-10" r="${R + 84}" fill="url(#glow)" class="beat"/>
  <circle class="f nv hglow" cx="0" cy="-10" r="${R + 84}" fill="url(#glow)"/>
  <circle cx="0" cy="-14" r="${R + 46}" fill="url(#halo)"/>
  <circle cx="0" cy="-9" r="${R + 20}" fill="none" class="sp" style="${dashTiming(2.5, true)}" stroke="${HOT}" stroke-width="26" stroke-opacity="0.14" stroke-dasharray="14 18"/>
  <circle cx="0" cy="0" r="${R}" fill="#000"/>
  <circle class="f nv hgulp" cx="0" cy="0" r="${R}" fill="#000"/>
  <circle cx="0" cy="0" r="${R + 16}" fill="url(#rimGlow)" class="beat"/>
  <circle cx="0" cy="0" r="${R + 2}" fill="none" stroke="${HOT}" stroke-width="2.5" stroke-opacity="0.75"/>
  <g class="f wv wflash">
    <circle cx="0" cy="0" r="${R + 30}" fill="url(#wburst)"/>
    <circle cx="0" cy="0" r="${R + 2}" fill="none" stroke="#fff" stroke-width="4"/>
  </g>
</g>

<!-- robotin näkö varjon sisällä: kylmän syaani säieiiris, mikrorenkaat ja
     kimallus, pupilli ja heijastus, datakehä, tähtäinkaaret, skannausviiva ja
     oikealle lähtevät johtimet. Finaalissa pupilli seuraa kursoria. -->
<g class="aimHost" transform="translate(${PX} ${PY})">
  <g class="eye">
    <g fill="none" stroke-width="1.2">
      <g stroke="url(#trace)">${traceParts.join('')}</g>
      <g stroke="${ICE}" stroke-opacity="0.65">${viaParts.join('')}</g>
    </g>
    <g class="pw" fill="none" stroke="${ICE_HOT}" stroke-width="2.2" stroke-linecap="round">${pulseTimer}${pulseParts}</g>
    <g id="irisArt">
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
    </g>
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
    </g>
    <g class="pSweep"><g class="pAim">
      <g class="eyeTurnBack" fill="none" stroke="${ICE}">
        <circle cx="0" cy="0" r="28" stroke="${ICE_HOT}" stroke-width="1.4" stroke-opacity="0.65" stroke-dasharray="${EYE_APERTURE}"/>
      </g>
      <circle class="pupil" cx="0" cy="0" r="22" fill="url(#pupil)"/>
    </g></g>
    <path d="M-66 -26A71 71 0 0 1 -34 -62" fill="none" stroke="${GLINT}" stroke-width="5" stroke-opacity="0.18" stroke-linecap="round"/>
    <path d="M58 30A66 66 0 0 1 36 54" fill="none" stroke="${GLINT}" stroke-width="3" stroke-opacity="0.1" stroke-linecap="round"/>
    <ellipse cx="-9" cy="-12" rx="6.5" ry="4" transform="rotate(-35 -9 -12)" fill="${GLINT}" fill-opacity="0.9"/>
    <circle cx="9" cy="10" r="2" fill="${GLINT}" fill-opacity="0.55"/>
  </g>
</g>

<!-- edessä: kiekon etupuolisko, kuuma kohta ja bitit radan etupuolella -->
${diskParts(true)}
<g class="spotW"><g class="spotFront">
  <circle cx="0" cy="0" r="22" fill="url(#spotGlow)"/>
  <circle cx="0" cy="0" r="6" fill="${HOT}"/>
</g></g>
<g class="f nv mealF">
  <circle cx="0" cy="0" r="22" fill="url(#spotGlow)"/>
  <circle cx="0" cy="0" r="6" fill="${HOT}"/>
</g>
<g class="f nv orbF"><circle class="relit" cx="0" cy="0" r="34" fill="url(#spotGlow)"/></g>
<g class="f wv wdot">
  <circle cx="0" cy="0" r="26" fill="url(#wGlow)"/>
  <circle cx="0" cy="0" r="5" fill="#fff"/>
</g>
<g class="f wv worbF"><g class="wcool">
  <circle cx="0" cy="0" r="22" fill="url(#wGlow)"/>
  <circle cx="0" cy="0" r="5" fill="#fff"/>
</g></g>
<g class="live"><g id="fallsF">${fallBits('fallFront')}</g></g>
<g class="f frz">${frozen('fallsF')}</g>

</g></g>

<!-- finaali: pyramidi, gravitaatiolinssi ja huippukivi aukon vieressä.
     Viestin merkkikoodit tulevat .clk-ryhmästä. -->
<g class="clk">${clockUnits}<g class="clk2">${clockTens}
  <ellipse class="f pglow" cx="${PCX}" cy="${num(PYR_MID_Y)}" rx="150" ry="95" fill="url(#pyrGlow)"/>
  <g class="f pyr"><g id="pyrCells">${pyramidCells}</g></g>
  <g class="f lens">
    <g clip-path="url(#lensClip)">
      <circle cx="0" cy="0" r="${LENS_R}" fill="${sky}"/>
      <g class="lensMag">
        ${frozen('field', ';--srcOp:0')}
        <use href="#pyrCells"/>
      </g>
    </g>
    <circle cx="0" cy="0" r="${LENS_R}" fill="none" stroke="${ICE_DEEP}" stroke-width="1" stroke-opacity="0.35"/>
    <circle cx="0" cy="0" r="24" fill="none" stroke="${ICE}" stroke-width="1.3" stroke-opacity="0.55"/>
    <circle cx="0" cy="0" r="7" fill="#000"/>
    <circle cx="0" cy="0" r="2.2" fill="${ICE_HOT}"/>
  </g>
  <g class="f cap"><g transform="translate(${PCX} ${CAP_Y})"><g class="capT">
    <path d="M${-CAP_W - 14} 8L0 ${-CAP_H - 16}L${CAP_W + 14} 8Z" fill="url(#capGlow)"/>
    <path class="capFlash" d="M${-CAP_W - 6} 3L0 ${-CAP_H - 7}L${CAP_W + 6} 3Z" fill="none" stroke="${ICE_HOT}" stroke-width="3" stroke-opacity="0.5" stroke-linejoin="round"/>
    <path d="M${-CAP_W} 0L0 ${-CAP_H}L${CAP_W} 0Z" fill="url(#capFill)" stroke="${ICE_HOT}" stroke-width="1.6" stroke-linejoin="round"/>
    <g transform="translate(0 ${num(-CAP_IN, 2)}) scale(${num(CAP_EYE_SCALE, 4)})"><g class="ceO">
      <use href="#irisArt"/>
      <g class="ceP"><circle cx="0" cy="0" r="24" fill="url(#pupil)"/></g>
      <ellipse cx="-9" cy="-12" rx="7" ry="4.5" transform="rotate(-35 -9 -12)" fill="${GLINT}" fill-opacity="0.9"/>
    </g></g>
  </g></g></g>
</g></g>

<rect class="gl" x="-100" y="300" width="1800" height="2" fill="${BLOOD}"/>
<rect class="gl gl2" x="-100" y="690" width="1800" height="1" fill="${EMBER}"/>
<rect x="-100" y="-100" width="1800" height="1200" fill="url(#vignette)"/>
</g>
</svg>`

  return { svg, firstFinale: t0, whiteCycles }
}

const SCENE_NAME = 'singulariteetti'
const sceneOptions = (test: Testitila, now: number, loadedAt: number): SceneOptions => ({
  test,
  message: VIESTIN_LAHDE,
  text: VIESTI_TEKSTI,
  whiteChance: VALKOISEN_AUKON_TODENNAKOISYYS,
  now,
  loadedAt,
})

const LOOK = (scene: string): ThemeSetArgs => ({
  colors: theme,
  backdrop: { scene, glass: { blur: 0, tint: '#0a0607', opacity: 0.6 } },
})

// Piirretyt kuvat näkymän nimen mukaan: tavallinen ja viimeisin testi.
const scenes = new Map<string, string>()
let loadedAt = 0
let testRuns = 0

const ALT =
  'Musta singulariteetti, jonka punahehkuinen kertymäkiekko pyörii ja sykkii; varjon sisällä käynnistyy välillä robotin kylmän syaani digitaalinen silmä piirilevyn johtimineen, ja taustan bittikenttä himmenee joka lyönnillä. Kierroksen lopussa bitit kasautuvat pyramidiksi, jonka huippukiveen silmä siirtyy.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    loadedAt = await $.clock.now()
    scenes.clear()
    scenes.set(SCENE_NAME, buildScene(sceneOptions(TESTITILA, loadedAt, loadedAt)).svg)
    const set = await $.theme.set(LOOK(SCENE_NAME))

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    try {
      await $.command.register({
        name: 'singulariteetti-testi',
        description: 'Käynnistää teeman finaalin heti ("valkoinen": valkoinen aukko, "silmä": tavallinen silmä)',
      })
    } catch (error) {
      $.ui.toast(`Singulariteetti: testikomennon rekisteröinti epäonnistui (${String(error)})`)
    }

    return next(e)
  })

  on('command.run', { command: 'singulariteetti-testi' }, async ($, e) => {
    const test: Testitila = /silm|eye/i.test(e.args) ? 'silma' : /valk|white/i.test(e.args) ? 'valkoinen' : 'finaali'
    const now = await $.clock.now()
    testRuns += 1
    const name = `${SCENE_NAME}-testi-${testRuns}`
    for (const key of [...scenes.keys()]) {
      if (key !== SCENE_NAME) {
        scenes.delete(key)
      }
    }
    scenes.set(name, buildScene(sceneOptions(test, now, loadedAt === 0 ? now : loadedAt)).svg)
    const set = await $.theme.set(LOOK(name))

    if (!set.isDrawn) {
      return { text: `Teema ei piirry nyt: ${set.reason}` }
    }

    return {
      text:
        test === 'silma'
          ? `Silmä aukeaa noin ${TEST_LEAD} sekunnin kuluttua. Sen jälkeen kierros jatkuu normaalisti.`
          : `Finaali${test === 'valkoinen' ? ' valkoisella aukolla' : ''} alkaa noin ${TEST_LEAD} sekunnin kuluttua. Sen jälkeen kierros jatkuu normaalisti.`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    let source = scenes.get(e.props.scene) ?? scenes.get(SCENE_NAME)

    if (source === undefined) {
      source = buildScene(sceneOptions(TESTITILA, loadedAt, loadedAt)).svg
      scenes.set(SCENE_NAME, source)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={source} alt={ALT} isInteractive />
  })
}

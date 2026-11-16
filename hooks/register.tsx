import type { Register, ThemeResult, ThemeSetArgs, TimerCall } from 'claude-code'

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
type Testitila = 'pois' | 'finaali' | 'valkoinen' | 'silma' | 'lepo'

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

// Silmän ja finaalin liike: askelta sekunnissa (1.1.14: 12, samoin kuin muu kuva, ja kaikki
// askeleet samoilla hetkillä). Sulava liike (0) piirtää kuvan joka näytön virkistyksellä:
// finaali jäädytti taustan joka kerta ja silmä nosti kuorman 80-90 %:iin (mitattu 16.11.2026).
const SILMAN_ASKELEET = 12

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
// 1.1.25: hidas vaellus ja kaarten kierto EIVÄT ole enää animaatioita. Koko ruudun ikkunassa (2560×1440)
// tausta jäätyi noin 90 s latauksesta aina, kun kaikki animaatioryhmät olivat päällä yhtä aikaa; ilman
// näitä kolmea (driftX, driftY, lensArcs) kuva pyöri (koe k1, 16.11.2026). OLED-suojana aukko saa nyt
// satunnaisen pienen siirron ja kaaret satunnaisen kulman JOKA LATAUKSELLA (ks. jitter).
const HIDAS_LIIKE: boolean = false
const jitter = (max: number): number => Math.round((Math.random() * 2 - 1) * max)
const DRIFT_X = 44 // yksikköä keskeltä kumpaankin suuntaan
const DRIFT_Y = 34
const DRIFT_X_STEP = 8 // sekuntia yksikköä kohden, TICKin monikerta
const DRIFT_Y_STEP = 7

// Linssikaarten hidas kierto, askel TICKin välein.
const LENS_SECONDS = 400

// Syke: 16 TICKiä, kaksoislyönti (lub-dub) alussa. Hehku leimahtaa, bittikenttä himmenee.
const BEAT_SECONDS = 16 * TICK

// Kiekon kuuma kohta kiertää kerran tässä ajassa (1.1.10: 8 → 16 s, ja se etenee samoin
// askelin kuin renkaat, 12/s; hehkuva häntä pehmentää askeleet). 24 askelta/s kaksinkertaisti
// taustan ruudut sekunnissa ja sen myötä näytönohjaimen kuorman (mitattu 16.11.2026).
const SPOT_SECONDS = 16

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
// alkaa `lead` sekunnin kuluttua. Mittaustila 'lepo' alkaa pisimmän tauon alusta,
// joten silmää ei näy vähintään 50 sekuntiin. Kohta on TICKin monikerta.
const EYE_FIRST_MIN = 20
const TEST_LEAD = 3
const eyeOffset = (test: Testitila, lead = TEST_LEAD): number => {
  if (test === 'silma') {
    return (EYE_STARTS[0] ?? 0) * TICK - lead
  }
  if (test === 'lepo') {
    const longest = pauseTicks.indexOf(Math.max(...pauseTicks))

    return ((EYE_STARTS[longest] ?? 0) - (pauseTicks[longest] ?? 0)) * TICK
  }
  if (test !== 'pois') {
    return FIN_START - lead
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

// Silmän ja finaalin liikkeen portaat sekunnissa (0 = sulava, kuten ennen). buildScene
// asettaa tämän ennen avainkehysten rakentamista ja palauttaa nollaksi lopuksi.
// Portaittain jokainen kohta pyöristetään askelruudukkoon, ja välit etenevät kokonaisin
// askelin: kuva päivittyy vain askelten kohdalla eikä joka näytön virkistyksellä.
let motionRate = 0
const quant = (seconds: number): number => (motionRate > 0 ? Math.round(seconds * motionRate) / motionRate : seconds)
const stepTiming = (from: number, to: number): string =>
  motionRate > 0 ? ` animation-timing-function:steps(${Math.max(1, Math.round((to - from) * motionRate))});` : ''
// Pisteet (aika, tyyli) avainkehyksiksi: saman hetken tyylit yhdistetään, ja kukin väli
// saa askeleensa. Muuttumaton väli ei tarvitse askelia (ei muutosta, ei ruutuja).
// Jokainen kehys täydennetään kaikilla ominaisuuksilla (puuttuva arvo interpoloidaan
// naapureista tai jatketaan): muuten puuttuvan ominaisuuden väli olisi pidempi kuin
// `steps(n)` olettaa, ja askeleet osuisivat ruudukon ulkopuolelle (mitattu 16.11.2026:
// noin 50 eri muutoshetkeä sekunnissa finaalissa). Myös 0 % ja 100 % ovat aina mukana,
// koska selaimen implisiittiset päätykehykset interpoloivat sulavasti.
const NUMBER = /-?\d+(?:\.\d+)?/g
const parseCss = (css: string): Map<string, string> => {
  const props = new Map<string, string>()
  for (const part of css.split(';')) {
    const colon = part.indexOf(':')
    if (colon > 0) {
      props.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
    }
  }

  return props
}
const lerpValue = (a: string, b: string, u: number): string => {
  if (a.replace(NUMBER, '#') !== b.replace(NUMBER, '#')) {
    return a
  }
  const target = b.match(NUMBER) ?? []
  let i = 0

  return a.replace(NUMBER, x => {
    const to = Number(target[i++] ?? x)

    return num(Number(x) + (to - Number(x)) * u, 3)
  })
}
const steppedFrames = (points: Step[], total: number, digits: number): string => {
  const byTime = new Map<number, Map<string, string>>()
  for (const [t, css] of points) {
    const key = Math.min(total, Math.max(0, quant(t)))
    const props = byTime.get(key) ?? new Map<string, string>()
    for (const [name, value] of parseCss(css)) {
      props.set(name, value)
    }
    byTime.set(key, props)
  }
  for (const end of [0, total]) {
    if (!byTime.has(end)) {
      byTime.set(end, new Map<string, string>())
    }
  }
  const times = [...byTime.keys()].sort((a, b) => a - b)
  const names = [...new Set([...byTime.values()].flatMap(props => [...props.keys()]))]
  const filled = times.map(t => {
    const own = byTime.get(t) ?? new Map<string, string>()
    const decls = names.map(name => {
      const value = own.get(name)
      if (value !== undefined) {
        return `${name}: ${value};`
      }
      const before = times.filter(s => s < t && byTime.get(s)?.has(name) === true).pop()
      const after = times.find(s => s > t && byTime.get(s)?.has(name) === true)
      const a = before === undefined ? undefined : byTime.get(before)?.get(name)
      const b = after === undefined ? undefined : byTime.get(after)?.get(name)
      const v =
        a !== undefined && b !== undefined && before !== undefined && after !== undefined
          ? lerpValue(a, b, (t - before) / (after - before))
          : (a ?? b ?? '')

      return `${name}: ${v};`
    })

    return decls.join(' ')
  })

  return times
    .map((t, i) => {
      const css = filled[i] ?? ''
      const next = times[i + 1]
      const timing = next === undefined || filled[i + 1] === css ? '' : stepTiming(t, next)

      return `${num((t / total) * 100, digits)}% { ${css}${timing} }`
    })
    .join(' ')
}

const eyeKeyframes = (name: string, rest: string, steps: Step[], finale: Step[] = steps): string => {
  const at = (seconds: number): string => `${((seconds / EYE_SECONDS) * 100).toFixed(4)}%`
  if (motionRate > 0) {
    const points: Step[] = [[0, rest]]
    EYE_STARTS.forEach((startTick, i) => {
      const start = startTick * TICK
      points.push([start, rest])
      for (const [t, css] of i === SHOWS - 1 ? finale : steps) {
        points.push([start + t, css])
      }
      points.push([start + showTicks(i) * TICK, rest])
    })
    points.push([EYE_SECONDS, rest])

    return `@keyframes ${name} { ${steppedFrames(points, EYE_SECONDS, 4)} }`
  }
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
  if (motionRate > 0) {
    return `@keyframes ${name} { ${steppedFrames(lists.flat(), total, 3)} }`
  }
  const byTime = new Map<string, string[]>()
  for (const [t, css] of lists.flat()) {
    const key = `${num(Math.min(100, Math.max(0, (t / total) * 100)))}%`
    byTime.set(key, [...(byTime.get(key) ?? []), css])
  }

  return `@keyframes ${name} { ${[...byTime].map(([key, css]) => `${key} { ${css.join(' ')} }`).join(' ')} }`
}
// Portaittaiset avainkehykset: kohdat ovat osuuksia kestosta, ja ne pyöristetään
// askeliin (FRAME_RATE), jolloin jokainen väli etenee kokonaisin askelin.
const stepKeyframes = (name: string, seconds: number, points: [number, string][], rate = FRAME_RATE): string => {
  const total = Math.round(seconds * rate)
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
// Kuuman kohdan ajoitus, kun se etenee `rate` askelta sekunnissa (0 = sulava).
const spotTiming = (rate: number, seconds = SPOT_SECONDS): string =>
  rate > 0 ? `steps(${Math.max(1, Math.round((seconds / STEPS) * rate))})` : 'linear'
// Kuuman kohdan häntä: kerroksia kiekon tasossa (kaaren pituus, leveys, peittävyys, väri).
// Katkoviiva kulkee radalla samoin askelin kuin piste, joten askeleet sulautuvat liikkeeksi.
const TAIL_LAYERS: [number, number, number, string][] = [
  [70, 5, 0.16, BLOOD],
  [44, 8, 0.26, EMBER],
  [24, 10, 0.4, EMBER],
  [10, 12, 0.6, HOT],
]
const spotTail = (front: boolean, seconds: number, rate: number): string => {
  const c = 2 * Math.PI * SPOT_R
  const steps = Math.max(1, Math.round(seconds * Math.max(1, rate)))
  const shape = (attrs: string): string =>
    front
      ? `<path d="M${SPOT_R} 0 A${SPOT_R} ${SPOT_R} 0 0 1 ${-SPOT_R} 0" fill="none" ${attrs}/>`
      : `<circle cx="0" cy="0" r="${SPOT_R}" fill="none" ${attrs}/>`

  return `<g transform="${HOLE} scale(1 ${SQUASH})">${TAIL_LAYERS.map(
    ([len, width, alpha, color], i) =>
      shape(
        `class="tail" style="animation:tail${i} ${seconds}s ${rate > 0 ? `steps(${steps})` : 'linear'} infinite" stroke="${color}" stroke-width="${width}" stroke-opacity="${alpha}" stroke-linecap="round" stroke-dasharray="${num(len, 1)} ${num(c - len, 1)}"`,
      ),
  ).join('')}</g>`
}
const tailKeyframes = (): string => {
  const c = 2 * Math.PI * SPOT_R

  return TAIL_LAYERS.map(([len], i) => `@keyframes tail${i} { from { stroke-dashoffset: ${num(len, 1)}; } to { stroke-dashoffset: ${num(len - c, 1)}; } }`).join(' ')
}
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
// 1.1.18: kello on YKSI toistuva <animate> (portaittainen luokkalista). Vanha ketju (72 <set>iä,
// joista kukin käynnisti itsensä uudelleen: begin="…;pK.begin+24s") PYSÄHTYI Chromium 156:ssa
// 48 s kohdalla: itseensä viittaava ajastin toimii vain kerran (todettu selainruudussa 16.11.2026).
const waveClockChain = Array.from(
  { length: WAVE_LENGTH },
  (_, k): string => `<set id="p${k}" attributeName="class" to="p${k}" begin="${num(k * TICK)}s;p${k}.begin+${WAVE_SECONDS}s"/>`,
).join('')
const waveClock = `<animate id="wclk" attributeName="class" calcMode="discrete" values="${Array.from({ length: WAVE_LENGTH }, (_, k): string => `p${k}`).join(';')}" dur="${WAVE_SECONDS}s" repeatCount="indefinite"/>`
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
const dashTiming = (seconds: number, reverse = false, rate = KIEKON_ASKELEET): string => {
  const end = reverse ? ' reverse' : ''
  if (rate <= 0) {
    return `animation:dash ${seconds}s linear infinite${end}`
  }
  const steps = Math.max(1, Math.round(seconds * rate))

  return `animation:dash ${num(steps / rate, 6)}s steps(${steps}) infinite${end}`
}
// Renkaiden liiketapa: 'dash' siirtää katkoviivaa (oletus), 'kierto' kääntää rengasta
// transformilla (sama nopeus kehää pitkin; etupuolisko rajataan), 'paikallaan' ei liiku.
type DiskMode = 'dash' | 'kierto' | 'paikallaan'
type DiskMotion = { rate: number; mode: DiskMode }
const DISK_DEFAULT: DiskMotion = { rate: KIEKON_ASKELEET, mode: 'dash' }
const rotTiming = (seconds: number, r: number, rate: number, reverse = false): string => {
  const turn = (seconds * 2 * Math.PI * r) / 160 // yksi kierros sekunteina
  const steps = Math.max(1, Math.round(turn * Math.max(1, rate)))

  return `animation:rot ${num(steps / Math.max(1, rate), 6)}s ${rate > 0 ? `steps(${steps})` : 'linear'} infinite${reverse ? ' reverse' : ''}`
}
const diskParts = (front: boolean, motion: DiskMotion = DISK_DEFAULT): string => {
  const shape = (r: number, attrs: string): string =>
    front
      ? `<path d="M${r} 0 A${r} ${r} 0 0 1 ${-r} 0" fill="none" ${attrs}/>`
      : `<circle cx="0" cy="0" r="${r}" fill="none" ${attrs}/>`
  const spin = (r: number, seconds: number, attrs: string): string => {
    if (motion.mode === 'paikallaan') {
      return shape(r, attrs)
    }
    if (motion.mode === 'kierto') {
      const turning = `<g style="${rotTiming(seconds, r, motion.rate)}"><circle cx="0" cy="0" r="${r}" fill="none" ${attrs}/></g>`

      return front ? `<g clip-path="url(#frontHalf)">${turning}</g>` : turning
    }

    return shape(r, `class="sp" style="${dashTiming(seconds, false, motion.rate)}" ${attrs}`)
  }

  return `<g transform="${HOLE} scale(1 ${SQUASH})">
    ${shape(276, `stroke="url(#disk)" stroke-width="216" stroke-opacity="0.32"`)}
    ${spin(304, 4, `stroke="${BLOOD}" stroke-width="56" stroke-opacity="0.45" stroke-dasharray="5 11"`)}
    ${spin(350, 11, `stroke="${BLOOD}" stroke-width="30" stroke-opacity="0.32" stroke-dasharray="2 14"`)}
    ${spin(226, 2.5, `stroke="${EMBER}" stroke-width="40" stroke-opacity="0.5" stroke-dasharray="6 10"`)}
    ${spin(186, 5, `stroke="${HOT}" stroke-width="18" stroke-opacity="0.5" stroke-dasharray="3 5"`)}
    ${shape(170, `stroke="${HOT}" stroke-width="3" stroke-opacity="0.6"`)}
    ${shape(262, `stroke="${EMBER}" stroke-width="2" stroke-opacity="0.45"`)}
    ${spin(382, 11, `stroke="${BLOOD}" stroke-width="2" stroke-opacity="0.5" stroke-dasharray="2 14"`)}
    ${shape(276, `class="f nv dfl" stroke="${HOT}" stroke-width="216"`)}
  </g>`
}
// Fotonirengas varjon reunalla (keskipiste 0, -9), sama liiketapa kuin kiekolla.
const photonRing = (motion: DiskMotion): string => {
  const attrs = `stroke="${HOT}" stroke-width="26" stroke-opacity="0.14" stroke-dasharray="14 18"`
  if (motion.mode === 'paikallaan') {
    return `<circle cx="0" cy="-9" r="${R + 20}" fill="none" ${attrs}/>`
  }
  if (motion.mode === 'kierto') {
    return `<g transform="translate(0 -9)"><g style="${rotTiming(2.5, R + 20, motion.rate, true)}"><circle cx="0" cy="0" r="${R + 20}" fill="none" ${attrs}/></g></g>`
  }

  return `<circle cx="0" cy="-9" r="${R + 20}" fill="none" class="sp" style="${dashTiming(2.5, true, motion.rate)}" ${attrs}/>`
}

// ─── Silmän seuranta ─────────────────────────────────────────────────────────
// Finaalin seurantavaiheessa pupilli katsoo hitaasti laidasta laitaan (.pSweep).
// 1.1.10 poisti kursoriseurannan (40 näkymätöntä :hover-ruutua): sovellus piirtää taustan
// kääreeseen, joka on pointer-events: none ja inert, joten hiiri ei koskaan tavoittanut
// ruutuja. Se vei noin 6 600 merkkiä kuvan 131 072 merkin rajasta.

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

// Silmän animaatiot. Rakennetaan buildScenessä (motionRate). 1.1.12: esitys ja finaali ovat
// omia animaatioitaan (nimi + S / F), jotka ovat olemassa vain esityksen (.pon) tai finaalin
// (.on) ajan, eivät koko jakson. Verkkobitit vaihtuvat aina TICK-tahdissa koko jakson.
const SHOW_SECONDS = EYE_SHOW_TICKS * TICK
const showKeyframes = (name: string, rest: string, steps: Step[], finale: Step[] = steps): string =>
  `@keyframes ${name}S { ${steppedFrames([[0, rest], ...steps, [SHOW_SECONDS, rest]], SHOW_SECONDS, 3)} } ` +
  `@keyframes ${name}F { ${steppedFrames([[0, rest], ...finale, [FIN_SECONDS, rest]], FIN_SECONDS, 3)} }`
const smooth = <T,>(build: () => T): T => {
  const keep = motionRate
  motionRate = 0
  try {
    return build()
  } finally {
    motionRate = keep
  }
}
const eyeCss = (): string => [
  // Verkkobittien kirkkaus on ryhmän opacity (ei fill-opacity), jotta selain voi
  // vaihtaa sen valmiiseen kuvaan ilman uudelleenpiirtoa.
  smooth(() => eyeKeyframes(
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
  )),
  showKeyframes(
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
  showKeyframes('eyeTurn', 'transform: rotate(-30deg);', [[7.6, 'transform: rotate(30deg);']], [
    [T_END - 0.1, 'transform: rotate(70deg);'],
  ]),
  showKeyframes(
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
  showKeyframes(
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
  showKeyframes(
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

const pyrFlowCss = (): string => `
  .pb text { font-size: 14px; font-weight: 700; text-anchor: middle; }
  .pb text:first-child { opacity: calc(1 - var(--b)); }
  .pb text + text { opacity: var(--b); }
  ${Array.from({ length: 8 }, (_, i) => `.q${i} { --c: var(--c${i}); } .j${i} { --b: mod(round(down, var(--c) / ${2 ** (7 - i)}), 2); }`).join('\n  ')}
  .pb { --mx: calc(var(--fx) * 0.42 - var(--fy) * 0.3); --my: calc(var(--fy) * 0.42 + var(--fx) * 0.3); }
  .on .pb { animation: flow ${num(FLOW_SECONDS)}s cubic-bezier(0.5, 0, 0.3, 1) var(--dl) both, crumble ${num(CRUMBLE_SECONDS)}s cubic-bezier(0.5, 0, 0.9, 0.6) var(--cl) forwards; }
  @keyframes flow {
    0% { transform: translate(var(--fx), var(--fy)); opacity: 0;${stepTiming(0, 0.12 * FLOW_SECONDS)} }
    12% { opacity: 0.9;${stepTiming(0.12 * FLOW_SECONDS, 0.55 * FLOW_SECONDS)} }
    55% { transform: translate(var(--mx), var(--my));${stepTiming(0.55 * FLOW_SECONDS, FLOW_SECONDS)} }
    100% { transform: translate(0px, 0px); opacity: 1; }
  }
  @keyframes crumble {
    0% { transform: translate(0px, 0px); opacity: 1;${stepTiming(0, CRUMBLE_SECONDS)} }
    100% { transform: translate(var(--cx), var(--cy)); opacity: 0; }
  }`

const finaleFixedCss = (): string => `
  /* 1. pupilli katsoo laidasta laitaan. Ei rekisteröityjä CSS-muuttujia: ne pysäyttivät
     sovelluksen taustan. */
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
  @keyframes srcOut { ${motionRate > 0 ? `0% {${stepTiming(0, 0.25)} } ` : ''}to { opacity: 0; } }

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
  ${pyrFlowCss()}

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
  lead?: number // testitila: sekunteja silmään tai finaaliin (oletus TEST_LEAD)
  disk?: DiskMotion // kevennyskokeet: kiekon renkaiden liike (oletus DISK_DEFAULT)
  spotRate?: number // kevennyskokeet: kuuman kohdan askeleet/s (oletus 2 × renkaiden)
  spotSeconds?: number // kevennyskokeet: kuuman kohdan kierros sekunteina (oletus SPOT_SECONDS)
  spotTail?: boolean // kuumalle kohdalle häntä (oletus päällä)
  frameRate?: number // kevennyskokeet: tuikkeen, sykkeen ja putoavien bittien askeleet/s (oletus FRAME_RATE)
  motionRate?: number // silmän ja finaalin askeleet/s (oletus SILMAN_ASKELEET; 0 = sulava)
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
  const offset = eyeOffset(o.test, o.lead)
  const disk = o.disk ?? DISK_DEFAULT
  const spotRate = o.spotRate ?? disk.rate
  const spotSeconds = o.spotSeconds ?? SPOT_SECONDS
  const SPOT_TIMING = spotTiming(spotRate, spotSeconds)
  const tail = o.spotTail !== false
  const tailBack = tail ? spotTail(false, spotSeconds, spotRate) : ''
  const tailFront = tail ? spotTail(true, spotSeconds, spotRate) : ''
  const fr = o.frameRate ?? FRAME_RATE
  motionRate = o.motionRate ?? SILMAN_ASKELEET
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
  // 1.1.26: yksi toistuva <animate> numeroa kohden. Vanha muoto (count kappaletta <set>-elementtejä, jotka
  // käynnistivät itsensä uudelleen: begin="…;cuJ.begin+…s") toimii Chromium 156:ssa vain yhden kierroksen.
  const digitSets = (name: string, base: string, count: number, span: number): string =>
    `<animate id="${name}" attributeName="class" calcMode="discrete" values="${Array.from({ length: count }, (_, j): string => `${base} ${name}${j}`).join(';')}" begin="${num(t0 - 0.5 * EYE_SECONDS)}s" dur="${num(count * span * EYE_SECONDS)}s" repeatCount="indefinite"/>`
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
  // 1.1.26: ajastimet ovat toistuvia <animate>-elementtejä (luokka päälle ja pois kierroksen sisällä).
  // Vanha muoto (<set … begin="…;pon.begin+576s">) toistui Chromium 156:ssa vain kerran, joten silmä ja
  // finaali olisivat loppuneet toisen kierroksen jälkeen (noin 19 min).
  const cycleTimer = (id: string, base: string, on: string, spans: [number, number][]): string => {
    const frac = (seconds: number): string => (Math.min(Math.max(seconds, 0), EYE_SECONDS) / EYE_SECONDS).toFixed(6)
    const values = [base, ...spans.flatMap(() => [on, base])]
    const keyTimes = ['0', ...spans.flatMap(([from, to]) => [frac(from), frac(to)])]

    return `<animate id="${id}" attributeName="class" calcMode="discrete" values="${values.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${num(EYE_SECONDS)}s" repeatCount="indefinite"/>`
  }
  const pulseTimer =
    showBegins.length === 0
      ? ''
      : cycleTimer(
          'pon',
          'aimHost',
          'aimHost pon',
          showBegins.map((begin): [number, number] => [begin, begin + EYE_SHOW_TICKS * TICK]),
        )
  const timers = `${cycleTimer('fin', 'stage', 'stage on', [[t0, t0 + FS]])}${
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
  <clipPath id="eyeClip"><circle cx="0" cy="0" r="84"/></clipPath>${disk.mode === 'kierto' ? '<clipPath id="frontHalf"><rect x="-420" y="0" width="840" height="420"/></clipPath>' : ''}
  <clipPath id="lensClip"><circle cx="0" cy="0" r="${LENS_R}"/></clipPath>
  <path id="eyeData" d="M-97 0A97 97 0 1 1 97 0A97 97 0 1 1 -97 0"/>
</defs>
<style>
  /* tähdet tuikkivat ryhmittäin, portaittain (FRAME_RATE) */
  ${TWINKLE_TIMES.map(([seconds, delay], i) => `.tw${i} { animation: tw ${seconds}s steps(${Math.round((seconds / 2) * fr)}) ${delay}s infinite; }`).join('\n  ')}
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
  ], fr)}
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
  @keyframes dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -160; } }${disk.mode === 'kierto' ? ' @keyframes rot { to { transform: rotate(360deg); } }' : ''}

${
  HIDAS_LIIKE
    ? `
  .lensArcs { animation: lensArcs ${LENS_SECONDS}s steps(${Math.round(LENS_SECONDS / TICK)}) infinite; }
  @keyframes lensArcs { to { transform: rotate(360deg); } }

  .driftX { animation: driftX ${2 * DRIFT_X * DRIFT_X_STEP}s steps(${2 * DRIFT_X}) ${-DRIFT_X * DRIFT_X_STEP}s infinite alternate; }
  .driftY { animation: driftY ${2 * DRIFT_Y * DRIFT_Y_STEP}s steps(${2 * DRIFT_Y}) ${-DRIFT_Y * DRIFT_Y_STEP}s infinite alternate; }
  @keyframes driftX { from { transform: translate(${-DRIFT_X}px, 0px); } to { transform: translate(${DRIFT_X}px, 0px); } }
  @keyframes driftY { from { transform: translate(0px, ${-DRIFT_Y}px); } to { transform: translate(0px, ${DRIFT_Y}px); } }
`
    : ''
}
  .spot { animation: spot ${spotSeconds}s ${SPOT_TIMING} infinite; }
  .spotFront { animation: spotFront ${spotSeconds}s ${SPOT_TIMING} infinite; }${tail ? `\n  ${tailKeyframes()}` : ''}
  @keyframes spot { ${spotFrames.join(' ')} }
  @keyframes spotFront { ${spotFrontFrames.join(' ')} }

  /* robotin näkö välähtää päälle, tarkentaa, vilkaisee vasemmalle tekstiä kohti ja sammuu;
     kierroksen viimeisellä kerralla se jää auki finaaliin */
  .eye { opacity: 0; transform: translate(0px, 0px) scale(0.86); }
  .pon .eye { animation: eyeS ${num(SHOW_SECONDS)}s ease-in-out both; }
  .on .eye { animation: eyeF ${num(FIN_SECONDS)}s ease-in-out both; }
  /* datakehä kiertää hitaasti koko ajan, kun silmä on auki */
  .eyeTurn { transform: rotate(-30deg); }
  .pon .eyeTurn { animation: eyeTurnS ${num(SHOW_SECONDS)}s linear both; }
  .on .eyeTurn { animation: eyeTurnF ${num(FIN_SECONDS)}s linear both; }
  /* tähtäinkaaret lukittuvat paikalleen ja nytkähtävät, kun katse kääntyy */
  .eyeTurnBack { transform: rotate(70deg); }
  .pon .eyeTurnBack { animation: eyeTurnBackS ${num(SHOW_SECONDS)}s ease-in-out both; }
  .on .eyeTurnBack { animation: eyeTurnBackF ${num(FIN_SECONDS)}s ease-in-out both; }
  /* pupilli supistuu terävästi juuri kun katse kääntyy tekstiin */
  .pupil { transform: scale(1.35); }
  .pon .pupil { animation: pupilS ${num(SHOW_SECONDS)}s ease-in-out both; }
  .on .pupil { animation: pupilF ${num(FIN_SECONDS)}s ease-in-out both; }
  /* valopulssit juoksevat johtimia pitkin ulos, kolme kertaa silmän ollessa auki */
  .pulse { stroke-dasharray: 7 200; stroke-dashoffset: 8; }
  .pon .pulse { animation: pulse ${num(EYE_SHOW_TICKS * TICK)}s linear both; }
  .on .pulse { animation: pulseF ${num(FIN_SECONDS)}s linear both; }
  /* skannausviiva: alas silmän käynnistyessä, ylös kun katse lukittuu */
  .scan { opacity: 0; transform: translate(0px, -90px); }
  .pon .scan { animation: scanS ${num(SHOW_SECONDS)}s linear both; }
  .on .scan { animation: scanF ${num(FIN_SECONDS)}s linear both; }
  ${eyeCss()}
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
  .fall, .fallFront { opacity: 0; animation: fall ${num(FALL_SECONDS, 6)}s steps(${Math.max(1, Math.round((FALL_FRAMES * fr) / FRAME_RATE))}) infinite; animation-delay: calc(var(--d) + var(--shift, 0s)); animation-play-state: var(--ps, running); }
  .fallFront { animation-name: fallFront; }
  .fall text, .fallFront text { font-size: 17px; }
  @keyframes fall { ${fallFrames.join(' ')} }
  @keyframes fallFront { ${fallFrontFrames.join(' ')} }

  ${FIELD_CSS}
  ${finaleFixedCss()}
  ${finaleCss}

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .f { display: none !important; }
  }
</style>
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
<g class="driftX"${HIDAS_LIIKE ? '' : ` transform="translate(${jitter(DRIFT_X)} ${jitter(DRIFT_Y)})"`}><g class="driftY">

<!-- taustatähdet taipuvat kaariksi aukon ympärillä -->
<g transform="translate(${PX} ${PY})">
  <circle cx="0" cy="0" r="${R + 64}" fill="none" stroke="${EMBER}" stroke-width="1" stroke-opacity="0.12"/>
  <g class="lensArcs"${HIDAS_LIIKE ? '' : ` transform="rotate(${Math.floor(Math.random() * 360)})"`}>${twinkleGroups(arcs, `fill="none" stroke="${STAR}" stroke-linecap="round"`)}</g>
</g>

<!-- takana: koko kiekko, kuuma kohta ja aukkoon valuvat bitit -->
${diskParts(false, disk)}
<g class="spotW">${tailBack}<g class="spot"><circle cx="0" cy="0" r="6" fill="${HOT}"/></g></g>
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
  ${photonRing(disk)}
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
<g class="aimHost" transform="translate(${PX} ${PY})">${pulseTimer}
  <g class="eye">
    <g fill="none" stroke-width="1.2">
      <g stroke="url(#trace)">${traceParts.join('')}</g>
      <g stroke="${ICE}" stroke-opacity="0.65">${viaParts.join('')}</g>
    </g>
    <g class="pw" fill="none" stroke="${ICE_HOT}" stroke-width="2.2" stroke-linecap="round">${pulseParts}</g>
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
${diskParts(true, disk)}
<g class="spotW">${tailFront}<g class="spotFront">
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

  // Portaittain myös finaalin viiveet ruudukkoon (pyramidin bitit, lähtevät bitit).
  const stepped =
    motionRate > 0
      ? svg.replace(/--(dl|cl|sd):(-?[\d.]+)s/g, (_, key: string, value: string) => `--${key}:${num(quant(Number(value)))}s`)
      : svg
  motionRate = 0

  return { svg: stepped, firstFinale: t0, whiteCycles }
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

// ─── Mittaussarja (/singulariteetti-testi sarja) ────────────────────────────
// Erittelykoe kuorman mittaamiseen: kuva vaihtuu itsestään SARJA_SECONDS sekunnin
// välein, ja vahti (_varmuuskopiot\mittarit\vahti.ps1) kirjaa kuorman. Osan hinta
// = s0 − sX. Variantti on tavallinen kuva, johon lisätään CSS-sääntö ja josta
// poistetaan SMIL-ajastimia. s0–s8 alkavat pisimmän tauon alusta (ei silmää).
// Yksittäinen variantti käsin: /singulariteetti-testi s3.
type SarjaSmil = 'kaikki' | 'pois' | 'ei kelloa' | 'vain kello'
type SarjaVariant = {
  id: string
  label: string
  test: Testitila
  lead?: number
  css?: string
  smil?: SarjaSmil
  opts?: Pick<SceneOptions, 'disk' | 'spotRate' | 'spotSeconds' | 'spotTail' | 'frameRate' | 'motionRate'>
  // Valmis kuva sellaisenaan (ei buildScenea): erottava koe, jossa ei ole mitään teeman omaa.
  raw?: string
  // Lisäpiirros kuvan loppuun (ennen </svg>), esim. vilkkuvat pisteet elonmerkiksi.
  extra?: string
  // 'ketju' = vanha kentän kello (72 itsensä käynnistävää <set>iä, 1.1.17 ja vanhemmat) vertailuun.
  clock?: 'ketju'
}
// Koe G2 (1.1.17): elonmerkki, jonka vahti näkee. 20 isoa pistettä, kirkkaus 12 askelta/s.
const ELO_CSS = '.kd { animation: kd 2s steps(24) infinite !important; } @keyframes kd { from { fill-opacity: 0.9; } to { fill-opacity: 0.1; } }'
const ELO_PISTEET = Array.from(
  { length: 20 },
  (_, i) => `<circle class="kd" style="animation-delay:-${((i * 2) / 12).toFixed(4)}s" cx="${220 + (i % 5) * 120}" cy="${200 + Math.floor(i / 5) * 120}" r="40" fill="${HOT}"/>`,
).join('')
// Koe G7 (1.1.23): dokumentin ikämittari. 18 neliötä, joista yksi syttyy 10 s välein dokumentin omasta
// alusta. Jos sovellus rakentaa taustan uudelleen (uusi kehys tai kuva), neliöt alkavat taas nollasta.
const IKA_CSS = '.ag { fill-opacity: 0.12; animation: ag 1s steps(1) both; } @keyframes ag { from { fill-opacity: 0.12; } to { fill-opacity: 1; } }'
const IKA_NELIOT = Array.from(
  { length: 18 },
  (_, i) => `<rect class="ag" style="animation-delay:${(i + 1) * 10 - 1}s" x="${80 + i * 46}" y="660" width="36" height="36" fill="${ICE}"/>`,
).join('')
const IKA_SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><style>${ELO_CSS} ${IKA_CSS}</style><rect width="1600" height="1000" fill="#07040a"/>${ELO_PISTEET}${IKA_NELIOT}</svg>`
// Kevyt kuva + kertapurske: 40 isoa ympyrää vilkkuu VAIN 12 ensimmäistä sekuntia dokumentin
// latauksesta. Jos sovellus lataa kehyksen uudelleen (esim. 90 s kohdalla), purske näkyy lokissa uudelleen.
const PURSKE_SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><style>${ELO_CSS} .b { animation: b 1s steps(12) 12 both; } @keyframes b { from { fill-opacity: 0.5; } to { fill-opacity: 0; } }</style><rect width="1600" height="1000" fill="#07040a"/>${Array.from(
  { length: 40 },
  (_, i) => `<circle class="b" cx="${100 + (i % 8) * 200}" cy="${100 + Math.floor(i / 8) * 200}" r="110" fill="${HOT}"/>`,
).join('')}${ELO_PISTEET}</svg>`
// Erottava koe G1 (1.1.16): hyvin kevyt kuva, 20 pistettä, joiden kirkkaus vaihtuu 12 askelta/s.
// fill-opacity piirretään pääsäikeellä (ei koostajalla), joten elossa oleva kuva näkyy vahdin lokissa.
const KEVYT_SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><style>.d { animation: d 2s steps(24) infinite; } @keyframes d { from { fill-opacity: 1; } to { fill-opacity: 0.1; } }</style><rect width="1600" height="1000" fill="#07040a"/>${Array.from(
  { length: 20 },
  (_, i) => `<circle class="d" style="animation-delay:-${((i * 2) / 12).toFixed(4)}s" cx="${420 + (i % 5) * 190}" cy="${260 + Math.floor(i / 5) * 160}" r="7" fill="${HOT}"/>`,
).join('')}</svg>`
const SARJA_SECONDS = 40
const SARJA_LEAD = 15 // silmä ja finaali alkavat vasta, kun latauksen 10 s on ohi
const offAnim = (...selectors: string[]): string => `${selectors.join(', ')} { animation: none !important; }`
// Vain kiekko (.sp, .spot, .spotFront) ja annetut luokat saavat animoitua.
const onlyAnim = (...keep: string[]): string =>
  `*${['.sp', '.spot', '.spotFront', ...keep].map(c => `:not(${c})`).join('')} { animation: none !important; }`
const ANIM_A1 = ['.driftX', '.driftY', '.lensArcs']
const ANIM_A2 = ['.tw', '.beat', '.suck', '.net', '.gl']
const ANIM_A3 = ['.fall', '.fallFront']
const SARJA: SarjaVariant[] = [
  { id: 's0', label: 'täysi kuva', test: 'lepo' },
  { id: 's1', label: 'kaikki animaatiot ja SMIL pois', test: 'lepo', css: offAnim('*'), smil: 'pois' },
  { id: 's2', label: 'ilman kiekon renkaiden liikettä', test: 'lepo', css: offAnim('.sp') },
  { id: 's3', label: 'ilman kentän kelloa', test: 'lepo', smil: 'ei kelloa' },
  { id: 's4', label: 'ilman putoavia bittejä', test: 'lepo', css: offAnim('.fall', '.fallFront') },
  { id: 's5', label: 'ilman sykettä, imaisua ja tuiketta', test: 'lepo', css: offAnim('.beat', '.suck', '.tw') },
  { id: 's6', label: 'ilman silmää', test: 'lepo', css: `.eye, .net { display: none !important; } ${offAnim('.eye', '.eye *', '.net')}` },
  { id: 's7', label: 'vain kiekko', test: 'lepo', css: '*:not(.sp):not(.spot):not(.spotFront) { animation: none !important; }', smil: 'pois' },
  { id: 's8', label: 'vain kenttä', test: 'lepo', css: offAnim('*'), smil: 'vain kello' },
  { id: 's9', label: `silmän esitys (${SARJA_LEAD} s kohdalla)`, test: 'silma', lead: SARJA_LEAD },
  { id: 's10', label: `finaali (${SARJA_LEAD} s kohdalla)`, test: 'finaali', lead: SARJA_LEAD },
]
const sarjaScene = (variant: SarjaVariant, now: number, loaded: number): string => {
  if (variant.raw !== undefined) {
    return variant.raw
  }
  let svg = buildScene({ ...sceneOptions(variant.test, now, loaded), lead: variant.lead, ...variant.opts }).svg
  if (variant.clock === 'ketju') {
    svg = svg.replace(waveClock, waveClockChain)
  }
  const smil = variant.smil ?? 'kaikki'
  if (smil !== 'kaikki') {
    svg = svg.replace(/<(?:set|animate) [^>]*\/>/g, set => {
      const clock = /^<set id="p\d+"/.test(set) || set.startsWith('<animate id="wclk"')

      return smil === 'pois' || (smil === 'ei kelloa' && clock) || (smil === 'vain kello' && !clock) ? '' : set
    })
  }

  if (variant.extra !== undefined) {
    svg = svg.replace(/<\/svg>\s*$/, `${variant.extra}</svg>`)
  }

  return variant.css === undefined ? svg : svg.replace('</style>', `  ${variant.css}\n</style>`)
}
const clockText = (ms: number): string => {
  const d = new Date(ms)
  const pad = (v: number): string => String(v).padStart(2, '0')

  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
let seriesTimers: { cancel: () => void }[] = []

// ─── Kevennyskokeet (K3) ─────────────────────────────────────────────────────
// Variantit, joita ajetaan automaattisesti (AUTOKOE) tai käsin (/singulariteetti-testi d3).
// Kaikki tilassa 'lepo' (ei silmää mittausikkunassa), ellei toisin mainita.
// d0–d8 = erä K3-1 (1.1.7–1.1.9): kuuma kohta vanhoilla asetuksilla (8 s, ei häntää).
const OLD_SPOT = { spotSeconds: 8, spotTail: false }
const FIN12 = { motionRate: 12, spotTail: false }
const NO_LENS = ' .lens { display: none !important; }'
const NO_FRZ = ' .frz { display: none !important; } .on .live { animation: none !important; }'
const NO_PYR = ' .pyr, .pglow { display: none !important; }'
const KEVENNYS: SarjaVariant[] = [
  { id: 'd0', label: 'kiekko 1.1.9 (renkaat 12/s, piste 24/s)', test: 'lepo', opts: { ...OLD_SPOT, spotRate: 24 } },
  { id: 'd1', label: 'renkaat 6/s, piste 12/s', test: 'lepo', opts: { ...OLD_SPOT, disk: { rate: 6, mode: 'dash' }, spotRate: 12 } },
  { id: 'd2', label: 'renkaat 4/s, piste 8/s', test: 'lepo', opts: { ...OLD_SPOT, disk: { rate: 4, mode: 'dash' }, spotRate: 8 } },
  { id: 'd3', label: 'renkaat 12/s, piste 12/s', test: 'lepo', opts: { ...OLD_SPOT, spotRate: 12 } },
  {
    id: 'd4',
    label: 'renkaat kiertyvät (transform) 12/s, piste 24/s',
    test: 'lepo',
    opts: { ...OLD_SPOT, disk: { rate: 12, mode: 'kierto' }, spotRate: 24 },
  },
  { id: 'd5', label: 'renkaat paikallaan, piste 24/s', test: 'lepo', opts: { ...OLD_SPOT, disk: { rate: 12, mode: 'paikallaan' }, spotRate: 24 } },
  {
    id: 'd6',
    label: 'koko kiekko paikallaan',
    test: 'lepo',
    opts: { ...OLD_SPOT, disk: { rate: 12, mode: 'paikallaan' }, spotRate: 24 },
    css: '.spot, .spotFront { animation-play-state: paused !important; }',
  },
  { id: 'd7', label: 'piste puolet hitaampi (16 s kierros), 12 askelta/s', test: 'lepo', opts: { spotSeconds: 16, spotRate: 12, spotTail: false } },
  { id: 'd8', label: 'piste puolet hitaampi, 12 askelta/s, häntä (= 1.1.10 oletus)', test: 'lepo' },
  // Erä K3-2 (1.1.10): perustaso ja silmän ja finaalin porrastus. Silmä ja finaali 12 s kohdalla.
  { id: 'b12', label: 'oletus 1.1.10 (kaikki 12 askelta/s)', test: 'lepo' },
  {
    id: 'b24',
    label: 'kaikki 24 askelta/s (renkaat, piste, tuike, syke, putoavat)',
    test: 'lepo',
    opts: { frameRate: 24, disk: { rate: 24, mode: 'dash' }, spotRate: 24 },
  },
  { id: 'e0', label: 'silmä sulava (1.1.13)', test: 'silma', lead: 12, opts: { spotTail: false, motionRate: 0 } },
  { id: 'e24', label: 'silmä 24 askelta/s', test: 'silma', lead: 12, opts: { motionRate: 24, spotTail: false } },
  { id: 'e12', label: 'silmä 12 askelta/s', test: 'silma', lead: 12, opts: { motionRate: 12, spotTail: false } },
  { id: 'n0', label: 'finaali sulava (1.1.13)', test: 'finaali', lead: 12, opts: { spotTail: false, motionRate: 0 } },
  { id: 'n24', label: 'finaali 24 askelta/s', test: 'finaali', lead: 12, opts: { motionRate: 24, spotTail: false } },
  { id: 'n12', label: 'finaali 12 askelta/s', test: 'finaali', lead: 12, opts: { motionRate: 12, spotTail: false } },
  // Erä K3-3 (1.1.11): mikä finaalissa on raskasta? Kaikki finaali 12 s kohdalla, 12 askelta/s.
  { id: 'f0', label: 'finaali kokonaan', test: 'finaali', lead: 12, opts: FIN12 },
  { id: 'f1', label: 'finaali ilman linssiä', test: 'finaali', lead: 12, opts: FIN12, css: NO_LENS },
  { id: 'f2', label: 'finaali ilman jähmettynyttä kopiota', test: 'finaali', lead: 12, opts: FIN12, css: NO_FRZ },
  { id: 'f3', label: 'finaali ilman pyramidia', test: 'finaali', lead: 12, opts: FIN12, css: NO_PYR },
  { id: 'f4', label: 'finaali ilman linssiä ja kopiota', test: 'finaali', lead: 12, opts: FIN12, css: NO_LENS + NO_FRZ },
  {
    id: 'f5',
    label: 'finaalista vain silmä',
    test: 'finaali',
    lead: 12,
    opts: FIN12,
    css: `${NO_LENS}${NO_FRZ}${NO_PYR} .cap { display: none !important; }`,
  },
  // Koe G1 (1.1.16): jäätyykö hyvin kevyt kuva myös noin 90 s latauksesta?
  { id: 'p20', label: 'kevyt kuva: musta pohja ja 20 pistettä, 12 askelta/s', test: 'lepo', raw: KEVYT_SCENE },
  // Koe G2 (1.1.17): lataako sovellus kehyksen uudelleen, ja mikä osa kuvasta jäätyy 90 s kohdalla?
  { id: 'pb', label: 'kevyt kuva + purske vain latauksen 12 ensimmäistä sekuntia', test: 'lepo', raw: PURSKE_SCENE },
  {
    id: 'h1',
    label: 'täysi kuva paikallaan (ei animaatioita, ei SMILiä) + vilkkuvat pisteet',
    test: 'lepo',
    css: `*:not(.kd) { animation: none !important; } ${ELO_CSS}`,
    smil: 'pois',
    extra: ELO_PISTEET,
  },
  // Koe G3 (1.1.18): uusi kello (yksi <animate>) vastaan vanha ketju.
  { id: 'c0', label: 'täysi kuva, VANHA kello (72 itsensä käynnistävää ajastinta)', test: 'lepo', clock: 'ketju' },
  { id: 'c1', label: 'täysi kuva, uusi kello (yksi toistuva animaatio)', test: 'lepo' },
  // Koe G4 (1.1.19): sama kuva kokonaan ilman SMIL-ajastimia (aalto paikallaan, CSS-animaatiot ennallaan).
  { id: 'm1', label: 'täysi kuva ilman yhtään SMIL-ajastinta', test: 'lepo', smil: 'pois' },
  // Koe G5 (1.1.21): m1 jäätyi 90 s kohdalla (2/2), s7 (vain kiekko) ei. Mikä CSS-animaatioperhe?
  // Kaikissa kiekko liikkuu (elonmerkki), SMIL pois, ja yksi perhe on päällä.
  { id: 'a1', label: 'kiekko + pitkät siirrot (vaellus 704/476 s, kaaret 400 s)', test: 'lepo', smil: 'pois', css: onlyAnim('.driftX', '.driftY', '.lensArcs') },
  { id: 'a2', label: 'kiekko + himmennykset (tuike, syke, imaisu, verkkobitit, häiriöviivat)', test: 'lepo', smil: 'pois', css: onlyAnim('.tw', '.beat', '.suck', '.net', '.gl') },
  { id: 'a3', label: 'kiekko + putoavat bitit', test: 'lepo', smil: 'pois', css: onlyAnim('.fall', '.fallFront') },
  // Koe G6 (1.1.22): a1, a2 ja a3 selvisivät kukin yli 2,5 min, m1 (kaikki) jäätyy 90 s. Parit:
  { id: 'q12', label: 'kiekko + pitkät siirrot + himmennykset', test: 'lepo', smil: 'pois', css: onlyAnim(...ANIM_A1, ...ANIM_A2) },
  { id: 'q13', label: 'kiekko + pitkät siirrot + putoavat', test: 'lepo', smil: 'pois', css: onlyAnim(...ANIM_A1, ...ANIM_A3) },
  { id: 'q23', label: 'kiekko + himmennykset + putoavat', test: 'lepo', smil: 'pois', css: onlyAnim(...ANIM_A2, ...ANIM_A3) },
  // Koe G7 (1.1.23): rakentaako sovellus taustan uudelleen 90 s kohdalla? Ikämittari (neliö / 10 s).
  { id: 'r1', label: 'kevyt kuva + ikämittari (neliö syttyy 10 s välein)', test: 'lepo', raw: IKA_SCENE },
  { id: 'r2', label: 'täysi kuva ilman SMILiä + ikämittari', test: 'lepo', smil: 'pois', css: IKA_CSS, extra: IKA_NELIOT },
  // Koe G8 (1.1.24): korjausehdokas. Koko kuva (kello, silmä, finaali) ilman vaelluksen ja kaarten animaatiota.
  // Perustelu: q23 ja q13 (kaksi perhettä kolmesta) selvisivät, m1 (kaikki kolme) jäätyy 90 s kohdalla.
  {
    id: 'k1',
    label: 'koko kuva ilman hidasta vaellusta ja kaarten kiertoa + ikämittari',
    test: 'lepo',
    css: `${offAnim(...ANIM_A1)} ${IKA_CSS}`,
    extra: IKA_NELIOT,
  },
]
const VARIANTS: SarjaVariant[] = [...SARJA, ...KEVENNYS]

// ═══ Automaattinen mittaus (kehitystä varten; julkaisussa AINA null) ═════════
// Kun teema latautuu (istunnon alku tai koodin uudelleenlataus vuoron lopussa),
// odotetaan `viive` s ja ajetaan `vaiheet` `kesto` s välein, sitten tavallinen kuva.
// Toteutuneet hetket kirjataan $.store-avaimeen 'autokoe'. HUOM: ajetaan jokaisen
// istunnon alussa, kunnes tämä on taas null.
// Ajetaan vain istunnossa `istunto` (muut auki olevat istunnot lataavat teeman myös uudelleen).
type Autokoe = { tunnus: string; istunto: string; viive: number; kesto: number; vaiheet: string[] }
// Edellinen erä: { tunnus: 'K3-1 kiekko', istunto: '<istunnon id>', viive: 30,
// kesto: 30, vaiheet: d0–d6 kahdesti }.
// Edelliset erät: K3-2 (b12, e*, n*, b24), K3-3 (f0–f5), K3-4 (b12, e0/e12/e24, n0/n12/n24).
// Koe G1 (1.1.16, tili 2): tavallinen kuva 150 s (vertailu), kevyt kuva 150 s, tavallinen kuva.
// Koe G2 (1.1.17): purskekuva, paikallaan oleva täysi kuva, vain kiekko (CSS), vain kentän kello (SMIL).
// Koe G3 (1.1.18): tavallinen kuva uudella kellolla 150 s, vanha kello 150 s, uusi kello 150 s, tavallinen.
// Koe G4 (1.1.19): ilman SMILiä (m1) ja uudella kellolla (c1) vuorotellen, 100 s kukin.
// Edellinen: { tunnus: 'G4 ilman SMILiä vastaan uusi kello', istunto: '<istunnon id>',
// viive: 5, kesto: 100, vaiheet: ['m1', 'c1', 'm1', 'c1', 'm1'] }.
const AUTOKOE = null as Autokoe | null

// Mitä kuvan vaihtaminen tarvitsee istunnolta (hookin `$` käy sellaisenaan).
type Host = {
  theme: { set: (attributes: ThemeSetArgs) => Promise<ThemeResult> }
  clock: { now: () => Promise<number>; after: TimerCall }
  store: { set: (key: string, value: unknown) => Promise<void> }
}

// ─── Toistokoe (/singulariteetti-testi toisto) ──────────────────────────────
// Jäätyykö tausta latautuessaan kuvan raskaudesta riippumatta, ja välttääkö
// <img>-piirto (isInteractive: false, ei kehystä) jäätymisen? Raskas = täysi kuva
// (lepo), kevyt = musta pohja ja yksi liikkuva piste. Kukin TOISTO_SECONDS.
const TOISTO_SECONDS = 20
const TOISTO_ROUNDS = 4
const PIENI_SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><style>.d { animation: d 4s steps(48) infinite; } @keyframes d { from { transform: translate(1100px, 540px); } to { transform: translate(1260px, 540px); } }</style><rect width="1600" height="1000" fill="#07040a"/><circle class="d" cx="0" cy="0" r="6" fill="${HOT}"/></svg>`
type ToistoVaihe = { id: string; label: string; heavy: boolean; img: boolean }
const TOISTO_KIERROS: ToistoVaihe[] = [
  { id: 'RK', label: 'raskas kehyksenä', heavy: true, img: false },
  { id: 'KK', label: 'kevyt kehyksenä', heavy: false, img: false },
  { id: 'RI', label: 'raskas kuvana', heavy: true, img: true },
  { id: 'KI', label: 'kevyt kuvana', heavy: false, img: true },
]
const TOISTO: ToistoVaihe[] = Array.from({ length: TOISTO_ROUNDS }, () => TOISTO_KIERROS).flat()
// Näkymät, jotka piirretään <img>-elementtinä (isInteractive: false).
const imgScenes = new Set<string>()
const KUVAKOE_SECONDS = 300 // pitkä kuvakoe: yli kolme kertaa "noin 90 s" -jäätymisen kohta

// Piirretyt kuvat näkymän nimen mukaan: tavallinen ja viimeisin testi.
const scenes = new Map<string, string>()
let loadedAt = 0
let testRuns = 0

// Vianetsintä (1.1.15): tausta jäätyy noin 90 s latauksesta. Kirjataan jokainen theme.set ja
// Backdrop-piirto (ui.render) aikaleimoineen $.store-avaimeen 'render-loki' (enintään 300),
// jotta nähdään, piirtääkö sovellus taustan uudelleen jäätymishetkellä.
const renderLog: [number, string, string][] = []
// Kaikki auki olevat istunnot kirjoittavat samaan storeen: oma avain prosessille.
const LOG_KEY = `render-loki-${Math.floor(Math.random() * 1e6)}`
const note =(kind: string, scene: string, host: { store: { set: (key: string, value: unknown) => Promise<void> } }): void => {
  try {
    renderLog.push([Date.now(), kind, scene])
    if (renderLog.length > 300) {
      renderLog.shift()
    }
    host.store.set(LOG_KEY, renderLog).catch(() => undefined)
  } catch {
    // kirjaus ei saa koskaan estää piirtoa
  }
}

// Uusi kuva ensin, vanhat testikuvat pois vasta sen jälkeen (ettei tausta välähdä).
const showScene = async (host: Host, svg: string, label: string, img = false): Promise<ThemeResult> => {
  testRuns += 1
  const name = `${SCENE_NAME}-${label}-${testRuns}`
  scenes.set(name, svg)
  if (img) {
    imgScenes.add(name)
  }
  note('theme.set', name, host)
  const set = await host.theme.set(LOOK(name))
  for (const key of [...scenes.keys()]) {
    if (key !== SCENE_NAME && key !== name) {
      scenes.delete(key)
      imgScenes.delete(key)
    }
  }

  return set
}

const startAuto = (host: Host, auto: Autokoe, loaded: number): void => {
  for (const timer of seriesTimers) {
    timer.cancel()
  }
  seriesTimers = []
  const steps = auto.vaiheet.flatMap(id => VARIANTS.filter(v => v.id === id))
  const log = { tunnus: auto.tunnus, kesto: auto.kesto, vaiheet: steps.map(v => v.id), vaihdot: [] as [string, number][] }
  const record = (id: string, at: number): void => {
    log.vaihdot.push([id, at])
    host.store.set('autokoe', log).catch(() => undefined)
  }
  record('ladattu', loaded)
  steps.forEach((variant, i) => {
    seriesTimers.push(
      host.clock.after((auto.viive + i * auto.kesto) * 1000, () => {
        void host.clock.now().then(at => {
          record(variant.id, at)

          return showScene(host, sarjaScene(variant, at, loaded), `auto-${variant.id}`)
        })
      }),
    )
  })
  seriesTimers.push(
    host.clock.after((auto.viive + steps.length * auto.kesto) * 1000, () => {
      void host.clock.now().then(at => {
        record('tavallinen', at)

        return showScene(host, buildScene(sceneOptions('pois', at, loaded)).svg, 'tavallinen')
      })
    }),
  )
}

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
    note('theme.set', SCENE_NAME, $)
    const set = await $.theme.set(LOOK(SCENE_NAME))

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    try {
      await $.command.register({
        name: 'singulariteetti-testi',
        description: 'Käynnistää teeman finaalin heti ("valkoinen": valkoinen aukko, "silmä": tavallinen silmä, "sarja": mittaussarja)',
      })
    } catch (error) {
      $.ui.toast(`Singulariteetti: testikomennon rekisteröinti epäonnistui (${String(error)})`)
    }
    if (AUTOKOE !== null && (await $.session.id().catch(() => '')) === AUTOKOE.istunto) {
      startAuto($, AUTOKOE, loadedAt)
    }

    return next(e)
  })

  // Vianetsintä (1.1.16): kirjataan myös, liittyykö tai irtoaako sovellus istunnosta ja
  // ilmoittaako se piirtovirheestä. Vain havainnointi: tapahtuma jatkaa aina eteenpäin.
  on('session.attach', ($, e, next) => {
    note('attach', `${e.surface} ${e.clientId}`, $)

    return next(e)
  })
  on('session.detach', ($, e, next) => {
    note('detach', `${e.surface} ${e.clientId} ${String(e.reason)}`, $)

    return next(e)
  })
  on('ui.fault', ($, e, next) => {
    note('fault', `${e.surface} ${String(e.component)}`, $)

    return next(e)
  })

  on('command.run', { command: 'singulariteetti-testi' }, async ($, e) => {
    const now = await $.clock.now()
    const loaded = loadedAt === 0 ? now : loadedAt
    const show = (svg: string, label: string, img = false): Promise<ThemeResult> => showScene($, svg, label, img)
    for (const timer of seriesTimers) {
      timer.cancel()
    }
    seriesTimers = []

    if (/sarja|series/i.test(e.args)) {
      const first = await show(sarjaScene(SARJA[0] ?? { id: 's0', label: '', test: 'lepo' }, now, loaded), 'sarja')
      if (!first.isDrawn) {
        return { text: `Teema ei piirry nyt: ${first.reason}` }
      }
      SARJA.forEach((variant, i) => {
        if (i > 0) {
          seriesTimers.push(
            $.clock.after(i * SARJA_SECONDS * 1000, () => {
              void $.clock.now().then(at => show(sarjaScene(variant, at, loaded), 'sarja'))
            }),
          )
        }
      })
      seriesTimers.push(
        $.clock.after(SARJA.length * SARJA_SECONDS * 1000, () => {
          void $.clock.now().then(at => show(buildScene(sceneOptions('pois', at, loaded)).svg, 'tavallinen'))
        }),
      )
      const total = SARJA.length * SARJA_SECONDS
      const order = SARJA.map((v, i) => `${clockText(now + i * SARJA_SECONDS * 1000)}  ${v.id}  ${v.label}`).join('\n')

      return {
        text: `Mittaussarja alkoi klo ${clockText(now)}. Kuva vaihtuu itsestään ${SARJA_SECONDS} sekunnin välein, ${SARJA.length} vaihetta, yhteensä ${Math.floor(total / 60)} min ${total % 60} s. Sarja päättyy klo ${clockText(now + total * 1000)}, ja tavallinen tausta palaa.\n\n${order}\n\nPidä ikkuna näkyvissä äläkä koske hiireen tai näppäimistöön ennen klo ${clockText(now + total * 1000)}. Kirjoita sitten "valmis".`,
        context: [`singulariteetti-sarja alku_epoch_ms=${now} vaihe_s=${SARJA_SECONDS} vaiheet=${SARJA.map(v => v.id).join(',')}`],
      }
    }

    if (/toisto|repeat/i.test(e.args)) {
      const heavy = (at: number): string => sarjaScene(SARJA[0] ?? { id: 's0', label: '', test: 'lepo' }, at, loaded)
      const step = (v: ToistoVaihe, at: number) => show(v.heavy ? heavy(at) : PIENI_SCENE, `toisto-${v.id}`, v.img)
      const firstStep = TOISTO[0]
      const first = firstStep === undefined ? undefined : await step(firstStep, now)
      if (first !== undefined && !first.isDrawn) {
        return { text: `Teema ei piirry nyt: ${first.reason}` }
      }
      TOISTO.forEach((v, i) => {
        if (i > 0) {
          seriesTimers.push(
            $.clock.after(i * TOISTO_SECONDS * 1000, () => {
              void $.clock.now().then(at => step(v, at))
            }),
          )
        }
      })
      seriesTimers.push(
        $.clock.after(TOISTO.length * TOISTO_SECONDS * 1000, () => {
          void $.clock.now().then(at => show(buildScene(sceneOptions('pois', at, loaded)).svg, 'tavallinen'))
        }),
      )
      const total = TOISTO.length * TOISTO_SECONDS
      const end = clockText(now + total * 1000)
      const order = TOISTO.map((v, i) => `${clockText(now + i * TOISTO_SECONDS * 1000)}  ${v.id}  ${v.label}`).join('\n')

      return {
        text: `Toistokoe alkoi klo ${clockText(now)}. Kuva vaihtuu itsestään ${TOISTO_SECONDS} sekunnin välein, ${TOISTO.length} vaihetta, yhteensä ${Math.floor(total / 60)} min ${total % 60} s. Kevyt kuva on musta pohja ja yksi liikkuva piste. Koe päättyy klo ${end}, ja tavallinen tausta palaa.\n\n${order}\n\nPidä ikkuna näkyvissä äläkä koske hiireen tai näppäimistöön ennen klo ${end}. Kirjoita sitten "valmis".`,
        context: [`singulariteetti-toisto alku_epoch_ms=${now} vaihe_s=${TOISTO_SECONDS} vaiheet=${TOISTO.map(v => v.id).join(',')}`],
      }
    }

    // Pitkä kuvakoe: tavallinen kuva <img>-elementtinä, finaali SARJA_LEAD s päästä.
    if (/kuva|img/i.test(e.args)) {
      const set = await show(buildScene({ ...sceneOptions('finaali', now, loaded), lead: SARJA_LEAD }).svg, 'kuva', true)
      if (!set.isDrawn) {
        return { text: `Teema ei piirry nyt: ${set.reason}` }
      }
      const end = clockText(now + KUVAKOE_SECONDS * 1000)

      return {
        text: `Kuvakoe alkoi klo ${clockText(now)}. Tausta piirretään nyt kuvana (ei kehystä). Finaali alkaa klo ${clockText(now + SARJA_LEAD * 1000)} ja kestää noin 11 sekuntia. Katso se. Sen jälkeen älä koske hiireen tai näppäimistöön ennen klo ${end}. Kirjoita sitten "valmis", ja kerro, näyttikö finaali samalta kuin ennen ja liikkuuko tausta yhä.`,
        context: [`singulariteetti-kuvakoe alku_epoch_ms=${now} finaali_s=${SARJA_LEAD} kesto_s=${KUVAKOE_SECONDS}`],
      }
    }

    const single = VARIANTS.find(v => new RegExp(`(^|\\s)${v.id}(\\s|$)`, 'i').test(e.args))
    if (single !== undefined) {
      const set = await show(sarjaScene(single, now, loaded), single.id)

      return set.isDrawn
        ? { text: `Variantti ${single.id} (${single.label}) piirtyi klo ${clockText(now)}.`, context: [`singulariteetti-variantti ${single.id} epoch_ms=${now}`] }
        : { text: `Teema ei piirry nyt: ${set.reason}` }
    }

    const test: Testitila = /silm|eye/i.test(e.args) ? 'silma' : /valk|white/i.test(e.args) ? 'valkoinen' : 'finaali'
    const set = await show(buildScene(sceneOptions(test, now, loaded)).svg, 'testi')

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
    let name = e.props.scene
    let source = scenes.get(name)

    if (source === undefined) {
      name = SCENE_NAME
      source = scenes.get(SCENE_NAME)
    }
    if (source === undefined) {
      source = buildScene(sceneOptions(TESTITILA, loadedAt, loadedAt)).svg
      scenes.set(SCENE_NAME, source)
    }

    const { Svg } = $.ui.resolve(e)

    note('render', name, $)

    return <Svg source={source} alt={ALT} isInteractive={!imgScenes.has(name)} />
  })
}

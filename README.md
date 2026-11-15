# Singulariteetti

A menacing sci-fi theme for the Claude Code desktop app. A black singularity glows red at the edge of the screen. Its accretion disk spins, it beats like a heart, and it slowly swallows a field of drifting bits. Every minute or two a cold cyan machine eye boots up inside the darkness, scans, turns to look at your text, and shuts down again.

*Uhkaava scifi-teema Claude Coden työpöytäsovellukseen: punahehkuinen singulariteetti, joka sykkii, nielee bittejä ja katsoo välillä takaisin kylmällä konesilmällä.*

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install singulariteetti --marketplace tion420/singulariteetti
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first; press Enter).

From a shell:

```
claude plugin install singulariteetti --marketplace tion420/singulariteetti
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `tion420/singulariteetti`, then **Add plugin**.

## What you get

- **The singularity**: a black hole with an ember-and-blood-red accretion disk, a lensed halo, and a heartbeat glow. Its gravity bends the background stars into arcs.
- **The bit field**: a sparse grid of 0s and 1s across the whole screen. A slow wave of light flows toward the hole, and the field dims softly on each heartbeat, as if the light were being pulled in. A few bits spiral into the disk.
- **The machine eye**: a cyan digital iris made of glowing strands, with a glinting pupil, a turning data ring, targeting arcs, a scan line, and circuit traces that carry light pulses. It appears at irregular intervals, 50 to 120 seconds apart, starting from a random point in each session. While it is open, scattered cyan "network" bits in the field light up.
- **Colors**: red-black surfaces and matching accent, danger, success, warning and code colors for the app itself.

## Good to know

- **Where it draws**: themes are drawn by the Claude Code desktop app. The terminal and editors draw no theme. The mobile app's Remote Control view did not draw mod themes when this was written.
- **Dark mode only.**
- **Screen-friendly**: the singularity wanders very slowly (about one pixel every 7–8 seconds over a 90 × 70 area) so its bright rings never burn into one spot of an OLED screen. Large surfaces change only on a shared 1/3-second tick to keep redraws light.
- **Reduced motion**: if your system asks for reduced motion, all animation stops.
- **One theme at a time**: a session has a single theme, so this replaces any other mod's theme while it is installed.

## Files

- `hooks/register.tsx`: the theme and the animated scene (one SVG, generated when the session starts).
- `hooks/make-colors.js`, `hooks/make-colors.d.ts`: the color helper from Claude Code's plugin-authoring kit, included unchanged. It turns a few anchor colors into the app's full palette.

## License

MIT. See [LICENSE](LICENSE).

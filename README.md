# Neonhorisontti

A calm neon sci-fi theme for the Claude Code desktop app. A black hole sits on a deep blue horizon. Its cyan and magenta accretion disk turns slowly, and its gravity bends the starlight around it. A faint field of bits covers the whole screen, and waves of light slide across it toward the hole. Now and then an all-seeing eye rises out of the dark on top of a pyramid made of bits.

*Rauhallinen neon-scifi-teema Claude Coden työpöytäsovellukseen: syaanina ja magentana hohtava musta aukko, koko ruudun bittikenttä ja harvoin aukosta nouseva kaikkinäkevän silmän pyramidi, jonka bitit kertovat OSIRIS-001.*

The plugin installs as `singulariteetti`, the repository's original name.

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

- **The black hole**: a black shadow with a bright photon ring and a lensed halo. A tilted accretion disk of cyan, magenta and white rings turns around it, with a hot spot orbiting on the disk. Its gravity bends the background stars into arcs, and its glow slowly breathes.
- **The bit field**: a sparse grid of 0s and 1s across the whole screen. A cyan wave of light slides through it toward the hole, and a sparser magenta wave crosses it. Some bits keep flipping between 0 and 1. The grid thins out around the hole, and ten bits spiral down into it.
- **The pyramid**: about once every 15 minutes (the first time 2 to 15 minutes after the theme loads), the hole flares and eight rows of bits rise out of it, stacking into a pyramid above it. A capstone rises last. Its eye opens, looks left and right and blinks, and then the hole swallows everything back. The show lasts about 37 seconds.
- **A hidden message**: the pyramid's 80 bits spell `OSIRIS-001` in ASCII, eight bits per character. Read them like text: top row first, left to right. A magenta bit marks the start of each character.
- **Colors**: deep blue-black surfaces with matching cyan accent, danger, success and warning colors for the app itself.

## Good to know

- **Where it draws**: themes are drawn by the Claude Code desktop app. The terminal and editors draw no theme. The mobile app's Remote Control view did not draw mod themes when this was written.
- **Dark mode only.**
- **Raise the pyramid now**: type `/pyramidi` in a session. The show starts about three seconds later. A second call within 45 seconds is refused, because swapping the scene twice in quick succession can stall the app's backdrop. The timings and the message are constants in `hooks/register.tsx`.
- **Screen-friendly**: the black hole wanders very slowly (one pixel every 7–8 seconds over a 90 × 70 area), so its bright rings never burn into one spot of an OLED screen. Large surfaces change only on a shared 1/3-second tick. The scene uses only CSS animations and no blur filters, which keeps redraws light.
- **Reduced motion**: if your system asks for reduced motion, all animation stops.
- **One theme at a time**: a session has a single theme, so this replaces any other mod's theme while it is installed.
- **Earlier versions**: versions 1.0 and 1.1 were a red, more menacing theme called Singulariteetti. It is still in the git history.

## Files

- `hooks/register.tsx`: the theme and the animated scene (one SVG, generated when the session starts).
- `hooks/make-colors.js`, `hooks/make-colors.d.ts`: the color helper from Claude Code's plugin-authoring kit, included unchanged. It turns a few anchor colors into the app's full palette.

## License

MIT. See [LICENSE](LICENSE).

import { expect, test } from 'claude-code/testing'

const BACKDROP = {
  plugin: 'singulariteetti',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'singulariteetti', plugin: 'singulariteetti', glass: { blur: 0, tint: '#0a0607', opacity: 0.6 } },
} as const

test('the backdrop draws the animated scene on desktop', async ($, on) => {
  on('clock.now', () => ({ value: 1_763_000_000_000 }))
  on('command.register', () => ({ value: { command: 'singulariteetti-testi' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })

  expect(svg).toBeDefined()
  await ui.unmount()
})

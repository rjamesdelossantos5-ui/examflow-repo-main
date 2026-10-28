/**
 * STI College's colors, for code that can't use the CSS variables in
 * app/globals.css: emails (mail apps ignore CSS variables), the error page
 * that renders without the app's stylesheet, and the public pages that
 * deliberately stay light in dark mode. Keep both lists in step.
 *
 * STI publishes no public brand guide. The yellow and blue are sampled from
 * the pixels of the STI logo (the yellow), and elms.sti.edu's theme (the blue); the navy is what sti.edu uses for
 * dark text. Ratios are WCAG contrast on white.
 */
export const STI = {
  /** Logo yellow. 1.17:1 on white — a FILL only, always with navy text on it. */
  yellow: '#FFF200',
  /** eLMS blue (elms.sti.edu). 4.6:1 with white text — header, primary buttons (white text), lines, icons. */
  blue: '#047EAF',
  /** sti.edu navy. 18.8:1 — body ink, and text on yellow (16:1). */
  navy: '#050D36',
  /** Secondary text on the blue header (4.6:1). */
  onBlueSoft: '#EAF4FB',
} as const

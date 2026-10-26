import { Poppins } from 'next/font/google'

// STI's font: elms.sti.edu sets "STI Education Services Group" and its whole
// portal in Poppins. Used app-wide (app/layout.tsx puts the variable on <html>).
// Poppins has no variable-weight file on Google Fonts, so each weight the app
// uses is listed: 400 body, 500/600 labels and buttons, 700–900 headings and
// the EXAMFLOW wordmark (font-black).
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
})

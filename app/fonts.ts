import { Archivo } from 'next/font/google'

// Loaded once and imported where needed (Next hosts one instance per call).
// Used by the public pages: the landing page and the Privacy Notice.
export const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo' })

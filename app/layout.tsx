import type { Metadata } from 'next'
import { poppins } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'EXAMFLOW',
  description: 'STI Special Exam Request System',
}

// Applied before first paint. Default is LIGHT — only go dark if the user
// explicitly chose it, so the app opens in light mode by default.
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  )
}

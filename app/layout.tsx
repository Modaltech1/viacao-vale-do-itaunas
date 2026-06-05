import type { Metadata, Viewport } from 'next'
import { DM_Sans, Poppins } from 'next/font/google'
import { brand } from '@/branding/brand'
import './globals.css'

const headingFont = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700'],
})

const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: brand.appName,
  description: brand.description,
  generator: 'Prodexy',
  icons: {
    icon: [{ url: brand.faviconUrl ?? brand.logoUrl }],
    apple: brand.logoUrl,
  },
}

export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}

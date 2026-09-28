import type { Metadata } from 'next'
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { SolicitudesProvider } from '@/lib/solicitudes-store'
import { AutorizacionesProvider } from '@/lib/autorizaciones-store'
import { HistoricoStoreProvider } from '@/lib/historico-store'
import { CalendarioProvider } from '@/lib/calendario-store'
import './globals.css'

const karolSans = localFont({
  src: [
    { path: '../public/fonts/fonnts.com-Karol_Sans_Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/KarolSans-SemiBold.otf', weight: '600', style: 'normal' },
    { path: '../public/fonts/fonnts.com-Karol_Sans_Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-karol-sans',
  display: 'swap',
});

const twogetherSans = localFont({
  src: [
    { path: '../public/fonts/TwogetherSans-Thin.otf', weight: '100', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-ThinItalic.otf', weight: '100', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-ExtraLight.otf', weight: '200', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-ExtraLightItalic.otf', weight: '200', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-Light.otf', weight: '300', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-Italic.otf', weight: '400', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-Medium.otf', weight: '500', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-Bold.otf', weight: '700', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-BoldItalic.otf', weight: '700', style: 'italic' },
    { path: '../public/fonts/TwogetherSans-Black.otf', weight: '900', style: 'normal' },
    { path: '../public/fonts/TwogetherSans-BlackItalic.otf', weight: '900', style: 'italic' },
  ],
  variable: '--font-twogether-sans',
  display: 'swap',
});

// Misma fuente que usan los PDFs generados (react-pdf, ver lib/pdf-fonts.ts)
// — solo existe el peso Thin. Se expone como fuente web para que el portal
// público de firma (components/firma-publica-client.tsx) se vea consistente
// con el documento que se está firmando, en vez de usar TwogetherSans (la
// tipografía del resto de la app).
const quetzalliSans = localFont({
  src: [
    { path: '../public/fonts/QuetzalliSans-Thin.otf', weight: '100', style: 'normal' },
  ],
  variable: '--font-quetzalli-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sistema para la Emisión de Dictaminaciones Técnicas Funcionales (SEDIT)',
  description: 'Sistema institucional de gestion y dictaminacion tecnica funcional',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`light ${karolSans.variable} ${twogetherSans.variable} ${quetzalliSans.variable}`} style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/morelosdesign/morelos-ds@main/tokens/css/all.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/morelosdesign/morelos-ds@main/tokens/css/typography-compound.css" />
      </head>
      <body className="theme-light theme-desktop min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <SolicitudesProvider>
            <AutorizacionesProvider>
              <HistoricoStoreProvider>
                <CalendarioProvider>
                  {children}
                </CalendarioProvider>
              </HistoricoStoreProvider>
            </AutorizacionesProvider>
          </SolicitudesProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}

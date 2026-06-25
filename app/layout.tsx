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

export const metadata: Metadata = {
  title: 'Sistema de Solicitudes de Dictaminación de Justificaciones',
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
    <html lang="es" className={`light ${karolSans.variable} ${twogetherSans.variable}`} style={{ colorScheme: 'light' }} suppressHydrationWarning>
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

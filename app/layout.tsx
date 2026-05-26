import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { SolicitudesProvider } from '@/lib/solicitudes-store'
import { AutorizacionesProvider } from '@/lib/autorizaciones-store'
import { HistoricoStoreProvider } from '@/lib/historico-store'
import { CalendarioProvider } from '@/lib/calendario-store'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

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
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
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

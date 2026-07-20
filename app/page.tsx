"use client"

import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { LoginForm, ForzarCambioContrasena } from "@/components/login-form"
import { AppShell } from "@/components/app-shell"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen flex flex-col bg-bg-surface-md overflow-hidden">
    {/* Marca de agua izquierda */}
    <div
      aria-hidden
      className="pointer-events-none select-none absolute inset-y-0 left-0"
      style={{
        width: '50vw',
        backgroundImage: "url(/quetzales-mitad2.svg)",
        backgroundPosition: 'right top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 220%',
        opacity: 0.5,
        filter: "brightness(0) invert(1)",
        transform: 'translateY(-4vh)',
      }}
    />

    {/* Marca de agua derecha */}
    <div
      aria-hidden
      className="pointer-events-none select-none absolute inset-y-0 right-0"
      style={{
        width: '50vw',
        backgroundImage: "url(/quetzales-mita2.1.svg)",
        backgroundPosition: 'left top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 220%',
        opacity: 0.5,
        filter: "brightness(0) invert(1)",
        transform: 'translateY(-4vh)',
      }}
    />

    <div className="relative flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-bg-base rounded-3xl shadow-sm px-8 py-6 flex flex-col gap-3">
        <div className="flex items-center justify-center">
          <Image
            src="/FINANZAS CONVIVENCIA COLOR 1.png"
            alt="Gobierno del Estado de Morelos · Secretaría de Administración y Finanzas"
            width={400}
            height={120}
            priority
            style={{ width: "auto", height: "50px", objectFit: "contain" }}
          />
        </div>

        <div className="text-center">
          <h1 className="font-sans text-[28px] font-normal leading-[120%] text-content-high">
            SISODIJ
          </h1>
          <p className="font-sans text-[14px] font-light leading-[140%] text-content-low mt-1">
            Gobierno del Estado de Morelos
          </p>
          <p className="font-sans text-[14px] font-light leading-[140%] text-content-low">
            Ingrese sus credenciales para acceder al sistema
          </p>
        </div>

        <LoginForm />
      </div>
    </div>

    <footer className="relative w-full">
      <div
        aria-hidden
        className="w-full"
        style={{
          height: 32,
          backgroundImage: 'url(/banner-completo.webp)',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          backgroundSize: 'auto 100%',
        }}
      />
    </footer>
  </div>
    )
  }
  if (user?.mustChangePassword) return <ForzarCambioContrasena />
  return <AppShell />
}

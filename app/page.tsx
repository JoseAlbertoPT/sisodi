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
      <div className="relative min-h-screen flex flex-col bg-[#ebeade] overflow-hidden">
    {/* Marca de agua izquierda */}
    <div
      aria-hidden
      className="pointer-events-none select-none absolute"
      style={{
        top: "-3vw",
        left: "-10vw",
        width: "60vw",
        height: "100vh",
        backgroundImage: "url(/quetzales-mitad2.svg)",
        backgroundPosition: "top right",
        backgroundRepeat: "no-repeat",
        backgroundSize: "55vw auto",
        opacity: 0.5,
        filter: "brightness(0) invert(1)",
      }}
    />

    {/* Marca de agua derecha */}
    <div
      aria-hidden
      className="pointer-events-none select-none absolute"
      style={{
        top: "-3vw",
        right: "-10vw",
        width: "60vw",
        height: "100vh",
        backgroundImage: "url(/quetzales-mita2.1.svg)",
        backgroundPosition: "top left",
        backgroundRepeat: "no-repeat",
        backgroundSize: "55vw auto",
        opacity: 0.5,
        filter: "brightness(0) invert(1)",
      }}
    />

    <div className="relative flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm px-8 py-6 flex flex-col gap-3">
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
          <h1 className="font-sans text-[28px] font-normal leading-[120%] text-[#2e3b2b]">
            SISODIJ
          </h1>
          <p className="font-sans text-[14px] font-light leading-[140%] text-[#5d5e5f] mt-1">
            Gobierno del Estado de Morelos
          </p>
          <p className="font-sans text-[14px] font-light leading-[140%] text-[#5d5e5f]">
            Ingrese sus credenciales para acceder al sistema
          </p>
        </div>

        <LoginForm />
      </div>
    </div>

    <footer className="relative w-full">
      <Image
        src="/banner-completo.webp"
        alt=""
        width={2001}
        height={52}
        priority
        className="w-full h-auto block"
      />
    </footer>
  </div>
    )
  }
  if (user?.mustChangePassword) return <ForzarCambioContrasena />
  return <AppShell />
}

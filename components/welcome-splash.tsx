"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"

interface WelcomePageProps {
  userName: string
  userRole?: string
}

export function WelcomePage({ userName, userRole }: WelcomePageProps) {
  return (
    <div className="flex flex-col gap-4 h-full p-6">

      {/* Encabezado */}
      <div className="flex flex-col gap-1 -mt-2">
        <Badge className="w-fit">Sistema SISODIJ</Badge>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {userName}</h1>
        <p className="text-muted-foreground text-sm">
          {userRole
            ? `Bienvenido(a) al sistema. Estás accediendo como ${userRole}.`
            : "Bienvenido(a) al sistema de gestión de justificaciones."}
        </p>
      </div>

      {/* Imagen principal */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border shadow-sm h-[calc(100vh-220px)]">
        <Image
          src="/img.png"
          alt="Panel SISODIJ"
          fill
          priority
          className="object-cover"
        />
      </div>

    </div>
  )
}

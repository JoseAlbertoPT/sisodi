"use client"

import Image from "next/image"
import { PageHeader } from "@/components/page-header"

interface WelcomePageProps {
  userName: string
  userRole?: string
}

export function WelcomePage({ userName, userRole }: WelcomePageProps) {
  return (
    <div className="flex flex-col h-full min-h-screen bg-bg-base">
      <PageHeader
        title={`Hola, ${userName}`}
        subtitle={
          userRole
            ? `Bienvenido(a) al sistema. Estás accediendo como ${userRole}.`
            : "Bienvenido(a) al sistema de gestión de justificaciones."
        }
      />
      <div className="flex-1 p-8">
        <div className="relative w-full overflow-hidden rounded-xl border border-border shadow-sm h-[calc(100vh-220px)]">
          <Image
            src="/img.png"
            alt="Panel SEDIT"
            fill
            priority
            className="object-cover"
          />
        </div>
      </div>
    </div>
  )
}

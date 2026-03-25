"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { UserCircle } from "lucide-react"
import { PageLayout } from "@/components/page-layout"

export function PerfilPage() {
  const { user } = useAuth()

  return (
    <PageLayout
      title="Mi Perfil"
      description="Informacion de su cuenta de usuario"
    >

      <Card className="shadow-sm border-border max-w-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <UserCircle className="h-5 w-5 text-secondary" />
            Datos del Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Avatar area */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-lg font-semibold text-card-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.role}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Nombre Completo</Label>
                <Input value={user?.name || ""} readOnly className="bg-background" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Correo Electronico</Label>
                <Input value={user?.email || ""} readOnly className="bg-background" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Rol</Label>
                <Input value={user?.role || ""} readOnly className="bg-background" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Ultimo Acceso</Label>
                <Input value="21/02/2026 09:30 hrs" readOnly className="bg-background" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Cambiar Contrasena
              </Button>
              <Button variant="outline">
                Editar Perfil
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}

import { FirmaPublicaClient } from "@/components/firma-publica-client"

interface PageProps {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function FirmadoPage({ params, searchParams }: PageProps) {
  const { uuid } = await params
  const { t: token = "" } = await searchParams

  return (
    <div className="min-h-screen bg-muted/30">
      {!token ? (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <h1 className="text-lg font-semibold text-destructive">Link inválido</h1>
            <p className="text-sm text-muted-foreground mt-2">Falta el token de acceso. Solicita un nuevo link al responsable.</p>
          </div>
        </div>
      ) : (
        <FirmaPublicaClient uuid={uuid} token={token} />
      )}
    </div>
  )
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Con EFIRMA_BYPASS=true la firma electrónica se SIMULA (no se validan
  // certificados y los sellos son falsos). Solo avisa en vez de impedir el
  // arranque, para no tirar un servidor que hoy lo tenga activo a propósito.
  if (process.env.NODE_ENV === "production" && process.env.EFIRMA_BYPASS === "true") {
    console.warn("⚠️  [seguridad] EFIRMA_BYPASS=true en producción: la firma electrónica está SIMULADA.")
  }

  // Precalienta el caché de "Programa o Proyecto" de SIGeF al arrancar el
  // servidor, para que el primer usuario del día no espere los ~4s de la
  // consulta SOAP en frío (ver lib/sigef-cache.ts). No bloquea el arranque.
  const { warmAllKnownDependencias } = await import("@/lib/sigef-cache")
  const { sincronizarDependenciasSigef } = await import("@/lib/sigef-sync")

  // Primero se sincronizan las Secretarías con el catálogo de dependencias de
  // SIGeF (altas y cambios de id, ver lib/sigef-sync.ts) y luego se
  // precalienta, para que el precalentamiento ya use los ids correctos.
  const sincronizarYPrecalentar = () =>
    sincronizarDependenciasSigef()
      .catch((e) => console.error("[sigef sync]", e instanceof Error ? e.message : e))
      .then(() => warmAllKnownDependencias())
  void sincronizarYPrecalentar()

  // Cada 5 min: lo que se dé de alta o cambie en SIGeF (Secretarías nuevas,
  // cambios de idDependencia) se ve en minutos, y es una sola llamada SOAP.
  // También reintenta el precalentamiento: el WS de SIGeF se cae de forma
  // intermitente (ver integracion-sigef-progreso.md) y, si estaba caído al
  // arrancar, así es el propio servidor quien detecta que volvió y repuebla
  // el caché — no un usuario esperando el timeout en el formulario.
  setInterval(() => void sincronizarYPrecalentar(), 5 * 60 * 1000)
}

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
  void warmAllKnownDependencias()

  // El WS de SIGeF corre en la infraestructura del proveedor y se cae de
  // forma intermitente (ver integracion-sigef-progreso.md). Si estaba caído
  // justo al arrancar el servidor, el precalentamiento de arriba falla y
  // nadie vuelve a reintentarlo solo — le toca a un usuario real disparar el
  // siguiente intento y pagar el timeout completo (SIGEF_TIMEOUT_MS). Este
  // intervalo reintenta el precalentamiento cada 5 min en segundo plano, para
  // que sea el propio servidor quien detecte la recuperación del servicio y
  // repueble el caché — no un usuario esperando 10s en el formulario.
  setInterval(() => {
    void warmAllKnownDependencias()
  }, 5 * 60 * 1000)
}

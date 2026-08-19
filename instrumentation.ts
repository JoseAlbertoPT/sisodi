export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Precalienta el caché de "Programa o Proyecto" de SIGeF al arrancar el
  // servidor, para que el primer usuario del día no espere los ~4s de la
  // consulta SOAP en frío (ver lib/sigef-cache.ts). No bloquea el arranque.
  const { warmAllKnownDependencias } = await import("@/lib/sigef-cache")
  void warmAllKnownDependencias()
}

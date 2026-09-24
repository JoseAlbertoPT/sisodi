// Cabeceras de seguridad para todas las respuestas.
// - X-Frame-Options SAMEORIGIN: la app se incrusta a sí misma (vista previa de
//   PDF en iframe), pero ningún otro sitio puede enmarcarla (clickjacking sobre
//   la pantalla de firma).
// - La CSP va en modo *Report-Only*: no bloquea nada, solo reporta en la
//   consola del navegador lo que bloquearía. Pasarla a `Content-Security-Policy`
//   cuando se confirme que no rompe el visor de PDF ni los estilos externos.
// - HSTS queda pendiente hasta que prod tenga HTTPS (lo pone infraestructura).
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ]
  },
}

export default nextConfig

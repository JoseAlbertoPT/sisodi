import nodemailer from "nodemailer"

export const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false,          
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function enviarCodigoRecuperacion(
  correo: string,
  codigo: string
) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      correo,
    subject: "Código de recuperación de contraseña",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Recuperación de contraseña</h2>
        <p>Use el siguiente código para restablecer su contraseña.
           Es válido por <strong>10 minutos</strong>.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:12px;
                    text-align:center;padding:24px;background:#f3f4f6;
                    border-radius:8px;color:#1e3a5f;margin:24px 0">
          ${codigo}
        </div>
        <p style="color:#6b7280;font-size:13px">
          Si no solicitó este código, ignore este mensaje.
        </p>
      </div>
    `,
  })
}
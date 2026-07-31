export async function generateCartaDescriptivaPDF(
  solicitudId: string | number,
  opts: { clave?: string; folioFallback?: string } = {},
) {
  try {
    const res = await fetch("/api/pdf/carta-descriptiva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId, clave: opts.clave }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || "Error al descargar el PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    let filename = `CartaDescriptiva_${opts.folioFallback || solicitudId}.pdf`;
    const cd = res.headers.get("content-disposition");
    if (cd && cd.includes("filename=")) {
      const match = cd.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert(
      error instanceof Error
        ? error.message
        : "Error al descargar la Carta Descriptiva",
    );
  }
}

export async function generateCartaDescriptivaPDFBase64(
  solicitudId: string | number,
  opts: { clave?: string } = {},
): Promise<string> {
  const res = await fetch("/api/pdf/carta-descriptiva", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ solicitudId, clave: opts.clave }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Error al generar la Carta Descriptiva");
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + "base64,".length) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

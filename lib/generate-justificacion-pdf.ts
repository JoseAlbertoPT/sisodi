interface JustificacionFirmasOverride {
  firmaElaboroNombre?: string;
  firmaElaboroCargo?: string;
}

export async function generateJustificacionPDF(solicitudId: string | number, folioFallback: string = "", firmas?: JustificacionFirmasOverride) {
  try {
    const res = await fetch("/api/pdf/justificacion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ solicitudId, ...firmas }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || "Error al descargar el PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    let filename = `Justificacion_${folioFallback || solicitudId}.pdf`;
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
    alert(error instanceof Error ? error.message : "Error al descargar el PDF de Justificación");
  }
}

export async function generateJustificacionPDFBase64(solicitudId: string | number): Promise<string> {
  // Este PDF es el que se sube al portal de firma electrónica ("Firma de
  // Justificación") — ahí no debe verse el folio de dictamen (paraFirma:
  // true hace que la plantilla muestre solo las siglas de la secretaría, no
  // la clave completa que sí se ve en Dictámenes/Catálogo).
  const res = await fetch("/api/pdf/justificacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ solicitudId, paraFirma: true }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Error al generar el PDF de Justificación");
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

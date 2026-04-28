export async function generateJustificacionPDF(solicitudId: string | number, folioFallback: string = "") {
  try {
    const res = await fetch("/api/pdf/justificacion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ solicitudId }),
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

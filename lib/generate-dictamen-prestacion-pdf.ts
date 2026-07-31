export async function generateDictamenPrestacionPDF(
  solicitudId: string | number,
  folioFallback: string = "",
) {
  try {
    const res = await fetch("/api/pdf/dictamen-prestacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || "Error al descargar el PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    let filename = `Dictamen_${folioFallback || solicitudId}.pdf`;
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
        : "Error al descargar el PDF del Dictamen",
    );
  }
}

export async function generateDictamenPrestacionPDFBase64(
  solicitudId: string | number,
): Promise<string> {
  const res = await fetch("/api/pdf/dictamen-prestacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ solicitudId }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Error al generar el PDF del Dictamen");
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

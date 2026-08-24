// Lector mínimo de certificados X.509 (.cer) para extraer Nombre y RFC del
// Subject, sin depender de una librería de criptografía completa — solo
// necesitamos leer campos del certificado, no validar la firma ni la cadena.
// Soporta .cer en DER (binario, lo más común para SAT) y en PEM (texto,
// "-----BEGIN CERTIFICATE-----").

export interface CertificadoInfo {
  nombre: string | null
  rfc: string | null
}

const RFC_REGEX = /[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/

interface TlvNode {
  tag: number
  contentStart: number
  contentEnd: number
}

function readLength(bytes: Uint8Array, offset: number): { length: number; headerLen: number } {
  const first = bytes[offset]
  if ((first & 0x80) === 0) {
    return { length: first, headerLen: 1 }
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = length * 256 + bytes[offset + 1 + i]
  }
  return { length, headerLen: 1 + numBytes }
}

function readTlv(bytes: Uint8Array, offset: number): TlvNode {
  const tag = bytes[offset]
  const { length, headerLen } = readLength(bytes, offset + 1)
  const contentStart = offset + 1 + headerLen
  return { tag, contentStart, contentEnd: contentStart + length }
}

function childrenOf(bytes: Uint8Array, node: TlvNode): TlvNode[] {
  const out: TlvNode[] = []
  let pos = node.contentStart
  while (pos < node.contentEnd) {
    const child = readTlv(bytes, pos)
    out.push(child)
    pos = child.contentEnd
  }
  return out
}

function decodeOid(bytes: Uint8Array, node: TlvNode): string {
  const buf = bytes.subarray(node.contentStart, node.contentEnd)
  if (buf.length === 0) return ""
  const parts: number[] = [Math.floor(buf[0] / 40), buf[0] % 40]
  let value = 0
  for (let i = 1; i < buf.length; i++) {
    value = value * 128 + (buf[i] & 0x7f)
    if ((buf[i] & 0x80) === 0) {
      parts.push(value)
      value = 0
    }
  }
  return parts.join(".")
}

function decodeString(bytes: Uint8Array, node: TlvNode): string {
  const buf = bytes.subarray(node.contentStart, node.contentEnd)
  // BMPString (0x1E) va en UTF-16BE; el resto (PrintableString, UTF8String,
  // IA5String, T61String...) se puede leer como texto plano/UTF-8.
  if (node.tag === 0x1e) {
    let out = ""
    for (let i = 0; i + 1 < buf.length; i += 2) out += String.fromCharCode((buf[i] << 8) | buf[i + 1])
    return out
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf)
}

function pemToDer(text: string): Uint8Array | null {
  const match = text.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/)
  if (!match) return null
  const base64 = match[1].replace(/\s+/g, "")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function parseCertificadoInfo(buffer: ArrayBuffer): CertificadoInfo {
  try {
    let bytes: Uint8Array = new Uint8Array(buffer)
    // Si el archivo es texto PEM en vez de DER binario, decodificarlo primero.
    if (bytes[0] !== 0x30) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
      const der = pemToDer(text)
      if (!der) return { nombre: null, rfc: null }
      bytes = der
    }

    const certificate = readTlv(bytes, 0)
    const tbsCertificate = childrenOf(bytes, certificate)[0]
    if (!tbsCertificate) return { nombre: null, rfc: null }

    // issuer, validity y subject son los únicos SEQUENCE (tag 0x30) directos
    // de TBSCertificate además de "signature" (AlgorithmIdentifier); en ese
    // orden: [0]=signature, [1]=issuer, [2]=validity, [3]=subject.
    const secuencias = childrenOf(bytes, tbsCertificate).filter((n) => n.tag === 0x30)
    const subject = secuencias[3]
    if (!subject) return { nombre: null, rfc: null }

    const valores: string[] = []
    let nombre: string | null = null

    for (const rdnSet of childrenOf(bytes, subject)) {
      if (rdnSet.tag !== 0x31) continue // SET
      for (const atv of childrenOf(bytes, rdnSet)) {
        if (atv.tag !== 0x30) continue // SEQUENCE { OID, valor }
        const [oidNode, valueNode] = childrenOf(bytes, atv)
        if (!oidNode || !valueNode) continue
        const oid = decodeOid(bytes, oidNode)
        const valor = decodeString(bytes, valueNode).trim()
        if (!valor) continue
        valores.push(valor)
        if (oid === "2.5.4.3" && !nombre) nombre = valor // commonName
      }
    }

    let rfc: string | null = null
    for (const valor of valores) {
      const match = valor.toUpperCase().match(RFC_REGEX)
      if (match) { rfc = match[0]; break }
    }

    return { nombre, rfc }
  } catch {
    return { nombre: null, rfc: null }
  }
}

"use client"

import { estadoBadge, StatusBadge } from "@/components/ui/status-badge"

const ESTADOS = [
  "Borrador",
  "En Validacion Justificaciones",
  "Observado por Validacion",
  "En Revision Revisor",
  "Observado por Revisor",
  "Pendiente Firma Justificacion",
  "Pendiente Firma Revision",
  "Pendiente Firma Validacion",
  "Pendiente Firma Emisor",
  "En Validacion Final",
  "Observado por Validacion Final",
  "En Revision Emisor",
  "Observado por Emisor",
  "Pendiente Firma Dictamen",
  "Emitido",
]

export default function BadgesPreviewPage() {
  return (
    <div className="min-h-screen bg-background p-8 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-light text-foreground">
            Preview: Estados de Solicitud
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Badges con tokens del DS Morelos. 15 estados activos.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Estados (BD → estadoBadge)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ESTADOS.map((estado, i) => (
              <div
                key={estado}
                className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-muted-foreground tabular-nums w-6">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground truncate">
                    {estado}
                  </span>
                </div>
                <div className="shrink-0">{estadoBadge(estado)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Paleta de tokens usados</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <TokenSwatch label="disabled (Borrador)"
              color="var(--sem-content-low)" bg="var(--sem-support-disabled-low)" />
            <TokenSwatch label="verde-tierra (Aprobación/Emitido)"
              color="var(--color-core-verde-tierra-40)" bg="var(--color-core-verde-tierra-90)" />
            <TokenSwatch label="mora (Observaciones)"
              color="var(--color-core-mora-40)" bg="var(--color-core-mora-95)" />
            <TokenSwatch label="info (En Revisión)"
              color="var(--sem-support-info)" bg="var(--sem-support-info-low)" />
            <TokenSwatch label="warning (Validación/DGDO)"
              color="var(--sem-support-warning)" bg="var(--sem-support-warning-low)" />
            <TokenSwatch label="success (Firma/Emisión)"
              color="var(--sem-support-success)" bg="var(--sem-support-success-low)" />
            <TokenSwatch label="error (Devuelta)"
              color="var(--sem-support-error)" bg="var(--sem-support-error-low)" />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">StatusBadge directo (labels custom)</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Activo" />
            <StatusBadge label="Inactivo" />
            <StatusBadge label="Centralizada" />
            <StatusBadge label="Paraestatal" />
            <StatusBadge label="Dictamen" />
            <StatusBadge label="Opinión" />
            <StatusBadge label="Electrónica" />
            <StatusBadge label="Autógrafa" />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Variantes cercanas — APLICADO (Fase D)</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <TokenLine hex="#832B56" token="var(--color-core-mora-20)" uses={94} />
            <TokenLine hex="#7B2D5E" token="var(--color-core-mora-30)" uses={28} />
            <TokenLine hex="#DC2626" token="var(--sem-support-error)" uses={17} />
            <TokenLine hex="#EF4444" token="var(--sem-support-error)" uses={9} />
            <TokenLine hex="#e4e3dc" token="var(--color-core-piedra-90)" uses={12} />
            <TokenLine hex="#f3f4f6" token="var(--sem-support-disabled-low)" uses={18} />
            <TokenLine hex="#A0845C" token="var(--color-core-arena-60)" uses={11} />
            <TokenLine hex="#2A3B29" token="var(--color-core-bosque-20)" uses={9} />
            <TokenLine hex="#283c2a" token="var(--color-core-bosque-20)" uses={6} />
            <TokenLine hex="#3a4a2a" token="var(--color-core-bosque-30)" uses={7} />
            <TokenLine hex="#4A5249" token="var(--color-core-verde-tierra-40)" uses={6} />
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Refactor de tokens — resumen</h2>

          <h3 className="text-sm font-semibold mt-2 mb-2">Hex exactos reemplazados (Fase A)</h3>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <TokenLine hex="#773357" token="var(--sem-accent-primary)" uses={57} />
            <TokenLine hex="#87090c" token="var(--sem-support-on-error-low)" uses={13} />
            <TokenLine hex="#ffeaea" token="var(--sem-support-error-low)" uses={11} />
            <TokenLine hex="#e4e3d6" token="var(--sem-bg-surface-high)" uses={14} />
            <TokenLine hex="#2e3b2b" token="var(--sem-content-high)" uses={8} />
            <TokenLine hex="#e7b400" token="var(--sem-support-focus)" uses={7} />
            <TokenLine hex="#1c7d29" token="var(--sem-support-success)" uses={6} />
            <TokenLine hex="#ffffff" token="var(--sem-bg-base)" uses={8} />
          </ul>

          <h3 className="text-sm font-semibold mt-2 mb-2">Grises Tailwind → semánticos (Fase B)</h3>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <TokenLine hex="#374151" token="var(--sem-content-high)" uses={17} />
            <TokenLine hex="#4B5563" token="var(--sem-content-low)" uses={6} />
            <TokenLine hex="#6B7280" token="var(--sem-content-low)" uses={19} />
            <TokenLine hex="#9CA3AF" token="var(--sem-border-high)" uses={14} />
            <TokenLine hex="#E5E7EB" token="var(--sem-border-md)" uses={23} />
          </ul>

          <h3 className="text-sm font-semibold mt-2 mb-2">Constantes por archivo (Fase C)</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><code className="text-xs">catalogo-centralizada-tab.tsx</code> · <code className="text-xs">VINO</code> · <code className="text-xs">VINO_HOVER</code> → <code className="text-xs">--sem-accent-primary</code></li>
            <li><code className="text-xs">revision-do-page.tsx</code> · <code className="text-xs">COLOR_SI</code> → <code className="text-xs">--color-core-verde-tierra-50</code></li>
            <li><code className="text-xs">revision-do-page.tsx</code> · <code className="text-xs">COLOR_SI_TEXT</code> → <code className="text-xs">--sem-content-high</code></li>
            <li><code className="text-xs">revision-do-page.tsx</code> · <code className="text-xs">COLOR_NO</code> → <code className="text-xs">--color-core-mora-20</code></li>
            <li><code className="text-xs">revision-do-page.tsx</code> · <code className="text-xs">COLOR_NO_APLICA</code> → <code className="text-xs">--sem-support-warning</code></li>
            <li><code className="text-xs">usuarios-page.tsx:758</code> · botón guardar → <code className="text-xs">bg-[var(--sem-accent-primary)]</code></li>
          </ul>
        </section>
      </div>
    </div>
  )
}

function TokenLine({ hex, token, uses }: { hex: string; token: string; uses: number }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="inline-block h-4 w-4 rounded border border-border shrink-0"
        style={{ backgroundColor: hex }}
      />
      <code className="text-xs">{hex}</code>
      <span className="text-xs">→</span>
      <span
        className="inline-block h-4 w-4 rounded border border-border shrink-0"
        style={{ backgroundColor: token }}
      />
      <code className="text-xs">{token}</code>
      <span className="text-xs ml-auto">{uses}×</span>
    </li>
  )
}

function TokenSwatch({
  label, color, bg,
}: { label: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-8 w-8 rounded-md border border-border"
        style={{ backgroundColor: bg }}
      />
      <span
        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-light"
        style={{ backgroundColor: bg, color }}
      >
        Aa
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

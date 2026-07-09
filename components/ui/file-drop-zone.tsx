'use client'

import * as React from 'react'
import { Loader2, X, File, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  accept?: string
  hint?: string
  selectLabel?: string
  /** Per-file size limit in MB. Default: 10 */
  maxSizeMB?: number
  /** Allow picking multiple files. Default: true */
  multiple?: boolean
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  error?: string | null
  className?: string
  /** Reduces vertical padding and icon size of the drop zone */
  compact?: boolean
}

/* ── File type icon using system SVGs ──────────────────────── */
export function FileTypeIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const cls = size === 'sm' ? 'h-6 w-6 shrink-0' : 'h-8 w-8 shrink-0'

  if (ext === 'pdf')
    return <img src="/Iconos1/doc icon-pdf.svg" alt="PDF" className={cls} />
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <img src="/Iconos1/doc csv.svg" alt="Excel" className={cls} />
  if (['ppt', 'pptx'].includes(ext))
    return <img src="/Iconos1/doc ppt.svg" alt="PowerPoint" className={cls} />
  if (['doc', 'docx', 'odt'].includes(ext))
    return <img src="/Iconos1/doc word.svg" alt="Word" className={cls} />
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
    return <img src="/Iconos1/doc img-jpg.svg" alt="Imagen" className={cls} />
  return <File className={cn(cls, 'text-[#9CA3AF]')} />
}

export function FileDropZone({
  accept,
  hint,
  selectLabel = 'Seleccionar archivo',
  maxSizeMB = 10,
  multiple = true,
  files,
  onFilesChange,
  disabled = false,
  loading = false,
  loadingText = 'Subiendo archivo...',
  error,
  className,
  compact = false,
}: FileDropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [sizeError, setSizeError] = React.useState<string | null>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const maxBytes = maxSizeMB * 1024 * 1024
    const valid: File[] = []
    let rejected = 0
    Array.from(incoming).forEach((f) => {
      if (f.size > maxBytes) { rejected++; return }
      valid.push(f)
    })
    if (rejected)
      setSizeError(`${rejected} archivo(s) superan el límite de ${maxSizeMB} MB y no se agregaron.`)
    else
      setSizeError(null)
    if (!valid.length) return
    onFilesChange(multiple ? [...files, ...valid] : [valid[0]])
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || loading) return
    addFiles(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
    setSizeError(null)
  }

  const displayError = error ?? sizeError
  const hasError = !!(displayError && !sizeError)

  /* ── Visual state ── */
  let borderColor = '#d1d5db'          // normal: gray-300
  let bgColor     = '#ffffff'          // normal: white
  if (disabled || loading) {
    borderColor = '#e5e7eb'; bgColor = '#f9fafb'
  } else if (hasError) {
    borderColor = '#f87171'; bgColor = '#fef2f2'
  } else if (dragOver) {
    borderColor = '#773357'; bgColor = '#fdf5f8'
  }

  const showDropZone = multiple || files.length === 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>

      {/* ── Drop zone ─────────────────────────────────────── */}
      {showDropZone && (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zona de carga de archivos"
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !loading) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: '10px',
          backgroundColor: bgColor,
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center text-center select-none',
          compact ? 'gap-1.5 py-5 px-3' : 'gap-2 py-7 px-4',
          disabled || loading ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={disabled || loading}
        />

        {/* Icon + badge */}
        <div className="relative">
          {loading ? (
            <Loader2 className={cn(compact ? 'h-7 w-7' : 'h-9 w-9', 'text-gray-400 animate-spin')} />
          ) : hasError ? (
            <img src="/iconos2/error_outline_cargaDoc.svg" alt="Error" className={compact ? 'h-7 w-7' : 'h-9 w-9'} />
          ) : (
            <img
              src="/iconos2/CargaDoc-black.svg"
              alt="Cargar documento"
              className={cn(compact ? 'h-7 w-7' : 'h-9 w-9', disabled ? 'opacity-30' : 'opacity-60')}
            />
          )}
          {files.length > 0 && !loading && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#773357] text-[11px] font-bold text-white leading-none">
              {files.length}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-0.5">
          <p className={cn('text-sm', disabled ? 'text-gray-300' : loading ? 'text-gray-400' : 'text-gray-500')}>
            {loading ? loadingText : 'Arrastra tu archivo aquí, o'}
          </p>
          {!loading && (
            <span className={cn('text-sm font-medium underline underline-offset-2', disabled ? 'text-gray-300' : 'text-[#773357]')}>
              {selectLabel}
            </span>
          )}
        </div>

        {hint && !loading && (
          <p className="text-xs text-gray-400">{hint}</p>
        )}
      </div>
      )}

      {/* ── Archivos seleccionados ─────────────────────────── */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              <FileTypeIcon name={file.name} size="sm" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate leading-snug">{file.name}</span>
                <span className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                disabled={disabled || loading}
                aria-label={`Quitar ${file.name}`}
                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Size error ────────────────────────────────────── */}
      {sizeError && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {sizeError}
        </p>
      )}

      {/* ── Validation error ──────────────────────────────── */}
      {hasError && displayError && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  )
}

/* ── Fila de archivo ya subido al servidor (con check) ──────── */
export function UploadedFileRow({
  nombre,
  ruta,
  onVer,
}: {
  nombre: string
  ruta?: string
  onVer?: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="relative shrink-0">
        <FileTypeIcon name={nombre} size="sm" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        </span>
      </div>
      <span className="text-sm font-medium text-gray-800 truncate flex-1 leading-snug">{nombre}</span>
      {(ruta || onVer) && (
        <button
          type="button"
          onClick={onVer ?? (() => ruta && window.open(ruta, '_blank'))}
          className="shrink-0 text-xs font-medium text-[#773357] hover:underline"
        >
          Ver
        </button>
      )}
    </div>
  )
}

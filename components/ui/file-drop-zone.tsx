'use client'

import * as React from 'react'
import {
  CloudUpload, Loader2, X,
  FileText, FileSpreadsheet, FileImage,
} from 'lucide-react'
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
}

/* ── Coloured file-type icon ──────────────────────────────── */
function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf')
    return <FileText className="h-6 w-6 text-[#EF4444]" />

  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileSpreadsheet className="h-6 w-6 text-[#16A34A]" />

  if (['ppt', 'pptx'].includes(ext))
    return <FileText className="h-6 w-6 text-[#EA580C]" />

  if (['doc', 'docx', 'odt'].includes(ext))
    return <FileText className="h-6 w-6 text-[#2563EB]" />

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'img', 'bmp'].includes(ext))
    return <FileImage className="h-6 w-6 text-[#6B7280]" />

  return <FileText className="h-6 w-6 text-[#9CA3AF]" />
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

  /* ── border / bg based on state ── */
  const borderColor =
    disabled || loading ? '#e0e0e0'
    : displayError && !sizeError ? '#D32F2F'
    : dragOver ? '#7B2D5E'
    : '#cccccc'

  const bgColor =
    disabled || loading ? '#f5f5f5'
    : displayError && !sizeError ? '#FFF5F5'
    : dragOver ? '#f5f0f5'
    : '#ffffff'

  return (
    <div className={cn('flex flex-col gap-4', className)}>

      {/* ── Drop zone ─────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zona de carga de archivos"
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: '12px',
          backgroundColor: bgColor,
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        className={cn(
          'relative flex w-full flex-col items-center justify-center gap-2 py-6 px-4 text-center select-none',
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

        {/* Cloud icon + counter badge */}
        <div className="relative">
          {loading ? (
            <Loader2 className="h-8 w-8 text-[#9CA3AF] animate-spin" />
          ) : (
            <CloudUpload
              className={cn(
                'h-8 w-8',
                displayError && !sizeError ? 'text-[#D32F2F]' : disabled ? 'text-[#ccc]' : 'text-[#9CA3AF]',
              )}
            />
          )}
          {files.length > 0 && !loading && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7B2D5E] text-[10px] font-bold text-white leading-none">
              {files.length}
            </span>
          )}
        </div>

        {/* Prompt text */}
        <div className="flex flex-col items-center gap-0.5">
          <p className={cn('text-sm', disabled ? 'text-[#aaa]' : 'text-[#6B7280]')}>
            {loading ? loadingText : 'Arrastra tu archivo aquí, o'}
          </p>
          {!loading && (
            <span className={cn('text-sm font-medium underline underline-offset-2', disabled ? 'text-[#aaa]' : 'text-[#7B2D5E]')}>
              {selectLabel}
            </span>
          )}
        </div>

        {hint && !loading && (
          <p className={cn('text-xs', disabled ? 'text-[#bbb]' : 'text-[#9CA3AF]')}>{hint}</p>
        )}
      </div>

      {/* ── File list ─────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] overflow-hidden">
          {files.map((file, i) => (
            <React.Fragment key={`${file.name}-${i}`}>
              {i > 0 && <div className="h-px bg-[#E5E7EB]" />}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <FileTypeIcon name={file.name} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-[#374151] truncate leading-snug">{file.name}</span>
                  <span className="text-[11px] text-[#9CA3AF] leading-none">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  disabled={disabled || loading}
                  aria-label={`Quitar ${file.name}`}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#E5E7EB] text-[#6B7280] hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── Error message ─────────────────────────────────── */}
      {displayError && (
        <p className="flex items-center gap-1.5 text-xs text-[#D32F2F]">
          <span className="shrink-0 text-base leading-none">⊘</span>
          {displayError}
        </p>
      )}
    </div>
  )
}

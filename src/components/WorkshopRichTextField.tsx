'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Bold, Italic, List, Underline } from 'lucide-react'
import {
  sanitizeWorkshopHtml,
  workshopRichTextForEditor,
  workshopRichTextPlainLength,
  WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH,
} from '@/lib/workshop-rich-text'

type WorkshopRichTextFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
}

const toolbarBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E4DE] bg-white text-[#444] hover:bg-[#F3F2EF] focus:outline-none focus:ring-2 focus:ring-[#5D755D] disabled:opacity-40'

export function WorkshopRichTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
}: WorkshopRichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  /** Last value written to the editor or emitted to the parent (null = not synced yet). */
  const syncedValue = useRef<string | null>(null)
  const [plainLength, setPlainLength] = useState(() => workshopRichTextPlainLength(value))

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (value === syncedValue.current) return

    const html = workshopRichTextForEditor(value)
    el.innerHTML = html
    syncedValue.current = value
    setPlainLength(workshopRichTextPlainLength(value))
  }, [value])

  const emit = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const sanitized = sanitizeWorkshopHtml(el.innerHTML)
    const normalized = sanitized !== el.innerHTML ? workshopRichTextForEditor(sanitized) : sanitized
    if (normalized !== el.innerHTML) {
      el.innerHTML = normalized
    }
    syncedValue.current = normalized
    setPlainLength(workshopRichTextPlainLength(normalized))
    onChange(normalized)
  }, [onChange])

  const runCommand = (command: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false)
    emit()
  }

  const minHeight = rows * 24 + 20

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          className={toolbarBtn}
          aria-label="Bold"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('bold')
          }}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          aria-label="Italic"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('italic')
          }}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          aria-label="Underline"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('underline')
          }}
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          aria-label="Bullet list"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('insertUnorderedList')
          }}
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        onInput={emit}
        style={{ minHeight }}
        className="workshop-rich-text-editor w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
      />

      <p
        className={`mt-1 text-xs ${plainLength > WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH ? 'text-red-600' : 'text-[#888]'}`}
      >
        {plainLength}/{WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH} characters
      </p>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const toolbarBtnActive =
  'border-[#5D755D] bg-[#E8EDE8] text-[#3D523D] ring-1 ring-[#5D755D]/25 hover:bg-[#DFE8DF]'

type FormatState = {
  bold: boolean
  italic: boolean
  underline: boolean
  list: boolean
}

const EMPTY_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  list: false,
}

function readFormatState(): FormatState {
  return {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    list: document.queryCommandState('insertUnorderedList'),
  }
}

function toolbarBtnClass(active: boolean) {
  return active ? `${toolbarBtn} ${toolbarBtnActive}` : toolbarBtn
}

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
  const [formatState, setFormatState] = useState<FormatState>(EMPTY_FORMAT)

  const updateFormatState = useCallback(() => {
    const el = editorRef.current
    if (!el || disabled) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const anchor = sel.anchorNode
    if (!anchor || !el.contains(anchor)) return

    setFormatState(readFormatState())
  }, [disabled])

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState)
    return () => document.removeEventListener('selectionchange', updateFormatState)
  }, [updateFormatState])

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
    // Do not rewrite innerHTML here — that resets the caret (e.g. after Enter).
    syncedValue.current = sanitized
    setPlainLength(workshopRichTextPlainLength(sanitized))
    onChange(sanitized)
    updateFormatState()
  }, [onChange, updateFormatState])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || disabled) return

    const sel = window.getSelection()
    let node: Node | null = sel?.anchorNode ?? null
    while (node && node !== editorRef.current) {
      const tag = node instanceof HTMLElement ? node.tagName : ''
      if (tag === 'LI' || tag === 'UL' || tag === 'OL') return
      node = node.parentNode
    }

    e.preventDefault()
    document.execCommand('insertLineBreak')
  }

  const runCommand = (command: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false)
    emit()
    updateFormatState()
  }

  const minHeight = rows * 24 + 20

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          className={toolbarBtnClass(formatState.bold)}
          aria-label="Bold"
          aria-pressed={formatState.bold}
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
          className={toolbarBtnClass(formatState.italic)}
          aria-label="Italic"
          aria-pressed={formatState.italic}
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
          className={toolbarBtnClass(formatState.underline)}
          aria-label="Underline"
          aria-pressed={formatState.underline}
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
          className={toolbarBtnClass(formatState.list)}
          aria-label="Bullet list"
          aria-pressed={formatState.list}
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
        onKeyDown={handleKeyDown}
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        onFocus={updateFormatState}
        onBlur={() => setFormatState(EMPTY_FORMAT)}
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

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Dialog({ open, onOpenChange, title, eyebrow = 'ARTHSAATHI', closeLabel = 'Close', children, className = '' }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => dialogRef.current?.querySelector('input,button,select,[tabindex="0"]')?.focus())
    return () => { document.body.style.overflow = priorOverflow; previous?.focus?.() }
  }, [open])
  if (!open) return null
  const keyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false) }
    if (event.key === 'Tab') {
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])') || [])]
      if (!focusable.length) return
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  return createPortal(<div className="retail-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange(false) }}><section ref={dialogRef} className={`retail-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="retail-dialog-title" onKeyDown={keyDown}><header><div><span className="retail-eyebrow">{eyebrow}</span><h2 id="retail-dialog-title">{title}</h2></div><button type="button" className="retail-icon-button" onClick={() => onOpenChange(false)} aria-label={closeLabel}><X size={17} /></button></header>{children}</section></div>, document.body)
}

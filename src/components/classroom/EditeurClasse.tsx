import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import ImageExt from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import mammoth from 'mammoth'
import html2canvas from 'html2canvas'
import { useBroadcastSocket } from '../../hooks/useBroadcastSocket'
import { usePartage } from '../../context/PartageContext'

interface Props {
  classeId: string
  seanceId: string
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  livreAImporter?: any | null
  onLivreImporte?: () => void
}

export default function EditeurClasse({ classeId, seanceId, role, livreAImporter, onLivreImporte }: Props) {
  const canEdit = role === 'professeur'
  const partage = usePartage()
  const sharingEditeur = partage.state.channel === 'editeur' && partage.state.byUserId === partage.userId

  const captureContainerRef = useRef<HTMLDivElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isApplyingRemote = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    editable: canEdit,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExt,
      Link.configure({ openOnClick: true }),
    ],
    content: '<p></p>',
    onUpdate: ({ editor }) => {
      if (!canEdit || isApplyingRemote.current) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        send({ type: 'editor_content', html: editor.getHTML() })
      }, 400)
    },
  })

  const { send } = useBroadcastSocket('editeur', classeId, seanceId, (data) => {
    if (data.type === 'editor_content' && editor && !canEdit) {
      isApplyingRemote.current = true
      editor.commands.setContent(data.html, false)
      isApplyingRemote.current = false
    }
  })

  useEffect(() => { partage.markAsSeen('editeur') }, [])

  // ── Capture + publication vidéo quand le prof active le partage ──
  const startCapture = useCallback(() => {
    if (!captureContainerRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 800
    captureCanvasRef.current = canvas
    const ctx = canvas.getContext('2d')!

    const tick = async () => {
      if (!captureContainerRef.current) return
      try {
        const snap = await html2canvas(captureContainerRef.current, { backgroundColor: '#ffffff', scale: 1 })
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(snap, 0, 0, canvas.width, canvas.height)
      } catch {}
    }
    tick()
    captureIntervalRef.current = setInterval(tick, 1000)

    const stream = canvas.captureStream(2)
    partage.publishStream(stream, 'editeur').then(ok => {
      if (!ok) {
        alert("⚠️ Rejoignez d'abord la salle vidéo pour partager l'éditeur.")
        partage.stopShare()
      }
    })
  }, [partage])

  const stopCapture = useCallback(() => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
    captureIntervalRef.current = null
    partage.unpublishStream('editeur')
  }, [partage])

  useEffect(() => {
    if (sharingEditeur && canEdit) {
      startCapture()
      return () => stopCapture()
    }
  }, [sharingEditeur, canEdit])

  // ── Import depuis la bibliothèque de livres ──
  useEffect(() => {
    if (!livreAImporter || !editor) return
    (async () => {
      try {
        if (livreAImporter.type_fichier === 'docx') {
          const resp = await fetch(livreAImporter.fichier_url)
          const buf = await resp.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer: buf })
          editor.commands.setContent(result.value)
        } else if (livreAImporter.type_fichier === 'image') {
          editor.chain().focus().setImage({ src: livreAImporter.fichier_url }).run()
        } else {
          editor.chain().focus().insertContent(
            `<p>📕 <a href="${livreAImporter.fichier_url}" target="_blank">${livreAImporter.titre}</a></p>`
          ).run()
        }
        send({ type: 'editor_content', html: editor.getHTML() })
      } catch { alert("❌ Impossible d'importer ce document") }
      finally { onLivreImporte?.() }
    })()
  }, [livreAImporter, editor])

  // ── Import Word (.docx) depuis le poste ──
  const handleImportDocx = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    editor?.commands.setContent(result.value)
    send({ type: 'editor_content', html: editor?.getHTML() })
  }

  // ── Export PDF ──
  const handleExportPdf = () => {
    const html = editor?.getHTML() ?? ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Document</title></head><body style="font-family:'Amiri',serif;padding:24px">${html}</body></html>`)
    win.document.close()
    win.print()
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-white">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-neutral-200 bg-neutral-50">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200 font-bold">G</button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200 italic">I</button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200 underline">S</button>
          <div className="w-px h-5 bg-neutral-300 mx-1" />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="px-2 py-1 text-xs rounded hover:bg-neutral-200">Titre</button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200">• Liste</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200">⇥ RTL</button>
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="px-2 py-1 text-sm rounded hover:bg-neutral-200">⇤ LTR</button>
          <div className="w-px h-5 bg-neutral-300 mx-1" />
          <label className="px-2 py-1 text-xs rounded hover:bg-neutral-200 cursor-pointer">
            📥 Importer Word
            <input type="file" accept=".docx" className="hidden" onChange={e => e.target.files?.[0] && handleImportDocx(e.target.files[0])} />
          </label>
          <button onClick={handleExportPdf} className="px-2 py-1 text-xs rounded hover:bg-neutral-200">📤 Export PDF</button>
          {sharingEditeur && (
            <span className="ml-auto text-xs text-indigo-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Partagé en direct
            </span>
          )}
        </div>
      )}
      {!canEdit && partage.isLive('editeur') && (
        <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-200 text-xs text-indigo-700 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Le professeur partage ce document en direct
        </div>
      )}
      <div ref={captureContainerRef} className="flex-1 overflow-y-auto p-6" style={{ direction: 'rtl' }}>
        <EditorContent editor={editor} className="prose max-w-none focus:outline-none" />
      </div>
    </div>
  )
}

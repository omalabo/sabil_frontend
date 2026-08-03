import { DiplomeForm } from '../components/DiplomaPreview'

export function printDiploma(html: string, titre: string = 'Diplome') {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    alert('Veuillez autoriser les popups pour imprimer.')
    return
  }
  w.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${titre}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `)
  w.document.close()
  // Attendre le rendu Tailwind + images
  setTimeout(() => {
    w.focus()
    w.print()
    // w.close() // décommente si tu veux fermer après impression
  }, 600)
}

// Téléchargement en PNG via html2canvas (optionnel)
export async function downloadDiplomaPng(elementId: string, filename: string) {
  const el = document.getElementById(elementId)
  if (!el) return
  // @ts-ignore
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
  const link = document.createElement('a')
  link.download = `${filename}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
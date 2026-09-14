// ── src/pages/MesDiplomes.tsx ─────────────────────────────────────────────────
import React, { useState } from 'react'
import { useGetMyDiplomesQuery } from '../../store/apiSlice'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Diplome {
  id: string
  nom_eleve_diplome: string
  matiere: string
  note_orale: string
  note_ecrite: string
  appreciation: string
  delivre_at: string
  classe_nom: string
  professeur_nom: string
  created_at: string
  image_diplome: string | null
}

// ── Helper pour construire l'URL absolue de l'image ───────────────────────────
const getFullUrl = (url: string | null | undefined) => {
  if (!url) return ''
  // Si c'est déjà une URL absolue, on la retourne telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  
  // Sinon, on préfixe avec l'URL de l'API (backend)
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function MesDiplomes() {
  const { data = [], isLoading } = useGetMyDiplomesQuery()
  const [selected, setSelected] = useState<Diplome | null>(null)

  if (isLoading) {
    return (
      <div className="p-8 text-center text-neutral-500">
        ⏳ Chargement de vos diplômes…
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="text-6xl mb-4">🎓</div>
        <h2 className="text-xl font-bold text-neutral-800 mb-2">
          Aucun diplôme pour le moment
        </h2>
        <p className="text-neutral-500">
          Vos attestations de réussite apparaîtront ici dès qu'elles seront délivrées par vos enseignants.
        </p>
      </div>
    )
  }

  // ✅ Téléchargement direct de l'image (avec URL absolue)
  async function handleDownload(d: Diplome) {
    const fullUrl = getFullUrl(d.image_diplome)
    if (!fullUrl) return
    
    try {
      // 1. Récupérer l'image en tant que Blob (données brutes)
      const response = await fetch(fullUrl)
      if (!response.ok) throw new Error('Échec du téléchargement')
      const blob = await response.blob()
      
      // 2. Créer une URL objet temporaire à partir du Blob
      const blobUrl = window.URL.createObjectURL(blob)
      
      // 3. Créer le lien et déclencher le téléchargement
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `Diplome-${d.nom_eleve_diplome}-${d.matiere}.png`
      document.body.appendChild(a)
      a.click()
      
      // 4. Nettoyage (très important pour libérer la mémoire)
      a.remove()
      window.URL.revokeObjectURL(blobUrl)
      
    } catch (error) {
      console.error("Erreur lors du téléchargement :", error)
      alert("Impossible de télécharger le diplôme automatiquement. Astuce : faites un clic droit sur l'aperçu > 'Enregistrer l'image sous...'")
    }
  }

  
  // ✅ Impression directe de l'image (avec URL absolue)
  function handlePrint(d: Diplome) {
    const fullUrl = getFullUrl(d.image_diplome)
    if (!fullUrl) return
    
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diplôme - ${d.nom_eleve_diplome}</title>
        <style>
          @page { size: landscape; margin: 0; }
          body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100vh; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${fullUrl}" onload="setTimeout(() => { window.print(); window.close(); }, 500)" />
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">🎓 Mes Diplômes</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Consultez, imprimez ou téléchargez vos attestations de réussite.
        </p>
      </header>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((d: Diplome) => (
          <div
            key={d.id}
            className="bg-white rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition overflow-hidden"
          >
            {/* ✅ Miniature du diplôme (avec URL absolue) */}
            {d.image_diplome && (
              <div
                className="w-full aspect-[1280/853] bg-neutral-100 cursor-pointer relative group"
                onClick={() => setSelected(d)}
              >
                <img
                  src={getFullUrl(d.image_diplome)}
                  alt={`Diplôme ${d.matiere}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback si l'image est vraiment introuvable
                    (e.target as HTMLImageElement).style.display = 'none'
                    ;(e.target as HTMLImageElement).parentElement!.innerHTML = 
                      '<div class="flex items-center justify-center h-full text-neutral-400 text-sm">Image indisponible</div>'
                  }}
                />
              </div>
            )}

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wide">
                    {d.classe_nom}
                  </div>
                  <h3 className="text-lg font-bold text-blue-800 mt-1">
                    {d.matiere}
                  </h3>
                </div>
                <div className="text-3xl">🏆</div>
              </div>

              <div className="text-sm text-neutral-600 space-y-1 mb-4">
                <div>
                  <span className="font-medium">Délivré le :</span>{' '}
                  {d.created_at && !d.created_at.startsWith('1970-01-01') 
                    ? new Date(d.created_at).toLocaleDateString('fr-FR')
                    : new Date().toLocaleDateString('fr-FR')}
                </div>
                <div className="flex gap-3">
                  <span>📖 Oral : <b className="text-blue-700">{d.note_orale || '—'}/20</b></span>
                  <span>💬 Écrit : <b className="text-blue-700">{d.note_ecrite || '—'}/20</b></span>
                </div>
                {d.appreciation && (
                  <div className="italic text-neutral-500 text-xs line-clamp-2 mt-2">
                    « {d.appreciation} »
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(d)}
                  className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg transition"
                >
                  👁️ Aperçu
                </button>
                <button
                  onClick={() => handlePrint(d)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                >
                  🖨️ Imprimer
                </button>
                <button
                  onClick={() => handleDownload(d)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                  title="Télécharger en PNG"
                >
                  ⬇️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ Modale aperçu — affiche simplement l'image avec URL absolue */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl max-w-5xl w-full p-2 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 z-10 shadow-lg border border-neutral-200 transition"
            >
              ✕
            </button>
            
            {selected.image_diplome ? (
              <img
                src={getFullUrl(selected.image_diplome)}
                alt={`Diplôme ${selected.matiere}`}
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                  alert("Impossible de charger l'image du diplôme.")
                }}
              />
            ) : (
              <div className="text-center text-neutral-400 py-12">
                Image du diplôme non disponible
              </div>
            )}
            
            <div className="flex gap-3 mt-4 justify-end p-2">
              <button
                onClick={() => handlePrint(selected)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
              >
                🖨️ Imprimer
              </button>
              <button
                onClick={() => handleDownload(selected)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
              >
                ⬇️ Télécharger PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

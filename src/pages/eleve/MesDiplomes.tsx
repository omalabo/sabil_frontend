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
  image_diplome: string | null  // ✅ URL de l'image générée
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

  // ✅ Téléchargement direct de l'image
  function handleDownload(d: Diplome) {
    if (!d.image_diplome) return
    const a = document.createElement('a')
    a.href = d.image_diplome
    a.download = `Diplome-${d.nom_eleve_diplome}-${d.matiere}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  // ✅ Impression directe de l'image
  function handlePrint(d: Diplome) {
    if (!d.image_diplome) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diplôme - ${d.nom_eleve_diplome}</title>
        <style>
          @page { size: landscape; margin: 0; }
          body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          img { width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <img src="${d.image_diplome}" onload="window.print(); window.close();" />
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
            {/* ✅ Miniature du diplôme */}
            {d.image_diplome && (
              <div
                className="w-full aspect-[1280/853] bg-neutral-100 cursor-pointer"
                onClick={() => setSelected(d)}
              >
                <img
                  src={d.image_diplome}
                  alt={`Diplôme ${d.matiere}`}
                  className="w-full h-full object-cover"
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
                  {new Date(d.delivre_at).toLocaleDateString('fr-FR')}
                </div>
                <div className="flex gap-3">
                  <span>📖 Oral : <b className="text-blue-700">{d.note_orale || '—'}/20</b></span>
                  <span>💬 Écrit : <b className="text-blue-700">{d.note_ecrite || '—'}/20</b></span>
                </div>
                {d.appreciation && (
                  <div className="italic text-neutral-500 text-xs line-clamp-2">
                    « {d.appreciation} »
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(d)}
                  className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg"
                >
                  👁️ Aperçu
                </button>
                <button
                  onClick={() => handlePrint(d)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                >
                  🖨️ Imprimer
                </button>
                <button
                  onClick={() => handleDownload(d)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  title="Télécharger en PNG"
                >
                  ⬇️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ Modale aperçu — affiche simplement l'image sauvegardée */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 z-10"
            >
              ✕
            </button>
            {/* ✅ Juste l'image, plus besoin de recalquer */}
            {selected.image_diplome ? (
              <img
                src={selected.image_diplome}
                alt={`Diplôme ${selected.matiere}`}
                className="w-full h-auto rounded-lg"
              />
            ) : (
              <div className="text-center text-neutral-400 py-12">
                Image du diplôme non disponible
              </div>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => handlePrint(selected)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
              >
                🖨️ Imprimer
              </button>
              <button
                onClick={() => handleDownload(selected)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
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
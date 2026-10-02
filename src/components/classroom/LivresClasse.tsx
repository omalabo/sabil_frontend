// components/classroom/LivresClasse.tsx
import { useRef, useState } from 'react'
import { useGetLivresClasseQuery, useUploadLivreClasseMutation, useDeleteLivreClasseMutation } from '../../store/apiSlice'

export default function LivresClasse({ classeId, role }: {
  classeId: string
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
}) {
  const { data, isLoading, refetch } = useGetLivresClasseQuery({ classe_id: classeId })
  const [uploadLivre] = useUploadLivreClasseMutation()
  const [deleteLivre] = useDeleteLivreClasseMutation()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const livres = data?.results ?? data ?? []

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('classe', classeId)
      fd.append('titre', file.name.replace(/\.[^/.]+$/, ''))
      fd.append('fichier_local', file)
      await uploadLivre(fd).unwrap()
      refetch()
    } catch {
      alert("❌ Échec de l'import")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-neutral-50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-neutral-900">📚 Livres & Documents</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Importez des PDF, PPTX, DOCX ou images pour les présenter en classe
          </p>
        </div>
        {role === 'professeur' && (
          <label className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition">
            {uploading ? 'Envoi…' : '+ Importer'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt,image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </label>
        )}
      </div>

      {isLoading ? (
        <p className="text-neutral-400 text-sm">Chargement…</p>
      ) : livres.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📚</div>
          <p className="text-neutral-400 text-sm italic">
            {role === 'professeur'
              ? 'Aucun document. Cliquez sur "+ Importer" pour commencer.'
              : 'Aucun document disponible pour l\'instant.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {livres.map((l: any) => (
            <div key={l.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-col gap-2 hover:shadow-md transition">
              <div className="text-2xl">
                {l.type_fichier === 'pdf' ? '📕' : l.type_fichier === 'docx' ? '📄' :
                 l.type_fichier === 'pptx' ? '📊' : '🖼️'}
              </div>
              <p className="text-xs font-medium text-neutral-800 truncate" title={l.titre}>
                {l.titre}
              </p>
              <p className="text-[10px] text-neutral-400">
                {l.taille_ko ? `${l.taille_ko} Ko` : ''} {l.professeur_nom ? `· ${l.professeur_nom}` : ''}
              </p>
              <div className="flex gap-1 mt-auto">
                <a
                  href={l.fichier_url}
                  download={l.nom_original}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center px-2 py-1 text-[11px] rounded bg-neutral-100 hover:bg-neutral-200 transition"
                >
                  ⬇️ Télécharger
                </a>
              </div>
              {role === 'professeur' && (
                <button
                  onClick={() => {
                    if (window.confirm('Supprimer ce document ?')) {
                      deleteLivre(l.id).then(() => refetch())
                    }
                  }}
                  className="text-[10px] text-red-500 hover:text-red-600 transition"
                >
                  🗑️ Supprimer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

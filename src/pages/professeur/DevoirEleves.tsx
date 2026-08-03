import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  useGetDevoirElevesQuery,
  useNoterEleveMutation,
  useUploadCorrectionProfMutation,
  useCorrigerDevoirMutation,
  useGetClassDevoirsQuery,
} from '../../store/apiSlice'
import { EleveDevoir, FichierDevoir } from '../../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: fr }) }
  catch { return iso }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── Bouton download fichier ──────────────────────────────────────────────────

function DownloadBtn({ fichier }: { fichier: FichierDevoir }) {
  const href = `/api/devoirs/fichiers/${fichier.id}/download/`
  return (
    <a
      href={href}
      download={fichier.nom_original}
      className="inline-flex items-center gap-1 text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 transition font-medium"
      title={`Télécharger ${fichier.nom_original}`}
    >
      ⬇ {fichier.nom_original.length > 18 ? fichier.nom_original.slice(0, 16) + '…' : fichier.nom_original}
      {fichier.taille_bytes && (
        <span className="opacity-70 ml-1">({formatBytes(fichier.taille_bytes)})</span>
      )}
    </a>
  )
}

// ─── Cellule note éditable ────────────────────────────────────────────────────

function NoteCell({
  absenceId,
  devoirId,
  initialNote,
}: {
  absenceId: string
  devoirId: string
  initialNote: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNote ?? '')
  const [noterEleve, { isLoading }] = useNoterEleveMutation()

  const handleSave = async () => {
    try {
      await noterEleve({ devoirId, absence_id: absenceId, note: draft }).unwrap()
      setEditing(false)
    } catch {
      alert('Erreur lors de la mise à jour de la note')
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="ex : 15/20"
          className="form-input text-xs w-24 py-0.5 border-primary-300 focus:ring-primary-500"
        />
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="text-xs bg-success-600 text-white px-2 py-0.5 rounded hover:bg-success-700 transition disabled:opacity-50"
        >
          {isLoading ? '…' : '✅'}
        </button>
        <button
          onClick={() => { setDraft(initialNote ?? ''); setEditing(false) }}
          className="text-xs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded hover:bg-neutral-300 transition"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Cliquer pour modifier la note"
      className="cursor-pointer text-sm font-medium text-neutral-700 hover:text-primary-600 hover:underline select-none"
    >
      {initialNote || <span className="italic text-neutral-400 text-xs">— noter</span>}
    </span>
  )
}

// ─── Bouton upload correction prof ────────────────────────────────────────────

function UploadCorrectionBtn({
  devoirId,
  eleveId,
}: {
  devoirId: string
  eleveId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [upload, { isLoading }] = useUploadCorrectionProfMutation()

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    try {
      await upload({ devoirId, eleveId, files }).unwrap()
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      alert("Erreur lors de l'upload")
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        id={`upload-${eleveId}`}
      />
      <label
        htmlFor={`upload-${eleveId}`}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium cursor-pointer transition
          ${isLoading
            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        title="Uploader un fichier corrigé pour cet élève"
      >
        {isLoading ? '…' : '⬆ Upload corrigé'}
      </label>
    </>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DevoirEleves() {
  const { devoirId } = useParams<{ devoirId: string }>()
  const navigate = useNavigate()

  const { data: eleves = [], isLoading, refetch } = useGetDevoirElevesQuery(devoirId!, { skip: !devoirId })
  const [corrigerDevoir, { isLoading: correcting }] = useCorrigerDevoirMutation()

  // On récupère le devoir courant pour afficher son statut
  // (on utilise un query générique; si la classe est inconnue on ignore)
  const [confirmCorriger, setConfirmCorriger] = useState(false)

  const handleCorriger = async () => {
    if (!devoirId) return
    try {
      await corrigerDevoir(devoirId).unwrap()
      setConfirmCorriger(false)
      refetch()
    } catch {
      alert('Erreur lors du passage en corrigé')
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-500 hover:text-primary-600 flex items-center gap-1 transition"
          >
            ← Retour
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">👥 Élèves du devoir</h1>
        </div>

        {/* Bouton Corriger (hors tableau) */}
        <div className="flex items-center gap-2">
          {confirmCorriger ? (
            <>
              <span className="text-sm text-neutral-600">Marquer ce devoir comme corrigé ?</span>
              <button
                onClick={handleCorriger}
                disabled={correcting}
                className="text-sm bg-success-600 text-white px-3 py-1.5 rounded hover:bg-success-700 transition disabled:opacity-50 font-medium"
              >
                {correcting ? '…' : '✅ Confirmer'}
              </button>
              <button
                onClick={() => setConfirmCorriger(false)}
                className="text-sm bg-neutral-200 text-neutral-600 px-3 py-1.5 rounded hover:bg-neutral-300 transition"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmCorriger(true)}
              className="text-sm bg-success-600 text-white px-3 py-1.5 rounded hover:bg-success-700 transition font-medium flex items-center gap-2"
            >
              ✏️ Marquer corrigé
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-neutral-400 text-sm">Chargement des élèves…</div>
        ) : eleves.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 text-sm">
            Aucun élève n'a participé à ce devoir.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-100 bg-neutral-50">
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">#</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Élève</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Fichiers élève</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Fichiers corrigés</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {(eleves as EleveDevoir[]).map((row, idx) => (
                  <tr
                    key={row.absence_id}
                    className="border-b border-neutral-100 hover:bg-neutral-50 transition align-top"
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-neutral-400 font-mono text-xs pt-4">
                      {idx + 1}
                    </td>

                    {/* Nom élève */}
                    <td className="px-4 py-3 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {row.eleve.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-800">{row.eleve.display_name}</p>
                          <p className="text-xs text-neutral-400">{row.eleve.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Fichiers élève (download) */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {row.fichiers_eleve.length === 0 ? (
                          <span className="text-xs text-neutral-400 italic">Aucun fichier soumis</span>
                        ) : (
                          row.fichiers_eleve.map(f => <DownloadBtn key={f.id} fichier={f} />)
                        )}
                      </div>
                    </td>

                    {/* Fichiers corrigés (upload + download) */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {/* Fichiers déjà uploadés */}
                        {row.fichiers_corriges.map(f => (
                          <DownloadBtn key={f.id} fichier={f} />
                        ))}
                        {/* Bouton upload */}
                        {devoirId && (
                          <UploadCorrectionBtn
                            devoirId={devoirId}
                            eleveId={row.eleve.id}
                          />
                        )}
                      </div>
                    </td>

                    {/* Note éditable */}
                    <td className="px-4 py-3 pt-4">
                      {devoirId && (
                        <NoteCell
                          devoirId={devoirId}
                          absenceId={row.absence_id}
                          initialNote={row.note}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Résumé */}
      {!isLoading && eleves.length > 0 && (
        <p className="text-xs text-neutral-400 text-right">
          {(eleves as EleveDevoir[]).length} élève(s) •{' '}
          {(eleves as EleveDevoir[]).filter(e => e.note).length} noté(s)
        </p>
      )}
    </div>
  )
}
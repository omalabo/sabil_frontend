import { useState, useEffect, useRef } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetAnnoncesGroupeQuery,
  useGetAnnoncesGroupeDetailQuery,
  useCreateAnnoncesGroupeMutation,
  useDeleteAnnoncesGroupeMutation,
  useGetClassesAssignablesQuery,
  useGetElevesParClasseQuery,
  useGetMesAnnoncesQuery,
  useMarquerAnnonceLueMutation,
} from '../../store/apiSlice'
import { AnnoncesGroupe, AnnonceEleve, ClasseSimple, EleveSimple } from '../../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy', { locale: fr })
}
function fmtDatetime(iso: string) {
  return format(new Date(iso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
}
function fmtTaille(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function isExpired(iso: string) {
  return new Date(iso) < new Date()
}

// ── Icône fichier ─────────────────────────────────────────────────────────────

function FileIcon({ mime, className = 'w-8 h-8' }: { mime: string | null; className?: string }) {
  const type = mime?.split('/')[0] ?? ''
  if (type === 'image')
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M6.75 3h10.5a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25A2.25 2.25 0 016.75 3z" />
      </svg>
    )
  if (type === 'video')
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

// ── Sélecteur classe → élèves ─────────────────────────────────────────────────

interface ClasseSelectorProps {
  onSelectionChange: (ids: string[]) => void
}

function ClasseEleveSelector({ onSelectionChange }: ClasseSelectorProps) {
  const { data: classes = [], isLoading: classesLoading } = useGetClassesAssignablesQuery()
  const [expandedClasseId, setExpandedClasseId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [classeSelections, setClasseSelections] = useState<Record<string, string[]>>({})

  // Charge les élèves de la classe ouverte
  const { data: elevesClasse = [], isLoading: elevesLoading } = useGetElevesParClasseQuery(
    expandedClasseId ?? '',
    { skip: !expandedClasseId }
  )

  function toggleClasse(classe: ClasseSimple, elevesIds: string[]) {
    const allSelected = elevesIds.every((id) => selectedIds.has(id))
    const newSelected = new Set(selectedIds)

    if (allSelected) {
      elevesIds.forEach((id) => newSelected.delete(id))
      setClasseSelections((prev) => ({ ...prev, [classe.id]: [] }))
    } else {
      elevesIds.forEach((id) => newSelected.add(id))
      setClasseSelections((prev) => ({ ...prev, [classe.id]: elevesIds }))
    }
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  function toggleEleve(eleveId: string, classeId: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(eleveId)) {
      newSelected.delete(eleveId)
    } else {
      newSelected.add(eleveId)
    }
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  if (classesLoading)
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {classes.length === 0 && (
        <p className="text-sm text-neutral-400 italic text-center py-4">Aucune classe active.</p>
      )}
      {classes.map((classe) => {
        // Pour l'accordéon ouvert, on connaît les élèves
        const isOpen = expandedClasseId === classe.id
        const knownEleves: EleveSimple[] = isOpen ? elevesClasse : []
        const knownIds = knownEleves.map((e) => e.id)
        const selectedInClasse = knownIds.filter((id) => selectedIds.has(id))
        const allChecked = knownIds.length > 0 && knownIds.every((id) => selectedIds.has(id))
        const someChecked = selectedInClasse.length > 0 && !allChecked

        // Nb sélectionnés dans la classe (même si accordéon fermé)
        const savedSel = classeSelections[classe.id]?.length ?? 0

        return (
          <div
            key={classe.id}
            className={`border rounded-xl overflow-hidden transition-all ${
              isOpen ? 'border-violet-300' : 'border-neutral-200'
            }`}
          >
            {/* Header classe */}
            <div className="flex items-center gap-3 px-3 py-3 bg-white">
              {/* Checkbox classe */}
              <button
                type="button"
                onClick={() => {
                  if (!isOpen) {
                    setExpandedClasseId(classe.id)
                  }
                  if (knownIds.length > 0) toggleClasse(classe, knownIds)
                }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  allChecked
                    ? 'bg-violet-600 border-violet-600'
                    : someChecked
                    ? 'bg-violet-200 border-violet-400'
                    : 'border-neutral-300 hover:border-violet-400'
                }`}
              >
                {allChecked && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {someChecked && <span className="w-2 h-0.5 bg-violet-600 rounded" />}
              </button>

              {/* Infos classe */}
              <button
                type="button"
                className="flex-1 text-left min-w-0"
                onClick={() => setExpandedClasseId(isOpen ? null : classe.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-neutral-800 truncate">{classe.nom}</span>
                  {classe.niveau && (
                    <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-500 text-xs rounded-md">
                      {classe.niveau}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 bg-violet-50 text-violet-600 text-xs rounded-md font-medium">
                    {classe.nb_eleves} élève{classe.nb_eleves > 1 ? 's' : ''}
                  </span>
                  {savedSel > 0 && !isOpen && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-md font-semibold">
                      {savedSel} sélectionné{savedSel > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {classe.professeur_nom && (
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">Prof : {classe.professeur_nom}</p>
                )}
              </button>

              {/* Chevron */}
              <button
                type="button"
                onClick={() => setExpandedClasseId(isOpen ? null : classe.id)}
                className="p-1 text-neutral-400 hover:text-neutral-600 shrink-0"
              >
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Liste élèves */}
            {isOpen && (
              <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 space-y-1">
                {elevesLoading ? (
                  <div className="py-3 flex justify-center">
                    <span className="text-xs text-neutral-400">Chargement des élèves…</span>
                  </div>
                ) : elevesClasse.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic py-2 text-center">Aucun élève actif dans cette classe.</p>
                ) : (
                  <>
                    {/* Tout sélectionner */}
                    <button
                      type="button"
                      onClick={() => toggleClasse(classe, knownIds)}
                      className="w-full text-left text-xs text-violet-600 font-semibold py-1 hover:underline"
                    >
                      {allChecked ? '✕ Désélectionner tous' : '✓ Sélectionner tous les élèves'}
                    </button>
                    {elevesClasse.map((eleve) => {
                      const checked = selectedIds.has(eleve.id)
                      return (
                        <button
                          key={eleve.id}
                          type="button"
                          onClick={() => toggleEleve(eleve.id, classe.id)}
                          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all ${
                            checked ? 'bg-violet-50 border border-violet-200' : 'bg-white border border-transparent hover:border-neutral-200'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            checked ? 'bg-violet-600 border-violet-600' : 'border-neutral-300'
                          }`}>
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm text-neutral-800 font-medium truncate">
                              {eleve.display_name ?? eleve.email}
                            </p>
                            {eleve.display_name && (
                              <p className="text-xs text-neutral-400 truncate">{eleve.email}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Modal création annonce ────────────────────────────────────────────────────

function CreateAnnonceModal({ onClose }: { onClose: () => void }) {
  const [titre, setTitre] = useState('')
  const [expiredAt, setExpiredAt] = useState('')
  //const [selectedEleveIds, setSelectedEleveIds] = useState<string[]>([])
  const [fichier, setFichier] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [createAnnonce, { isLoading }] = useCreateAnnoncesGroupeMutation()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFichier(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fichier || !titre.trim()) return

    const fd = new FormData()
    fd.append('titre', titre)
    //fd.append('anonce_expired', new Date(expiredAt).toISOString())
    fd.append('fichier_local', fichier)

    try {
      await createAnnonce(fd).unwrap()
      onClose()
    } catch {}
  }

  const canSubmit = !!fichier && titre.trim() 

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">Nouvelle annonce</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Titre <span className="text-rose-500">*</span>
            </label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Résultats du mois de juin"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              required
            />
          </div>

          {/* Date expiration */}
           {/* <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Date d'expiration <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={expiredAt}
              onChange={(e) => setExpiredAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              required
            />
          </div>  */}

          {/* Upload fichier */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Fichier <span className="text-rose-500">*</span>
            </label>
            <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf" onChange={handleFile} />
            {!fichier ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-neutral-300 hover:border-violet-400 hover:bg-violet-50 rounded-xl transition"
              >
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-neutral-500">Cliquez pour uploader une image, vidéo ou PDF</p>
              </button>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {preview ? (
                  <img src={preview} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-neutral-200 rounded-lg flex items-center justify-center shrink-0">
                    <FileIcon mime={fichier.type} className="w-7 h-7 text-neutral-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{fichier.name}</p>
                  <p className="text-xs text-neutral-400">{fmtTaille(fichier.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFichier(null); setPreview(null) }}
                  className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Sélection élèves */}
          {/* <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-neutral-700">
                Destinataires <span className="text-rose-500">*</span>
              </label>
              {selectedEleveIds.length > 0 && (
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full">
                  {selectedEleveIds.length} sélectionné{selectedEleveIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ClasseEleveSelector onSelectionChange={setSelectedEleveIds} />
          </div> */}

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="flex-1 px-4 py-2.5 text-sm text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition font-semibold"
            >
              {isLoading ? '⏳ Envoi…' : '📢 Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal détail annonce (direction) ──────────────────────────────────────────

function AnnonceDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: annonce, isLoading } = useGetAnnoncesGroupeDetailQuery(id)
  const [deleteAnnonce, { isLoading: deleting }] = useDeleteAnnoncesGroupeMutation()

  async function handleDelete() {
    if (!window.confirm('Supprimer cette annonce ?')) return
    await deleteAnnonce(id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900 truncate pr-2">
            {isLoading ? '…' : annonce?.titre ?? 'Annonce'}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-40 bg-neutral-100 rounded-xl" />
            <div className="h-4 bg-neutral-100 rounded w-2/3" />
          </div>
        ) : annonce ? (
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Aperçu fichier */}
            {annonce.fichier_url && annonce.mime_type?.startsWith('image/') && (
              <img
                src={annonce.fichier_url}
                alt={annonce.titre ?? ''}
                className="w-full rounded-xl object-cover max-h-64"
              />
            )}
            {annonce.fichier_url && !annonce.mime_type?.startsWith('image/') && (
              <a
                href={annonce.fichier_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-violet-50 hover:border-violet-200 transition"
              >
                <FileIcon mime={annonce.mime_type} className="w-8 h-8 text-violet-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{annonce.nom_original}</p>
                  <p className="text-xs text-neutral-400">{fmtTaille(annonce.taille_bytes)}</p>
                </div>
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}

            {/* Méta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Publiée le</p>
                <p className="text-sm text-neutral-800">{fmtDate(annonce.created_at)}</p>
              </div>
              {/* <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Expire le</p>
                <p className={`text-sm font-medium ${isExpired(annonce.anonce_expired) ? 'text-rose-600' : 'text-neutral-800'}`}>
                  {fmtDatetime(annonce.anonce_expired)}
                  {isExpired(annonce.anonce_expired) && ' · Expirée'}
                </p>
              </div> */}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Destinataires</p>
                <p className="text-sm text-neutral-800">{annonce.nb_destinataires}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Lus</p>
                <p className="text-sm text-emerald-700 font-semibold">
                  {annonce.nb_lus} / {annonce.nb_destinataires}
                </p>
              </div>
            </div>

            {/* Barre de lecture */}
            {annonce.nb_destinataires > 0 && (
              <div>
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>Taux de lecture</span>
                  <span>{Math.round((annonce.nb_lus / annonce.nb_destinataires) * 100)} %</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${(annonce.nb_lus / annonce.nb_destinataires) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Liste destinataires */}
            {annonce.destinataires && annonce.destinataires.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Destinataires</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {annonce.destinataires.map((d) => (
                    <div key={d.id} className="flex items-center gap-2.5 px-2 py-1.5 bg-neutral-50 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-semibold shrink-0">
                        {(d.eleve_nom ?? d.eleve_email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-800 font-medium truncate">{d.eleve_nom ?? d.eleve_email}</p>
                        <p className="text-xs text-neutral-400 truncate">{d.eleve_email}</p>
                      </div>
                      {d.statut ? (
                        <span className="text-xs text-emerald-600 font-semibold shrink-0">✓ Lu</span>
                      ) : (
                        <span className="text-xs text-neutral-400 shrink-0">Non lu</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supprimer */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl transition font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? 'Suppression…' : 'Supprimer cette annonce'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Carte annonce (direction) ─────────────────────────────────────────────────

function AnnonceCard({ annonce }: { annonce: AnnoncesGroupe }) {
  const [showDetail, setShowDetail] = useState(false)
  //const expired = isExpired(annonce.anonce_expired)
  const tauxLecture = annonce.nb_destinataires > 0
    ? Math.round((annonce.nb_lus / annonce.nb_destinataires) * 100)
    : 0

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className={`w-full text-left bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md active:scale-[0.99] ${
          'border-neutral-200 hover:border-violet-200'
        }`}
      >
        <div className="flex gap-3 p-4">
          {/* Miniature ou icône */}
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 flex items-center justify-center">
            {annonce.fichier_url && annonce.mime_type?.startsWith('image/') ? (
              <img src={annonce.fichier_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileIcon mime={annonce.mime_type} className="w-7 h-7 text-neutral-400" />
            )}
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1 flex-wrap">
              <p className="text-sm font-semibold text-neutral-900 truncate flex-1">
                {annonce.titre ?? annonce.nom_original}
              </p>
             
            </div>

            {/* <p className="text-xs text-neutral-400 mb-2">
              {fmtDate(annonce.created_at)} · expire {fmtDate(annonce.anonce_expired)}
            </p> */}

            {/* Stats lecture */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${tauxLecture}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500 shrink-0 tabular-nums">
                {annonce.nb_lus}/{annonce.nb_destinataires} lus
              </span>
            </div>
          </div>
        </div>
      </button>

      {showDetail && (
        <AnnonceDetailModal id={annonce.id} onClose={() => setShowDetail(false)} />
      )}
    </>
  )
}

// ── Carte annonce (élève) ─────────────────────────────────────────────────────

export function AnnonceEleveCard({ annonce }: { annonce: AnnonceEleve }) {
  const [showFull, setShowFull] = useState(false)
  const [marquerLue] = useMarquerAnnonceLueMutation()

  function handleOpen() {
    if (!annonce.statut) marquerLue(annonce.id)
    setShowFull(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full text-left bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md active:scale-[0.99] ${
          !annonce.statut
            ? 'border-violet-300 ring-1 ring-violet-200'
            : 'border-neutral-200 hover:border-violet-200'
        }`}
      >
        {/* Point non lu */}
        <div className="flex gap-3 p-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 flex items-center justify-center relative">
            {annonce.fichier_url && annonce.mime_type?.startsWith('image/') ? (
              <img src={annonce.fichier_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileIcon mime={annonce.mime_type} className="w-7 h-7 text-neutral-400" />
            )}
            {!annonce.statut && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <p className={`text-sm truncate flex-1 ${!annonce.statut ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                {annonce.titre ?? annonce.nom_original}
              </p>
              {annonce.est_expiree && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-400 shrink-0">
                  Expirée
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">{fmtDate(annonce.annonce_created_at)}</p>
            {!annonce.statut && (
              <span className="inline-block mt-1.5 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                Nouveau
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Viewer élève */}
      {showFull && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900 truncate pr-2">
                {annonce.titre ?? annonce.nom_original}
              </h2>
              <button type="button" onClick={() => setShowFull(false)} className="text-neutral-400 hover:text-neutral-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {annonce.fichier_url && annonce.mime_type?.startsWith('image/') ? (
                <img
                  src={annonce.fichier_url}
                  alt={annonce.titre ?? ''}
                  className="w-full rounded-xl object-contain max-h-72"
                />
              ) : annonce.fichier_url ? (
                <a
                  href={annonce.fichier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition"
                >
                  <FileIcon mime={annonce.mime_type} className="w-8 h-8 text-violet-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-violet-800 truncate">{annonce.nom_original}</p>
                    <p className="text-xs text-violet-500 mt-0.5">Appuyer pour ouvrir</p>
                  </div>
                  <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Publiée le</p>
                <p className="text-sm text-neutral-800">{fmtDate(annonce.created_at)}</p>
                <div className="flex flex-col gap-0.5 mt-1.5">
                    <a href="mailto:awef@gmail.com" className="text-xs text-violet-600 hover:underline">
                    ♀ Dames : Sabil.al.ilm@gmail.com
                    </a>
                    <a href="mailto:serrg@gmail.com" className="text-xs text-violet-600 hover:underline">
                    ♂ Hommes : Sabil.al.ilm.homme@gmail.com
                    </a>
                </div>
               </div>
                {/* <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5">Expire le</p>
                  <p className={`text-sm font-medium ${annonce.est_expiree ? 'text-rose-600' : 'text-neutral-800'}`}>
                    {fmtDate(annonce.anonce_expired)}
                  </p>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

type TabId = 'actives' | 'expirees'

export default function AnnoncesPage() {
  const { user } = useAppSelector(selectAuth)
  const isDirection = user?.role === 'direction'
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('actives')

  // ── Direction ──
  const { data: annoncesRaw, isLoading: dirLoading } = useGetAnnoncesGroupeQuery(undefined, {
    skip: !isDirection,
  })
  const annonces: AnnoncesGroupe[] = Array.isArray(annoncesRaw)
    ? annoncesRaw
    : (annoncesRaw as any)?.results ?? []

  // ── Élève ──
  const { data: mesAnnoncesRaw, isLoading: eleveLoading } = useGetMesAnnoncesQuery(undefined, {
    skip: isDirection,
  })
  const mesAnnonces: AnnonceEleve[] = Array.isArray(mesAnnoncesRaw)
    ? mesAnnoncesRaw
    : (mesAnnoncesRaw as any)?.results ?? []

  const isLoading = isDirection ? dirLoading : eleveLoading

  // Filtres direction
  const annoncesActives = annonces.filter((a) => !isExpired(a.anonce_expired))
  const annoncesExpirees = annonces.filter((a) => isExpired(a.anonce_expired))

  // Filtres élève
  const mesNonLues = mesAnnonces.filter((a) => !a.statut && !a.est_expiree)
  const mesActives = mesAnnonces.filter((a) => !a.est_expiree)
  const mesExpirees = mesAnnonces.filter((a) => a.est_expiree)

  const currentDirList = activeTab === 'actives' ? annoncesActives : annoncesExpirees
  const currentEleveList = activeTab === 'actives' ? mesActives : mesExpirees

  const tabs = [
    {
      id: 'actives' as TabId,
      label: 'Actives',
      count: isDirection ? annoncesActives.length : mesActives.length,
      color: 'text-violet-600 bg-violet-100',
    },
    /* y */
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Annonces</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isDirection ? 'Gérez vos communications aux élèves' : 'Vos annonces de la direction'}
          </p>
        </div>
        {isDirection && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-2xl shadow-sm transition active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nouvelle annonce</span>
          </button>
        )}
      </div>

      {/* ── Alerte non-lues (élève) ── */}
      {!isDirection && mesNonLues.length > 0 && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-sm text-violet-800 font-medium">
            {mesNonLues.length} nouvelle{mesNonLues.length > 1 ? 's' : ''} annonce{mesNonLues.length > 1 ? 's' : ''} non lue{mesNonLues.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* ── Stats direction ── */}
      {isDirection && !isLoading && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-3">
            <p className="text-xs text-neutral-500 font-medium">Actives</p>
            <p className="text-2xl font-bold text-violet-600 mt-0.5">{annoncesActives.length}</p>
          </div>
          {/* <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-3">
            <p className="text-xs text-neutral-500 font-medium">Expirées</p>
            <p className="text-2xl font-bold text-neutral-400 mt-0.5">{annoncesExpirees.length}</p>
          </div> */}
          <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-3">
            <p className="text-xs text-neutral-500 font-medium">Total</p>
            <p className="text-2xl font-bold text-neutral-700 mt-0.5">{annonces.length}</p>
          </div>
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex gap-2 mb-5 bg-neutral-100 p-1 rounded-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
              activeTab === tab.id ? tab.color : 'bg-neutral-200 text-neutral-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-neutral-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded-lg w-3/4" />
                  <div className="h-3 bg-neutral-100 rounded-lg w-1/3" />
                  <div className="h-2 bg-neutral-100 rounded-full w-full mt-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isDirection ? (
        currentDirList.length === 0 ? (
          <EmptyState tab={activeTab} isDirection />
        ) : (
          <div className="space-y-3">
            {currentDirList.map((a) => (
              <AnnonceCard key={a.id} annonce={a} />
            ))}
          </div>
        )
      ) : (
        currentEleveList.length === 0 ? (
          <EmptyState tab={activeTab} isDirection={false} />
        ) : (
          <div className="space-y-3">
            {currentEleveList.map((a) => (
              <AnnonceEleveCard key={a.id} annonce={a} />
            ))}
          </div>
        )
      )}

      {showCreate && <CreateAnnonceModal onClose={() => setShowCreate(false)} />}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
      `}</style>
    </div>
  )
}

function EmptyState({ tab, isDirection }: { tab: TabId; isDirection: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
        </svg>
      </div>
      {/* <p className="text-neutral-600 font-semibold">
        {tab === 'expirees' ? 'Aucune annonce expirée' : 'Aucune annonce active'}
      </p> */}
      <p className="text-neutral-400 text-sm mt-1">
        {tab === 'expirees'
          ? 'Les annonces expirées apparaîtront ici.'
          : isDirection
          ? 'Créez une nouvelle annonce pour commencer.'
          : 'La direction n\'a pas encore publié d\'annonce.'}
      </p>
    </div>
  )
}
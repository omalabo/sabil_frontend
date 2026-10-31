import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  useGetLivresClasseQuery,
  useUploadLivreClasseMutation,
  useDeleteLivreClasseMutation,
  usePublierLivreClasseMutation,
} from '../../store/apiSlice'

type Role = 'eleve' | 'professeur' | 'admin' | 'direction'
type SubTab = 'bibliotheque' | 'direction'

// ─── Styles locaux (animations douces, désactivées si "réduire les animations") ───
const STYLES = `
@keyframes lv-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes lv-toast{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes lv-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.lv-panel{animation:lv-in .24s ease-out}
.lv-toast{animation:lv-toast .2s ease-out}
.lv-dot{animation:lv-pulse 1.4s ease-in-out infinite}
.lv-card{transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease}
.lv-card:hover{box-shadow:0 8px 20px rgba(49,46,129,.10);transform:translateY(-2px)}
@media (prefers-reduced-motion:reduce){
  .lv-panel,.lv-toast,.lv-dot{animation:none}
  .lv-card{transition:none}.lv-card:hover{transform:none}
}
`

// ─── Helpers ───
const isFromDirection = (l: any) => l.source === 'direction'
// Un document de la direction n'est visible par la classe qu'après publication par le professeur
const isPublished = (l: any) => !isFromDirection(l) || !!l.publie_aux_eleves
const iconFor = (t?: string) => (t === 'pdf' ? '📕' : t === 'docx' || t === 'doc' ? '📄' : '🖼️')
const errMsg = (err: any) => err?.data?.detail || err?.data?.error || err?.message || 'Erreur inconnue'

export default function LivresClasse({ classeId, role }: { classeId: string; role: Role }) {
  const isProf = role === 'professeur'
  const isDirection = role === 'direction'
  const hasSubTabs = isProf || isDirection

  const { data, isLoading, refetch } = useGetLivresClasseQuery({ classe_id: classeId })
  const [uploadLivre] = useUploadLivreClasseMutation()
  const [deleteLivre] = useDeleteLivreClasseMutation()
  const [publierLivre] = usePublierLivreClasseMutation()

  const [sub, setSub] = useState<SubTab>('bibliotheque')
  const [uploading, setUploading] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const notify = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 3500)
  }
  const setBusy = (id: string, on: boolean) =>
    setBusyIds(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n })

  const livres: any[] = useMemo(() => data?.results ?? data ?? [], [data])

  // bibliotheque = exactement ce que voient les élèves ; direction = fichiers déposés par la direction
  const { bibliotheque, depotsDirection } = useMemo(() => ({
    bibliotheque: livres.filter(isPublished),
    depotsDirection: livres.filter(isFromDirection),
  }), [livres])
  const enAttente = depotsDirection.filter(l => !l.publie_aux_eleves).length

  const activeSub: SubTab = hasSubTabs ? sub : 'bibliotheque'
  const list = activeSub === 'direction' ? depotsDirection : bibliotheque
  const canUpload = (isProf && activeSub === 'bibliotheque') || (isDirection && activeSub === 'direction')

  // ─── Actions ───
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('classe', classeId)
      fd.append('titre', file.name.replace(/\.[^/.]+$/, ''))
      fd.append('fichier_local', file)
      // Indication seulement : le backend décide de la visibilité à partir du rôle de l'utilisateur
      if (isDirection) fd.append('destinataire', 'professeur')
      await uploadLivre(fd).unwrap()
      await refetch()
      notify('ok', isDirection ? 'Document envoyé au professeur.' : 'Document importé.')
    } catch (err: any) {
      console.error('Erreur upload:', err)
      notify('err', `Échec de l'import : ${errMsg(err)}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (l: any) => {
    if (!window.confirm('Supprimer ce document ?')) return
    setBusy(l.id, true)
    try {
      await deleteLivre(l.id).unwrap()
      await refetch()
    } catch (err: any) {
      notify('err', `Suppression impossible : ${errMsg(err)}`)
    } finally {
      setBusy(l.id, false)
    }
  }

  const handlePublish = async (l: any, publie: boolean) => {
    setBusy(l.id, true)
    try {
      await publierLivre({ id: l.id, publie }).unwrap()
      await refetch()
      notify('ok', publie ? 'Document publié aux élèves.' : 'Document retiré de la vue des élèves.')
    } catch (err: any) {
      notify('err', `Action impossible : ${errMsg(err)}`)
    } finally {
      setBusy(l.id, false)
    }
  }

  // ─── Onglets internes ───
  const tabs: { id: SubTab; icon: string; label: string; count?: number; alert?: boolean }[] | null = isProf
    ? [
        { id: 'bibliotheque', icon: '📚', label: 'Bibliothèque', count: bibliotheque.length },
        { id: 'direction', icon: '🏛️', label: 'De la direction', count: enAttente, alert: enAttente > 0 },
      ]
    : isDirection
    ? [
        { id: 'bibliotheque', icon: '📚', label: 'Bibliothèque', count: bibliotheque.length },
        { id: 'direction', icon: '📤', label: 'Envoyés au professeur', count: depotsDirection.length },
      ]
    : null
  const activeIndex = Math.max(0, tabs?.findIndex(t => t.id === activeSub) ?? 0)

  const subtitle =
    activeSub === 'direction'
      ? isProf
        ? "Documents envoyés par la direction. Les élèves ne les voient qu'après votre publication."
        : 'Documents réservés au professeur de la classe, qui décide de les publier ou non.'
      : isProf
      ? 'Importez des PDF, DOCX ou images pour les présenter en classe'
      : 'Documents partagés pour cette classe'

  const emptyText =
    activeSub === 'direction'
      ? isProf
        ? 'Aucun document reçu de la direction pour le moment.'
        : 'Aucun envoi. Cliquez sur « + Envoyer au professeur » pour déposer un document.'
      : isProf
      ? 'Aucun document. Cliquez sur « + Importer » pour commencer.'
      : "Aucun document disponible pour l'instant."

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-neutral-50">
      <style>{STYLES}</style>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-neutral-900">📚 Livres & Documents</h3>
          <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>
        </div>

        {canUpload && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Envoi…' : isDirection ? '+ Envoyer au professeur' : '+ Importer'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Sélecteur à pastille glissante */}
      {tabs && (
        <div
          role="tablist"
          className="relative grid grid-cols-2 p-1 mb-4 rounded-xl bg-neutral-200/70 w-full max-w-lg"
        >
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 rounded-lg bg-white shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ width: 'calc(50% - 4px)', transform: `translateX(${activeIndex * 100}%)` }}
          />
          {tabs.map(t => {
            const selected = t.id === activeSub
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSub(t.id)}
                className={`relative z-10 flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors duration-200 ${
                  selected ? 'text-indigo-700' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <span>{t.icon}</span>
                <span className="truncate">{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={`min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                      t.alert ? 'bg-amber-100 text-amber-700' : selected ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-300/70 text-neutral-600'
                    }`}
                  >
                    {t.alert && <span className="lv-dot inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 align-middle" />}
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Notification */}
      {notice && (
        <div
          role="status"
          className={`lv-toast mb-3 px-3 py-2 rounded-lg text-xs font-medium border ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'ok' ? '✅ ' : '⚠️ '}{notice.text}
        </div>
      )}

      {/* Contenu de l'onglet (réapparition en douceur à chaque changement) */}
      <div key={activeSub} className="lv-panel">
        {activeSub === 'direction' && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 flex gap-2 items-start">
            <span className="text-base leading-none">🔒</span>
            <p className="m-0">
              {isProf
                ? "Ces fichiers sont visibles par vous seul. Utilisez « Publier aux élèves » pour les ajouter à la bibliothèque de la classe ; vous pouvez les retirer à tout moment."
                : 'Seul le professeur de cette classe voit ces fichiers. Les élèves n\'y ont accès que si le professeur les publie.'}
            </p>
          </div>
        )}

        {isLoading ? (
          <p className="text-neutral-400 text-sm">Chargement…</p>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">{activeSub === 'direction' ? '🏛️' : '📚'}</div>
            <p className="text-neutral-400 text-sm italic">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {list.map((l: any) => (
              <LivreCard
                key={l.id}
                l={l}
                busy={busyIds.has(l.id)}
                // Statut de publication : visible dans l'onglet direction, et pour le prof sur les fichiers de la direction
                statusMode={activeSub === 'direction' ? (isProf ? 'prof' : 'direction') : null}
                originBadge={activeSub === 'bibliotheque' && isFromDirection(l)}
                canPublish={isProf && activeSub === 'direction'}
                canDelete={
                  isProf || (isDirection && activeSub === 'direction' && !l.publie_aux_eleves)
                }
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Carte document ───
function LivreCard({
  l, busy, statusMode, originBadge, canPublish, canDelete, onPublish, onDelete,
}: {
  l: any
  busy: boolean
  statusMode: 'prof' | 'direction' | null
  originBadge: boolean
  canPublish: boolean
  canDelete: boolean
  onPublish: (l: any, publie: boolean) => void
  onDelete: (l: any) => void
}) {
  const published = !!l.publie_aux_eleves
  const auteur = l.auteur_nom ?? l.professeur_nom

  return (
    <div className="lv-card bg-white border border-neutral-200 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-2xl">{iconFor(l.type_fichier)}</div>
        {originBadge && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            🏛️ Direction
          </span>
        )}
      </div>

      <p className="text-xs font-medium text-neutral-800 truncate" title={l.titre}>{l.titre}</p>
      <p className="text-[10px] text-neutral-400">
        {l.taille_ko ? `${l.taille_ko} Ko` : ''} {auteur ? `· ${auteur}` : ''}
      </p>

      {statusMode && (
        <span
          className={`self-start px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            published
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {published
            ? statusMode === 'prof' ? '✓ Visible par les élèves' : '✓ Publié aux élèves'
            : statusMode === 'prof' ? '⏳ Non publié' : '⏳ En attente du professeur'}
        </span>
      )}

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

      {canPublish && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPublish(l, !published)}
          className={`w-full px-2 py-1.5 text-[11px] font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
            published
              ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {busy ? '…' : published ? '↩ Retirer aux élèves' : '📢 Publier aux élèves'}
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(l)}
          className="text-[10px] text-red-500 hover:text-red-600 transition disabled:opacity-50"
        >
          🗑️ Supprimer
        </button>
      )}
    </div>
  )
}

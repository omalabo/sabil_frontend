// src/pages/GestionDiplomes.tsx
import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  useGetMyEmittedDiplomesQuery,
  useGetClassesQuery,
  useCancelDiplomeMutation,
  useReactivateDiplomeMutation,
  useUpdateDiplomeMutation,
  useDeleteDiplomeMutation,
} from '../../store/apiSlice'
import { Diplome, ClasseOption } from '../../types'
import SignaturePad from '../../components/shared/SignaturePad'
import html2canvas from 'html2canvas'
import diplomaBg from '../../assets/diplome-bg.jpg'

// ── Types ─────────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'active' | 'cancelled'

interface FormState {
  classe_id: string
  eleve_id: string
  nom_eleve_diplome: string
  matiere: string
  note_orale: string
  note_ecrite: string
  appreciation: string
  nom_enseignant: string
  delivre_at: string
  signature: string
}

// ── Helpers (mêmes que GenerateurDiplome.tsx) ─────────────────────────────────
const BG_W = 1280
const BG_H = 853

function wrapTextToLines(text: string, widths: number[], font: string): string[] {
  if (!text) return []
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  const lines: string[] = []
  let current = ''
  let lineIndex = 0
  for (const ch of text) {
    if (lineIndex >= widths.length) break
    const test = current + ch
    if (ctx.measureText(test).width > widths[lineIndex] && current) {
      lines.push(current)
      lineIndex++
      current = ch
    } else {
      current = test
    }
  }
  if (current && lineIndex < widths.length) lines.push(current)
  return lines
}

function fmtDate(iso: string) {
  if (!iso) return { day: '', month: '', year: '' }
  const [y, m, d] = iso.split('-')
  return { day: d, month: m, year: y }
}

// ── DiplômePreview (réutilisé depuis GenerateurDiplome.tsx) ───────────────────
// ⚠️ Tu peux extraire ce composant dans un fichier partagé : components/DiplomaPreview.tsx
// Pour l'instant je le remets ici pour que le code soit autonome.
interface FieldBox {
  top: number
  left: number
  width?: number
  align?: 'left' | 'center' | 'right'
  fontSize: number
  color?: string
  italic?: boolean
  cursive?: boolean
  weight?: number
  letterSpacing?: string
  anchor?: 'center' | 'bottom'
}

function Field({ box, children }: { box: FieldBox; children: React.ReactNode }) {
  const isCenterAnchor = box.width === undefined
  const lineHeight = Math.round(box.fontSize * 1.2)
  const top = box.top - lineHeight
  return (
    <div
      className="absolute overflow-visible flex items-center"
      style={{
        top: `${top}px`,
        left: `${box.left}px`,
        height: `${lineHeight}px`,
        width: box.width ? `${box.width}px` : undefined,
        transform: isCenterAnchor ? 'translateX(-50%)' : undefined,
        justifyContent:
          box.align === 'left' ? 'flex-start' : box.align === 'right' ? 'flex-end' : 'center',
      }}
    >
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: `${box.fontSize}px`,
          color: box.color ?? '#1e3a5f',
          fontStyle: box.italic ? 'italic' : 'normal',
          fontFamily: box.cursive ? "'Brush Script MT', 'Segoe Script', cursive" : 'Georgia, serif',
          fontWeight: box.weight ?? 400,
          letterSpacing: box.letterSpacing,
          lineHeight: 1,
        }}
      >
        {children}
      </span>
    </div>
  )
}

function DiplomaPreview({ form, innerRef }: { form: FormState; innerRef?: React.Ref<HTMLDivElement> }) {
  const { day, month, year } = fmtDate(form.delivre_at)
  const apprLines = React.useMemo(
    () => wrapTextToLines(form.appreciation, [515, 610], '16px Georgia, serif'),
    [form.appreciation]
  )
  const ensLines = React.useMemo(
    () => wrapTextToLines(form.nom_enseignant, [130, 130], '13px Georgia, serif'),
    [form.nom_enseignant]
  )
  return (
    <div
      ref={innerRef}
      className="relative select-none"
      style={{
        width: `${BG_W}px`,
        height: `${BG_H}px`,
        flexShrink: 0,
        backgroundImage: `url(${diplomaBg})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Field box={{ top: 439, left: 625, fontSize: 30, cursive: true, italic: true, color: '#1d3f7a' }}>
        {form.nom_eleve_diplome}
      </Field>
      <Field box={{ top: 498, left: 639, fontSize: 24, cursive: true, italic: true, color: '#1d3f7a' }}>
        {form.matiere}
      </Field>
      <Field box={{ top: 554, left: 440, width: 137, align: 'center', fontSize: 15, weight: 600 }}>
        {form.note_orale}
      </Field>
      <Field box={{ top: 554, left: 818, width: 71, align: 'center', fontSize: 14, weight: 600 }}>
        {form.note_ecrite}
      </Field>
      {apprLines.map((line, i) => (
        <Field
          key={i}
          box={i === 0
            ? { top: 601, left: 460, width: 515, align: 'left', fontSize: 16 }
            : { top: 638, left: 355, width: 610, align: 'left', fontSize: 16 }}
        >
          {line}
        </Field>
      ))}
      {ensLines.map((line, i) => (
        <Field
          key={i}
          box={{ top: 740 + i * 17, left: 425, width: 130, align: 'center', fontSize: 13, weight: 600 }}
        >
          {line}
        </Field>
      ))}
      {form.signature && (
        <div
          className="absolute"
          style={{ top: '755px', left: '900px', width: '200px', height: '65px', transform: 'translate(-50%, 0)' }}
        >
          <img
            src={form.signature}
            alt="Signature"
            style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
            crossOrigin="anonymous"
          />
        </div>
      )}
      <Field box={{ top: 733, left: 840, width: 48, align: 'center', fontSize: 15 }}>{day}</Field>
      <Field box={{ top: 733, left: 905, width: 48, align: 'center', fontSize: 15 }}>{month}</Field>
      <Field box={{ top: 733, left: 970, width: 62, align: 'center', fontSize: 15 }}>{year}</Field>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GestionDiplomes() {
  // États UI
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [classeFilter, setClasseFilter] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Modales
  const [previewDiplome, setPreviewDiplome] = useState<Diplome | null>(null)
  const [editDiplome, setEditDiplome] = useState<Diplome | null>(null)
  const [cancelDiplomeTarget, setCancelDiplomeTarget] = useState<Diplome | null>(null)
  const [deleteDiplomeTarget, setDeleteDiplomeTarget] = useState<Diplome | null>(null)
  const [cancelMotif, setCancelMotif] = useState('')

  // Hooks RTK
  const statutFilter = tab === 'all' ? '' : tab === 'active' ? 'active' : 'cancelled'
  const { data: diplomes = [], isLoading } = useGetMyEmittedDiplomesQuery({
    statut: statutFilter,
    classe_id: classeFilter,
    search,
  })
  const { data: classesData } = useGetClassesQuery({})
  const classes = classesData?.results ?? []

  const [cancelDiplome, { isLoading: cancelling }] = useCancelDiplomeMutation()
  const [reactivateDiplome, { isLoading: reactivating }] = useReactivateDiplomeMutation()
  const [updateDiplome, { isLoading: updating }] = useUpdateDiplomeMutation()
  const [deleteDiplome, { isLoading: deleting }] = useDeleteDiplomeMutation()

  // Stats
  const stats = useMemo(() => {
    // Pour les stats, on utilise TOUS les diplômes (sans filtre statut)
    // Ici on se base sur ce qu'on a, mais idéalement on ferait une requête séparée
    return {
      total: diplomes.length,
      // Ces stats sont approximatives car filtrées par tab — à améliorer si besoin
    }
  }, [diplomes])

  // Fermer le menu au clic extérieur
  React.useEffect(() => {
    const close = () => setMenuOpenId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!cancelDiplomeTarget) return
    try {
      await cancelDiplome({ id: cancelDiplomeTarget.id, motif: cancelMotif }).unwrap()
      setCancelDiplomeTarget(null)
      setCancelMotif('')
      toastSuccess('Diplôme annulé')
    } catch (e: any) {
      toastError(e?.data?.detail || "Erreur lors de l'annulation")
    }
  }

  async function handleReactivate(d: Diplome) {
    try {
      await reactivateDiplome({ id: d.id }).unwrap()
      setMenuOpenId(null)
      toastSuccess('Diplôme réactivé')
    } catch (e: any) {
      toastError(e?.data?.detail || 'Erreur lors de la réactivation')
    }
  }

  async function handleDelete() {
    if (!deleteDiplomeTarget) return
    try {
      await deleteDiplome({ id: deleteDiplomeTarget.id }).unwrap()
      setDeleteDiplomeTarget(null)
      toastSuccess('Diplôme supprimé définitivement')
    } catch (e: any) {
      toastError(e?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  // Toasts simples (remplace par ton système de notif si tu en as un)
  function toastSuccess(msg: string) {
    alert('✅ ' + msg) // à remplacer par ton toaster
  }
  function toastError(msg: string) {
    alert('❌ ' + msg)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">📜 Mes diplômes délivrés</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Gérez, annulez, modifiez ou supprimez les diplômes que vous avez émis.
        </p>
      </div>

      {/* Barre d'outils */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Rechercher par nom d'élève ou matière..."
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>
          {/* Filtre classe */}
          <select
            value={classeFilter}
            onChange={(e) => setClasseFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
          >
            <option value="">Toutes les classes</option>
            {classes.map((c: ClasseOption) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-neutral-200">
          {([
            { key: 'all', label: 'Tous', icon: '📋' },
            { key: 'active', label: 'Actifs', icon: '✅' },
            { key: 'cancelled', label: 'Annulés', icon: '⛔' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
                tab === t.key
                  ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="text-center py-12 text-neutral-500">⏳ Chargement...</div>
      ) : diplomes.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <p className="text-neutral-500">Aucun diplôme trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {diplomes.map((d: Diplome) => (
            <DiplomeCard
              key={d.id}
              diplome={d}
              menuOpen={menuOpenId === d.id}
              onToggleMenu={(e) => {
                e.stopPropagation()
                setMenuOpenId(menuOpenId === d.id ? null : d.id)
              }}
              onPreview={() => setPreviewDiplome(d)}
              onEdit={() => {
                setEditDiplome(d)
                setMenuOpenId(null)
              }}
              onCancel={() => {
                setCancelDiplomeTarget(d)
                setMenuOpenId(null)
              }}
              onReactivate={() => handleReactivate(d)}
              onDelete={() => {
                setDeleteDiplomeTarget(d)
                setMenuOpenId(null)
              }}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {previewDiplome && (
        <PreviewModal diplome={previewDiplome} onClose={() => setPreviewDiplome(null)} />
      )}
      {editDiplome && (
        <EditModal
          diplome={editDiplome}
          onClose={() => setEditDiplome(null)}
          onSave={async (formData) => {
            try {
              await updateDiplome({ id: editDiplome.id, formData }).unwrap()
              setEditDiplome(null)
              toastSuccess('Diplôme modifié avec succès')
            } catch (e: any) {
              toastError(e?.data?.detail || 'Erreur lors de la modification')
            }
          }}
          saving={updating}
        />
      )}
      {cancelDiplomeTarget && (
        <Modal onClose={() => setCancelDiplomeTarget(null)} title="⛔ Annuler ce diplôme ?">
          <p className="text-sm text-neutral-600 mb-4">
            L'élève <strong>{cancelDiplomeTarget.nom_eleve_diplome}</strong> ne verra plus ce diplôme.
            Vous pourrez toujours le modifier et le réactiver plus tard.
          </p>
          <textarea
            rows={3}
            value={cancelMotif}
            onChange={(e) => setCancelMotif(e.target.value)}
            placeholder="Motif d'annulation (optionnel)..."
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setCancelDiplomeTarget(null)}
              className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {cancelling ? '⏳...' : '⛔ Confirmer l\'annulation'}
            </button>
          </div>
        </Modal>
      )}
      {deleteDiplomeTarget && (
        <Modal onClose={() => setDeleteDiplomeTarget(null)} title="🗑️ Supprimer définitivement ?">
          <p className="text-sm text-neutral-600 mb-4">
            Cette action est <strong className="text-red-600">irréversible</strong>.
            Le diplôme de <strong>{deleteDiplomeTarget.nom_eleve_diplome}</strong> sera définitivement supprimé.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteDiplomeTarget(null)}
              className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {deleting ? '⏳...' : '🗑️ Supprimer définitivement'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Carte d'un diplôme ────────────────────────────────────────────────────────
function DiplomeCard({
  diplome,
  menuOpen,
  onToggleMenu,
  onPreview,
  onEdit,
  onCancel,
  onReactivate,
  onDelete,
}: {
  diplome: Diplome
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  onPreview: () => void
  onEdit: () => void
  onCancel: () => void
  onReactivate: () => void
  onDelete: () => void
}) {
  const isActive = diplome.statut === 'active'
  const fullUrl = diplome.image_diplome
    ? (diplome.image_diplome.startsWith('http')
        ? diplome.image_diplome
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${diplome.image_diplome}`)
    : ''

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-md transition">
      {/* Miniature */}
      <div className="relative aspect-[3/2] bg-neutral-100 cursor-pointer" onClick={onPreview}>
        {fullUrl ? (
          <img
            src={fullUrl}
            alt={diplome.nom_eleve_diplome}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
            Pas d'aperçu
          </div>
        )}
        {/* Badge statut */}
        <span
          className={`absolute top-2 left-2 px-2 py-1 text-xs font-semibold rounded-full ${
            isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isActive ? '✅ Actif' : '⛔ Annulé'}
        </span>
      </div>

      {/* Infos */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 truncate">
              👤 {diplome.nom_eleve_diplome}
            </h3>
            <p className="text-sm text-neutral-600 truncate">📚 {diplome.matiere}</p>
          </div>
          <button
            onClick={onToggleMenu}
            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500"
          >
            ⋮
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
          <span className="bg-neutral-100 px-2 py-0.5 rounded">🏫 {diplome.classe_nom}</span>
          {diplome.note_orale && (
            <span className="bg-neutral-100 px-2 py-0.5 rounded">🗣️ {diplome.note_orale}/20</span>
          )}
          {diplome.note_ecrite && (
            <span className="bg-neutral-100 px-2 py-0.5 rounded">✍️ {diplome.note_ecrite}/20</span>
          )}
        </div>

        <p className="text-xs text-neutral-400">
          📅 Délivré le {new Date(diplome.created_at).toLocaleDateString('fr-FR')}
        </p>

        {diplome.motif_annulation && (
          <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            ⚠️ {diplome.motif_annulation}
          </p>
        )}

        {/* Actions rapides */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onPreview}
            className="flex-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg"
          >
            👁️ Aperçu
          </button>
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-semibold rounded-lg"
          >
            ✏️ Modifier
          </button>
        </div>
      </div>

      {/* Menu déroulant */}
      {menuOpen && (
        <div
          className="absolute right-4 mt-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {isActive ? (
            <>
              <MenuItem icon="⛔" label="Annuler ce diplôme" onClick={onCancel} color="red" />
            </>
          ) : (
            <>
              <MenuItem icon="✅" label="Réactiver" onClick={onReactivate} color="emerald" />
              <div className="border-t border-neutral-100 my-1" />
              <MenuItem icon="🗑️" label="Supprimer définitivement" onClick={onDelete} color="red" />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color: string }) {
  const colorClass = color === 'red' ? 'hover:bg-red-50 text-red-700' : color === 'emerald' ? 'hover:bg-emerald-50 text-emerald-700' : 'hover:bg-neutral-50 text-neutral-700'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${colorClass}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ── Modale générique ──────────────────────────────────────────────────────────
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Modale aperçu ─────────────────────────────────────────────────────────────
function PreviewModal({ diplome, onClose }: { diplome: Diplome; onClose: () => void }) {
  const fullUrl = diplome.image_diplome
    ? (diplome.image_diplome.startsWith('http')
        ? diplome.image_diplome
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${diplome.image_diplome}`)
    : ''

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Aperçu du diplôme</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">
            ✕
          </button>
        </div>
        {fullUrl ? (
          <img src={fullUrl} alt="Diplôme" className="w-full rounded-lg" />
        ) : (
          <p className="text-center text-neutral-500 py-12">Image indisponible</p>
        )}
      </div>
    </div>
  )
}

// ── Modale édition ────────────────────────────────────────────────────────────
function EditModal({
  diplome,
  onClose,
  onSave,
  saving,
}: {
  diplome: Diplome
  onClose: () => void
  onSave: (formData: FormData) => Promise<void>
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>({
    classe_id: diplome.classe,
    eleve_id: diplome.eleve,
    nom_eleve_diplome: diplome.nom_eleve_diplome,
    matiere: diplome.matiere || '',
    note_orale: diplome.note_orale || '',
    note_ecrite: diplome.note_ecrite || '',
    appreciation: diplome.appreciation || '',
    nom_enseignant: diplome.professeur_nom || '',
    delivre_at: diplome.delivre_at || '',
    signature: '', // on ne réaffiche pas l'ancienne signature
  })

  const exportRef = useRef<HTMLDivElement>(null)
  const { data: classesData } = useGetClassesQuery({})
  const classes = classesData?.results ?? []

  function handleChange(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Génère le PNG (même logique que GenerateurDiplome.tsx)
  const generateDiplomaImage = useCallback(async (): Promise<Blob> => {
    const el = exportRef.current
    if (!el) throw new Error('Export ref not found')
    await document.fonts.ready
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      width: 1280,
      height: 853,
    })
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png',
        1.0
      )
    })
  }, [form])

  async function handleSubmit() {
    try {
      const imageBlob = await generateDiplomaImage()
      const formData = new FormData()
      formData.append('classe', form.classe_id)
      formData.append('eleve', form.eleve_id)
      formData.append('nom_eleve_diplome', form.nom_eleve_diplome)
      formData.append('matiere', form.matiere)
      formData.append('note_orale', form.note_orale)
      formData.append('note_ecrite', form.note_ecrite)
      formData.append('appreciation', form.appreciation)
      formData.append('delivre_at', form.delivre_at)
      formData.append('image_diplome', imageBlob, `diplome-${form.nom_eleve_diplome}-${form.matiere}.png`)
      await onSave(formData)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">✏️ Modifier le diplôme</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">
            ✕
          </button>
        </div>

        {/* Formulaire (même structure que GenerateurDiplome.tsx) */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Nom affiché</label>
            <input
              type="text"
              value={form.nom_eleve_diplome}
              onChange={(e) => handleChange('nom_eleve_diplome', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Matière</label>
            <input
              type="text"
              value={form.matiere}
              onChange={(e) => handleChange('matiere', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Note orale</label>
              <input
                type="text"
                value={form.note_orale}
                onChange={(e) => handleChange('note_orale', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Note écrite</label>
              <input
                type="text"
                value={form.note_ecrite}
                onChange={(e) => handleChange('note_ecrite', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Appréciation</label>
            <textarea
              rows={2}
              value={form.appreciation}
              onChange={(e) => handleChange('appreciation', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Date</label>
            <input
              type="date"
              value={form.delivre_at}
              onChange={(e) => handleChange('delivre_at', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Signature (optionnel)</label>
            <SignaturePad onChange={(dataUrl) => handleChange('signature', dataUrl)} width={380} height={130} />
          </div>
        </div>

        {/* Aperçu caché pour export */}
        <div ref={exportRef} style={{ position: 'fixed', left: '-3000px', top: 0, pointerEvents: 'none' }}>
          <DiplomaPreview form={form} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {saving ? '⏳ Enregistrement...' : '💾 Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  )
}

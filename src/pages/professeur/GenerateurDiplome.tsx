// ── src/pages/GenerateurDiplome.tsx ───────────────────────────────────────────
import React, { useState, useRef, useCallback } from 'react'
import {
  useGetClassesQuery,
  useGetElevesByClasseQuery,
  useCreateDiplomeMutation,
} from '../../store/apiSlice'
import { ClasseOption } from '../../types'
import diplomaBg from '../../assets/diplome-bg.jpg'
import SignaturePad from '../../components/shared/SignaturePad'
import html2canvas from 'html2canvas'

// ── Types ─────────────────────────────────────────────────────────────────────
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
  signature: string // ✅ dataURL de la signature
}

const INITIAL_FORM: FormState = {
  classe_id: '',
  eleve_id: '',
  nom_eleve_diplome: '',
  matiere: '',
  note_orale: '',
  note_ecrite: '',
  appreciation: '',
  nom_enseignant: '',
  delivre_at: new Date().toISOString().split('T')[0],
  signature: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Dimensions de référence (taille RÉELLE et FIXE du diplôme, en px) ─────────
// On ne fait plus jamais dépendre le rendu de %, aspect-ratio ou cqw : ces CSS
// modernes ne sont pas fiables avec html2canvas (c'est la cause du décalage à
// l'export PNG). DiplomaPreview se rend toujours en dur à 1280x853px, point.
// La responsivité à l'écran est gérée par un wrapper séparé (scale JS), voir
// ResponsiveDiplomaPreview plus bas — jamais utilisé pour l'export/impression.
const BG_W = 1280
const BG_H = 853

// ── Style d'un champ ──────────────────────────────────────────────────────────
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
  // Hauteur de ligne FIXE et explicite (jamais déduite du contenu / de la police) :
  // c'est ce qui rend le centrage vertical fiable même via html2canvas, qui ne
  // calcule pas toujours la hauteur naturelle du texte exactement comme un vrai
  // navigateur (source du décalage vertical constaté à l'export PNG).
  const lineHeight = Math.round(box.fontSize * 1.2)
  const top = box.anchor === 'bottom' ? box.top - lineHeight : box.top - lineHeight

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

// ── Diplôme visuel ─────────────────────────────────────────────────────────────
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
      {/* Nom de l'élève */}
      <Field box={{ top: 419, left: 625, fontSize: 30, cursive: true, italic: true, color: '#1d3f7a' }}>
        {form.nom_eleve_diplome}
      </Field>

      {/* Matière / session */}
      <Field box={{ top: 483, left: 639, fontSize: 24, cursive: true, italic: true, color: '#1d3f7a' }}>
        {form.matiere}
      </Field>

      {/* Note orale */}
      <Field box={{ top: 545, left: 440, width: 137, align: 'center', fontSize: 15, weight: 600 }}>
        {form.note_orale}
      </Field>

      {/* Note écrite */}
      <Field box={{ top: 545, left: 818, width: 71, align: 'center', fontSize: 14, weight: 600 }}>
        {form.note_ecrite}
      </Field>

      {/* Appréciation */}
      {apprLines.map((line, i) => (
        <Field
          key={i}
          box={i === 0
            ? { top: 590, left: 460, width: 515, align: 'left', fontSize: 16 }
            : { top: 630, left: 355, width: 610, align: 'left', fontSize: 16 }}
        >
          {line}
        </Field>
      ))}

      {/* Nom de l'enseignante */}
      {ensLines.map((line, i) => (
        <Field
          key={i}
          box={{ top: 732 + i * 17, left: 425, width: 130, align: 'center', fontSize: 13, weight: 600 }}
        >
          {line}
        </Field>
      ))}

      {/* ✅ SIGNATURE de l'enseignant(e) — image positionnée sous le nom */}
      {form.signature && (
        <div
          className="absolute"
          style={{
            top: `${755}px`,
            left: `${900}px`,
            width: `${200}px`,
            height: `${65}px`,
            transform: 'translate(-50%, 0)',
          }}
        >
          <img
            src={form.signature}
            alt="Signature"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              mixBlendMode: 'multiply', // fond transparent → se fond sur le diplôme
            }}
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* Date : jour / mois / année */}
      <Field box={{ top: 725, left: 840, width: 48, align: 'center', fontSize: 15 }}>
        {day}
      </Field>
      <Field box={{ top: 725, left: 905, width: 48, align: 'center', fontSize: 15 }}>
        {month}
      </Field>
      <Field box={{ top: 725, left: 970, width: 62, align: 'center', fontSize: 15 }}>
        {year}
      </Field>
    </div>
  )
}

// ── Wrapper responsive pour l'aperçu écran UNIQUEMENT ─────────────────────────
// DiplomaPreview est fixe à 1280x853px (voir plus haut). Pour qu'il s'adapte à
// la largeur de la carte d'aperçu (petit écran, mobile…), on le réduit avec un
// transform: scale() calculé en JS selon la largeur réelle du conteneur.
// ⚠️ Ce wrapper ne doit JAMAIS être utilisé pour l'export PNG ou l'impression :
// html2canvas et l'impression doivent toujours capturer DiplomaPreview nu, à sa
// taille native 1280x853, sinon le décalage revient.
function ResponsiveDiplomaPreview({ form }: { form: FormState }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  React.useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const update = () => setScale(el.offsetWidth / BG_W)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: BG_H * scale, overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <DiplomaPreview form={form} />
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function GenerateurDiplome() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null) // ✅ ref pour l'export HD

  const { data: classesData, isLoading: loadingClasses } = useGetClassesQuery({})
  const classes = classesData?.results ?? []

  const { data: elevesData = [], isLoading: loadingEleves } = useGetElevesByClasseQuery(
    form.classe_id,
    { skip: !form.classe_id }
  )

  const [createDiplome] = useCreateDiplomeMutation()

  function handleChange(key: keyof FormState, value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'eleve_id') {
        const eleve = elevesData.find((e: any) => e.id === value)
        if (eleve) next.nom_eleve_diplome = eleve.display_name ?? eleve.email ?? ''
      }
      if (key === 'classe_id') {
        next.eleve_id = ''
        next.nom_eleve_diplome = ''
      }
      return next
    })
  }

  // ✅ Génère le PNG du diplôme en 1280px et le retourne en Blob
  const generateDiplomaImage = useCallback(async (): Promise<Blob> => {
    const el = exportRef.current
    if (!el) throw new Error('Export ref not found')

    // Forcer la taille réelle pour un export net
    const originalWidth = el.style.width
    el.style.width = '1280px'

    // Attendre que le background image soit chargé
    await new Promise(r => setTimeout(r, 200))

    const canvas = await html2canvas(el, {
      scale: 2,               // ×2 pour la qualité (2560px réel)
      useCORS: true,          // ✅ important si l'image est servie par un autre domaine
      allowTaint: true,
      backgroundColor: null,  // transparent
      logging: false,
      width: 1280,
      height: 853,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1280,
      windowHeight: 853,
    })

    el.style.width = originalWidth

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png',
        1.0
      )
    })
  }, [])

  async function handleSubmit() {
    setSubmitted(true)
    if (!form.classe_id || !form.eleve_id || !form.matiere || !form.nom_eleve_diplome) return

    setSaving(true)
    try {
      // 1) Générer l'image PNG du diplôme (avec signature)
      const imageBlob = await generateDiplomaImage()

      // 2) Construire le FormData
      const formData = new FormData()
      formData.append('classe', form.classe_id)
      formData.append('eleve', form.eleve_id)
      formData.append('nom_eleve_diplome', form.nom_eleve_diplome)
      formData.append('matiere', form.matiere)
      formData.append('note_orale', form.note_orale)
      formData.append('note_ecrite', form.note_ecrite)
      formData.append('appreciation', form.appreciation)
      formData.append('delivre_at', form.delivre_at)
      // ✅ Le fichier image
      formData.append(
        'image_diplome',
        imageBlob,
        `diplome-${form.nom_eleve_diplome}-${form.matiere}.png`
      )

      // 3) Envoyer au backend
      await createDiplome(formData).unwrap()

      setSuccess(true)
      setSubmitted(false)
      setForm(INITIAL_FORM)
    } catch (e) {
      console.error('Erreur sauvegarde diplôme:', e)
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const el = document.getElementById('diploma-print-target')
    if (!el) return
    const originalBody = document.body.innerHTML
    document.body.innerHTML = `<style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: landscape; margin: 0; }
      body { margin: 0; }
    </style>${el.innerHTML}`
    window.print()
    document.body.innerHTML = originalBody
    window.location.reload()
  }

  const isFormValid = form.classe_id && form.eleve_id && form.matiere && form.nom_eleve_diplome

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">🎓 Générer un Diplôme</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Remplissez le formulaire, signez, puis enregistrez l'attestation
          </p>
        </div>
      </div>

      {/* Succès */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <span>✅</span>
            <span>Diplôme enregistré avec succès.</span>
          </div>
          <button
            onClick={() => setSuccess(false)}
            className="text-emerald-500 hover:text-emerald-700 text-lg"
          >✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Formulaire (2 cols) ── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Informations du diplôme
            </p>

            {/* Classe */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Classe <span className="text-red-500">*</span>
              </label>
              <select
                value={form.classe_id}
                onChange={e => handleChange('classe_id', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white ${submitted && !form.classe_id ? 'border-red-400' : 'border-neutral-300'}`}
              >
                <option value="">Sélectionner une classe</option>
                {loadingClasses ? (
                  <option disabled>Chargement…</option>
                ) : (
                  (Array.isArray(classes) ? classes : []).map((c: ClasseOption) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}{c.programme ? ` (${c.programme})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Élève */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Élève <span className="text-red-500">*</span>
              </label>
              <select
                value={form.eleve_id}
                onChange={e => handleChange('eleve_id', e.target.value)}
                disabled={!form.classe_id}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white disabled:opacity-50 ${submitted && !form.eleve_id ? 'border-red-400' : 'border-neutral-300'}`}
              >
                <option value="">Sélectionner un élève</option>
                {loadingEleves ? (
                  <option disabled>Chargement…</option>
                ) : (
                  (Array.isArray(elevesData) ? elevesData : []).map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.display_name ?? e.email}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Nom affiché sur diplôme */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Nom affiché sur le diplôme <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nom_eleve_diplome}
                onChange={e => handleChange('nom_eleve_diplome', e.target.value)}
                placeholder="Nom et Prénom complets"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none ${submitted && !form.nom_eleve_diplome ? 'border-red-400' : 'border-neutral-300'}`}
              />
            </div>

            {/* Matière */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Matière / Session <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.matiere}
                onChange={e => handleChange('matiere', e.target.value)}
                placeholder="Ex : Récitation du Coran, Fiqh…"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none ${submitted && !form.matiere ? 'border-red-400' : 'border-neutral-300'}`}
              />
            </div>

            {/* Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Note orale (/ 20)
                </label>
                <input
                  type="text"
                  value={form.note_orale}
                  onChange={e => handleChange('note_orale', e.target.value)}
                  placeholder="Ex : 17"
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Note écrite (/ 20)
                </label>
                <input
                  type="text"
                  value={form.note_ecrite}
                  onChange={e => handleChange('note_ecrite', e.target.value)}
                  placeholder="Ex : 15"
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
            </div>

            {/* Appréciation */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Appréciation
              </label>
              <textarea
                rows={2}
                value={form.appreciation}
                onChange={e => handleChange('appreciation', e.target.value)}
                placeholder="Mention ou commentaire libre… (2 lignes max)"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none resize-none"
              />
            </div>

            {/* Nom de l'enseignant(e) */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Nom de l'enseignant(e)
              </label>
              <input
                type="text"
                value={form.nom_enseignant}
                onChange={e => handleChange('nom_enseignant', e.target.value)}
                placeholder="Ex : Mme Fatima"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Date de délivrance
              </label>
              <input
                type="date"
                value={form.delivre_at}
                onChange={e => handleChange('delivre_at', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>

            {/* ✅ SIGNATURE */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Signature de l'enseignant(e)
              </label>
              <SignaturePad
                onChange={(dataUrl) => handleChange('signature', dataUrl)}
                width={380}
                height={130}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              🖨️ Imprimer
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>

          {submitted && !isFormValid && (
            <p className="text-xs text-red-500 text-center">
              Veuillez remplir tous les champs obligatoires (*).
            </p>
          )}
        </div>

        {/* ── Aperçu diplôme (3 cols) ── */}
        <div className="xl:col-span-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Aperçu en temps réel
          </p>
          <div className="bg-neutral-100 rounded-xl p-4 overflow-auto">
            {/* Aperçu responsive */}
            <div ref={previewRef} style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
              <ResponsiveDiplomaPreview form={form} />
            </div>

            {/* ✅ Version taille réelle cachée — utilisée pour l'export PNG ET l'impression */}
            {/* ⚠️ IMPORTANT pour html2canvas :
                - opacity: 0 → html2canvas capture un rendu VIDE (transparent), à éviter.
                - left: -99999px → décalage trop extrême, fausse les calculs de coordonnées.
                On garde donc l'élément bien opaque/visible pour html2canvas, juste déplacé
                d'un offset raisonnable pour qu'il soit hors du champ visible de l'utilisateur. */}
            <div
              id="diploma-print-target"
              ref={exportRef}
              style={{
                position: 'fixed',
                top: 0,
                left: '-3000px',
                pointerEvents: 'none',
              }}
            >
              <DiplomaPreview form={form} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import { Fragment, useState, useEffect, useRef } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetFacturesEmisesQuery,
  useGetProfFacturePresencesQuery,
  useCreateFactureMutation,
  usePreviewFactureMutation,
  useSendFactureReminderMutation,
  useLazyGetFactureParticipantsQuery,
  useUpdateParticipantsPaymentMutation,
  useGetFactureEleveByFactureQuery,
  useConfirmerFactureEleveMutation,
  useConfirmerToutFactureEleveMutation,
} from '../../store/apiSlice'
import {
  Facture,
  FacturePreview,
  FactureLigne,
  FactureParticipant,
  ParticipantsPaymentData,
  ParticipantPaymentInput,
  FactureElevePayeItem,
  TypeCours,
} from '../../types'
import SubmitFactureModal from '../../components/shared/Submitfacturemodal'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PresenceFacturable {
  id: string
  created_at: string
  classe: string
  classe_nom: string
  seance: string
  seance_titre: string
  nb_participants: number
  nb_inscrits: number
}

// ── Helpers ──────────────────────────────────────────────────

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMMM yyyy', { locale: fr })
}

function fmtEuros(val: string | number | null | undefined): string {
  if (val == null) return '—'
  return `${parseFloat(String(val)).toFixed(2)} €`
}

// ✅ Label lisible pour le type de cours
function labelTypeCours(type: TypeCours): string {
  const map: Record<TypeCours, string> = {
    solo:              'Solo',
    duo:               'Duo',
    trio:              'Trio',
    groupe:            'Groupe',
    alphabetisation:   'Alphabétisation',
    fluidification:    'Fluidification',
    groupe_special_3e: 'Groupe 3€',
    gratuit:           '100% Gratuit',
    '':                '—',
  }
  return map[type] ?? type
}

// ✅ Badge coloré pour le type de cours
function TypeCoursBadge({ type }: { type: TypeCours }) {
  const colorMap: Record<TypeCours, string> = {
    solo:              'bg-blue-100 text-blue-700',
    duo:               'bg-purple-100 text-purple-700',
    trio:              'bg-indigo-100 text-indigo-700',
    groupe:            'bg-teal-100 text-teal-700',
    alphabetisation:   'bg-orange-100 text-orange-700',
    fluidification:    'bg-orange-100 text-orange-700',
    groupe_special_3e: 'bg-yellow-100 text-yellow-700',
    gratuit:           'bg-gray-100 text-gray-500',
    '':                'bg-gray-100 text-gray-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorMap[type] ?? 'bg-gray-100 text-gray-500'}`}>
      {labelTypeCours(type)}
    </span>
  )
}

// ── Composant principal ───────────────────────────────────────
export default function ProfFactures() {
  const { user } = useAppSelector(selectAuth)

  const [showGenerate, setShowGenerate] = useState(false)
  const [preview, setPreview] = useState<FacturePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [showParticipantsDropdown, setShowParticipantsDropdown] = useState(false)
  const [participants, setParticipants] = useState<FactureParticipant[]>([])
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})
  const [allAmountsFilled, setAllAmountsFilled] = useState(true)
  const [participantsPaymentData, setParticipantsPaymentData] = useState<ParticipantsPaymentData | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    classe_id: '',
    date_debut: '',
    date_fin: '',
    lien_paypal: '',
    rib: '',
  })

  // ── Queries ──────────────────────────────────────────────────
  const {
    data: facturesData,
    isLoading: facturesLoading,
    refetch,
  } = useGetFacturesEmisesQuery({ page: 1 }, { skip: user?.role !== 'professeur' })
  const factures: Facture[] = facturesData?.results ?? []

  const {
    data: presences = [],
    isLoading: presencesLoading,
  } = useGetProfFacturePresencesQuery()

  const [triggerGetParticipants, { isLoading: participantsLoading }] =
    useLazyGetFactureParticipantsQuery()

  // ── Mutations ────────────────────────────────────────────────
  const [createFacture, { isLoading: creating }] = useCreateFactureMutation()
  const [previewFacture, { isLoading: previewing }] = usePreviewFactureMutation()
  const [sendReminder] = useSendFactureReminderMutation()
  const [updateParticipantsPayment] = useUpdateParticipantsPaymentMutation()

  // ── Classe unique pour le select ─────────────────────────────
  const classesUniques = [
    ...new Map(
      presences.map((p: PresenceFacturable) => [p.classe, p])
    ).values(),
  ] as PresenceFacturable[]

  const lignesFiltrees = presences.filter((p: PresenceFacturable) => {
    if (!form.classe_id || !form.date_debut || !form.date_fin) return true
    if (p.classe !== form.classe_id) return false
    const d = new Date(p.created_at)
    return d >= new Date(form.date_debut) && d <= new Date(form.date_fin)
  })

  const [factureASoumettre, setFactureASoumettre] = useState<Facture | null>(null)
  const [expandedFactureId, setExpandedFactureId] = useState<string | null>(null)
  const [confirmingAll, setConfirmingAll] = useState<Record<string, boolean>>({})
  const [confirmingSingle, setConfirmingSingle] = useState<Record<string, boolean>>({})

  const {
    data: factureEleveData,
    isLoading: factureEleveLoading,
  } = useGetFactureEleveByFactureQuery(
    expandedFactureId ?? '',
    { skip: !expandedFactureId }
  )

  const [confirmerFactureEleve] = useConfirmerFactureEleveMutation()
  const [confirmerToutFactureEleve] = useConfirmerToutFactureEleveMutation()

  useEffect(() => {
    const values = Object.values(paymentAmounts)
    if (values.length === 0) { setAllAmountsFilled(true); return }
    const hasAnyFilled = values.some(v => v !== '' && v != null)
    const allFilled = values.every(v => v !== '' && v != null)
    setAllAmountsFilled(hasAnyFilled ? allFilled : true)
  }, [paymentAmounts])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowParticipantsDropdown(false)
      }
    }
    if (showParticipantsDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showParticipantsDropdown])

  // ── Aperçu ───────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!form.classe_id || !form.date_debut || !form.date_fin) {
      setPreviewError('Veuillez renseigner la classe et les deux dates.')
      return
    }
    setPreviewError(null)
    try {
      const result = await previewFacture({
        classe_id: form.classe_id,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
      }).unwrap()
      setPreview(result)
      setParticipants([])
      setPaymentAmounts({})
      setParticipantsPaymentData(null)
      setShowParticipantsDropdown(false)
    } catch (err: any) {
      setPreviewError(err?.data?.error ?? "Erreur lors de l'aperçu")
      setPreview(null)
    }
  }

  const openParticipantsDropdown = async () => {
    if (!preview) { alert("Veuillez d'abord générer un aperçu"); return }
    try {
      const result = await triggerGetParticipants({
        classe_id: form.classe_id,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
      }).unwrap()
      setParticipants(result)
      const initialAmounts: Record<string, string> = {}
      result.forEach((p: FactureParticipant) => {
        initialAmounts[p.absence_prof_id] = p.montant_a_paye?.toString() ?? ''
      })
      setPaymentAmounts(initialAmounts)
      setShowParticipantsDropdown(true)
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur lors du chargement des participants')
    }
  }

  const handleAmountChange = (absence_prof_id: string, value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return
    setPaymentAmounts(prev => ({ ...prev, [absence_prof_id]: value }))
  }

  const handleSaveParticipantsPayment = () => {
    if (!allAmountsFilled) {
      alert('⚠️ Si vous saisissez un montant pour un élève, veuillez remplir tous les champs (mettez 0 si gratuit)')
      return
    }
    const participantsPayload: ParticipantPaymentInput[] = participants.map(p => ({
      absence_prof_id: p.absence_prof_id,
      montant_a_paye: paymentAmounts[p.absence_prof_id] === ''
        ? null
        : parseFloat(paymentAmounts[p.absence_prof_id]),
    }))
    setParticipantsPaymentData({ participants: participantsPayload, payeur_id: user?.id ?? '' })
    setShowParticipantsDropdown(false)
  }

  // ── Soumission ────────────────────────────────────────────────
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const factureResult = await createFacture({
        classe_id: form.classe_id,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        lien_paypal: form.lien_paypal,
        rib: form.rib,
      }).unwrap()

      const facture_id = factureResult.id

      if (participantsPaymentData?.participants.length) {
        const totalMontant = parseFloat(preview?.montant_total ?? '0')
        const nbParticipants = participantsPaymentData.participants.length
        const defaultAmount = nbParticipants > 0 ? totalMontant / nbParticipants : 0

        const participantsWithAmounts = participantsPaymentData.participants.map(p => ({
          absence_prof_id: p.absence_prof_id,
          montant_a_paye: p.montant_a_paye !== null && p.montant_a_paye !== undefined
            ? p.montant_a_paye
            : defaultAmount,
        }))

        await updateParticipantsPayment({
          facture_id,
          payeur_id: participantsPaymentData.payeur_id,
          participants: participantsWithAmounts,
        }).unwrap()
      }

      setShowGenerate(false)
      setPreview(null)
      setParticipantsPaymentData(null)
      setForm({ classe_id: '', date_debut: '', date_fin: '', lien_paypal: '', rib: '' })
      refetch()
      alert('✅ Facture générée avec succès')
    } catch (err: any) {
      console.error(err)
      alert(err?.data?.error ?? 'Erreur lors de la génération')
    }
  }

  const handleReminder = async (factureId: string) => {
    try {
      await sendReminder(factureId).unwrap()
      alert('🔔 Rappel envoyé')
    } catch {
      alert("Erreur lors de l'envoi du rappel")
    }
  }

  const handleConfirmSinglePayment = async (factureEleveId: string) => {
    setConfirmingSingle(prev => ({ ...prev, [factureEleveId]: true }))
    try {
      await confirmerFactureEleve(factureEleveId).unwrap()
      alert('✅ Paiement confirmé')
      refetch()
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur lors de la confirmation')
    } finally {
      setConfirmingSingle(prev => ({ ...prev, [factureEleveId]: false }))
    }
  }

  const handleConfirmAllPayments = async (factureId: string) => {
    setConfirmingAll(prev => ({ ...prev, [factureId]: true }))
    try {
      const result = await confirmerToutFactureEleve({ facture_id: factureId }).unwrap()
      alert(`✅ ${result.count} paiement(s) confirmé(s)`)
      refetch()
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur lors de la confirmation globale')
    } finally {
      setConfirmingAll(prev => ({ ...prev, [factureId]: false }))
    }
  }

  const toggleFactureExpansion = (factureId: string) => {
    setExpandedFactureId(prev => prev === factureId ? null : factureId)
  }

  const closeModal = () => {
    setShowGenerate(false)
    setPreview(null)
    setPreviewError(null)
    setParticipantsPaymentData(null)
    setShowParticipantsDropdown(false)
    setForm({ classe_id: '', date_debut: '', date_fin: '', lien_paypal: '', rib: '' })
  }

  // ── Composant indicateur ──────────────────────────────────────
  function BlinkingIndicator({ count }: { count: number }) {
    if (count <= 0) return null
    return (
      <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-orange-100 border border-orange-300 rounded-full animate-pulse">
        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
        <span className="text-xs font-medium text-orange-700">{count} à confirmer</span>
      </span>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">💰 Mes Factures</h1>
        <button onClick={() => setShowGenerate(true)} className="btn-primary">
          ➕ Générer une facture
        </button>
      </div>

      {/* ── Séances réalisées ──────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">
          📋 Séances réalisées (éligibles à facturation)
        </h2>
        {presencesLoading ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  {['Date séance', 'Classe', 'Participants', 'Nb inscrits'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {presences.map((p: PresenceFacturable) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{p.classe_nom}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.nb_participants}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-neutral-100 text-neutral-700 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.nb_inscrits}
                      </span>
                    </td>
                  </tr>
                ))}
                {presences.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-neutral-500 text-sm">
                      Aucune séance validée pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Factures émises ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">🧾 Factures émises</h2>
        {facturesLoading ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  {['Classe', 'Période', 'Heures', 'Total élèves', 'Part prof', 'Part direction', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {factures.map((f: Facture) => (
                  <Fragment key={f.id}>
                    {/* Ligne principale */}
                    <tr
                      className={`hover:bg-neutral-50 cursor-pointer ${expandedFactureId === f.id ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleFactureExpansion(f.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900 flex items-center">
                          {f.classe_nom}
                          <BlinkingIndicator count={f.nb_paiements_a_confirmer ?? 0} />
                        </p>
                        <p className="text-xs text-neutral-500">{f.nb_eleves_inscrits} inscrit(s)</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                        {fmtDate(f.date_debut)} → {fmtDate(f.date_fin)}
                      </td>
                      <td className="px-4 py-3 text-sm">{f.honoraire}h</td>

                      {/* ✅ Total collecté auprès des élèves */}
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {fmtEuros(f.montant_total)}
                      </td>

                      {/* ✅ Part prof */}
                      <td className="px-4 py-3 font-medium text-success-700">
                        {fmtEuros(f.part_prof)}
                      </td>

                      {/* ✅ Part direction */}
                      <td className="px-4 py-3 font-medium text-orange-700">
                        {fmtEuros(f.part_direction)}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          f.statut === 'payee'   ? 'bg-success-100 text-success-700' :
                          f.statut === 'envoyee' ? 'bg-warning-100 text-warning-700' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {f.statut === 'payee' ? '✅ Payée' : f.statut === 'envoyee' ? '⏳ En attente' : '📝 Brouillon'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {f.statut === 'brouillon' && (
                            <button
                              onClick={() => setFactureASoumettre(f)}
                              className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 font-medium transition"
                            >
                              📤 Soumettre
                            </button>
                          )}
                          {f.statut === 'envoyee' && (
                            <button
                              onClick={() => handleReminder(f.id)}
                              className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded hover:bg-warning-200"
                            >
                              🔔 Rappel
                            </button>
                          )}
                          {(f.nb_paiements_a_confirmer ?? 0) > 0 && (
                            <button
                              onClick={() => toggleFactureExpansion(f.id)}
                              className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 flex items-center gap-1"
                            >
                              👁️ {expandedFactureId === f.id ? 'Masquer' : 'Voir'}
                            </button>
                          )}
                          <button
                            className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-200"
                            onClick={(e) => { e.stopPropagation() }}
                          >
                            📄 Voir
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Ligne expandée : paiements élèves */}
                    {expandedFactureId === f.id && (
                      <tr>
                        <td colSpan={8} className="px-4 py-0 bg-primary-50/50">
                          <div className="p-4 border-t border-primary-200">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-semibold text-neutral-800">
                                💰 Paiements élèves en attente de confirmation
                              </h4>
                              {(f.nb_paiements_a_confirmer ?? 0) > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleConfirmAllPayments(f.id) }}
                                  disabled={confirmingAll[f.id]}
                                  className="text-xs bg-success-600 text-white px-3 py-1.5 rounded hover:bg-success-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {confirmingAll[f.id] ? '⏳...' : '✅ Confirmer tout'}
                                </button>
                              )}
                            </div>

                            {/* ✅ Récapitulatif financier de la facture */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="bg-white rounded-lg p-3 border border-neutral-200 text-center">
                                <p className="text-xs text-neutral-500 mb-1">Total élèves</p>
                                <p className="font-semibold text-neutral-900">{fmtEuros(f.montant_total)}</p>
                              </div>
                              <div className="bg-success-50 rounded-lg p-3 border border-success-200 text-center">
                                <p className="text-xs text-success-600 mb-1">Votre part (prof)</p>
                                <p className="font-semibold text-success-700">{fmtEuros(f.part_prof)}</p>
                              </div>
                              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
                                <p className="text-xs text-orange-600 mb-1">Part direction</p>
                                <p className="font-semibold text-orange-700">{fmtEuros(f.part_direction)}</p>
                              </div>
                            </div>

                            {factureEleveLoading ? (
                              <p className="text-sm text-neutral-500">Chargement des paiements…</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm divide-y divide-neutral-200">
                                  <thead className="bg-neutral-100">
                                    <tr>
                                      {['Élève', 'Email', 'Montant dû', 'Payé', 'Statut', 'Action'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100 bg-white">
                                    {(factureEleveData ?? []).map((fe: FactureElevePayeItem) => (
                                      <tr key={fe.id} className="hover:bg-neutral-50">
                                        <td className="px-3 py-2 font-medium text-neutral-900">{fe.eleve_nom}</td>
                                        <td className="px-3 py-2 text-xs text-neutral-500">{fe.eleve_email}</td>
                                        <td className="px-3 py-2 text-right font-mono">{fmtEuros(fe.montant_a_payer)}</td>
                                        <td className="px-3 py-2 text-right font-mono text-success-700">{fmtEuros(fe.montant_payer)}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            fe.statut === 'confirmee' ? 'bg-success-100 text-success-700' :
                                            fe.statut === 'payee'     ? 'bg-orange-100 text-orange-700' :
                                            'bg-neutral-100 text-neutral-700'
                                          }`}>
                                            {fe.statut === 'confirmee' ? '✅ Confirmé' :
                                             fe.statut === 'payee'     ? '⏳ À confirmer' : '📝 Émis'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          {fe.statut === 'payee' && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleConfirmSinglePayment(fe.id) }}
                                              disabled={confirmingSingle[fe.id]}
                                              className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 disabled:opacity-50"
                                            >
                                              {confirmingSingle[fe.id] ? '⏳' : '✓'}
                                            </button>
                                          )}
                                          {fe.statut === 'confirmee' && (
                                            <span className="text-xs text-success-600">✓</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    {(factureEleveData?.length ?? 0) === 0 && (
                                      <tr>
                                        <td colSpan={6} className="px-3 py-4 text-center text-neutral-500 text-sm">
                                          Aucun paiement en attente
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="mt-3 text-xs text-neutral-500 flex items-center gap-2">
                              <span>📊</span>
                              <span>
                                {f.nb_paiements_confirmes ?? 0}/{f.nb_paiements_total ?? 0} paiements confirmés
                                {(f.nb_paiements_confirmes === f.nb_paiements_total) && (f.nb_paiements_total ?? 0) > 0 && (
                                  <span className="text-success-600 font-medium ml-1">→ Facture marquée comme payée</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}

                {factures.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500 text-sm">
                      Aucune facture générée pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {factureASoumettre && (
              <SubmitFactureModal
                facture={factureASoumettre}
                onClose={() => setFactureASoumettre(null)}
                onSuccess={() => {
                  setFactureASoumettre(null)
                  refetch()
                  alert('✅ Facture soumise avec succès !')
                }}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Modal génération ─────────────────────────────────── */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <form
            onSubmit={handleGenerate}
            className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl my-8"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">💰 Générer une facture</h3>

            <div className="space-y-4">
              {/* Classe */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Classe *</label>
                <select
                  value={form.classe_id}
                  onChange={(e) => {
                    setForm({ ...form, classe_id: e.target.value })
                    setPreview(null)
                    setParticipantsPaymentData(null)
                  }}
                  className="form-input"
                  required
                >
                  <option value="">Sélectionner une classe…</option>
                  {classesUniques.map((p) => (
                    <option key={p.classe} value={p.classe}>{p.classe_nom}</option>
                  ))}
                </select>
              </div>

              {/* Période */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">De *</label>
                  <input
                    type="date"
                    value={form.date_debut}
                    onChange={(e) => { setForm({ ...form, date_debut: e.target.value }); setPreview(null); setParticipantsPaymentData(null) }}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">À *</label>
                  <input
                    type="date"
                    value={form.date_fin}
                    min={form.date_debut}
                    onChange={(e) => { setForm({ ...form, date_fin: e.target.value }); setPreview(null); setParticipantsPaymentData(null) }}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {/* Bouton aperçu */}
              <div>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewing || !form.classe_id || !form.date_debut || !form.date_fin}
                  className="text-sm px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 disabled:opacity-50"
                >
                  {previewing ? '⏳ Calcul…' : '🔍 Aperçu des séances & montants'}
                </button>
              </div>

              {/* Erreur aperçu */}
              {previewError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {previewError}
                </p>
              )}

              {/* ✅ Résumé aperçu enrichi */}
              {preview && (
                <div className="border border-primary-200 bg-primary-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-primary-900">📊 Aperçu de la facture</h4>
                    {/* Badge type de cours */}
                    {preview.type_cours && <TypeCoursBadge type={preview.type_cours} />}
                  </div>

                  {/* ✅ 3 blocs financiers bien distincts */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-primary-100 text-center">
                      <p className="text-xs text-neutral-500 mb-1">Total élèves paient</p>
                      <p className="font-bold text-neutral-900">{fmtEuros(preview.total_collecte)}</p>
                    </div>
                    <div className="bg-success-50 rounded-lg p-3 border border-success-200 text-center">
                      <p className="text-xs text-success-600 mb-1">Votre part (prof)</p>
                      <p className="font-bold text-success-700">{fmtEuros(preview.part_prof)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
                      <p className="text-xs text-orange-600 mb-1">À reverser direction</p>
                      <p className="font-bold text-orange-700">{fmtEuros(preview.part_direction)}</p>
                    </div>
                  </div>

                  {/* Métriques secondaires */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Séances',       value: preview.lignes.length },
                      { label: 'Total heures',  value: `${parseFloat(preview.total_heures).toFixed(2)}h` },
                      { label: 'Élèves inscrits', value: preview.nb_inscrits },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-lg p-2 text-center border border-primary-100">
                        <p className="text-xs text-neutral-500">{label}</p>
                        <p className="font-semibold text-neutral-900 text-sm">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ✅ Avertissement cours gratuit */}
                  {preview.type_cours === 'gratuit' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
                      🎁 Cours 100% gratuit — aucun montant ne sera facturé aux élèves ni reversé.
                    </div>
                  )}

                  {/* ✅ Info alphabétisation / fluidification */}
                  {(preview.type_cours === 'alphabetisation' || preview.type_cours === 'fluidification') && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                      📌 Programme spécial — le prof garde la totalité, rien n'est reversé à la direction.
                    </div>
                  )}

                  {/* Dropdown participants (inchangé) */}
                  <div className="relative inline-block" ref={dropdownRef}>
                    {showParticipantsDropdown && (
                      <div className="absolute z-50 mt-2 w-80 bg-white rounded-lg shadow-xl border border-neutral-200 p-4 right-0">
                        <h5 className="text-sm font-semibold text-neutral-900 mb-2">💰 Montant par élève</h5>
                        {!allAmountsFilled && (
                          <p className="text-xs text-warning-700 bg-warning-50 border border-warning-200 rounded px-2 py-1 mb-2">
                            ⚠️ Remplissez tous les champs (0 si gratuit)
                          </p>
                        )}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {participantsLoading ? (
                            <p className="text-xs text-neutral-500">Chargement…</p>
                          ) : participants.map(p => (
                            <div key={p.absence_prof_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-neutral-100 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-neutral-900 truncate">{p.eleve_nom}</p>
                                {p.eleve_email && <p className="text-xs text-neutral-500 truncate">{p.eleve_email}</p>}
                              </div>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">€</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  value={paymentAmounts[p.absence_prof_id] ?? ''}
                                  onChange={(e) => handleAmountChange(p.absence_prof_id, e.target.value)}
                                  className="w-24 pl-5 pr-2 text-right text-sm py-1.5 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {preview && participants.length > 0 && (
                          <p className="text-xs text-neutral-500 mt-2 pt-2 border-t border-neutral-100">
                            💡 Par défaut : <strong>{(parseFloat(preview.montant_total) / participants.length).toFixed(2)} €</strong> / élève
                          </p>
                        )}
                        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-neutral-100">
                          <button type="button" onClick={() => setShowParticipantsDropdown(false)} className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded">
                            Fermer
                          </button>
                          <button type="button" onClick={handleSaveParticipantsPayment} disabled={!allAmountsFilled} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50">
                            ✅ Valider
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ✅ Tableau des lignes enrichi */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs divide-y divide-primary-100">
                      <thead>
                        <tr className="text-primary-700">
                          <th className="py-1 pr-3 text-left font-semibold">Date séance</th>
                          <th className="py-1 pr-3 text-left font-semibold">Connexion</th>
                          <th className="py-1 pr-3 text-left font-semibold">Déconnexion</th>
                          <th className="py-1 pr-3 text-right font-semibold">Durée</th>
                          <th className="py-1 pr-3 text-right font-semibold">Participants</th>
                          <th className="py-1 pr-3 text-right font-semibold">Tarif/h</th>
                          <th className="py-1 pr-3 text-right font-semibold">Total séance</th>
                          <th className="py-1 pr-3 text-right font-semibold">Part prof</th>
                          <th className="py-1 text-right font-semibold">Part dir.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-50">
                        {preview.lignes.map((l: FactureLigne) => (
                          <tr key={l.presence_id} className="text-neutral-700">
                            <td className="py-1 pr-3 whitespace-nowrap">{fmtDate(l.date_seance)}</td>
                            <td className="py-1 pr-3">{l.heure_connexion_prof ?? '—'}</td>
                            <td className="py-1 pr-3">{l.heure_deconnexion ?? '—'}</td>
                            <td className="py-1 pr-3 text-right font-mono">{parseFloat(l.duree_heures).toFixed(2)}h</td>
                            <td className="py-1 pr-3 text-right">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                                {l.nb_participants}
                              </span>
                            </td>
                            <td className="py-1 pr-3 text-right font-mono">{fmtEuros(l.tarif_eleve_par_personne)}</td>
                            <td className="py-1 pr-3 text-right font-mono">{fmtEuros(l.total_collecte_seance)}</td>
                            <td className="py-1 pr-3 text-right font-mono text-success-700">{fmtEuros(l.part_prof_seance)}</td>
                            <td className="py-1 text-right font-mono text-orange-700">{fmtEuros(l.part_direction_seance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!preview && form.classe_id && form.date_debut && form.date_fin && lignesFiltrees.length > 0 && (
                <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                  💡 {lignesFiltrees.length} séance(s) dans cet intervalle. Cliquez sur « Aperçu » pour voir le détail.
                </p>
              )}

              {/* PayPal */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Lien PayPal (optionnel)</label>
                <input
                  type="url"
                  placeholder="https://paypal.me/…"
                  value={form.lien_paypal}
                  onChange={(e) => setForm({ ...form, lien_paypal: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* RIB */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">RIB / Coordonnées bancaires</label>
                <textarea
                  placeholder="IBAN, BIC, etc."
                  value={form.rib}
                  onChange={(e) => setForm({ ...form, rib: e.target.value })}
                  className="form-input"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition">
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating || !preview}
                className="btn-primary disabled:opacity-50"
                title={!preview ? "Faites d'abord un aperçu" : ''}
              >
                {creating ? '⏳ Génération…' : '✅ Générer et enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Info bas de page ─────────────────────────────────── */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <p className="text-sm text-primary-800">
          💡 <strong>Info :</strong> Seules les séances où l'élève <em>et</em> le professeur ont confirmé leur présence apparaissent ici.
          Les honoraires sont calculés sur la base de la durée réelle de connexion du professeur.
        </p>
      </div>
    </div>
  )
}
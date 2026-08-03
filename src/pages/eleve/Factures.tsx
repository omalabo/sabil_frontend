import { useState, useMemo } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetFacturesEleveQuery,
  usePayerFactureEleveMutation,
} from '../../store/apiSlice'
import type { FactureElevePayeItem } from '../../types/index'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy', { locale: fr }) }
  catch { return d }
}

function fmtMontant(v: number | null | undefined) {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('fr-FR')} €`
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgePaiement({ statut_paiement }: { statut_paiement: FactureElevePayeItem['statut_paiement'] }) {
  if (statut_paiement === 'paye') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      ✅ Payée
    </span>
  )
  if (statut_paiement === 'partiel') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      🔶 Partielle
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
      ⏳ À payer
    </span>
  )
}

function BadgeStatut({ statut }: { statut: FactureElevePayeItem['statut'] }) {
  if (statut === 'confirmee') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
      🎓 Confirmée
    </span>
  )
  if (statut === 'payee') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      ✅ Payée
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200">
      📄 Émise
    </span>
  )
}

// ─── Barre de progression paiement ───────────────────────────────────────────

function ProgressPaiement({ paye, total }: { paye: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paye / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-red-300'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500 whitespace-nowrap">{pct}%</span>
    </div>
  )
}

// ─── Modal paiement ───────────────────────────────────────────────────────────

interface PayModalProps {
  facture: FactureElevePayeItem
  onClose: () => void
}

function PayModal({ facture, onClose }: PayModalProps) {
  const reste = (facture.montant_a_payer || 0) - (facture.montant_payer || 0)
  const [montant, setMontant] = useState<string>(String(reste > 0 ? reste : 0))
  const [erreur, setErreur] = useState<string | null>(null)
  const [payer, { isLoading }] = usePayerFactureEleveMutation()

  async function handlePay() {
    const val = parseFloat(montant)
    if (isNaN(val) || val <= 0) { setErreur('Montant invalide.'); return }
    if (val > reste) { setErreur(`Le montant dépasse le reste dû (${reste} €).`); return }
    setErreur(null)
    try {
      await payer({ facture_eleve_id: facture.id, montant_payer: val }).unwrap()
      onClose()
    } catch (e: any) {
      setErreur(e?.data?.error ?? 'Erreur lors du paiement.')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-widest font-semibold mb-0.5">
                Enregistrer un paiement
              </p>
              <h3 className="font-bold text-lg">{facture.classe_nom}</h3>
              <p className="text-sm text-blue-200 mt-0.5">
                Séance du {fmt(facture.date_seance)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-lg"
            >×</button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">
          {/* Récap montants */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">À payer</p>
              <p className="font-bold text-neutral-800">{fmtMontant(facture.montant_a_payer)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-600 mb-1">Déjà payé</p>
              <p className="font-bold text-emerald-700">{fmtMontant(facture.montant_payer)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-600 mb-1">Reste</p>
              <p className="font-bold text-amber-700">{fmtMontant(reste)}</p>
            </div>
          </div>

          <ProgressPaiement paye={facture.montant_payer || 0} total={facture.montant_a_payer || 0} />

          {/* Input montant */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Montant versé (€)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-semibold">€</span>
              <input
                type="number"
                min="0.01"
                max={reste}
                step="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                placeholder={`Max ${reste} €`}
              />
            </div>
            {/* Raccourcis */}
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map(pct => {
                const val = Math.round((reste * pct) / 100)
                return (
                  <button
                    key={pct}
                    onClick={() => setMontant(String(val))}
                    className="flex-1 py-1 text-xs font-medium border border-neutral-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                  >
                    {pct}%
                  </button>
                )
              })}
            </div>
          </div>

          {erreur && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {erreur}
            </p>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handlePay}
              disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><span className="animate-spin">⏳</span> Envoi…</>
                : <>💳 Payer</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Onglets ──────────────────────────────────────────────────────────────────

type Onglet = 'a_payer' | 'paye' | 'confirmee'

const ONGLETS: { id: Onglet; label: string; icon: string }[] = [
  { id: 'a_payer',   label: 'À payer',    icon: '⏳' },
  { id: 'paye',      label: 'Payées',     icon: '✅' },
  { id: 'confirmee', label: 'Confirmées', icon: '🎓' },
]

// ─── Composant principal ──────────────────────────────────────────────────────

type SortKey = 'classe_nom' | 'date_seance' | 'montant_a_payer' | 'statut_paiement' | 'created_at'

export default function EleveFactures() {
  const { user } = useAppSelector(selectAuth)
  const isEleve = user?.role === 'eleve'

  const [page, setPage]         = useState(1)
  const [onglet, setOnglet]     = useState<Onglet>('a_payer')
  const [payModal, setPayModal] = useState<FactureElevePayeItem | null>(null)
  const [sort, setSort]         = useState<{ key: SortKey; asc: boolean }>({ key: 'date_seance', asc: false })

  const { data, isLoading, isFetching, refetch } = useGetFacturesEleveQuery(
    { page },
    { skip: !isEleve }
  )

  const factures: FactureElevePayeItem[] = data?.results ?? []

  // ── Filtrage par onglet ──────────────────────────────────
  const filtered = useMemo(() => {
    return factures.filter((f) => {
      if (onglet === 'confirmee') return f.statut === 'confirmee'
      if (onglet === 'paye')      return f.statut_paiement === 'paye' || f.statut_paiement === 'partiel'
      // a_payer : tout ce qui n'est ni confirmé ni entièrement payé
      return f.statut !== 'confirmee' && f.statut_paiement !== 'paye'
    })
  }, [factures, onglet])

  // ── Compteurs ────────────────────────────────────────────
  const counts = useMemo(() => ({
    a_payer:   factures.filter(f => f.statut !== 'confirmee' && f.statut_paiement !== 'paye').length,
    paye:      factures.filter(f => f.statut_paiement === 'paye' || f.statut_paiement === 'partiel').length,
    confirmee: factures.filter(f => f.statut === 'confirmee').length,
  }), [factures])

  // ── Tri ──────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true })
  }

  const displayed = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = String((a as any)[sort.key] ?? '')
      const vb = String((b as any)[sort.key] ?? '')
      return sort.asc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [filtered, sort])

  // ── Th helper ────────────────────────────────────────────
  function Th({ label, sortKey }: { label: string; sortKey?: SortKey }) {
    return (
      <th
        onClick={() => sortKey && toggleSort(sortKey)}
        className={`px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap ${
          sortKey ? 'cursor-pointer select-none hover:text-neutral-800' : ''
        }`}
      >
        {label}
        {sortKey && sort.key === sortKey && (
          <span className="ml-1 text-blue-500">{sort.asc ? '↑' : '↓'}</span>
        )}
      </th>
    )
  }

  // ── Totaux onglet courant ────────────────────────────────
  const totalAPayer  = displayed.reduce((acc, f) => acc + (f.montant_a_payer || 0), 0)
  const totalPaye    = displayed.reduce((acc, f) => acc + (f.montant_payer   || 0), 0)
  const totalRestant = totalAPayer - totalPaye

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl mx-auto px-2">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">💰 Mes Factures & Paiements</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data?.count ?? 0} séance{(data?.count ?? 0) !== 1 ? 's' : ''} facturée{(data?.count ?? 0) !== 1 ? 's' : ''}
            {isFetching && !isLoading && (
              <span className="ml-2 text-blue-400 text-xs animate-pulse">Actualisation…</span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start sm:self-center px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* ── Cartes récap globales ── */}
      {!isLoading && factures.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Total dû</p>
            <p className="text-xl font-bold text-neutral-800">
              {fmtMontant(factures.reduce((a, f) => a + (f.montant_a_payer || 0), 0))}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 shadow-sm">
            <p className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Total payé</p>
            <p className="text-xl font-bold text-emerald-700">
              {fmtMontant(factures.reduce((a, f) => a + (f.montant_payer || 0), 0))}
            </p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 shadow-sm">
            <p className="text-xs text-amber-600 uppercase tracking-wider mb-1">Reste à payer</p>
            <p className="text-xl font-bold text-amber-700">
              {fmtMontant(
                factures.reduce((a, f) => a + (f.montant_a_payer || 0), 0) -
                factures.reduce((a, f) => a + (f.montant_payer   || 0), 0)
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex gap-1 border-b border-neutral-200">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => { setOnglet(o.id); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-all -mb-px ${
              onglet === o.id
                ? 'bg-white border-neutral-200 text-blue-700 border-b-white'
                : 'bg-neutral-50 border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>{o.icon}</span>
            <span>{o.label}</span>
            {counts[o.id] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                onglet === o.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-neutral-200 text-neutral-600'
              }`}>
                {counts[o.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <Th label="Classe"         sortKey="classe_nom" />
                <Th label="Séance"         sortKey="date_seance" />
                <Th label="Professeur" />
                <Th label="À payer"        sortKey="montant_a_payer" />
                <Th label="Payé" />
                <Th label="Reste" />
                <Th label="Progression" />
                <Th label="Paiement"       sortKey="statut_paiement" />
                <Th label="Statut" />
                {onglet === 'a_payer' && <Th label="Action" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">

              {/* Loading */}
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center text-neutral-400 text-sm">
                    <span className="animate-spin inline-block mr-2">⏳</span>Chargement…
                  </td>
                </tr>
              )}

              {/* Lignes */}
              {!isLoading && displayed.map((f) => {
                const reste = (f.montant_a_payer || 0) - (f.montant_payer || 0)
                const peutPayer = onglet === 'a_payer' && f.statut !== 'confirmee'
                return (
                  <tr key={f.id} className="hover:bg-neutral-50 transition-colors">

                    {/* Classe */}
                    <td className="px-4 py-3 font-medium text-neutral-900 text-sm whitespace-nowrap">
                      {f.classe_nom || '—'}
                    </td>

                    {/* Date séance */}
                    <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                      {fmt(f.date_seance)}
                    </td>

                    {/* Prof */}
                    <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                      {f.prof_nom || '—'}
                    </td>

                    {/* Montant à payer */}
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-800 whitespace-nowrap">
                      {fmtMontant(f.montant_a_payer)}
                    </td>

                    {/* Montant payé */}
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 whitespace-nowrap">
                      {fmtMontant(f.montant_payer)}
                    </td>

                    {/* Reste */}
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                      <span className={reste > 0 ? 'text-amber-700' : 'text-emerald-600'}>
                        {fmtMontant(reste)}
                      </span>
                    </td>

                    {/* Barre progression */}
                    <td className="px-4 py-3 min-w-[120px]">
                      <ProgressPaiement
                        paye={f.montant_payer || 0}
                        total={f.montant_a_payer || 0}
                      />
                    </td>

                    {/* Badge paiement */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BadgePaiement statut_paiement={f.statut_paiement} />
                    </td>

                    {/* Badge statut modèle */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BadgeStatut statut={f.statut} />
                    </td>

                    {/* Bouton payer */}
                    {onglet === 'a_payer' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {peutPayer ? (
                          <button
                            onClick={() => setPayModal(f)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                          >
                            💳 Payer
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">—</span>
                        )}
                      </td>
                    )}

                  </tr>
                )
              })}

              {/* Empty state */}
              {!isLoading && displayed.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <span className="text-4xl">
                        {onglet === 'a_payer' ? '🎉' : onglet === 'paye' ? '📭' : '🏆'}
                      </span>
                      <p className="text-sm font-medium">
                        {onglet === 'a_payer'
                          ? 'Aucune facture en attente de paiement.'
                          : onglet === 'paye'
                          ? 'Aucun paiement enregistré.'
                          : 'Aucun paiement confirmé par le professeur.'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Pied de table : totaux de l'onglet */}
            {!isLoading && displayed.length > 0 && (
              <tfoot>
                <tr className="bg-neutral-100 border-t-2 border-neutral-300">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    Total ({displayed.length} séance{displayed.length > 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-neutral-800">
                    {fmtMontant(totalAPayer)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700">
                    {fmtMontant(totalPaye)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-700">
                    {fmtMontant(totalRestant)}
                  </td>
                  <td colSpan={onglet === 'a_payer' ? 4 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {data && (data.previous || data.next) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50">
            <button
              disabled={!data.previous}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >← Précédent</button>
            <span className="text-xs text-neutral-500">
              Page {page} / {Math.ceil((data.count ?? 0) / 10)}
            </span>
            <button
              disabled={!data.next}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >Suivant →</button>
          </div>
        )}
      </div>

      {/* Note info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <span className="text-lg shrink-0">💡</span>
        <p className="text-sm text-blue-800">
          Cliquez sur <strong>💳 Payer</strong> pour enregistrer un paiement partiel ou total.
          Le professeur recevra une notification et pourra <strong>confirmer</strong> la réception.
          Une fois confirmée, la facture passe en onglet <strong>🎓 Confirmées</strong>.
        </p>
      </div>

      {/* Modal paiement */}
      {payModal && (
        <PayModal
          facture={payModal}
          onClose={() => setPayModal(null)}
        />
      )}
    </div>
  )
}
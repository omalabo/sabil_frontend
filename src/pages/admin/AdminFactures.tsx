import { useState, useMemo } from 'react'
import { useGetFacturesAdminQuery, useValiderFactureMutation } from '../../store/apiSlice'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

/* ─────────────── Types ─────────────── */
interface PresenceDetail {
  id: string
  created_at: string
  heure_connexion: string | null
  heure_deconnexion: string | null
}

interface FactureAdmin {
  id: string
  classe_nom: string
  professeur_nom: string
  nb_eleves_inscrits: number
  taux_horaire: string
  montant_total: string | null
  statut: string
  lien_paypal: string | null
  rib: string | null
  date_echeance: string | null
  envoyee_chat: boolean
  created_at: string
  nbr_eleves_participe: number
  date_debut: string
  date_fin: string
  honoraire: number
  presence_ids: string[]
  seance_ids: string[]
  presences_detail: PresenceDetail[]
}

/* ─────────────── Statut badge ─────────────── */
const statutConfig: Record<string, { label: string; cls: string }> = {
  brouillon:  { label: 'Brouillon',  cls: 'bg-neutral-100 text-neutral-600' },
  envoyee:    { label: 'Envoyée',    cls: 'bg-blue-100 text-blue-700' },
  validee:    { label: 'Validée',    cls: 'bg-emerald-100 text-emerald-700' },
  rejetee:    { label: 'Rejetée',    cls: 'bg-red-100 text-red-700' },
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg = statutConfig[statut] ?? { label: statut, cls: 'bg-neutral-100 text-neutral-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ─────────────── Modal séances ─────────────── */
function SeancesModal({
  facture,
  onClose,
}: {
  facture: FactureAdmin
  onClose: () => void
}) {
  const pairs = facture.presence_ids.map((pid) => ({
    presence: facture.presences_detail?.find((p) => p.id === pid),
    pid,
  }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">📅 Séances de la facture</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{facture.classe_nom}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-200 text-neutral-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                {['#', 'Date séance', 'Heure connexion', 'Heure déconnexion'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {pairs.map(({ presence, pid }, idx) => (
                <tr key={pid} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-neutral-400">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {presence?.created_at
                      ? format(new Date(presence.created_at), 'dd MMM yyyy', { locale: fr })
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap font-mono">
                    {presence?.heure_connexion
                      ? format(new Date(presence.heure_connexion), 'HH:mm', { locale: fr })
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap font-mono">
                    {presence?.heure_deconnexion
                      ? format(new Date(presence.heure_deconnexion), 'HH:mm', { locale: fr })
                      : <span className="text-neutral-400">—</span>}
                  </td>
                </tr>
              ))}
              {pairs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 text-sm">
                    Aucune séance associée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Filter input ─────────────── */
function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  options?: string[]
}) {
  if (options) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">Tous</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Filtrer…`}
        className="text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
    </div>
  )
}

/* ─────────────── Main page ─────────────── */
export default function AdminFactures() {
  const { data, isLoading, refetch } = useGetFacturesAdminQuery()

    const factures: FactureAdmin[] = data?.results ?? []
  const [validerFacture] = useValiderFactureMutation()

  /* Filters */
  const [filters, setFilters] = useState({
    classe: '',
    professeur: '',
    statut: '',
    montant_min: '',
    montant_max: '',
    envoyee: '',
  })

  const setFilter = (key: keyof typeof filters) => (v: string) =>
    setFilters((f) => ({ ...f, [key]: v }))

  /* Modal */
  const [selectedFacture, setSelectedFacture] = useState<FactureAdmin | null>(null)

  /* Derived options */
  const classes    = useMemo(() => [...new Set(factures.map((f: FactureAdmin) => f.classe_nom))], [factures])
  const professeurs = useMemo(() => [...new Set(factures.map((f: FactureAdmin) => f.professeur_nom))], [factures])
  const statuts    = Object.keys(statutConfig)

  /* Filtered rows */
  const filtered = useMemo(() => {
    return factures.filter((f: FactureAdmin) => {
      if (filters.classe     && f.classe_nom      !== filters.classe)     return false
      if (filters.professeur && f.professeur_nom  !== filters.professeur) return false
      if (filters.statut     && f.statut          !== filters.statut)     return false
      if (filters.montant_min && parseFloat(f.montant_total ?? '0') < parseFloat(filters.montant_min)) return false
      if (filters.montant_max && parseFloat(f.montant_total ?? '0') > parseFloat(filters.montant_max)) return false
      if (filters.envoyee === 'oui' && !f.envoyee_chat) return false
      if (filters.envoyee === 'non' &&  f.envoyee_chat) return false
      return true
    })
  }, [factures, filters])

  /* Validate */
  const handleValider = async (id: string) => {
    if (!confirm('Valider cette facture ?')) return
    try {
      await validerFacture(id).unwrap()
      refetch()
      alert('✅ Facture validée')
    } catch {
      alert('Erreur lors de la validation')
    }
  }
  const navigate = useNavigate()
  /* Active filter count */
  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/suivi-presences')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          ← Retour
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-900">🧾 Gestion des factures</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{filtered.length} facture{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
            🔍 Filtres
            {activeFilters > 0 && (
              <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {activeFilters}
              </span>
            )}
          </h2>
          {activeFilters > 0 && (
            <button
              onClick={() => setFilters({ classe: '', professeur: '', statut: '', montant_min: '', montant_max: '', envoyee: '' })}
              className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <FilterInput label="Classe"      value={filters.classe}      onChange={setFilter('classe')}      options={classes} />
          <FilterInput label="Professeur"  value={filters.professeur}  onChange={setFilter('professeur')}  options={professeurs} />
          <FilterInput label="Statut"      value={filters.statut}      onChange={setFilter('statut')}      options={statuts} />
          <FilterInput label="Montant min" value={filters.montant_min} onChange={setFilter('montant_min')} type="number" />
          <FilterInput label="Montant max" value={filters.montant_max} onChange={setFilter('montant_max')} type="number" />
          <FilterInput label="Chat envoyé" value={filters.envoyee}     onChange={setFilter('envoyee')}     options={['oui', 'non']} />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400 text-sm">
          Chargement des factures…
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Classe', 'Professeur', 'Période', 'Élèves inscrits',
                    'Participants', 'Taux horaire', 'Montant total',
                    'Honoraire', 'Statut', 'Chat', 'Échéance', 'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((f: FactureAdmin) => (
                  <tr key={f.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900 whitespace-nowrap">
                      {f.classe_nom}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                      {f.professeur_nom}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      <div>{format(new Date(f.date_debut), 'dd/MM/yy', { locale: fr })}</div>
                      <div className="text-neutral-400">→ {format(new Date(f.date_fin), 'dd/MM/yy', { locale: fr })}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-neutral-100 text-neutral-700 text-xs font-bold px-2 py-0.5 rounded">
                        {f.nb_eleves_inscrits}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-primary-100 text-primary-800 text-xs font-bold px-2 py-0.5 rounded">
                        {f.nbr_eleves_participe}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                      {parseFloat(f.taux_horaire).toFixed(2)} €/h
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900 whitespace-nowrap">
                      {f.montant_total ? `${parseFloat(f.montant_total).toFixed(2)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                      {f.honoraire} h
                    </td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={f.statut} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.envoyee_chat ? (
                        <span title="Envoyée dans le chat" className="text-emerald-500">✓</span>
                      ) : (
                        <span title="Non envoyée" className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {f.date_echeance
                        ? format(new Date(f.date_echeance), 'dd MMM yyyy', { locale: fr })
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Séances */}
                        <button
                          onClick={() => setSelectedFacture(f)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          📅 Séances
                          {f.presence_ids?.length > 0 && (
                            <span className="bg-blue-200 text-blue-800 text-xs font-bold px-1.5 rounded-full">
                              {f.presence_ids.length}
                            </span>
                          )}
                        </button>

                        {/* Valider */}
                        {f.statut !== 'validee' && (
                          <button
                            onClick={() => handleValider(f.id)}
                            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            ✅ Valider
                          </button>
                        )}
                        {f.statut === 'validee' && (
                          <span className="text-xs text-emerald-500 font-medium px-2.5 py-1.5">Validée</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-neutral-400 text-sm">
                      {factures.length === 0 ? 'Aucune facture disponible' : 'Aucune facture ne correspond aux filtres'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seances modal */}
      {selectedFacture && (
        <SeancesModal facture={selectedFacture} onClose={() => setSelectedFacture(null)} />
      )}
    </div>
  )
}
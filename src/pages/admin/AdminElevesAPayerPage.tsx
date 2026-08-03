import React, { useMemo, useState } from 'react'
import { useGetAdminElevesAPayerQuery, useReactivateUserMutation } from '../../store/apiSlice'
import { AdminEleveAPayer } from '../../types'
import api from '../../config/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// Normalise pour une recherche insensible aux accents / à la casse
function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminElevesAPayerPage() {
  // 1) Un seul appel réseau. Tout le filtrage se fait ensuite en local (JS).
  const { data = [], isLoading, isError, refetch } = useGetAdminElevesAPayerQuery()
  const [reactivateUser] = useReactivateUserMutation()

  // Onglet Actifs / Inactifs — même logique que GestionComptes
  const [activeTab, setActiveTab] = useState<'actifs' | 'inactifs'>('actifs')

  // États des filtres — 100% locaux, pas de requête déclenchée au changement
  const [searchNom, setSearchNom] = useState('')
  const [professeurId, setProfesseurId] = useState('')
  const [classeId, setClasseId] = useState('')

  // Pour désactiver "en cours" un bouton pendant l'appel réseau
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Listes déroulantes construites à partir des données déjà chargées
  const professeurs = useMemo(() => {
    const map = new Map<string, string>()
    data.forEach(d => {
      if (d.professeur_id) map.set(d.professeur_id, d.professeur_nom)
    })
    return Array.from(map, ([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [data])

  // Les classes proposées dépendent du prof sélectionné (toujours en local)
  const classes = useMemo(() => {
    const map = new Map<string, string>()
    data
      .filter(d => !professeurId || d.professeur_id === professeurId)
      .forEach(d => {
        if (d.classe_id) map.set(d.classe_id, d.classe_nom)
      })
    return Array.from(map, ([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [data, professeurId])

  // Si on change de prof et que la classe sélectionnée ne lui appartient plus, on la réinitialise
  function handleProfChange(value: string) {
    setProfesseurId(value)
    setClasseId(prev => {
      const stillValid = data.some(d => d.classe_id === prev && (!value || d.professeur_id === value))
      return stillValid ? prev : ''
    })
  }

  // Filtrage instantané — recalculé à chaque frappe / sélection, sans appel réseau
  const filtered: AdminEleveAPayer[] = useMemo(() => {
    const needle = normalize(searchNom)
    const wantActive = activeTab === 'actifs'
    return data.filter(d => {
      if (d.eleve_is_active !== wantActive) return false
      if (professeurId && d.professeur_id !== professeurId) return false
      if (classeId && d.classe_id !== classeId) return false
      if (needle && !normalize(d.eleve_nom).includes(needle)) return false
      return true
    })
  }, [data, searchNom, professeurId, classeId, activeTab])

  // Compteurs pour les badges d'onglets (avant filtres nom/prof/classe, juste sur is_active)
  const countActifs = useMemo(() => data.filter(d => d.eleve_is_active).length, [data])
  const countInactifs = useMemo(() => data.filter(d => !d.eleve_is_active).length, [data])

  const total = filtered.reduce((acc, it) => acc + (it.montant_a_payer || 0), 0)
  const hasActiveFilter = !!(searchNom || professeurId || classeId)

  function resetFilters() {
    setSearchNom('')
    setProfesseurId('')
    setClasseId('')
  }

  // Désactiver un élève — même endpoint que GestionComptes (DELETE /users/:id/)
  async function handleDeactivate(eleveId: string) {
    if (!confirm('Désactiver ce compte élève ?')) return
    setPendingId(eleveId)
    try {
      await api.delete(`/users/${eleveId}/`)
      await refetch()
    } catch (err) {
      alert('Erreur lors de la désactivation')
    } finally {
      setPendingId(null)
    }
  }

  // Réactiver un élève — même mutation que GestionComptes
  async function handleReactivate(eleveId: string) {
    setPendingId(eleveId)
    try {
      await reactivateUser(eleveId).unwrap()
      await refetch()
    } catch (err) {
      alert('Erreur lors de la réactivation')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">💰 Élèves avec factures à payer</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {filtered.length} élève{filtered.length > 1 ? 's' : ''} · Total {fmtEur(total)}
            {hasActiveFilter && <span className="text-neutral-400"> (filtré)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilter && (
            <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
              Filtres actifs
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-sm px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition text-neutral-700 font-medium"
          >
            ↻ Réinitialiser
          </button>
        </div>
      </div>

      {/* ── Onglets Actifs / Inactifs ── */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('actifs')}
          className={`px-3 py-1 rounded ${activeTab === 'actifs' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}
        >
          Actifs ({countActifs})
        </button>
        <button
          onClick={() => setActiveTab('inactifs')}
          className={`px-3 py-1 rounded ${activeTab === 'inactifs' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}
        >
          Inactifs ({countInactifs})
        </button>
      </div>

      {/* ── Filtres (statiques, instantanés — aucune requête au backend) ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Filtres</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Recherche par nom élève — filtre dès la 1ère lettre */}
          <input
            type="text"
            placeholder="🔎 Nom de l'élève…"
            value={searchNom}
            onChange={e => setSearchNom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
          />

          {/* Professeur */}
          <select
            value={professeurId}
            onChange={e => handleProfChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
          >
            <option value="">Tous mes professeurs</option>
            {professeurs.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>

          {/* Classe — dépend du prof sélectionné */}
          <select
            value={classeId}
            onChange={e => setClasseId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-rose-500">
            Erreur de chargement.{' '}
            <button onClick={() => refetch()} className="underline font-medium">Réessayer</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400 italic">
            Aucune facture élève {activeTab === 'actifs' ? 'active' : 'inactive'} en attente pour ces filtres.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Élève</th>
                  <th className="text-left font-semibold px-4 py-2.5">Téléphone</th>
                  <th className="text-left font-semibold px-4 py-2.5">Classe</th>
                  <th className="text-left font-semibold px-4 py-2.5">Cours</th>
                  <th className="text-left font-semibold px-4 py-2.5">Professeur</th>
                  <th className="text-right font-semibold px-4 py-2.5">Montant à payer</th>
                  <th className="text-right font-semibold px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(it => (
                  <tr key={it.facture_eleve_id} className="hover:bg-amber-50/50 transition">
                    <td className="px-4 py-2.5 font-medium text-neutral-800 whitespace-nowrap">{it.eleve_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.telephone || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.classe_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.cours || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.professeur_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700 whitespace-nowrap">
                      {fmtEur(it.montant_a_payer)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {it.eleve_is_active ? (
                        <button
                          onClick={() => handleDeactivate(it.eleve_id)}
                          disabled={pendingId === it.eleve_id}
                          className="text-xs bg-danger-100 text-danger-700 px-2 py-1 rounded hover:bg-danger-200 transition-colors disabled:opacity-50"
                          title="Désactiver ce compte élève"
                        >
                          {pendingId === it.eleve_id ? '⏳' : '🗑️ Désactiver'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(it.eleve_id)}
                          disabled={pendingId === it.eleve_id}
                          className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded hover:bg-success-200 transition-colors disabled:opacity-50"
                          title="Réactiver ce compte élève"
                        >
                          {pendingId === it.eleve_id ? '⏳' : '♻️ Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
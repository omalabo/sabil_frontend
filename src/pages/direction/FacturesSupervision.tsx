import { useState } from 'react'
import { useGetFacturesQuery } from '../../store/apiSlice'
import api from '../../config/axios'
import { Facture } from '../../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function DirectionFacturesSupervision() {
  const [filterStatut, setFilterStatut] = useState('all')
  const [filterMois, setFilterMois] = useState('')
  
  const {  facturesData, isLoading, refetch } = useGetFacturesQuery({ page: 1 })
  let factures = facturesData?.results || []

  // Filtres
  if (filterStatut !== 'all') {
    factures = factures.filter((f: Facture) => f.statut === filterStatut)
  }
  if (filterMois) {
    factures = factures.filter((f: Facture) => f.periode_mois?.startsWith(filterMois))
  }

  // 📊 Stats rapides
  const totalEnvoye = factures.filter((f: Facture) => f.statut === 'envoye').length
  const totalPaye = factures.filter((f: Facture) => f.statut === 'paye').length
  const montantTotal = factures.reduce((sum: number, f: Facture) => 
    sum + parseFloat(f.montant_total || '0'), 0)

  // 🔔 Forcer l'envoi d'un rappel
  const forceReminder = async (factureId: string) => {
    try {
      await api.post('/factures/send-reminders/', { facture_id: factureId, force: true })
      alert('🔔 Rappel forcé envoyé')
      refetch()
    } catch (err) {
      alert('Erreur lors de l\'envoi')
    }
  }

  // ✅ Marquer comme payée manuellement (pour dépannage)
  const markAsPaid = async (factureId: string) => {
    if (!confirm('Marquer cette facture comme PAYÉE manuellement ?')) return
    try {
      await api.patch(`/paiements/`, { 
        facture: factureId, 
        montant: 0, // Montant réel récupéré côté backend
        methode: 'manual_override',
        reference: `OVERRIDE-${Date.now()}`
      })
      alert('✅ Facture marquée comme payée')
      refetch()
    } catch (err) {
      alert('Erreur lors de la mise à jour')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">📊 Supervision Factures</h1>
        <button onClick={() => refetch()} className="btn-primary">🔄 Actualiser</button>
      </div>

      {/* 📈 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Total factures</p>
          <p className="text-2xl font-bold text-neutral-900">{facturesData?.count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">En attente</p>
          <p className="text-2xl font-bold text-warning-600">{totalEnvoye}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Payées</p>
          <p className="text-2xl font-bold text-success-600">{totalPaye}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Montant total</p>
          <p className="text-2xl font-bold text-primary-700">{montantTotal.toFixed(2)} €</p>
        </div>
      </div>

      {/* 🔍 Filtres */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg border border-neutral-200">
        <select 
          value={filterStatut} 
          onChange={e => setFilterStatut(e.target.value)}
          className="form-input w-48"
        >
          <option value="all">Tous les statuts</option>
          <option value="envoye">En attente</option>
          <option value="paye">Payées</option>
        </select>
        <input 
          type="month" 
          value={filterMois} 
          onChange={e => setFilterMois(e.target.value)}
          className="form-input w-48"
        />
      </div>

      {/* 📋 Tableau des factures */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Classe / Prof</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Période</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Dernier rappel</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {factures.map((f: Facture) => (
              <tr key={f.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{f.classe_nom}</p>
                  <p className="text-xs text-neutral-500">{f.professeur_nom}</p>
                </td>
                <td className="px-4 py-3 text-sm">
                  {format(new Date(f.periode_mois), 'MMMM yyyy', { locale: fr })}
                </td>
                <td className="px-4 py-3 font-medium">
                  {parseFloat(f.montant_total || '0').toFixed(2)} €
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    f.statut === 'paye' ? 'bg-success-100 text-success-700' :
                    'bg-warning-100 text-warning-700'
                  }`}>
                    {f.statut === 'paye' ? '✅ Payée' : '⏳ En attente'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {f.envoyee_chat_at ? format(new Date(f.envoyee_chat_at), 'dd/MM') : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {f.statut === 'envoye' && (
                      <>
                        <button 
                          onClick={() => forceReminder(f.id)}
                          className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded hover:bg-warning-200"
                          title="Forcer un rappel"
                        >
                          🔔
                        </button>
                        <button 
                          onClick={() => markAsPaid(f.id)}
                          className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded hover:bg-success-200"
                          title="Marquer comme payée (dépannage)"
                        >
                          ✅
                        </button>
                      </>
                    )}
                    <button className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-200">
                      📄 Détails
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {factures.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Aucune facture trouvée avec ces filtres
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
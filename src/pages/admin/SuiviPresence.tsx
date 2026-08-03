import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetFacturesQuery, useGetSuiviPresencesQuery } from '../../store/apiSlice'
import api from '../../config/axios'
import { Facture } from '../../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import AdminFactures from './AdminFactures'
import { useNavigate } from 'react-router-dom'

interface SuiviPresence {
  id: string
  created_at: string
  classe: string
  classe_nom: string
  seance: string
  seance_titre: string
  nb_participants: number
  nb_inscrits: number
  resp_query_10_eleve: boolean
  resp_query_fin_eleve: boolean
}

export default function AdminSuiviPresences() {
  const { user } = useAppSelector(selectAuth)
  const [showGenerate, setShowGenerate] = useState(false)
  const [form, setForm] = useState({
    classe_id: '',
    lien_paypal: '',
    rib: '',
    dates_cours: [{ date: '', duree: 60 }],
  })

  const {
    data: facturesData,
    isLoading: facturesLoading,
    refetch,
  } = useGetFacturesQuery({ page: 1 }, { skip: user?.role !== 'professeur' })
  const factures = facturesData?.results ?? []

  const {
    data: presences = [],
    isLoading: presencesLoading,
  } = useGetSuiviPresencesQuery()

  
  const navigate = useNavigate()

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/factures/auto-generate/', {
        classe_id: form.classe_id,
        lien_paypal: form.lien_paypal,
        rib: form.rib,
      })
      setShowGenerate(false)
      refetch()
      alert('✅ Facture générée et envoyée dans le chat de la classe')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la génération')
    }
  }

  const sendReminder = async (factureId: string) => {
    try {
      await api.post('/factures/send-reminders/', { facture_id: factureId })
      alert('🔔 Rappel envoyé')
    } catch {
      alert("Erreur lors de l'envoi du rappel")
    }
  }

 

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900"> Suivi des présences</h1>
        <button onClick={() => navigate('/admin/factures')} className="btn-primary">
          🧾 Gérer les factures
        </button>
      </div>

      {/* Présences facturables */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">
          📋 Présences
        </h2>
        {presencesLoading ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  {["Date séance", "Classe", "Participants (élèves)", "Nbr d'inscrits", "presence professeur(début)", "presence professeur(fin)"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {presences.map((p: SuiviPresence) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                      {format(new Date(p.created_at), 'dd MMMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{p.classe_nom}</td>
                    <td className="px-4 py-3 text-lef">
                      <span className="inline-block bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.nb_participants}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="inline-block bg-neutral-100 text-neutral-700 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.nb_inscrits}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="inline-block bg-neutral-100 text-neutral-700 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.resp_query_10_eleve}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="inline-block bg-neutral-100 text-neutral-700 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.resp_query_fin_eleve}
                      </span>
                    </td>
                  </tr>
                ))}
                {presences.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 text-sm">
                      Aucune séance pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

  

      {/* Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleGenerate} className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">💰 Générer une facture</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Classe *</label>
                <select
                  value={form.classe_id}
                  onChange={(e) => setForm({ ...form, classe_id: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Sélectionner une classe…</option>
                  {[...new Map(presences.map((p: SuiviPresence) => [p.classe, p])).values()].map((p: SuiviPresence) => (
                    <option key={p.classe} value={p.classe}>{p.classe_nom}</option>
                  ))}
                </select>
              </div>
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
              <button type="button" onClick={() => setShowGenerate(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
                Annuler
              </button>
              <button type="submit" className="btn-primary">✅ Générer et envoyer</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <p className="text-sm text-primary-800">
          💡 <strong>Info :</strong> Seules les séances où l'élève <em>et</em> le professeur ont confirmé leur présence (10 min + fin) apparaissent ici.
        </p>
      </div>
    </div>
  )
}
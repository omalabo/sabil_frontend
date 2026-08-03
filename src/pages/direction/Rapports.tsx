import { useState } from 'react'
import api from '../../config/axios'

export default function DirectionRapports() {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'global'>('daily')
  const [loading, setLoading] = useState(false)
  const [rapportData, setRapportData] = useState<any>(null)

  const fetchRapport = async (endpoint: string) => {
    setLoading(true)
    try {
      const res = await api.get(endpoint)
      setRapportData(res.data)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">📈 Rapports & Statistiques</h1>
      
      <div className="flex gap-2 border-b border-neutral-200 pb-1">
        {[
          { id: 'daily', label: '📅 Quotidien Absences' },
          { id: 'monthly', label: '🗓️ Mensuel Professeurs' },
          { id: 'global', label: '🌍 Global Système' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t.id ? 'bg-white border-x border-t border-neutral-200 text-primary-700 -mb-px' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <button onClick={() => fetchRapport(tab === 'daily' ? '/rapports/daily-absences/' : tab === 'monthly' ? '/rapports/monthly-summary/' : '/rapports-auto/')} disabled={loading} className="btn-primary mb-4">
          {loading ? 'Chargement...' : 'Générer le rapport'}
        </button>

        {rapportData && (
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 max-h-96 overflow-auto">
            <pre className="text-sm text-neutral-800 whitespace-pre-wrap font-mono">
              {JSON.stringify(rapportData, null, 2)}
            </pre>
          </div>
        )}
        
        {!rapportData && !loading && (
          <p className="text-center text-neutral-500 py-8">Sélectionnez un type de rapport et cliquez sur "Générer"</p>
        )}
      </div>
    </div>
  )
}
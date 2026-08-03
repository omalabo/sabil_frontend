import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import api from '../../config/axios'
import DataTable from '../../components/shared/DataTable'

export default function AdminSignalements() {
  const { user } = useAppSelector(selectAuth)
  const [absences, setAbsences] = useState<any[]>([])
  const [flaggedClasses, setFlaggedClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [absRes, clsRes] = await Promise.all([
        api.get('/absences-profs/'),
        api.get('/classes/?couleur=rouge&statut=fin_session')
      ])
      setAbsences(absRes.data.results || [])
      setFlaggedClasses(clsRes.data.results || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useState(() => { loadData() }, [])

  const columns = [
    { key: 'type', label: 'Type', render: (item: any) => item.classe ? '🚩 Classe' : '👨‍🏫 Absence Prof' },
    { key: 'nom', label: 'Détail', render: (item: any) => item.classe ? item.classe.nom : `${item.professeur_nom} (${item.date_absence})` },
    { key: 'source', label: 'Source', render: (item: any) => <span className="text-xs bg-neutral-100 px-2 py-1 rounded">{item.source || 'Signalement'}</span> },
    { key: 'actions', label: 'Actions', render: (item: any) => (
      <button onClick={async () => { await api.post(`/notifications/`, { type: 'alert_direction', titre: 'Signalement validé', contenu: JSON.stringify(item), lu: false }); alert('Notifié à la direction'); }} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200">📤 Notifier Direction</button>
    )}
  ]

  const combinedData = [...absences, ...flaggedClasses].map(i => ({ id: i.id, ...i }))

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">🚩 Signalements & Alertes</h1>
        <button onClick={loadData} className="btn-primary">🔄 Actualiser</button>
      </div>
      <DataTable data={combinedData} columns={columns} isLoading={loading} emptyMessage="Aucun signalement en attente" />
    </div>
  )
}
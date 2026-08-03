import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">⚙️ Dashboard Administrateur</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Professeurs gérés</p>
          <p className="text-3xl font-bold text-primary-700">4</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Classes en pause</p>
          <p className="text-3xl font-bold text-warning-600">1</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Signalements à traiter</p>
          <p className="text-3xl font-bold text-danger-600">2</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => navigate('/admin/professeurs')} className="class-card text-left hover:border-primary-300">
          <h3 className="font-semibold">👨‍🏫 Voir les Professeurs</h3>
          <p className="text-sm text-neutral-600">Accéder aux classes par enseignant</p>
        </button>
        <button onClick={() => navigate('/admin/messages-prives')} className="class-card text-left hover:border-primary-300">
          <h3 className="font-semibold">💬 Messages Privés</h3>
          <p className="text-sm text-neutral-600">Répondre aux élèves directement</p>
        </button>
      </div>
    </div>
  )
}
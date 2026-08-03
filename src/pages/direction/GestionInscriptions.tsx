import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetClassQuery, useGetUsersQuery } from '../../store/apiSlice'
import api from '../../config/axios'
import { User, Class, Inscription } from '../../types'

export default function DirectionGestionInscriptions() {
  const { classeId } = useParams<{ classeId: string }>()
  const navigate = useNavigate()
  
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [availableEleves, setAvailableEleves] = useState<User[]>([])
  const [selectedEleve, setSelectedEleve] = useState<string>('')
  const [nomDiplome, setNomDiplome] = useState('')
  const [loading, setLoading] = useState(true)

  // 📡 Fetch de la classe
  const {  data: classe } = useGetClassQuery(classeId!, { skip: !classeId })

  // 📡 Fetch des élèves non encore inscrits dans cette classe
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Récupérer les inscriptions existantes
        const inscRes = await api.get(`/inscriptions/?classe=${classeId}`)
        setInscriptions(inscRes.data.results || [])
        
        // 2. Récupérer tous les élèves
        const elevesRes = await api.get('/users/?role=eleve')
        const allEleves: User[] = elevesRes.data.results || []
        
        // 3. Filtrer ceux déjà inscrits
        const inscritIds = new Set(inscRes.data.results?.map((i: Inscription) => i.eleve.id))
        setAvailableEleves(allEleves.filter((e: User) => !inscritIds.has(e.id)))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (classeId) loadData()
  }, [classeId])

  // ➕ Ajouter un élève à la classe
  const handleAddEleve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEleve || !classeId) return

    try {
      await api.post('/inscriptions/', {
        eleve: selectedEleve,
        classe: classeId,
        statut: 'active',
        date_inscription: new Date().toISOString().split('T')[0],
        nom_diplome: nomDiplome || '',
        contrat_signe: false, // À signer ensuite
        contrat_signe_at: null
      })
      
      // Rafraîchir la liste
      const inscRes = await api.get(`/inscriptions/?classe=${classeId}`)
      setInscriptions(inscRes.data.results || [])
      
      // Mettre à jour la liste des élèves disponibles
      setAvailableEleves(prev => prev.filter(e => e.id !== selectedEleve))
      setSelectedEleve('')
      setNomDiplome('')
      alert('✅ Élève inscrit avec succès')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de l\'inscription')
    }
  }

  // 🗑️ Retirer un élève (désinscription)
  const handleRemoveEleve = async (inscriptionId: string, eleveNom: string) => {
    if (!confirm(`Retirer ${eleveNom} de cette classe ?`)) return
    try {
      await api.delete(`/inscriptions/${inscriptionId}/`)
      setInscriptions(prev => prev.filter(i => i.id !== inscriptionId))
      alert('✅ Élève retiré')
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
  }

  // ✍️ Générer/Signer un contrat pour un élève
  const handleSignContract = async (inscription: Inscription) => {
    console.log('inscription:', inscription)
    try {
      await api.post(`/contrats/sign/`, {
        eleve: inscription.eleve,
        classe: inscription.classe,
        version_reglement: '1.0',
        contenu_snapshot: 'Règlement intérieur v1.0 - Accepté électroniquement',
        //ip_signature: '127.0.0.1' // À remplacer par l'IP réelle
      })
      
      // Mettre à jour l'inscription
      await api.patch(`/inscriptions/${inscription.id}/`, {
        contrat_signe: true,
        contrat_signe_at: new Date().toISOString()
      })
      
      setInscriptions(prev => prev.map(i => 
        i.id === inscription.id ? { ...i, contrat_signe: true, contrat_signe_at: new Date().toISOString() } : i
      ))
      alert('✅ Contrat signé électroniquement')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la signature')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">👥 Gestion des inscriptions</h1>
          <p className="text-neutral-600">Classe : {classe?.nom} • {classe?.programme}</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-neutral-600 hover:text-neutral-900">← Retour</button>
      </div>

      {/* ➕ Formulaire d'ajout d'élève */}
      <form onSubmit={handleAddEleve} className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold">➕ Inscrire un nouvel élève</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select 
            value={selectedEleve} 
            onChange={e => setSelectedEleve(e.target.value)}
            className="form-input"
            required
          >
            <option value="">Sélectionner un élève...</option>
            {availableEleves.map(eleve => (
              <option key={eleve.id} value={eleve.id}>{eleve.display_name} ({eleve.email})</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Nom pour le diplôme (optionnel)"
            value={nomDiplome}
            onChange={e => setNomDiplome(e.target.value)}
            className="form-input"
          />
          <button type="submit" disabled={!selectedEleve} className="btn-primary">
            ✅ Inscrire l'élève
          </button>
        </div>
        {availableEleves.length === 0 && (
          <p className="text-sm text-neutral-500">Tous les élèves sont déjà inscrits dans cette classe</p>
        )}
      </form>

      {/* 📋 Liste des élèves inscrits */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200">
          <h3 className="font-semibold">📚 Élèves inscrits ({inscriptions.length})</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          {inscriptions.map((insc) => (
            <div key={insc.id} className="p-4 flex items-center justify-between hover:bg-neutral-50">
              <div>
                <p className="font-medium">{insc.eleve_nom || insc.eleve?.display_name}</p>
                <p className="text-sm text-neutral-500">
                  Inscrit le {new Date(insc.date_inscription).toLocaleDateString('fr-FR')}
                  {insc.nom_diplome && ` • Diplôme: ${insc.nom_diplome}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Badge contrat */}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  insc.contrat_signe ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                }`}>
                  {insc.contrat_signe ? '✅ Signé' : '⏳ À signer'}
                </span>
                
                {/* Bouton signature si pas encore signé */}
                {!insc.contrat_signe && (
                  <button 
                    onClick={() => handleSignContract(insc)}
                    className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded hover:bg-primary-200"
                  >
                    ✍️ Signer contrat
                  </button>
                )}
                
                {/* Bouton retirer */}
                <button 
                  onClick={() => handleRemoveEleve(insc.id, insc.eleve_nom || insc.eleve?.display_name || '')}
                  className="text-xs bg-danger-100 text-danger-700 px-3 py-1 rounded hover:bg-danger-200"
                >
                  🗑️ Retirer
                </button>
              </div>
            </div>
          ))}
          {inscriptions.length === 0 && (
            <p className="text-center text-neutral-500 py-8">Aucun élève inscrit dans cette classe</p>
          )}
        </div>
      </div>

      {/* ℹ️ Note pédagogique */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <p className="text-sm text-primary-800">
          💡 <strong>Info :</strong> Chaque élève doit signer électroniquement le règlement intérieur avant de pouvoir accéder aux cours. 
          Le contrat est horodaté et conservé dans l'historique même en cas de modification du règlement.
        </p>
      </div>
    </div>
  )
}
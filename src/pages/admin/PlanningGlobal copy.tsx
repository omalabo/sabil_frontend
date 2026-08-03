import { useState, useEffect } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import api from '../../config/axios'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const HEURES = Array.from({ length: 32 }, (_, i) => { const h = 6 + Math.floor(i/2); return `${String(h).padStart(2,'0')}:${i%2===0?'00':'30'}` })

export default function AdminPlanningGlobal() {
  const { user } = useAppSelector(selectAuth)
  const [grid, setGrid] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const slots = await api.get('/planning-dispos/')
        const classes = await api.get(`/classes/?admin=${user?.id}`)
        
        const map: Record<string, any[]> = {}
        HEURES.forEach(h => JOURS.forEach((_, j) => map[`${j}-${h}`] = []))
        
        slots.data.results.forEach((s: any) => {
          if(s.disponible) map[`${s.jour_semaine-1}-${s.heure_debut.substring(0,5)}`]?.push({ type: 'slot', prof: s.professeur_nom })
        })
        classes.data.results.forEach((c: any) => {
          map[`${c.jour_semaine-1}-${c.heure_debut?.substring(0,5)}`]?.push({ type: 'classe', nom: c.nom, couleur: c.couleur })
        })
        setGrid(map)
      } catch(err) { console.error(err) } finally { setLoading(false) }
    }
    load()
  }, [user])

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">📅 Planning Global (Admin)</h1>
      <p className="text-sm text-neutral-600">Vue consolidée des créneaux et classes que vous gérez.</p>
      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto p-4">
        <table className="min-w-full text-xs border-collapse">
          <thead><tr className="bg-neutral-50">{HEURES.length > 0 && <th className="p-2 w-16 border-b">Heure</th>}{JOURS.map(j => <th key={j} className="p-2 border-b text-center">{j}</th>)}</tr></thead>
          <tbody>
            {HEURES.map(h => (
              <tr key={h} className="border-b border-neutral-100">
                <td className="p-2 font-mono text-neutral-500 border-r">{h}</td>
                {JOURS.map((_, j) => (
                  <td key={`${j}-${h}`} className="p-1 h-10 border-r border-neutral-100 bg-white">
                    {(grid[`${j}-${h}`] || []).map((item, i) => (
                      <div key={i} className={`px-1 py-0.5 rounded text-[10px] truncate mb-0.5 ${item.type === 'classe' ? (item.couleur === 'orange' ? 'bg-warning-100' : 'bg-primary-100') : 'bg-success-50'}`}>
                        {item.type === 'classe' ? `📚 ${item.nom}` : `✅ ${item.prof}`}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
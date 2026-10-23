// AnnoncesEleve.tsx — Page dédiée aux annonces pour l'élève
// Reprend exactement le contenu de l'onglet "annonces" de ClasseDetail
import { useMemo } from 'react'
import { useGetMesAnnoncesQuery } from '../../store/apiSlice'
import { AnnonceEleveCard } from '../direction/Annonces' // ajustez le chemin selon votre structure
import type { AnnonceEleve } from '../../types'

export default function AnnoncesEleve() {
  const { data: mesAnnoncesRaw, isLoading, refetch } = useGetMesAnnoncesQuery(undefined, {
    pollingInterval: 15000, // rafraîchissement toutes les 15s
  })

  const mesAnnonces: AnnonceEleve[] = useMemo(() => {
    if (Array.isArray(mesAnnoncesRaw)) return mesAnnoncesRaw
    return (mesAnnoncesRaw as any)?.results ?? []
  }, [mesAnnoncesRaw])

  const annoncesActives = mesAnnonces
  const hasNonLues = annoncesActives.some((a: any) => !a.statut)

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 lg:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              📢 Mes Annonces
              {hasNonLues && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Nouvelles
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {annoncesActives.length} annonce{annoncesActives.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition"
            title="Rafraîchir"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-neutral-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-neutral-500">Chargement des annonces…</p>
          </div>
        ) : annoncesActives.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-40">📭</div>
            <p className="text-neutral-500 text-sm">Aucune annonce pour le moment.</p>
            <p className="text-neutral-400 text-xs mt-1">
              Les annonces de l'école apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {annoncesActives.map((annonce: any) => (
              <AnnonceEleveCard key={annonce.id} annonce={annonce} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

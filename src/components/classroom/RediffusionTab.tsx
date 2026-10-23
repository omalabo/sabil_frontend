import { useState, useEffect, useMemo } from 'react'
import api from '../../config/axios'
import { Class } from '../../types'

interface RediffusionTabProps {
  classeId: string
  activeClass: Class | null
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
}

interface VideoMessage {
  id: string
  fichier_url: string
  nom_fichier?: string
  created_at: string
  expediteur_nom: string
  expediteur?: string | { id: string; display_name: string }
  duree?: number // en secondes si dispo
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const getFullUrl = (url: string | null | undefined) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.sabil-al-ilm.org/api'
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

const formatDateFr = (iso: string) => {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const formatDuree = (secondes?: number) => {
  if (!secondes) return null
  const m = Math.floor(secondes / 60)
  const s = Math.floor(secondes % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Composant principal ─────────────────────────────────────────────────
export default function RediffusionTab({ classeId, activeClass, role }: RediffusionTabProps) {
  const [videos, setVideos] = useState<VideoMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<VideoMessage | null>(null)

  useEffect(() => {
    if (!classeId) return
    setLoading(true)
    api
      .get('/messages/', { params: { classe_id: classeId, type_message: 'video' } })
      .then((res) => {
        const msgs: VideoMessage[] = (res.data.results || res.data || []).filter(
          (m: any) => m.type_message === 'video' && m.fichier_url
        )
        // Trier par date décroissante (plus récent en premier)
        msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setVideos(msgs)
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [classeId])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, VideoMessage[]> = {}
    videos.forEach((v) => {
      const dateKey = new Date(v.created_at).toDateString()
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(v)
    })
    return groups
  }, [videos])

  const handlePlay = (video: VideoMessage) => {
    setPreviewVideo(video)
    setPlayingId(video.id)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-neutral-50">
        <div className="w-10 h-10 border-4 border-neutral-200 border-t-red-500 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-neutral-500">Chargement des rediffusions…</p>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-neutral-50">
        <div className="text-6xl mb-4 opacity-40">🎬</div>
        <p className="text-neutral-500 text-sm">Aucune rediffusion disponible</p>
        <p className="text-neutral-400 text-xs mt-1">
          Les enregistrements des cours apparaîtront ici.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-100">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              🎬 Rediffusion des cours
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {videos.length} vidéo{videos.length > 1 ? 's' : ''} • {activeClass?.nom || 'Classe'}
            </p>
          </div>
        </div>
      </div>

      {/* Grille de vidéos (style YouTube) */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            activeClass={activeClass}
            onPlay={() => handlePlay(video)}
          />
        ))}
      </div>

      {/* Lightbox vidéo (style YouTube) */}
      {previewVideo && (
        <VideoLightbox
          video={previewVideo}
          activeClass={activeClass}
          onClose={() => {
            setPreviewVideo(null)
            setPlayingId(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Carte vidéo (style YouTube) ────────────────────────────────────────
function VideoCard({
  video,
  activeClass,
  onPlay,
}: {
  video: VideoMessage
  activeClass: Class | null
  onPlay: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group"
      onClick={onPlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video bg-neutral-900 overflow-hidden">
        {/* Vidéo en arrière-plan (muet, pas d'autoplay au hover pour éviter la conso) */}
        <video
          src={getFullUrl(video.fichier_url)}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Bouton Play centré */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            hover ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl transform transition-transform group-hover:scale-110">
            <svg
              className="w-8 h-8 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Durée (si dispo) */}
        {video.duree && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
            {formatDuree(video.duree)}
          </div>
        )}

        {/* Badge "ENREGISTREMENT" */}
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
          ● Cours enregistré
        </div>
      </div>

      {/* Infos vidéo */}
      <div className="p-3">
        {/* Titre = Date du cours */}
        <h3 className="font-semibold text-sm text-neutral-900 line-clamp-2 mb-1.5">
          Cours du {formatDateFr(video.created_at)}
        </h3>

        {/* Nom du prof */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {video.expediteur_nom?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="text-xs text-neutral-600 truncate">{video.expediteur_nom}</span>
        </div>

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <span>📚</span>
            <span className="truncate max-w-[120px]">{activeClass?.nom || 'Classe'}</span>
          </span>
          {activeClass?.programme && (
            <span className="flex items-center gap-1">
              <span>📖</span>
              <span className="truncate max-w-[120px]">{activeClass.programme}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <span>🕐</span>
            <span>{formatTime(video.created_at)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Lightbox vidéo (modal plein écran) ─────────────────────────────────
function VideoLightbox({
  video,
  activeClass,
  onClose,
}: {
  video: VideoMessage
  activeClass: Class | null
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Bouton fermer */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition z-10"
      >
        ✕
      </button>

      <div
        className="w-full max-w-5xl bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Vidéo */}
        <div className="relative aspect-video bg-black">
          <video
            src={getFullUrl(video.fichier_url)}
            controls
            autoPlay
            className="w-full h-full"
          />
        </div>

        {/* Infos sous la vidéo */}
        <div className="p-5 bg-neutral-900 text-white">
          <h3 className="text-lg font-bold mb-2">
            Cours du {formatDateFr(video.created_at)} à {formatTime(video.created_at)}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                {video.expediteur_nom?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <div className="font-semibold text-white">{video.expediteur_nom}</div>
                <div className="text-xs text-neutral-400">Professeur</div>
              </div>
            </div>
            <div className="h-8 w-px bg-neutral-700" />
            <div>
              <div className="text-xs text-neutral-400">Classe</div>
              <div className="font-medium">{activeClass?.nom || '—'}</div>
            </div>
            {activeClass?.programme && (
              <>
                <div className="h-8 w-px bg-neutral-700" />
                <div>
                  <div className="text-xs text-neutral-400">Programme</div>
                  <div className="font-medium">{activeClass.programme}</div>
                </div>
              </>
            )}
            {activeClass?.niveau && (
              <>
                <div className="h-8 w-px bg-neutral-700" />
                <div>
                  <div className="text-xs text-neutral-400">Niveau</div>
                  <div className="font-medium">{activeClass.niveau}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

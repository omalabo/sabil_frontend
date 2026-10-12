import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  className?: string
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
const SPEEDS = [1, 1.25, 1.5, 2, 0.75]
export default function ProtectedAudio({ src, className = '' }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  // Nettoyage du blob quand le composant disparaît ou que la source change
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [src])

  // Charge l'audio en blob au premier clic (l'URL réelle n'est plus visible dans le DOM)
  const ensureLoaded = async (): Promise<boolean> => {
    const audio = audioRef.current
    if (!audio) return false
    if (blobUrlRef.current) return true
    setLoading(true)
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      blobUrlRef.current = URL.createObjectURL(blob)
      audio.src = blobUrlRef.current
      return true
    } catch {
      setError(true)
      return false
    } finally {
      setLoading(false)
    }
  }

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    if (!(await ensureLoaded())) return
    try {
      audio.defaultPlaybackRate = speed
      audio.playbackRate = speed
      await audio.play()
    } catch {
      setError(true)
    }
  }

  // Les vocaux .webm enregistrés par le navigateur ont souvent une durée "Infinity" :
  // on force le calcul de la vraie durée.
  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isFinite(audio.duration)) {
      setDuration(audio.duration)
      return
    }
    const fix = () => {
      audio.removeEventListener('timeupdate', fix)
      setDuration(audio.duration)
      audio.currentTime = 0
    }
    audio.addEventListener('timeupdate', fix)
    audio.currentTime = 1e101
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrent(t)
  }
  const [speed, setSpeed] = useState(1)

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    const audio = audioRef.current
    if (audio) {
      audio.defaultPlaybackRate = next
      audio.playbackRate = next
    }
  }
  return (
    <div
      className={`flex items-center gap-2 select-none ${className}`}
      style={{ minWidth: 190, maxWidth: 240 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={toggle}
        disabled={loading || error}
        className="w-8 h-8 shrink-0 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white flex items-center justify-center transition"
        title={playing ? 'Pause' : 'Lecture'}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {error ? (
        <span className="text-xs text-red-500">Audio indisponible</span>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(current, duration || 0)}
            onChange={seek}
            disabled={!duration}
            className="flex-1 h-1 accent-green-600 cursor-pointer min-w-0"
          />
          <span className="text-[11px] tabular-nums text-gray-500 shrink-0">
            {fmt(playing || current > 0 ? current : duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="shrink-0 px-1.5 h-6 rounded-full bg-black/10 hover:bg-black/20 text-[11px] font-semibold tabular-nums text-gray-700 transition"
            title="Vitesse de lecture"
          >
            {speed}×
          </button>
        </>
      )}
    </div>
  )
}

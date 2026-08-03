import React, { useRef, useState, useEffect, useCallback } from 'react'

interface SignaturePadProps {
  onChange: (dataUrl: string) => void
  width?: number
  height?: number
  penColor?: string
  penWidth?: number
}

export default function SignaturePad({
  onChange,
  width = 400,
  height = 150,
  penColor = '#1d3f7a',
  penWidth = 2.5,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  // ✅ INIT : Fond TRANSPARENT (pas de blanc)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    
    // On efface tout pour garantir la transparence
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [penColor, penWidth])

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      if ('touches' in e) {
        const touch = e.touches[0]
        return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
      }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    },
    []
  )

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setIsEmpty(false)
  }

  const endDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    onChange(dataUrl)
  }

  // ✅ CLEAR : Effacer avec transparence, pas avec du blanc
  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height) // <-- ICI : clearRect au lieu de fillRect
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    setIsEmpty(true)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-neutral-300 rounded-lg overflow-hidden bg-transparent"
        style={{ width, maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          width={width * 2}
          height={height * 2}
          style={{ width, height, maxWidth: '100%', cursor: 'crosshair', touchAction: 'none', background: 'transparent' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-neutral-400 text-sm italic">Signez ici</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-xs text-neutral-500 hover:text-red-500 underline transition"
      >
        ✕ Effacer la signature
      </button>
    </div>
  )
}
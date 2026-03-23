import { useRef, useEffect } from 'react'
import useStore from '../../store/useStore'

export default function ElevationProfile() {
  const canvasRef = useRef(null)
  const trails = useStore((s) => s.trails)
  const selectedSegments = useStore((s) => s.selectedSegments)
  const computedRoute = useStore((s) => s.computedRoute)
  const mode = useStore((s) => s.mode)

  // Get the relevant segment IDs
  const segmentIds = mode === 'route' && computedRoute
    ? computedRoute.segments
    : [...selectedSegments]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !trails || segmentIds.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Collect elevation points from selected segments (in order for route, any order for select)
    const elevations = []
    let cumDist = 0

    for (const segId of segmentIds) {
      const feat = trails.features.find((f) => f.properties.id === segId)
      if (!feat) continue
      const coords = feat.geometry.coordinates // [lon, lat, elev]
      for (let i = 0; i < coords.length; i++) {
        if (i > 0) {
          const [lon1, lat1] = coords[i - 1]
          const [lon2, lat2] = coords[i]
          const dLat = (lat2 - lat1) * Math.PI / 180
          const dLon = (lon2 - lon1) * Math.PI / 180
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2
          cumDist += 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        }
        elevations.push({ dist: cumDist, elev: coords[i][2] || 0 })
      }
    }

    if (elevations.length < 2) return

    const minElev = Math.min(...elevations.map((e) => e.elev))
    const maxElev = Math.max(...elevations.map((e) => e.elev))
    const maxDist = elevations[elevations.length - 1].dist
    const elevRange = maxElev - minElev || 1

    // Padding
    const pad = { top: 8, right: 8, bottom: 20, left: 36 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Fill background
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, w, h)

    // Draw filled area
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top + plotH)
    for (const pt of elevations) {
      const x = pad.left + (pt.dist / maxDist) * plotW
      const y = pad.top + plotH - ((pt.elev - minElev) / elevRange) * plotH
      ctx.lineTo(x, y)
    }
    ctx.lineTo(pad.left + plotW, pad.top + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(42, 157, 143, 0.15)'
    ctx.fill()

    // Draw line
    ctx.beginPath()
    for (let i = 0; i < elevations.length; i++) {
      const x = pad.left + (elevations[i].dist / maxDist) * plotW
      const y = pad.top + plotH - ((elevations[i].elev - minElev) / elevRange) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#2a9d8f'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Y axis labels (elevation)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '9px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(maxElev)} ft`, pad.left - 4, pad.top + 8)
    ctx.fillText(`${Math.round(minElev)} ft`, pad.left - 4, pad.top + plotH)

    // X axis labels (distance)
    ctx.textAlign = 'center'
    ctx.fillText('0', pad.left, pad.top + plotH + 14)
    ctx.fillText(`${maxDist.toFixed(1)} mi`, pad.left + plotW, pad.top + plotH + 14)

    // Elevation gain
    let gain = 0
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i].elev - elevations[i - 1].elev
      if (diff > 0) gain += diff
    }
    ctx.fillStyle = '#64748b'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(gain)} ft gain`, w / 2, pad.top + plotH + 14)

  }, [trails, segmentIds])

  if (segmentIds.length === 0) return null

  return (
    <div className="border-t border-stone-200 bg-stone-50 p-2">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 80 }}
      />
    </div>
  )
}

import { useRef, useEffect } from 'react'
import useStore from '../../store/useStore'

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Try to order segments into a connected chain by matching endpoints
function orderSegments(features) {
  if (features.length <= 1) return features

  const remaining = [...features]
  const ordered = [remaining.shift()]

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1]
    const lastEnd = last.properties.endNode

    // Find a segment whose start or end connects to our chain's end
    let bestIdx = -1
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].properties.startNode === lastEnd || remaining[i].properties.endNode === lastEnd) {
        bestIdx = i
        break
      }
    }

    if (bestIdx === -1) {
      // No connected segment found — just append the next one (gap)
      ordered.push(remaining.shift())
    } else {
      const seg = remaining.splice(bestIdx, 1)[0]
      // Flip if needed so the connecting end comes first
      if (seg.properties.endNode === lastEnd) {
        // Reverse the coordinates for display
        seg._reversed = true
      }
      ordered.push(seg)
    }
  }

  return ordered
}

export default function ElevationProfile() {
  const canvasRef = useRef(null)
  const trails = useStore((s) => s.trails)
  const selectedSegments = useStore((s) => s.selectedSegments)
  const computedRoute = useStore((s) => s.computedRoute)
  const mode = useStore((s) => s.mode)

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

    // Get features and order them into a connected chain
    const features = segmentIds
      .map((id) => trails.features.find((f) => f.properties.id === id))
      .filter(Boolean)

    const ordered = mode === 'route' ? features : orderSegments(features)

    // Collect elevation points, detecting gaps between non-adjacent segments
    const sections = [] // array of arrays — each sub-array is a connected run
    let currentSection = []
    let cumDist = 0

    for (let s = 0; s < ordered.length; s++) {
      const feat = ordered[s]
      let coords = [...feat.geometry.coordinates]
      if (feat._reversed) coords = coords.reverse()

      // Check if this segment connects to the previous one
      if (s > 0 && currentSection.length > 0) {
        const prevLast = currentSection[currentSection.length - 1]
        const thisFirst = coords[0]
        const gap = haversine(prevLast.lat, prevLast.lon, thisFirst[1], thisFirst[0])
        if (gap > 0.1) {
          // Gap — start a new section
          sections.push(currentSection)
          currentSection = []
          cumDist += 0.05 // small visual gap
        }
      }

      for (let i = 0; i < coords.length; i++) {
        const [lon, lat, elev] = coords[i]
        if (currentSection.length > 0) {
          const prev = currentSection[currentSection.length - 1]
          cumDist += haversine(prev.lat, prev.lon, lat, lon)
        }
        currentSection.push({ dist: cumDist, elev: elev || 0, lat, lon })
      }
    }
    if (currentSection.length > 0) sections.push(currentSection)

    const allPoints = sections.flat()
    if (allPoints.length < 2) return

    const minElev = Math.min(...allPoints.map((e) => e.elev))
    const maxElev = Math.max(...allPoints.map((e) => e.elev))
    const maxDist = allPoints[allPoints.length - 1].dist
    const elevRange = maxElev - minElev || 1

    const pad = { top: 8, right: 8, bottom: 20, left: 36 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, w, h)

    // Draw each connected section separately
    for (const section of sections) {
      // Filled area
      ctx.beginPath()
      ctx.moveTo(
        pad.left + (section[0].dist / maxDist) * plotW,
        pad.top + plotH
      )
      for (const pt of section) {
        const x = pad.left + (pt.dist / maxDist) * plotW
        const y = pad.top + plotH - ((pt.elev - minElev) / elevRange) * plotH
        ctx.lineTo(x, y)
      }
      ctx.lineTo(
        pad.left + (section[section.length - 1].dist / maxDist) * plotW,
        pad.top + plotH
      )
      ctx.closePath()
      ctx.fillStyle = 'rgba(42, 157, 143, 0.15)'
      ctx.fill()

      // Line
      ctx.beginPath()
      for (let i = 0; i < section.length; i++) {
        const x = pad.left + (section[i].dist / maxDist) * plotW
        const y = pad.top + plotH - ((section[i].elev - minElev) / elevRange) * plotH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = '#2a9d8f'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Labels
    ctx.fillStyle = '#94a3b8'
    ctx.font = '9px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(maxElev)} ft`, pad.left - 4, pad.top + 8)
    ctx.fillText(`${Math.round(minElev)} ft`, pad.left - 4, pad.top + plotH)

    ctx.textAlign = 'center'
    ctx.fillText('0', pad.left, pad.top + plotH + 14)
    ctx.fillText(`${maxDist.toFixed(1)} mi`, pad.left + plotW, pad.top + plotH + 14)

    // Elevation gain
    let gain = 0
    for (const section of sections) {
      for (let i = 1; i < section.length; i++) {
        const diff = section[i].elev - section[i - 1].elev
        if (diff > 0) gain += diff
      }
    }
    ctx.fillStyle = '#64748b'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(gain)} ft gain`, w / 2, pad.top + plotH + 14)
  }, [trails, segmentIds, mode])

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

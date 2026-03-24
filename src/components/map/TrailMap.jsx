import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, Polygon, Marker } from 'react-leaflet'
import L from 'leaflet'
import useStore from '../../store/useStore'
import { useMemo, useRef, useCallback } from 'react'

const FOREST_PARK_CENTER = [45.565, -122.775]
const DEFAULT_ZOOM = 13

const BOUNDS = [
  [45.505, -122.84],
  [45.625, -122.69],
]

const OUTER_RING = [
  [44.0, -124.0],
  [44.0, -121.0],
  [47.0, -121.0],
  [47.0, -124.0],
  [44.0, -124.0],
]

// 5 trail type colors
const TRAIL_COLORS = {
  wildwood:  '#1b7340',  // deep forest green — the spine
  leif:      '#5c4033',  // dark brown — the main road
  trail:     '#2a9d8f',  // teal — named trails
  connector: '#94a3b8',  // muted gray — short connectors
  firelane:  '#d4a017',  // golden — fire lanes
}

const TRAIL_WEIGHTS = {
  wildwood: 4,
  leif: 4,
  trail: 3,
  connector: 2,
  firelane: 2.5,
}

function getTrailColor(type) {
  return TRAIL_COLORS[type] || TRAIL_COLORS.trail
}
function getTrailWeight(type) {
  return TRAIL_WEIGHTS[type] || 3
}

// Create a text-only DivIcon for map labels
function labelIcon(text, className = '') {
  return L.divIcon({
    className: `trail-label ${className}`,
    html: `<span>${text}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// Compute midpoint of a coordinate array
function midpoint(coords) {
  const mid = Math.floor(coords.length / 2)
  return [coords[mid][1], coords[mid][0]] // [lat, lng]
}

export default function TrailMap() {
  const trails = useStore((s) => s.trails)
  const trailheads = useStore((s) => s.trailheads)
  const boundary = useStore((s) => s.boundary)
  const selectedSegments = useStore((s) => s.selectedSegments)
  const toggleSegment = useStore((s) => s.toggleSegment)
  const mode = useStore((s) => s.mode)
  const computedRoute = useStore((s) => s.computedRoute)
  const reachableResult = useStore((s) => s.reachableResult)

  const storeRef = useRef({ selectedSegments, toggleSegment, mode })
  storeRef.current = { selectedSegments, toggleSegment, mode }

  const defaultStyle = useCallback((feature) => {
    const type = feature.properties.type
    return {
      color: getTrailColor(type),
      weight: getTrailWeight(type),
      opacity: 0.85,
    }
  }, [])

  const onEachFeature = useCallback((feature, layer) => {
    const { name, distanceMiles, id, type } = feature.properties
    layer.bindTooltip(`${name} (${distanceMiles.toFixed(2)} mi)`, { sticky: true })

    const baseWeight = getTrailWeight(type)
    layer.on({
      mouseover: (e) => {
        if (!storeRef.current.selectedSegments.has(id)) {
          e.target.setStyle({ weight: baseWeight + 2, opacity: 1 })
        }
      },
      mouseout: (e) => {
        if (!storeRef.current.selectedSegments.has(id)) {
          e.target.setStyle({ weight: baseWeight, opacity: 0.85 })
        }
      },
      click: () => {
        if (storeRef.current.mode === 'select') {
          storeRef.current.toggleSegment(id, distanceMiles)
        }
      },
    })
  }, [])

  const selectedFeatures = useMemo(() => {
    if (!trails || selectedSegments.size === 0) return null
    return {
      type: 'FeatureCollection',
      features: trails.features.filter((f) => selectedSegments.has(f.properties.id)),
    }
  }, [trails, selectedSegments])

  const selectedKey = useMemo(
    () => `selected-${[...selectedSegments].sort().join(',')}`,
    [selectedSegments]
  )

  // Route overlay
  const routeFeatures = useMemo(() => {
    if (!trails || !computedRoute) return null
    const segSet = new Set(computedRoute.segments)
    return {
      type: 'FeatureCollection',
      features: trails.features.filter((f) => segSet.has(f.properties.id)),
    }
  }, [trails, computedRoute])

  const routeKey = useMemo(
    () => computedRoute ? `route-${computedRoute.segments.join(',')}` : 'no-route',
    [computedRoute]
  )

  // Reachable segments overlay (distance explorer)
  const reachableFeatures = useMemo(() => {
    if (!trails || !reachableResult) return null
    const segSet = new Set(reachableResult.segments)
    return {
      type: 'FeatureCollection',
      features: trails.features.filter((f) => segSet.has(f.properties.id)),
    }
  }, [trails, reachableResult])

  const reachableKey = useMemo(
    () => reachableResult ? `reach-${reachableResult.segments.length}` : 'no-reach',
    [reachableResult]
  )

  const parkBoundary = useMemo(() => {
    if (!boundary) return null
    return boundary.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])
  }, [boundary])

  // Build trail name labels — place on longest segments, spread apart
  const trailLabels = useMemo(() => {
    if (!trails) return []

    // Group segments by trailName, collect their midpoints + distances
    const byTrail = new Map()
    for (const f of trails.features) {
      const { trailName, type, distanceMiles } = f.properties
      const coords = f.geometry.coordinates
      if (coords.length < 2 || type === 'connector') continue

      if (!byTrail.has(trailName)) byTrail.set(trailName, { type, segments: [] })
      byTrail.get(trailName).segments.push({
        pos: midpoint(coords),
        dist: distanceMiles,
        coords,
      })
    }

    const labels = []

    for (const [trailName, { type, segments }] of byTrail) {
      // Sort segments by distance descending — label the longest ones
      const sorted = [...segments].sort((a, b) => b.dist - a.dist)

      const className = type === 'wildwood' ? 'label-wildwood'
        : type === 'leif' ? 'label-leif'
        : type === 'firelane' ? 'label-firelane'
        : 'label-trail'

      const displayName = type === 'wildwood' ? 'Wildwood Trail'
        : type === 'leif' ? 'Leif Erikson Dr.'
        : trailName

      if (type === 'wildwood' || type === 'leif') {
        // Place labels evenly along the trail by geographic spread
        // Use original segment order (not sorted by distance) for geographic distribution
        const maxLabels = type === 'wildwood' ? 10 : 5
        const spacing = type === 'wildwood' ? 0.010 : 0.012
        const placed = []
        // Walk through segments in order and place labels at even intervals
        const step = Math.max(1, Math.floor(segments.length / maxLabels))
        for (let i = 0; i < segments.length; i += step) {
          const seg = segments[i]
          const tooClose = placed.some(
            (p) => Math.abs(p[0] - seg.pos[0]) < spacing && Math.abs(p[1] - seg.pos[1]) < spacing
          )
          if (!tooClose) {
            labels.push({ pos: seg.pos, text: displayName, className })
            placed.push(seg.pos)
          }
          if (placed.length >= maxLabels) break
        }
      } else {
        // Named trails / firelanes: label on longest segment, add 2nd if spread out
        if (sorted.length > 0) {
          labels.push({ pos: sorted[0].pos, text: displayName, className })

          // Add a second label if there's a segment far enough from the first
          if (sorted.length >= 2) {
            const first = sorted[0].pos
            const distant = sorted.find(
              (seg) => seg !== sorted[0] &&
                (Math.abs(first[0] - seg.pos[0]) > 0.006 || Math.abs(first[1] - seg.pos[1]) > 0.006)
            )
            if (distant) {
              labels.push({ pos: distant.pos, text: displayName, className })
            }
          }
        }
      }
    }

    return labels
  }, [trails])

  return (
    <MapContainer
      center={FOREST_PARK_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}
      maxBounds={BOUNDS}
      maxBoundsViscosity={1.0}
      minZoom={12}
      renderer={L.canvas({ tolerance: 10 })}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
        maxZoom={18}
        opacity={0.3}
      />

      {parkBoundary && (
        <Polygon
          positions={[OUTER_RING, parkBoundary]}
          pathOptions={{
            fillColor: '#1a1a2e',
            fillOpacity: 0.8,
            stroke: false,
          }}
        />
      )}
      {parkBoundary && (
        <Polygon
          positions={parkBoundary}
          pathOptions={{
            color: '#4a5568',
            weight: 2,
            opacity: 0.4,
            fill: false,
          }}
        />
      )}

      {trails && (
        <GeoJSON
          key="trails"
          data={trails}
          style={defaultStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {selectedSegments.size > 0 && selectedFeatures && (
        <GeoJSON
          key={selectedKey}
          data={selectedFeatures}
          style={{ color: '#e76f51', weight: 6, opacity: 1, interactive: false }}
          interactive={false}
        />
      )}
      {routeFeatures && (
        <GeoJSON
          key={routeKey}
          data={routeFeatures}
          style={{ color: '#264653', weight: 7, opacity: 0.9, dashArray: '12 6', interactive: false }}
          interactive={false}
        />
      )}
      {reachableFeatures && (
        <GeoJSON
          key={reachableKey}
          data={reachableFeatures}
          style={{ color: '#7c3aed', weight: 6, opacity: 0.85, interactive: false }}
          interactive={false}
        />
      )}
      {reachableResult && reachableResult.endpoints.map((ep, i) => (
        <CircleMarker
          key={`ep-${i}`}
          center={[ep.lat, ep.lon]}
          radius={5}
          fillColor="#7c3aed"
          fillOpacity={0.9}
          color="#fff"
          weight={2}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent className="endpoint-label">
            {ep.label} ({ep.distance} mi)
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Trail name labels */}
      {trailLabels.map((label, i) => (
        <Marker
          key={`label-${i}`}
          position={label.pos}
          icon={labelIcon(label.text, label.className)}
          interactive={false}
        />
      ))}

      {/* Trailhead markers with permanent labels */}
      {trailheads && trailheads.map((th) => (
        <CircleMarker
          key={th.id}
          center={[th.lat, th.lng]}
          radius={5}
          fillColor="#264653"
          fillOpacity={0.9}
          color="#fff"
          weight={2}
        >
          <Tooltip direction="right" offset={[8, 0]} permanent className="trailhead-label">
            {th.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

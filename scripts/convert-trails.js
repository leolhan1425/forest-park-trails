/**
 * Convert Forest Park trail XLSX data into GeoJSON + boundary data.
 *
 * Key behavior: Splits trails at every junction/intersection so each
 * segment is a clickable stretch between two crossings.
 *
 * Input: 5 XLSX files in ~/Downloads/
 * Output: public/data/trails.json, trailheads.json, graph.json, boundary.json
 */

import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import convex from '@turf/convex'
import buffer from '@turf/buffer'
import { featureCollection, point } from '@turf/helpers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(__dirname, '..')
const DOWNLOADS = join(process.env.HOME, 'Downloads')
const OUT_DIR = join(PROJECT, 'public', 'data')

const FILES = {
  wildwood: join(DOWNLOADS, 'WildwoodTrailNEZ.xlsx'),
  leifErikson: join(DOWNLOADS, 'LeifEriksonDriveNEZ.xlsx'),
  firelanes: join(DOWNLOADS, 'ForestRoadsFireLanesNEZ.xlsx'),
  otherTrails: join(DOWNLOADS, 'OtherTrailsNEZ.xlsx'),
}

// --- Trail type classification (5 categories) ---
// 1. wildwood   — Wildwood Trail (the main 30-mile spine)
// 2. leif       — Leif Erikson Drive
// 3. trail      — Named trails connecting to the network (Alder, Maple, etc.)
// 4. connector  — Short connectors to trailheads/parking, unnamed paths
// 5. firelane   — Fire lanes

const FIRELANE_PATTERN = /^Fire Lane/
const CONNECTOR_NAMES = new Set([
  'access to Newton', 'connector', 'cut-over', 'parking access', 'shortcut',
  'Bray', 'Creek', 'Morak', 'Maple Link', 'Nature Link',
])
const ROAD_AS_TRAIL = new Set([
  'BPA Road', 'Newton Road', 'Saltzman Road',
  'Springville Road', 'Holman Lane', 'Willalatin Road',
])

function classifyTrail(name) {
  if (name === 'Wildwood') return 'wildwood'
  if (name === 'Leif Erikson') return 'leif'
  if (FIRELANE_PATTERN.test(name)) return 'firelane'
  if (CONNECTOR_NAMES.has(name)) return 'connector'
  // Roads like Saltzman, BPA etc. are effectively trails for hikers
  return 'trail'
}

// --- Read points from a sheet ---
function readPoints(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const headers = rows[0]
  const cols = {}
  headers.forEach((h, i) => {
    const key = String(h).trim().toLowerCase()
    if (key.includes('latdeg')) cols.latDeg = i
    if (key.includes('latmin')) cols.latMin = i
    if (key.includes('latsec')) cols.latSec = i
    if (key.includes('longdeg')) cols.lonDeg = i
    if (key.includes('longmin')) cols.lonMin = i
    if (key.includes('longsec')) cols.lonSec = i
    if (key === 'z _ft' || key === 'z_ft') cols.elev = i
    if (key === 'trailname' || key === 'roadname') cols.name = i
    if (key === 'notes') cols.notes = i
    if (key === 'trailpoint' || key === 'roadpoint') cols.point = i
  })

  const points = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    if (r[cols.point] == null) continue
    const latDeg = Number(r[cols.latDeg]) || 0
    const latMin = Number(r[cols.latMin]) || 0
    const latSec = Number(r[cols.latSec]) || 0
    const lonDeg = Number(r[cols.lonDeg]) || 0
    const lonMin = Number(r[cols.lonMin]) || 0
    const lonSec = Number(r[cols.lonSec]) || 0

    const lat = latDeg + latMin / 60 + latSec / 3600
    const lon = -(Math.abs(lonDeg) + lonMin / 60 + lonSec / 3600)
    const elev = Number(r[cols.elev]) || 0
    const name = cols.name != null ? String(r[cols.name] || '').trim() : ''
    const notes = cols.notes != null ? String(r[cols.notes] || '').trim() : ''

    points.push({ lat, lon, elev, name, notes, pointIdx: Number(r[cols.point]) })
  }
  return points
}

// --- Read segment mileage (cumulative) ---
function readSegmentMileages(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const headers = rows[0]
  const cols = {}
  headers.forEach((h, i) => {
    const key = String(h).trim().toLowerCase()
    if (key === 'trailname' || key === 'roadname') cols.name = i
    if (key === 'mileage') cols.mileage = i
    if (key === 'segment') cols.segment = i
  })

  const result = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    if (r[cols.segment] == null) continue
    result.push({
      name: String(r[cols.name] || '').trim(),
      mileage: Number(r[cols.mileage]) || 0,
    })
  }
  return result
}

// --- Haversine distance between two points in miles ---
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// --- Check if a note references a trail junction (not a mile marker) ---
function isJunctionNote(note) {
  if (!note) return false
  const lower = note.toLowerCase()
  // Skip pure mile markers like "0.25 miles", "1.00 miles"
  if (/^\d+\.?\d*\s*miles?$/.test(note.trim())) return false
  // Junction keywords
  if (lower.includes('junction') || lower.includes('intersection')) return true
  // Trail/road names mentioned (Leif Erikson notes use bare names)
  if (/trail|fire lane|road|lane/i.test(note)) return true
  // Bare trail name references on Leif Erikson (e.g., "WildCherry Trail", "Dogwood Trail")
  if (/^[A-Z][a-z]+ ?(Trail|Road|Lane)?$/.test(note.trim())) return true
  // Parking/gate at start/end of a trail
  if (lower.includes('parking') || lower.includes('edge of')) return true
  // Injected trailhead split points
  if (lower.startsWith('trailhead:')) return true
  return false
}

// --- Extract junction label from a note ---
function junctionLabel(note) {
  if (!note) return 'junction'
  // "junction, Hemlock Trail" → "Hemlock Trail"
  let m = note.match(/(?:junction|intersection),?\s*(.+)/i)
  if (m) return m[1].trim()
  // Bare name like "WildCherry Trail" or "Fire Lane 1"
  return note.trim()
}

// --- Group points by trail name ---
function groupByTrail(points) {
  const groups = new Map()
  for (const p of points) {
    if (!p.name) continue
    if (!groups.has(p.name)) groups.set(p.name, [])
    groups.get(p.name).push(p)
  }
  return groups
}

// --- Remove outlier points that jump far from neighbors ---
function removeOutliers(points, maxJumpMiles = 0.1) {
  if (points.length < 3) return points
  const clean = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const distPrev = haversine(points[i].lat, points[i].lon, points[i - 1].lat, points[i - 1].lon)
    const distNext = haversine(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon)
    // If this point is far from BOTH neighbors, it's an outlier
    if (distPrev > maxJumpMiles && distNext > maxJumpMiles) {
      console.log(`  Removed outlier in ${points[i].name} at point ${i} (jumped ${distPrev.toFixed(3)} mi)`)
      continue
    }
    clean.push(points[i])
  }
  clean.push(points[points.length - 1])
  return clean
}

// --- Simplify a point array for display ---
function simplifyPoints(points, maxPoints = 80) {
  if (points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  const result = []
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1 || i % step === 0) {
      result.push(points[i])
    }
  }
  return result
}

// --- Compute distance of a point array in miles ---
function computeDistance(points) {
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
  }
  return dist
}

// --- Inject trailhead split points into a trail's point array ---
// Finds the closest point on the trail to each trailhead (within tolerance)
// and marks it as a split point by adding a synthetic note.
function injectTrailheadSplits(points, trailheads, toleranceMiles = 0.06) {
  for (const th of trailheads) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = haversine(points[i].lat, points[i].lon, th.lat, th.lng)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    // Only inject if close enough and not already a junction point
    if (bestDist < toleranceMiles && bestIdx > 0 && bestIdx < points.length - 1) {
      if (!isJunctionNote(points[bestIdx].notes)) {
        points[bestIdx].notes = `trailhead: ${th.name}`
      }
    }
  }
}

// --- Split a trail's points at junction indices, produce sub-segments ---
function splitAtJunctions(trailName, points) {
  // Find indices of junction points (includes injected trailhead splits)
  const junctionIndices = []
  for (let i = 0; i < points.length; i++) {
    if (isJunctionNote(points[i].notes)) {
      junctionIndices.push(i)
    }
  }

  // If no junctions, return the whole trail as one segment
  if (junctionIndices.length === 0) {
    return [{
      name: trailName,
      startLabel: 'start',
      endLabel: 'end',
      points,
    }]
  }

  // Build sub-segments between consecutive junctions
  const segments = []

  // Start → first junction
  if (junctionIndices[0] > 0) {
    segments.push({
      name: trailName,
      startLabel: 'start',
      endLabel: junctionLabel(points[junctionIndices[0]].notes),
      points: points.slice(0, junctionIndices[0] + 1),
    })
  }

  // Between consecutive junctions
  for (let j = 0; j < junctionIndices.length - 1; j++) {
    const fromIdx = junctionIndices[j]
    const toIdx = junctionIndices[j + 1]
    if (toIdx - fromIdx < 2) continue // skip zero-length segments
    segments.push({
      name: trailName,
      startLabel: junctionLabel(points[fromIdx].notes),
      endLabel: junctionLabel(points[toIdx].notes),
      points: points.slice(fromIdx, toIdx + 1),
    })
  }

  // Last junction → end
  const lastJIdx = junctionIndices[junctionIndices.length - 1]
  if (lastJIdx < points.length - 1) {
    segments.push({
      name: trailName,
      startLabel: junctionLabel(points[lastJIdx].notes),
      endLabel: 'end',
      points: points.slice(lastJIdx),
    })
  }

  return segments
}

// --- Trailhead data ---
const TRAILHEADS = [
  { id: 'th-1', name: 'Lower Macleay Park', lat: 45.536085, lng: -122.712436, parking: '~6 spaces' },
  { id: 'th-2', name: 'Thurman: Leif Erikson Drive', lat: 45.539692, lng: -122.724152, parking: '~10 spaces' },
  { id: 'th-3', name: 'Upper Macleay Park', lat: 45.526915, lng: -122.726383, parking: '~10 spaces' },
  { id: 'th-4', name: 'Aspen Trail', lat: 45.536235, lng: -122.718830, parking: '~4 spaces' },
  { id: 'th-5', name: 'Holman Lane', lat: 45.533710, lng: -122.718658, parking: null },
  { id: 'th-6', name: 'Tunnel & Cumberland Trails', lat: 45.530343, lng: -122.717328, parking: '~6 spaces' },
  { id: 'th-7', name: 'Forest Lane: Firelane 1', lat: 45.545252, lng: -122.746038, parking: '~20 spaces' },
  { id: 'th-8', name: 'NW 53rd: Birch Trail', lat: 45.533551, lng: -122.732962, parking: '~12 spaces' },
  { id: 'th-9', name: 'NW 53rd: Dogwood & Wild Cherry', lat: 45.538760, lng: -122.734280, parking: '~8 spaces' },
  { id: 'th-10', name: 'NW 53rd: Wildwood Trail', lat: 45.540533, lng: -122.737327, parking: '~20 spaces' },
  { id: 'th-11', name: 'Lower Saltzman Road', lat: 45.566588, lng: -122.753592, parking: '~20 spaces' },
  { id: 'th-12', name: 'Upper Springville Road', lat: 45.573978, lng: -122.789812, parking: '~15 spaces' },
  { id: 'th-13', name: 'Upper Saltzman & Firelane 5', lat: 45.562141, lng: -122.783589, parking: '~15 spaces' },
  { id: 'th-14', name: 'Germantown: Leif Erikson', lat: 45.589236, lng: -122.790327, parking: '~20 spaces' },
  { id: 'th-15', name: 'Germantown: Wildwood Trail', lat: 45.587555, lng: -122.794104, parking: '~20 spaces' },
  { id: 'th-16', name: 'Ridge Trail', lat: 45.580767, lng: -122.766294, parking: '~3 spaces' },
  { id: 'th-17', name: 'Newton Road', lat: 45.591819, lng: -122.802601, parking: '~10 spaces' },
  { id: 'th-18', name: 'Newberry Road', lat: 45.605571, lng: -122.823544, parking: '~12 spaces' },
  { id: 'th-19', name: 'Pittock Mansion', lat: 45.525532, lng: -122.718101, parking: '~40 paid spaces' },
  { id: 'th-20', name: 'Oregon Zoo / Washington Park', lat: 45.509700, lng: -122.716400, parking: 'Large paid lot' },
]

// --- Main ---
async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log('Reading XLSX files...')
  const wbWildwood = XLSX.readFile(FILES.wildwood)
  const wbLeif = XLSX.readFile(FILES.leifErikson)
  const wbFirelanes = XLSX.readFile(FILES.firelanes)
  const wbOther = XLSX.readFile(FILES.otherTrails)

  const allPoints = [
    ...readPoints(wbWildwood, 'TrailPoints'),
    ...readPoints(wbLeif, 'RoadPoints'),
    ...readPoints(wbFirelanes, 'TrailPoints'),
    ...readPoints(wbOther, 'TrailPoints'),
  ]

  console.log(`Total points: ${allPoints.length}`)

  const grouped = groupByTrail(allPoints)
  console.log(`Trails: ${grouped.size}`)

  // --- Clean outliers and inject trailhead splits ---
  for (const [trailName, points] of grouped) {
    const cleaned = removeOutliers(points)
    grouped.set(trailName, cleaned)
  }
  for (const [trailName, points] of grouped) {
    injectTrailheadSplits(points, TRAILHEADS)
  }

  // --- Split each trail at junctions + trailheads ---
  const features = []
  let segId = 0
  let totalSplitSegments = 0

  for (const [trailName, points] of grouped) {
    if (points.length < 2) continue

    const subSegments = splitAtJunctions(trailName, points)
    totalSplitSegments += subSegments.length

    for (const sub of subSegments) {
      const dist = computeDistance(sub.points)
      if (dist < 0.005) continue // skip tiny segments < ~25 ft

      const simplified = simplifyPoints(sub.points)
      const coordinates = simplified.map((p) => [p.lon, p.lat, p.elev])

      // Build display name
      let displayName = trailName
      if (subSegments.length > 1) {
        displayName = `${trailName}: ${sub.startLabel} → ${sub.endLabel}`
      }

      // Keep start/end coords for graph building
      const startPt = sub.points[0]
      const endPt = sub.points[sub.points.length - 1]

      segId++
      features.push({
        type: 'Feature',
        properties: {
          id: `seg-${segId}`,
          name: displayName,
          trailName,
          type: classifyTrail(trailName),
          distanceMiles: Math.round(dist * 100) / 100,
          startLabel: sub.startLabel,
          endLabel: sub.endLabel,
          startCoord: [startPt.lat, startPt.lon],
          endCoord: [endPt.lat, endPt.lon],
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      })
    }
  }

  console.log(`\nSplit into ${features.length} segments (from ${grouped.size} trails)`)

  // Log some examples
  const wildwoodSegs = features.filter((f) => f.properties.trailName === 'Wildwood')
  const leifSegs = features.filter((f) => f.properties.trailName === 'Leif Erikson')
  console.log(`  Wildwood: ${wildwoodSegs.length} segments`)
  console.log(`  Leif Erikson: ${leifSegs.length} segments`)
  for (const s of wildwoodSegs.slice(0, 5)) {
    console.log(`    ${s.properties.name} (${s.properties.distanceMiles} mi)`)
  }

  const trailsGeoJSON = { type: 'FeatureCollection', features }

  // --- Compute park boundary ---
  console.log('\nComputing park boundary...')
  // Sample every 20th point for the hull (performance)
  const samplePoints = []
  for (let i = 0; i < allPoints.length; i += 20) {
    const p = allPoints[i]
    if (p.lat && p.lon) samplePoints.push(point([p.lon, p.lat]))
  }
  const pointsFC = featureCollection(samplePoints)
  const hull = convex(pointsFC)
  const boundary = buffer(hull, 0.3, { units: 'kilometers' })
  console.log(`  Boundary: ${boundary.geometry.coordinates[0].length} points`)

  // --- Build graph from segment endpoints ---
  console.log('\nBuilding graph...')
  const SNAP_TOLERANCE = 0.001 // ~100m in degrees — catches BPA Road dogleg + similar gaps
  const nodeMap = new Map() // "lat,lon" key -> nodeId
  const nodes = {} // nodeId -> { id, lat, lon, label }
  const adjacency = {} // nodeId -> [{ node, segment, distance }]
  let nodeCounter = 0

  function getOrCreateNode(lat, lon, label) {
    // Snap to existing node if close enough
    for (const [key, existingId] of nodeMap) {
      const [eLat, eLon] = key.split(',').map(Number)
      if (Math.abs(eLat - lat) < SNAP_TOLERANCE && Math.abs(eLon - lon) < SNAP_TOLERANCE) {
        return existingId
      }
    }
    const id = `n${++nodeCounter}`
    const key = `${lat},${lon}`
    nodeMap.set(key, id)
    nodes[id] = { id, lat, lon, label }
    adjacency[id] = []
    return id
  }

  for (const f of features) {
    const { id, distanceMiles, startLabel, endLabel, startCoord, endCoord } = f.properties
    const startNode = getOrCreateNode(startCoord[0], startCoord[1], startLabel)
    const endNode = getOrCreateNode(endCoord[0], endCoord[1], endLabel)

    // Add edges in both directions (undirected)
    const trailType = f.properties.type
    adjacency[startNode].push({ node: endNode, segment: id, distance: distanceMiles, trailType })
    adjacency[endNode].push({ node: startNode, segment: id, distance: distanceMiles, trailType })

    // Store node IDs on the feature for frontend use
    f.properties.startNode = startNode
    f.properties.endNode = endNode
  }

  // Replace generic "start"/"end" labels with trail names or nearest trailhead
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.label === 'start' || node.label === 'end') {
      // Find which trail this node belongs to
      const connectedSegs = adjacency[nodeId] || []
      const trailNames = new Set()
      for (const edge of connectedSegs) {
        const feat = features.find((f) => f.properties.id === edge.segment)
        if (feat) trailNames.add(feat.properties.trailName)
      }
      // Check if a trailhead is nearby
      let nearestTh = null
      let nearestDist = Infinity
      for (const th of TRAILHEADS) {
        const d = haversine(node.lat, node.lon, th.lat, th.lng)
        if (d < nearestDist) { nearestDist = d; nearestTh = th }
      }
      if (nearestDist < 0.15) {
        node.label = nearestTh.name
      } else {
        node.label = [...trailNames].join(' / ') + (node.label === 'end' ? ' end' : ' start')
      }
    }
  }

  // Tag trailheads with nearest graph nodes
  for (const th of TRAILHEADS) {
    let bestNode = null
    let bestDist = Infinity
    for (const [, node] of Object.entries(nodes)) {
      const d = haversine(th.lat, th.lng, node.lat, node.lon)
      if (d < bestDist) {
        bestDist = d
        bestNode = node.id
      }
    }
    th.nodeId = bestNode
  }

  const graph = { nodes, adjacency }
  console.log(`  ${Object.keys(nodes).length} nodes, ${features.length} edges`)

  // --- Write outputs ---
  const trailsJson = JSON.stringify(trailsGeoJSON)
  await writeFile(join(OUT_DIR, 'trails.json'), trailsJson)
  await writeFile(join(OUT_DIR, 'trailheads.json'), JSON.stringify(TRAILHEADS, null, 2))
  await writeFile(join(OUT_DIR, 'graph.json'), JSON.stringify(graph, null, 2))
  await writeFile(join(OUT_DIR, 'boundary.json'), JSON.stringify(boundary))

  const sizeMB = (Buffer.byteLength(trailsJson) / 1024 / 1024).toFixed(2)
  console.log(`\nOutput:`)
  console.log(`  trails.json: ${features.length} segments, ${sizeMB} MB`)
  console.log(`  boundary.json: written`)

  let totalMiles = 0
  for (const f of features) totalMiles += f.properties.distanceMiles
  console.log(`\nTotal: ${totalMiles.toFixed(2)} miles across ${features.length} segments`)
}

main().catch(console.error)

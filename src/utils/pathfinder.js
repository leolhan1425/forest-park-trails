/**
 * Dijkstra shortest path on the trail graph.
 *
 * Uses weighted costs that prefer trails (especially Wildwood) over
 * roads and firelanes, so routes feel natural for hikers.
 */

// Cost multipliers by trail type — lower = preferred
const TYPE_WEIGHT = {
  wildwood: 1.0,   // strongly preferred
  trail: 1.1,      // slightly prefer named trails
  leif: 1.5,       // Leif Erikson is a road, less preferred for hiking
  firelane: 1.8,   // firelanes are steep and less scenic
  connector: 1.3,  // connectors are fine but short
  road: 1.5,       // roads similar to Leif
}

export function findShortestPath(graph, startNodeId, endNodeId) {
  const { adjacency } = graph
  if (!adjacency[startNodeId] || !adjacency[endNodeId]) return null

  const cost = {}
  const realDist = {} // track actual distance (unweighted)
  const prev = {}
  const prevSeg = {}
  const visited = new Set()
  const queue = new Set(Object.keys(adjacency))

  for (const node of queue) {
    cost[node] = Infinity
    realDist[node] = Infinity
  }
  cost[startNodeId] = 0
  realDist[startNodeId] = 0

  while (queue.size > 0) {
    let current = null
    let minCost = Infinity
    for (const node of queue) {
      if (!visited.has(node) && cost[node] < minCost) {
        minCost = cost[node]
        current = node
      }
    }

    if (current === null || current === endNodeId) break

    visited.add(current)
    queue.delete(current)

    for (const edge of adjacency[current]) {
      if (visited.has(edge.node)) continue
      const weight = TYPE_WEIGHT[edge.trailType] || 1.2
      const newCost = cost[current] + edge.distance * weight
      if (newCost < cost[edge.node]) {
        cost[edge.node] = newCost
        realDist[edge.node] = realDist[current] + edge.distance
        prev[edge.node] = current
        prevSeg[edge.node] = edge.segment
      }
    }
  }

  if (cost[endNodeId] === Infinity) return null

  const path = []
  const segments = []
  let node = endNodeId
  while (node !== startNodeId) {
    path.unshift(node)
    segments.unshift(prevSeg[node])
    node = prev[node]
  }
  path.unshift(startNodeId)

  return {
    path,
    segments,
    distance: Math.round(realDist[endNodeId] * 100) / 100,
  }
}

/**
 * Find all segments reachable within a given distance from a start node.
 * Uses Dijkstra with real distances (no weighting) to find all nodes
 * within budget, then collects the segments that connect them.
 *
 * Returns { segments: [segIds], endpoints: [{nodeId, label, distance}] }
 * Endpoints are the frontier nodes — farthest reachable points on each branch.
 */
export function findReachable(graph, startNodeId, maxMiles) {
  const { adjacency, nodes } = graph
  if (!adjacency[startNodeId]) return null

  const dist = {}
  const visited = new Set()
  const reachableSegments = new Set()
  const queue = new Set(Object.keys(adjacency))

  for (const node of queue) dist[node] = Infinity
  dist[startNodeId] = 0

  while (queue.size > 0) {
    let current = null
    let minDist = Infinity
    for (const node of queue) {
      if (!visited.has(node) && dist[node] < minDist) {
        minDist = dist[node]
        current = node
      }
    }

    if (current === null || minDist > maxMiles) break

    visited.add(current)
    queue.delete(current)

    for (const edge of adjacency[current]) {
      if (visited.has(edge.node)) continue
      const newDist = dist[current] + edge.distance
      if (newDist < dist[edge.node]) {
        dist[edge.node] = newDist
      }
      // Include segment if at least the start node is within budget
      if (dist[current] <= maxMiles && newDist <= maxMiles) {
        reachableSegments.add(edge.segment)
      }
    }
  }

  // Find frontier endpoints — reachable nodes where at least one neighbor is NOT reachable
  const endpoints = []
  for (const nodeId of visited) {
    if (nodeId === startNodeId) continue
    const neighbors = adjacency[nodeId] || []
    const isFrontier = neighbors.some((e) => !visited.has(e.node) || dist[e.node] > maxMiles)
    if (isFrontier || neighbors.length <= 1) {
      const node = nodes[nodeId]
      endpoints.push({
        nodeId,
        lat: node.lat,
        lon: node.lon,
        label: node.label || nodeId,
        distance: Math.round(dist[nodeId] * 100) / 100,
      })
    }
  }

  return {
    segments: [...reachableSegments],
    endpoints,
  }
}

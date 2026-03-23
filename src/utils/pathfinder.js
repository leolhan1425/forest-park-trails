/**
 * Dijkstra shortest path on the trail graph.
 * Returns { path: [nodeIds], segments: [segmentIds], distance: miles }
 */
export function findShortestPath(graph, startNodeId, endNodeId) {
  const { adjacency } = graph
  if (!adjacency[startNodeId] || !adjacency[endNodeId]) return null

  const dist = {}
  const prev = {}
  const prevSeg = {}
  const visited = new Set()
  const queue = new Set(Object.keys(adjacency))

  for (const node of queue) {
    dist[node] = Infinity
  }
  dist[startNodeId] = 0

  while (queue.size > 0) {
    // Find unvisited node with smallest distance
    let current = null
    let minDist = Infinity
    for (const node of queue) {
      if (!visited.has(node) && dist[node] < minDist) {
        minDist = dist[node]
        current = node
      }
    }

    if (current === null || current === endNodeId) break

    visited.add(current)
    queue.delete(current)

    for (const edge of adjacency[current]) {
      if (visited.has(edge.node)) continue
      const newDist = dist[current] + edge.distance
      if (newDist < dist[edge.node]) {
        dist[edge.node] = newDist
        prev[edge.node] = current
        prevSeg[edge.node] = edge.segment
      }
    }
  }

  if (dist[endNodeId] === Infinity) return null

  // Reconstruct path
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
    distance: Math.round(dist[endNodeId] * 100) / 100,
  }
}

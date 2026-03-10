function toPersonNode(person, depth) {
  if (!person) {
    return null;
  }

  return {
    id: person.id,
    name: person.name || "Sem nome",
    birthYear: person.birthYear || null,
    deathYear: person.deathYear || null,
    sex: person.sex ?? null,
    depth,
  };
}

function normalizeYear(year) {
  if (!year || Number.isNaN(Number(year))) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(year);
  return parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
}

function createGenealogyIndex(people, parentLinks) {
  const peopleById = new Map();
  const parentsByChild = new Map();
  const childrenByParent = new Map();
  const adjacency = new Map();

  for (const person of people) {
    peopleById.set(Number(person.id), {
      ...person,
      id: Number(person.id),
      birthYear: person.birthYear ? Number(person.birthYear) : null,
      deathYear: person.deathYear ? Number(person.deathYear) : null,
    });
    adjacency.set(Number(person.id), new Set());
  }

  for (const link of parentLinks) {
    const childId = Number(link.childId);
    const parentId = Number(link.parentId);
    if (!childId || !parentId) {
      continue;
    }

    if (!parentsByChild.has(childId)) {
      parentsByChild.set(childId, []);
    }
    parentsByChild.get(childId).push({
      childId,
      parentId,
      relation: link.relation || "parent",
    });

    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId).push({
      childId,
      parentId,
      relation: link.relation || "child",
    });

    if (!adjacency.has(childId)) {
      adjacency.set(childId, new Set());
    }
    if (!adjacency.has(parentId)) {
      adjacency.set(parentId, new Set());
    }
    adjacency.get(childId).add(parentId);
    adjacency.get(parentId).add(childId);
  }

  return {
    peopleById,
    parentsByChild,
    childrenByParent,
    adjacency,
    parentLinks: parentLinks.map((link) => ({
      childId: Number(link.childId),
      parentId: Number(link.parentId),
      relation: link.relation || "parent",
    })),
  };
}

function findOldestAncestralPath(index, personId, maxDepth = 20) {
  const startId = Number(personId);
  const startPerson = index.peopleById.get(startId);
  if (!startPerson) {
    return {
      nodes: [],
      edges: [],
      generations: 0,
      warnings: ["Person not found"],
    };
  }

  let bestPath = [startId];
  let bestYear = Number.POSITIVE_INFINITY;
  let bestDepth = 0;

  const dfs = (currentId, depth, pathIds, visited) => {
    if (depth > 0) {
      const currentPerson = index.peopleById.get(currentId);
      const currentYear = normalizeYear(currentPerson?.birthYear);
      const isBetterYear = currentYear < bestYear;
      const isTieWithMoreDepth = currentYear === bestYear && depth > bestDepth;
      if (isBetterYear || isTieWithMoreDepth) {
        bestYear = currentYear;
        bestDepth = depth;
        bestPath = [...pathIds];
      }
    }

    if (depth >= maxDepth) {
      return;
    }

    const parentEdges = index.parentsByChild.get(currentId) || [];
    for (const edge of parentEdges) {
      if (visited.has(edge.parentId)) {
        continue;
      }

      visited.add(edge.parentId);
      pathIds.push(edge.parentId);
      dfs(edge.parentId, depth + 1, pathIds, visited);
      pathIds.pop();
      visited.delete(edge.parentId);
    }
  };

  dfs(startId, 0, [startId], new Set([startId]));

  const warnings = [];
  if (bestPath.length === 1) {
    warnings.push("No ancestors with parent links were found");
  }
  if (!Number.isFinite(bestYear)) {
    warnings.push("No known birth year found in reachable ancestors");
  }

  const nodes = bestPath
    .map((id, depth) => toPersonNode(index.peopleById.get(id), depth))
    .filter(Boolean);
  const edges = [];
  for (let i = 0; i < bestPath.length - 1; i += 1) {
    edges.push({
      sourceId: bestPath[i],
      targetId: bestPath[i + 1],
      relation: "ancestor",
    });
  }

  return {
    nodes,
    edges,
    generations: Math.max(bestPath.length - 1, 0),
    warnings,
  };
}

function getGenerationDistribution(index, personId, maxDepth = 20) {
  const startId = Number(personId);
  if (!index.peopleById.has(startId)) {
    return [];
  }

  const counts = new Map();
  const queue = [{ id: startId, depth: 0 }];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    counts.set(current.depth, (counts.get(current.depth) || 0) + 1);
    if (current.depth >= maxDepth) {
      continue;
    }

    const parents = index.parentsByChild.get(current.id) || [];
    for (const edge of parents) {
      if (visited.has(edge.parentId)) {
        continue;
      }
      visited.add(edge.parentId);
      queue.push({ id: edge.parentId, depth: current.depth + 1 });
    }
  }

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, count]) => ({ generation, count }));
}

function findShortestRelationshipPath(index, fromId, toId, maxDepth = 20) {
  const startId = Number(fromId);
  const targetId = Number(toId);
  if (!index.peopleById.has(startId) || !index.peopleById.has(targetId)) {
    return {
      nodes: [],
      edges: [],
      distance: -1,
      warnings: ["One or both people were not found"],
    };
  }

  const queue = [{ id: startId, depth: 0 }];
  const visited = new Set([startId]);
  const previous = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.id === targetId) {
      break;
    }
    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = index.adjacency.get(current.id) || new Set();
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      previous.set(neighbor, current.id);
      queue.push({ id: neighbor, depth: current.depth + 1 });
    }
  }

  if (!visited.has(targetId)) {
    return {
      nodes: [],
      edges: [],
      distance: -1,
      warnings: ["No relationship path found"],
    };
  }

  const ids = [targetId];
  while (ids[ids.length - 1] !== startId) {
    ids.push(previous.get(ids[ids.length - 1]));
  }
  ids.reverse();

  const nodes = ids.map((id, depth) =>
    toPersonNode(index.peopleById.get(id), depth)
  );
  const edges = [];
  for (let i = 0; i < ids.length - 1; i += 1) {
    edges.push({
      sourceId: ids[i],
      targetId: ids[i + 1],
      relation: "related",
    });
  }

  return {
    nodes,
    edges,
    distance: ids.length - 1,
    warnings: [],
  };
}

function buildNetwork(index, personId, depth = 3) {
  const startId = Number(personId);
  const maxDepth = Number(depth);
  if (!index.peopleById.has(startId)) {
    return { nodes: [], edges: [] };
  }

  const queue = [{ id: startId, depth: 0 }];
  const visitedDepth = new Map([[startId, 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= maxDepth) {
      continue;
    }
    const neighbors = index.adjacency.get(current.id) || new Set();
    for (const neighbor of neighbors) {
      const existingDepth = visitedDepth.get(neighbor);
      const nextDepth = current.depth + 1;
      if (existingDepth !== undefined && existingDepth <= nextDepth) {
        continue;
      }
      visitedDepth.set(neighbor, nextDepth);
      queue.push({ id: neighbor, depth: nextDepth });
    }
  }

  const includedIds = new Set(visitedDepth.keys());
  const nodes = [...includedIds]
    .map((id) => toPersonNode(index.peopleById.get(id), visitedDepth.get(id)))
    .filter(Boolean);

  const edges = [];
  for (const link of index.parentLinks) {
    if (includedIds.has(link.childId) && includedIds.has(link.parentId)) {
      edges.push({
        sourceId: link.childId,
        targetId: link.parentId,
        relation: link.relation || "family",
      });
    }
  }

  return { nodes, edges };
}

module.exports = {
  createGenealogyIndex,
  findOldestAncestralPath,
  getGenerationDistribution,
  findShortestRelationshipPath,
  buildNetwork,
};

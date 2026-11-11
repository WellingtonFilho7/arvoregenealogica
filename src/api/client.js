const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json();

  if (!response.ok) {
    const warning = payload?.warnings?.[0] || "Request failed";
    throw new Error(warning);
  }

  return payload;
}

export function searchPeople(query) {
  return request(`/api/search?q=${encodeURIComponent(query)}`);
}

export function getPersonSummary(personId) {
  return request(`/api/person/${personId}/summary`);
}

export function getAncestralPath(personId) {
  return request(`/api/person/${personId}/ancestral-path`);
}

export function getGenerationDistribution(personId) {
  return request(`/api/person/${personId}/generation-distribution`);
}

export function getInsights(personId) {
  return request(`/api/person/${personId}/insights`);
}

export function getMigrationTimeline(personId) {
  return request(`/api/person/${personId}/migration-timeline`);
}

export function getNetwork(personId, depth = 3) {
  return request(`/api/person/${personId}/network?depth=${depth}`);
}

export function getRelationshipPath(personId, toId) {
  return request(`/api/person/${personId}/relationship-path?toId=${toId}`);
}

export function getStory(personId) {
  return request(`/api/person/${personId}/story`);
}

export function getNotableAncestors(personId, limit = 8) {
  return request(`/api/person/${personId}/notable-ancestors?limit=${limit}`);
}

export function searchPeopleV2(query) {
  return request(`/api/v2/search?q=${encodeURIComponent(query)}`);
}

export function getExperienceV2(personId, maxDepth = 20) {
  return request(`/api/v2/person/${personId}/experience?maxDepth=${maxDepth}`);
}

export function getClaimsV2(personId, page = 1, pageSize = 12, maxDepth = 20) {
  return request(
    `/api/v2/person/${personId}/claims?page=${page}&pageSize=${pageSize}&maxDepth=${maxDepth}`
  );
}

export function getEvidenceV2(personId, claimId, maxDepth = 20) {
  return request(`/api/v2/person/${personId}/evidence/${encodeURIComponent(claimId)}?maxDepth=${maxDepth}`);
}

export function getMapV2(personId, maxDepth = 20, fromYear = null, toYear = null) {
  const params = new URLSearchParams();
  params.set("maxDepth", String(maxDepth));
  if (fromYear !== null && fromYear !== undefined) {
    params.set("fromYear", String(fromYear));
  }
  if (toYear !== null && toYear !== undefined) {
    params.set("toYear", String(toYear));
  }
  return request(`/api/v2/person/${personId}/map?${params.toString()}`);
}

export function getNetworkV2(personId, depth = 3, maxNodesPerDepth = 8) {
  return request(
    `/api/v2/person/${personId}/network?depth=${depth}&maxNodesPerDepth=${maxNodesPerDepth}`
  );
}

export function getDocumentaryV2(personId, maxDepth = 20) {
  return request(`/api/v2/person/${personId}/documentary?maxDepth=${maxDepth}`);
}

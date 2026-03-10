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

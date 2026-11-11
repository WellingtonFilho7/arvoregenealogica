export {};

const fs = require("fs");
const path = require("path");
const {
  createGenealogyIndex,
  findOldestAncestralPath,
  getGenerationDistribution,
  findShortestRelationshipPath,
  buildNetwork,
} = require("../lib/genealogy");

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const DEFAULT_V2_NETWORK_DEPTH = 3;
const DEFAULT_V2_MAX_NODES_PER_DEPTH = 8;
const HISTORIC_TITLE_RE =
  /\b(dom|dona|rei|rainha|conde|duque|barao|visconde|sir|lord|saint|sao|santa|frei)\b/i;
const GEO_LOCAL_HINTS = [
  { key: "caico", lat: -6.4564, lon: -37.0978, confidence: "high" },
  { key: "rio grande do norte", lat: -5.4026, lon: -36.9541, confidence: "medium" },
  { key: "patos", lat: -7.0174, lon: -37.2747, confidence: "high" },
  { key: "santa luzia", lat: -6.8712, lon: -36.9189, confidence: "high" },
  { key: "paraiba", lat: -7.28, lon: -36.72, confidence: "medium" },
  { key: "joao pessoa", lat: -7.1195, lon: -34.845, confidence: "high" },
  { key: "mamanguape", lat: -6.8381, lon: -35.1267, confidence: "high" },
  { key: "acari", lat: -6.4368, lon: -36.6413, confidence: "high" },
  { key: "olinda", lat: -8.0089, lon: -34.8553, confidence: "high" },
  { key: "pernambuco", lat: -8.8137, lon: -36.9541, confidence: "medium" },
  { key: "brasil", lat: -14.235, lon: -51.9253, confidence: "medium" },
  { key: "brazil", lat: -14.235, lon: -51.9253, confidence: "medium" },
  { key: "lisboa", lat: 38.7223, lon: -9.1393, confidence: "high" },
  { key: "acores", lat: 37.7412, lon: -25.6756, confidence: "medium" },
  { key: "azores", lat: 37.7412, lon: -25.6756, confidence: "medium" },
  { key: "portugal", lat: 39.3999, lon: -8.2245, confidence: "medium" },
  { key: "espanha", lat: 40.4637, lon: -3.7492, confidence: "medium" },
  { key: "spain", lat: 40.4637, lon: -3.7492, confidence: "medium" },
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractYear(dateRaw) {
  const match = String(dateRaw || "").match(/([12][0-9]{3})/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function toCentury(year) {
  if (!year) {
    return null;
  }
  return Math.floor((year - 1) / 100) + 1;
}

function buildResponse(data, meta = {}, warnings = []) {
  return {
    data,
    meta,
    warnings,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function toConfidenceFromRatio(score) {
  if (score >= 0.75) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}

function summarizeConfidence(items) {
  return items.reduce(
    (acc, item) => {
      const bucket = item?.confidence || "low";
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

function deterministicCoordinatesFromPlace(placeName) {
  const normalized = normalizeText(placeName);
  if (!normalized) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 33 + normalized.charCodeAt(i)) >>> 0;
  }
  const lat = ((hash % 14000) / 100) - 70;
  const lon = (((hash * 17) % 34000) / 100) - 170;
  return { lat, lon, geoMode: "estimated", geoConfidence: "low" };
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function birthYearScore(year) {
  if (!year) {
    return 0;
  }
  if (year <= 1500) {
    return 4;
  }
  if (year <= 1700) {
    return 3;
  }
  if (year <= 1850) {
    return 2;
  }
  if (year <= 1950) {
    return 1;
  }
  return 0;
}

class GenealogyService {
  repository: any;
  cache: any;
  dbPath: string;
  cacheTtlMs: number;
  geoOnlineCachePath: string;
  geoOnlineCache: any;
  enableOnlineGeocoder: boolean;

  constructor({ repository, cache, dbPath, cacheTtlMs = DEFAULT_CACHE_TTL }) {
    this.repository = repository;
    this.cache = cache;
    this.dbPath = dbPath;
    this.cacheTtlMs = cacheTtlMs;
    this.enableOnlineGeocoder = process.env.ENABLE_ONLINE_GEOCODER === "1";
    this.geoOnlineCachePath = path.resolve(
      process.cwd(),
      process.env.GEOCODE_CACHE_PATH || ".cache/geocode-cache.json"
    );
    this.geoOnlineCache = this._loadGeoOnlineCache();
  }

  getHealth() {
    const isOk = this.repository.health();
    return {
      status: isOk ? "ok" : "degraded",
      dbPath: this.dbPath,
    };
  }

  _loadContext() {
    return this.cache.getOrSet("context", this.cacheTtlMs, () => {
      const people = this.repository.getAllPeople();
      const parentLinks = this.repository.getParentLinks();
      const events = this.repository.getPersonEvents();
      const index = createGenealogyIndex(people, parentLinks);

      const eventsByPersonId = new Map();
      for (const event of events) {
        if (!eventsByPersonId.has(event.personId)) {
          eventsByPersonId.set(event.personId, []);
        }
        eventsByPersonId.get(event.personId).push(event);
      }

      return {
        people,
        index,
        eventsByPersonId,
      };
    });
  }

  _collectAncestorIds(index, personId, maxDepth = 20) {
    const startId = Number(personId);
    if (!index.peopleById.has(startId)) {
      return [];
    }

    const queue = [{ id: startId, depth: 0 }];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth >= maxDepth) {
        continue;
      }

      const parents = index.parentsByChild.get(current.id) || [];
      for (const parent of parents) {
        if (visited.has(parent.parentId)) {
          continue;
        }
        visited.add(parent.parentId);
        queue.push({ id: parent.parentId, depth: current.depth + 1 });
      }
    }

    return [...visited];
  }

  _loadGeoOnlineCache() {
    try {
      if (!fs.existsSync(this.geoOnlineCachePath)) {
        return {};
      }
      const raw = fs.readFileSync(this.geoOnlineCachePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _resolveGeo(placeName, lat, lon) {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        lat: Number(lat),
        lon: Number(lon),
        geoMode: "exact",
        geoConfidence: "high",
      };
    }

    const normalized = normalizeText(placeName);
    if (normalized) {
      const local = GEO_LOCAL_HINTS.find((hint) => normalized.includes(hint.key));
      if (local) {
        return {
          lat: local.lat,
          lon: local.lon,
          geoMode: "matched",
          geoConfidence: local.confidence,
        };
      }

      if (this.enableOnlineGeocoder) {
        const cached = this.geoOnlineCache[normalized];
        if (
          cached &&
          Number.isFinite(cached.lat) &&
          Number.isFinite(cached.lon)
        ) {
          return {
            lat: Number(cached.lat),
            lon: Number(cached.lon),
            geoMode: "online",
            geoConfidence: cached.confidence || "medium",
          };
        }
      }
    }

    return deterministicCoordinatesFromPlace(placeName);
  }

  _buildRoutes(points) {
    const ordered = [...points].sort((a, b) => {
      if (a.year === null && b.year === null) {
        return safeNumber(a.eventId) - safeNumber(b.eventId);
      }
      if (a.year === null) {
        return 1;
      }
      if (b.year === null) {
        return -1;
      }
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return safeNumber(a.eventId) - safeNumber(b.eventId);
    });

    const routes = [];
    for (let i = 1; i < ordered.length; i += 1) {
      const from = ordered[i - 1];
      const to = ordered[i];
      routes.push({
        id: `${from.eventId}-${to.eventId}`,
        fromEventId: from.eventId,
        toEventId: to.eventId,
        fromLat: from.lat,
        fromLon: from.lon,
        toLat: to.lat,
        toLon: to.lon,
      });
    }

    return routes;
  }

  _compactNetwork(network, maxNodesPerDepth = DEFAULT_V2_MAX_NODES_PER_DEPTH) {
    const nodes = Array.isArray(network?.nodes) ? network.nodes : [];
    const edges = Array.isArray(network?.edges) ? network.edges : [];
    if (nodes.length === 0) {
      return { nodes: [], edges: [], highlights: [] };
    }

    const byDepth = new Map();
    const degreeById = new Map();
    const nodesById = new Map();

    for (const node of nodes) {
      const depth = safeNumber(node.depth, 0);
      if (!byDepth.has(depth)) {
        byDepth.set(depth, []);
      }
      byDepth.get(depth).push(node);
      nodesById.set(String(node.id), node);
    }

    for (const edge of edges) {
      const source = String(edge.sourceId);
      const target = String(edge.targetId);
      degreeById.set(source, (degreeById.get(source) || 0) + 1);
      degreeById.set(target, (degreeById.get(target) || 0) + 1);
    }

    const compactNodes = [];
    const keptIds = new Set();
    const hiddenToCluster = new Map();
    const highlights = [];

    for (const [depth, depthNodes] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
      const ordered = [...depthNodes].sort((a, b) => {
        const degreeDelta =
          (degreeById.get(String(b.id)) || 0) - (degreeById.get(String(a.id)) || 0);
        if (degreeDelta !== 0) {
          return degreeDelta;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      if (ordered.length <= maxNodesPerDepth) {
        for (const node of ordered) {
          compactNodes.push(node);
          keptIds.add(String(node.id));
        }
        continue;
      }

      const keepCount = Math.max(1, maxNodesPerDepth - 1);
      const kept = ordered.slice(0, keepCount);
      const hidden = ordered.slice(keepCount);
      const clusterId = `cluster-${depth}`;

      for (const node of kept) {
        compactNodes.push(node);
        keptIds.add(String(node.id));
      }

      for (const node of hidden) {
        hiddenToCluster.set(String(node.id), clusterId);
      }

      compactNodes.push({
        id: clusterId,
        name: `+${hidden.length} pessoas`,
        depth,
        cluster: true,
      });
      highlights.push({
        type: "cluster",
        depth,
        hiddenCount: hidden.length,
      });
    }

    const edgeMap = new Map();
    for (const edge of edges) {
      const sourceId = String(edge.sourceId);
      const targetId = String(edge.targetId);
      const mappedSource = keptIds.has(sourceId) ? sourceId : hiddenToCluster.get(sourceId);
      const mappedTarget = keptIds.has(targetId) ? targetId : hiddenToCluster.get(targetId);

      if (!mappedSource || !mappedTarget || mappedSource === mappedTarget) {
        continue;
      }

      const outSource = mappedSource.startsWith("cluster-")
        ? mappedSource
        : nodesById.get(mappedSource)?.id;
      const outTarget = mappedTarget.startsWith("cluster-")
        ? mappedTarget
        : nodesById.get(mappedTarget)?.id;
      if (outSource === undefined || outTarget === undefined) {
        continue;
      }
      const key = `${outSource}::${outTarget}::${edge.relation || "family"}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          sourceId: outSource,
          targetId: outTarget,
          relation: edge.relation || "family",
        });
      }
    }

    return {
      nodes: compactNodes,
      edges: [...edgeMap.values()],
      highlights,
    };
  }

  _buildV2NarrativeBundle(personId, { maxDepth = 20 } = {}) {
    const context = this._loadContext();
    const baseId = Number(personId);
    const person = context.index.peopleById.get(baseId);
    if (!person) {
      return null;
    }

    const generatedAt = nowIso();
    const warnings = [];
    const ancestorIds = this._collectAncestorIds(context.index, baseId, Number(maxDepth));
    const branchPeople = ancestorIds
      .map((id) => context.index.peopleById.get(id))
      .filter(Boolean);
    const pathResult = findOldestAncestralPath(context.index, baseId, Number(maxDepth));
    const distribution = getGenerationDistribution(context.index, baseId, Number(maxDepth));

    const events = [];
    for (const ancestorId of ancestorIds) {
      const personEvents = context.eventsByPersonId.get(ancestorId) || [];
      for (const event of personEvents) {
        const geo = this._resolveGeo(event.placeName, event.lat, event.lon);
        if (!geo) {
          continue;
        }
        events.push({
          eventId: event.eventId,
          personId: ancestorId,
          personName: context.index.peopleById.get(ancestorId)?.name || "Sem nome",
          eventType: event.eventType,
          year: extractYear(event.dateRaw),
          dateRaw: event.dateRaw || "",
          placeName: event.placeName || "Local nao informado",
          lat: geo.lat,
          lon: geo.lon,
          geoMode: geo.geoMode,
          geoConfidence: geo.geoConfidence,
        });
      }
    }

    events.sort((a, b) => {
      if (a.year === null && b.year === null) {
        return safeNumber(a.eventId) - safeNumber(b.eventId);
      }
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

    if (events.length === 0) {
      warnings.push("Nenhum evento encontrado para o recorte selecionado.");
    }

    const routes = this._buildRoutes(events);
    const oldestNode = pathResult.nodes[pathResult.nodes.length - 1] || person;
    const missingBirthYears = branchPeople.filter(
      (item) => !item.birthYear || item.birthYear <= 0
    ).length;
    const inferredGeoCount = events.filter(
      (event) => event.geoMode === "estimated"
    ).length;

    const surnameCount = new Map();
    for (const entry of branchPeople) {
      const surname = String(entry.surname || "").trim();
      if (!surname) {
        continue;
      }
      surnameCount.set(surname, (surnameCount.get(surname) || 0) + 1);
    }
    const topSurname = [...surnameCount.entries()].sort((a, b) => b[1] - a[1])[0];

    const branchDegrees = branchPeople
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        degree: context.index.adjacency.get(entry.id)?.size || 0,
        birthYear: entry.birthYear || null,
      }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5);

    const claims = [];
    const evidenceByClaimId = new Map();

    const addClaim = (claim, evidence) => {
      claims.push(claim);
      evidenceByClaimId.set(claim.id, evidence);
    };

    const deepRatio = Math.min(1, safeNumber(pathResult.generations, 0) / 18);
    const deepConfidence = toConfidenceFromRatio(deepRatio);
    addClaim(
      {
        id: "deep_lineage",
        title: "Linhagem profunda",
        value: `${pathResult.generations} geracoes`,
        why: `A trilha principal conecta ${person.name} a ${oldestNode?.name || "um ancestral antigo"} em ${pathResult.generations} saltos parentais.`,
        confidence: deepConfidence,
        evidenceIds: ["path:main", `person:${person.id}`],
        actions: [{ type: "open_evidence", target: "deep_lineage" }],
      },
      {
        claimId: "deep_lineage",
        title: "Linhagem profunda",
        confidence: deepConfidence,
        origin: "path:main",
        proof: [{ type: "path", nodes: pathResult.nodes, edges: pathResult.edges }],
        limitations: pathResult.warnings || [],
      }
    );

    const hasOldestYear = Boolean(oldestNode?.birthYear);
    const oldestConfidence = hasOldestYear ? "high" : "medium";
    addClaim(
      {
        id: "oldest_ancestor",
        title: "Ancestral mais antigo",
        value: hasOldestYear
          ? `${oldestNode.birthYear} · ${oldestNode.name}`
          : oldestNode?.name || "Sem data consolidada",
        why: "O recorte busca o nascimento mais antigo no ramo alcançável da pessoa base.",
        confidence: oldestConfidence,
        evidenceIds: [`person:${oldestNode?.id || "unknown"}`, "path:main"],
        actions: [{ type: "open_evidence", target: "oldest_ancestor" }],
      },
      {
        claimId: "oldest_ancestor",
        title: "Ancestral mais antigo",
        confidence: oldestConfidence,
        origin: `person:${oldestNode?.id || "unknown"}`,
        proof: [{ type: "person", person: oldestNode }],
        limitations: hasOldestYear ? [] : ["Nascimento mais antigo sem ano explícito no banco."],
      }
    );

    const topConnector = branchDegrees[0];
    const connectorRatio = Math.min(1, safeNumber(topConnector?.degree, 0) / 10);
    const connectorConfidence = toConfidenceFromRatio(connectorRatio);
    addClaim(
      {
        id: "branch_connectors",
        title: "Conectores de ramos",
        value: topConnector
          ? `${topConnector.name} (${topConnector.degree} conexoes)`
          : "Conectores nao identificados",
        why: "Pessoas com alta conectividade unem diferentes segmentos da arvore familiar.",
        confidence: topConnector ? connectorConfidence : "low",
        evidenceIds: branchDegrees.map((item) => `person:${item.id}`),
        actions: [{ type: "open_evidence", target: "branch_connectors" }],
      },
      {
        claimId: "branch_connectors",
        title: "Conectores de ramos",
        confidence: topConnector ? connectorConfidence : "low",
        origin: "network:branch-degree",
        proof: [{ type: "connectors", connectors: branchDegrees }],
        limitations: branchDegrees.length > 0 ? [] : ["Sem conectores suficientes para ranking."],
      }
    );

    const surnameRatio = topSurname
      ? Math.min(1, safeNumber(topSurname[1], 0) / Math.max(1, branchPeople.length * 0.35))
      : 0;
    const surnameConfidence = topSurname ? toConfidenceFromRatio(surnameRatio) : "low";
    addClaim(
      {
        id: "dominant_lineage",
        title: "Linhagem dominante",
        value: topSurname ? `${topSurname[0]} (${topSurname[1]})` : "Sem padrao dominante",
        why: "A recorrência de sobrenomes ajuda a visualizar continuidade e ramificações.",
        confidence: surnameConfidence,
        evidenceIds: topSurname ? [`surname:${topSurname[0]}`] : [],
        actions: [{ type: "open_evidence", target: "dominant_lineage" }],
      },
      {
        claimId: "dominant_lineage",
        title: "Linhagem dominante",
        confidence: surnameConfidence,
        origin: "surname:frequency",
        proof: [{ type: "surnames", ranking: [...surnameCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10) }],
        limitations: topSurname ? [] : ["Sobrenomes insuficientes para inferência robusta."],
      }
    );

    const geoCovered = events.filter((event) => event.geoMode !== "estimated").length;
    const geoCoverageRatio = events.length > 0 ? geoCovered / events.length : 0;
    const geoConfidence = toConfidenceFromRatio(geoCoverageRatio);
    addClaim(
      {
        id: "geo_journey",
        title: "Jornada geografica",
        value: `${events.length} eventos · ${routes.length} rotas`,
        why: "A sequência temporal de eventos revela deslocamentos e permanências familiares.",
        confidence: geoConfidence,
        evidenceIds: events.slice(0, 8).map((item) => `event:${item.eventId}`),
        actions: [{ type: "open_evidence", target: "geo_journey" }],
      },
      {
        claimId: "geo_journey",
        title: "Jornada geografica",
        confidence: geoConfidence,
        origin: "events:timeline",
        proof: [{ type: "map", points: events, routes }],
        limitations:
          inferredGeoCount > 0
            ? [`${inferredGeoCount} eventos usam geolocalização estimada.`]
            : [],
      }
    );

    const gapRatio = branchPeople.length > 0 ? 1 - missingBirthYears / branchPeople.length : 0;
    const gapConfidence = toConfidenceFromRatio(gapRatio);
    addClaim(
      {
        id: "relevant_gaps",
        title: "Lacunas relevantes",
        value: `${missingBirthYears} nascimentos ausentes · ${inferredGeoCount} pontos inferidos`,
        why: "As lacunas ajudam a priorizar novas pesquisas sem interromper a narrativa.",
        confidence: gapConfidence,
        evidenceIds: ["quality:birth_year", "quality:geo_mode"],
        actions: [{ type: "open_evidence", target: "relevant_gaps" }],
      },
      {
        claimId: "relevant_gaps",
        title: "Lacunas relevantes",
        confidence: gapConfidence,
        origin: "quality:summary",
        proof: [
          {
            type: "quality",
            missingBirthYears,
            inferredGeoCount,
            totalPeople: branchPeople.length,
            totalEvents: events.length,
          },
        ],
        limitations: [],
      }
    );

    const networkRaw = buildNetwork(
      context.index,
      baseId,
      DEFAULT_V2_NETWORK_DEPTH
    );
    const networkCompact = this._compactNetwork(
      networkRaw,
      DEFAULT_V2_MAX_NODES_PER_DEPTH
    );

    const keyMilestones = events.slice(0, 10).map((event) => ({
      eventId: event.eventId,
      year: event.year,
      placeName: event.placeName,
      personName: event.personName,
      eventType: event.eventType,
      geoMode: event.geoMode,
      geoConfidence: event.geoConfidence,
    }));

    const lineageSpine = pathResult.nodes.map((node, index) => ({
      id: node.id,
      name: node.name,
      birthYear: node.birthYear || null,
      deathYear: node.deathYear || null,
      depth: index,
    }));

    const confidenceSummary = summarizeConfidence(claims);
    const sortedClaims = [...claims].sort((a, b) => {
      const scoreMap = { high: 3, medium: 2, low: 1 };
      const delta = scoreMap[b.confidence] - scoreMap[a.confidence];
      if (delta !== 0) {
        return delta;
      }
      return String(a.title).localeCompare(String(b.title));
    });

    const topClaims = sortedClaims.slice(0, 4);
    const notableAncestors = this.getNotableAncestors(baseId, {
      maxDepth: Number(maxDepth),
      limit: 6,
    }).data;

    const chapters = [
      {
        id: "abertura",
        title: "Abertura: o fio da memoria",
        body: `${person.name} inicia uma travessia familiar que alcança ${pathResult.generations} geracoes até ${oldestNode?.name || "um ancestral antigo"}.`,
        evidenceIds: ["deep_lineage", "oldest_ancestor"],
      },
      {
        id: "rotas",
        title: "Terras e deslocamentos",
        body:
          events.length > 0
            ? `${events.length} eventos foram organizados em uma linha temporal para reconstruir caminhos entre lugares e epocas.`
            : "Ainda não há eventos suficientes para reconstruir rotas históricas completas.",
        evidenceIds: ["geo_journey"],
      },
      {
        id: "conectores",
        title: "Personagens de conexão",
        body:
          topConnector
            ? `${topConnector.name} aparece como elo importante entre ramos, ajudando a explicar cruzamentos familiares.`
            : "Nenhum conector forte foi identificado neste recorte.",
        evidenceIds: ["branch_connectors"],
      },
      {
        id: "proximos-passos",
        title: "Próximos passos da investigação",
        body: `As lacunas atuais indicam foco em ${missingBirthYears} registros de nascimento e ${inferredGeoCount} pontos geográficos inferidos.`,
        evidenceIds: ["relevant_gaps"],
      },
    ];

    const highlights = topClaims.map((claim) => ({
      id: claim.id,
      label: claim.title,
      value: claim.value,
      confidence: claim.confidence,
      evidenceIds: claim.evidenceIds,
    }));

    const mapCoverage = events.length ? geoCovered / events.length : 0;
    const dataQuality = {
      totalPeople: branchPeople.length,
      missingBirthYears,
      totalEvents: events.length,
      inferredGeoCount,
      mapCoverage,
    };

    return {
      generatedAt,
      person,
      pathResult,
      distribution,
      claims: sortedClaims,
      evidenceByClaimId,
      events,
      routes,
      networkRaw,
      networkCompact,
      keyMilestones,
      lineageSpine,
      topClaims,
      chapters,
      highlights,
      notableAncestors,
      dataQuality,
      confidenceSummary,
      warnings,
    };
  }

  searchPeople(query) {
    const people = this.repository.searchPeople(query, 30);
    return buildResponse(people, { count: people.length }, []);
  }

  getPersonSummary(personId) {
    const person = this.repository.getPersonSummary(Number(personId));
    if (!person) {
      return buildResponse(null, {}, ["Person not found"]);
    }

    return buildResponse(person, {}, []);
  }

  getAncestralPath(personId, { maxDepth = 20, mode = "oldest" } = {}) {
    const context = this._loadContext();
    const key = `path:${personId}:${maxDepth}:${mode}`;
    const result = this.cache.getOrSet(key, this.cacheTtlMs, () => {
      return findOldestAncestralPath(context.index, Number(personId), maxDepth);
    });

    return buildResponse(result, { mode, maxDepth }, result.warnings || []);
  }

  getGenerationDistribution(personId, { maxDepth = 20 } = {}) {
    const context = this._loadContext();
    const key = `distribution:${personId}:${maxDepth}`;
    const result = this.cache.getOrSet(key, this.cacheTtlMs, () => {
      return getGenerationDistribution(context.index, Number(personId), maxDepth);
    });

    return buildResponse(result, { maxDepth }, []);
  }

  getInsights(personId, { maxDepth = 20 } = {}) {
    const context = this._loadContext();
    const ancestorIds = this._collectAncestorIds(context.index, personId, maxDepth);
    const warnings = [];

    if (ancestorIds.length === 0) {
      return buildResponse([], { maxDepth }, ["Person not found for insight analysis"]);
    }

    const branchPeople = ancestorIds
      .map((id) => context.index.peopleById.get(id))
      .filter(Boolean);

    const branchYears = branchPeople
      .map((person) => person.birthYear)
      .filter((year) => year && year > 0);

    const missingBirthYears = branchPeople.filter(
      (person) => !person.birthYear || person.birthYear <= 0
    ).length;
    if (missingBirthYears > 0) {
      warnings.push(`${missingBirthYears} people in branch have unknown birth year`);
    }

    const pathResult = findOldestAncestralPath(
      context.index,
      Number(personId),
      maxDepth
    );
    const earliestBirthYear =
      branchYears.length > 0 ? Math.min(...branchYears) : null;

    const centuries = new Map();
    for (const year of branchYears) {
      const century = toCentury(year);
      if (!century) {
        continue;
      }
      centuries.set(century, (centuries.get(century) || 0) + 1);
    }
    const dominantCenturyEntry = [...centuries.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0];

    const surnames = new Map();
    for (const person of branchPeople) {
      if (!person.surname || !person.surname.trim()) {
        continue;
      }
      const surname = person.surname.trim();
      surnames.set(surname, (surnames.get(surname) || 0) + 1);
    }
    const topSurnameEntry = [...surnames.entries()].sort((a, b) => b[1] - a[1])[0];

    const cards = [
      {
        id: "deep_branch",
        title: "Ramo mais profundo",
        value: `${pathResult.generations} geracoes`,
        description: "Quantidade de saltos da pessoa base ate o ancestral mais antigo alcancavel.",
        cta: "/path",
      },
      {
        id: "earliest_ancestor",
        title: "Nascimento mais antigo no ramo",
        value: earliestBirthYear ? String(earliestBirthYear) : "Sem ano conhecido",
        description: "Ano de nascimento mais antigo entre pessoas alcancaveis no ramo.",
        cta: "/path",
      },
      {
        id: "dominant_century",
        title: "Seculo predominante",
        value: dominantCenturyEntry
          ? `${dominantCenturyEntry[0]}º seculo`
          : "Sem dados suficientes",
        description: "Seculo com maior quantidade de nascimentos conhecidos.",
        cta: "/insights",
      },
      {
        id: "data_gap_birth",
        title: "Lacunas de nascimento",
        value: `${missingBirthYears} pessoas`,
        description: "Pessoas sem ano de nascimento conhecido no ramo analisado.",
        cta: "/insights",
      },
      {
        id: "dominant_surname",
        title: "Sobrenome recorrente",
        value: topSurnameEntry
          ? `${topSurnameEntry[0]} (${topSurnameEntry[1]})`
          : "Sem sobrenome consolidado",
        description: "Sobrenome mais frequente dentro da area ancestral analisada.",
        cta: "/network",
      },
    ];

    return buildResponse(cards, { maxDepth, sampleSize: branchPeople.length }, warnings);
  }

  getMigrationTimeline(personId, { maxDepth = 20 } = {}) {
    const context = this._loadContext();
    const warnings = [];
    const ancestorIds = this._collectAncestorIds(context.index, personId, maxDepth);

    const events = [];
    for (const id of ancestorIds) {
      const personEvents = context.eventsByPersonId.get(id) || [];
      for (const event of personEvents) {
        const person = context.index.peopleById.get(id);
        events.push({
          eventId: event.eventId,
          personId: id,
          personName: person?.name || "Sem nome",
          eventType: event.eventType,
          year: extractYear(event.dateRaw),
          dateRaw: event.dateRaw,
          placeName: event.placeName || "Local nao informado",
          lat: event.lat,
          lon: event.lon,
        });
      }
    }

    if (events.length === 0) {
      warnings.push("No events found for selected branch");
    }

    const noCoordinateCount = events.filter(
      (event) => event.lat === null || event.lon === null
    ).length;
    if (noCoordinateCount > 0) {
      warnings.push(`${noCoordinateCount} events are missing map coordinates`);
    }

    events.sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

    return buildResponse(
      events,
      { count: events.length, maxDepth },
      warnings
    );
  }

  getNetwork(personId, { depth = 3 } = {}) {
    const context = this._loadContext();
    const network = buildNetwork(context.index, Number(personId), Number(depth));

    return buildResponse(network, { depth: Number(depth) }, []);
  }

  getNotableAncestors(
    personId,
    { maxDepth = 20, limit = 8, networkDepth = 3 } = {}
  ) {
    const context = this._loadContext();
    const baseId = Number(personId);
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 8, 20));
    let mode = "ancestors";
    let candidateIds = this._collectAncestorIds(context.index, baseId, Number(maxDepth))
      .filter((id) => id !== baseId);

    if (candidateIds.length === 0) {
      mode = "network_fallback";
      const network = buildNetwork(context.index, baseId, Number(networkDepth));
      candidateIds = (network.nodes || [])
        .map((node) => Number(node.id))
        .filter((id) => id !== baseId);
    }

    candidateIds = [...new Set(candidateIds)];

    if (candidateIds.length === 0) {
      return buildResponse(
        [],
        { maxDepth: Number(maxDepth), limit: boundedLimit, totalCandidates: 0, mode },
        ["No related people found for notable analysis"]
      );
    }

    const notable = candidateIds
      .map((id) => {
        const person = context.index.peopleById.get(id);
        if (!person) {
          return null;
        }

        const reasons = [];
        let score = 0;

        if (HISTORIC_TITLE_RE.test(person.name || "")) {
          score += 4;
          reasons.push("Nome com titulo historico");
        }

        const ancientScore = birthYearScore(person.birthYear);
        if (ancientScore > 0) {
          score += ancientScore;
          reasons.push("Nascimento antigo no recorte genealogico");
        }

        const degree = context.index.adjacency.get(id)?.size || 0;
        if (degree >= 3) {
          score += Math.min(3, degree - 2);
          reasons.push("Conecta diferentes ramos familiares");
        }

        const knownEvents = (context.eventsByPersonId.get(id) || []).filter(
          (event) => extractYear(event.dateRaw) !== null
        );
        if (knownEvents.length >= 2) {
          score += 2;
          reasons.push("Multiplos eventos historicos registrados");
        }

        if (score === 0) {
          score = 1;
          reasons.push("Presenca relevante no caminho ancestral analisado");
        }

        return {
          id: person.id,
          name: person.name,
          birthYear: person.birthYear || null,
          deathYear: person.deathYear || null,
          score,
          reasons,
          evidence: `/api/person/${person.id}/summary`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const aYear = a.birthYear || Number.POSITIVE_INFINITY;
        const bYear = b.birthYear || Number.POSITIVE_INFINITY;
        if (aYear !== bYear) {
          return aYear - bYear;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .slice(0, boundedLimit);

    return buildResponse(
      notable,
      {
        maxDepth: Number(maxDepth),
        limit: boundedLimit,
        totalCandidates: candidateIds.length,
        mode,
      },
      []
    );
  }

  getRelationshipPath(personId, toId, { maxDepth = 8 } = {}) {
    const context = this._loadContext();
    const path = findShortestRelationshipPath(
      context.index,
      Number(personId),
      Number(toId),
      Number(maxDepth)
    );

    return buildResponse(path, { maxDepth: Number(maxDepth) }, path.warnings || []);
  }

  _getV2BundleCached(personId, { maxDepth = 20 } = {}) {
    const key = `v2-bundle:${personId}:${maxDepth}`;
    return this.cache.getOrSet(key, this.cacheTtlMs, () =>
      this._buildV2NarrativeBundle(personId, { maxDepth })
    );
  }

  searchPeopleV2(query) {
    const baseMatches = this.repository.searchPeople(query, 30);
    const context = this._loadContext();
    const generatedAt = nowIso();
    const rows = baseMatches.map((person) => {
      const path = findOldestAncestralPath(context.index, Number(person.id), 20);
      const degree = context.index.adjacency.get(Number(person.id))?.size || 0;
      return {
        id: person.id,
        name: person.name,
        yearsLabel: `${person.birthYear || "?"} - ${person.deathYear || "?"}`,
        birthYear: person.birthYear || null,
        deathYear: person.deathYear || null,
        estimatedDepth: safeNumber(path.generations, 0),
        connectivitySignal: degree >= 8 ? "high" : degree >= 4 ? "medium" : "low",
      };
    });

    return buildResponse(
      rows,
      {
        count: rows.length,
        generatedAt,
        confidenceSummary: summarizeConfidence(
          rows.map((row) => ({ confidence: row.connectivitySignal }))
        ),
      },
      []
    );
  }

  getV2Experience(personId, { maxDepth = 20 } = {}) {
    const bundle = this._getV2BundleCached(personId, { maxDepth });
    if (!bundle) {
      return buildResponse(null, { generatedAt: nowIso(), confidenceSummary: { high: 0, medium: 0, low: 0 } }, ["Person not found"]);
    }

    return buildResponse(
      {
        hero: {
          personId: bundle.person.id,
          name: bundle.person.name,
          arcSummary: `Da pessoa base ate ${bundle.pathResult.nodes[bundle.pathResult.nodes.length - 1]?.name || "ancestral antigo"} (${bundle.pathResult.nodes[bundle.pathResult.nodes.length - 1]?.birthYear || "ano desconhecido"}).`,
          confidence: bundle.topClaims[0]?.confidence || "medium",
          generations: bundle.pathResult.generations,
        },
        lineageSpine: bundle.lineageSpine,
        topClaims: bundle.topClaims,
        keyMilestones: bundle.keyMilestones,
        notableAncestors: bundle.notableAncestors,
        dataQuality: bundle.dataQuality,
      },
      {
        generatedAt: bundle.generatedAt,
        confidenceSummary: bundle.confidenceSummary,
      },
      bundle.warnings
    );
  }

  getV2Claims(personId, { maxDepth = 20, page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    const bundle = this._getV2BundleCached(personId, { maxDepth });
    if (!bundle) {
      return buildResponse(
        [],
        {
          generatedAt: nowIso(),
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          total: 0,
          confidenceSummary: { high: 0, medium: 0, low: 0 },
        },
        ["Person not found"]
      );
    }

    const normalizedPage = Math.max(1, safeNumber(page, 1));
    const normalizedPageSize = Math.max(
      1,
      Math.min(MAX_PAGE_SIZE, safeNumber(pageSize, DEFAULT_PAGE_SIZE))
    );
    const start = (normalizedPage - 1) * normalizedPageSize;
    const rows = bundle.claims.slice(start, start + normalizedPageSize);

    return buildResponse(
      rows,
      {
        generatedAt: bundle.generatedAt,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: bundle.claims.length,
        confidenceSummary: bundle.confidenceSummary,
      },
      bundle.warnings
    );
  }

  getV2Evidence(personId, claimId, { maxDepth = 20 } = {}) {
    const bundle = this._getV2BundleCached(personId, { maxDepth });
    if (!bundle) {
      return buildResponse(
        null,
        { generatedAt: nowIso(), confidenceSummary: { high: 0, medium: 0, low: 0 } },
        ["Person not found"]
      );
    }

    const evidence = bundle.evidenceByClaimId.get(String(claimId));
    if (!evidence) {
      return buildResponse(
        null,
        { generatedAt: bundle.generatedAt, confidenceSummary: bundle.confidenceSummary },
        [`Claim '${claimId}' not found`]
      );
    }

    return buildResponse(
      evidence,
      {
        generatedAt: bundle.generatedAt,
        confidenceSummary: bundle.confidenceSummary,
      },
      bundle.warnings
    );
  }

  getV2Map(personId, { maxDepth = 20, fromYear = null, toYear = null } = {}) {
    const bundle = this._getV2BundleCached(personId, { maxDepth });
    if (!bundle) {
      return buildResponse(
        { points: [], routes: [] },
        { generatedAt: nowIso(), confidenceSummary: { high: 0, medium: 0, low: 0 } },
        ["Person not found"]
      );
    }

    const hasLowerYear =
      fromYear !== null &&
      fromYear !== undefined &&
      String(fromYear).trim() !== "" &&
      Number.isFinite(Number(fromYear));
    const hasUpperYear =
      toYear !== null &&
      toYear !== undefined &&
      String(toYear).trim() !== "" &&
      Number.isFinite(Number(toYear));
    const lowerYear = hasLowerYear ? Number(fromYear) : null;
    const upperYear = hasUpperYear ? Number(toYear) : null;
    const points = bundle.events.filter((event) => {
      if (lowerYear !== null && event.year !== null && event.year < lowerYear) {
        return false;
      }
      if (upperYear !== null && event.year !== null && event.year > upperYear) {
        return false;
      }
      return true;
    });
    const routes = this._buildRoutes(points);
    const confidenceSummary = summarizeConfidence(
      points.map((point) => ({ confidence: point.geoConfidence }))
    );

    return buildResponse(
      { points, routes },
      {
        generatedAt: bundle.generatedAt,
        confidenceSummary,
      },
      bundle.warnings
    );
  }

  getV2Network(
    personId,
    { depth = DEFAULT_V2_NETWORK_DEPTH, maxNodesPerDepth = DEFAULT_V2_MAX_NODES_PER_DEPTH } = {}
  ) {
    const context = this._loadContext();
    const baseId = Number(personId);
    if (!context.index.peopleById.has(baseId)) {
      return buildResponse(
        { nodes: [], edges: [], highlights: [] },
        { generatedAt: nowIso(), confidenceSummary: { high: 0, medium: 0, low: 0 } },
        ["Person not found"]
      );
    }

    const raw = buildNetwork(context.index, baseId, Number(depth));
    const compact = this._compactNetwork(raw, Number(maxNodesPerDepth));

    return buildResponse(
      compact,
      {
        generatedAt: nowIso(),
        depth: Number(depth),
        maxNodesPerDepth: Number(maxNodesPerDepth),
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      []
    );
  }

  getV2Documentary(personId, { maxDepth = 20 } = {}) {
    const bundle = this._getV2BundleCached(personId, { maxDepth });
    if (!bundle) {
      return buildResponse(
        null,
        { generatedAt: nowIso(), confidenceSummary: { high: 0, medium: 0, low: 0 } },
        ["Person not found"]
      );
    }

    return buildResponse(
      {
        title: `Documentario genealogico de ${bundle.person.name}`,
        chapters: bundle.chapters,
        highlights: bundle.highlights,
      },
      {
        generatedAt: bundle.generatedAt,
        confidenceSummary: bundle.confidenceSummary,
      },
      bundle.warnings
    );
  }

  getStory(personId, { maxDepth = 20 } = {}) {
    const summary = this.getPersonSummary(personId);
    const path = this.getAncestralPath(personId, { maxDepth });
    const insights = this.getInsights(personId, { maxDepth });
    const timeline = this.getMigrationTimeline(personId, { maxDepth: 12 });

    const personName = summary.data?.name || "Pessoa selecionada";
    const oldestNode =
      path.data?.nodes?.[path.data.nodes.length - 1] || summary.data;
    const knownTimeline = timeline.data.filter((item) => item.year !== null);

    const chapters = [
      {
        id: "origem",
        title: "Origem da pessoa base",
        body: `${personName} e o ponto de partida da exploracao. A trilha atual alcanca ${path.data.generations} geracoes.`,
      },
      {
        id: "linhagem",
        title: "Salto geracional",
        body: `O ancestral mais antigo alcancavel neste recorte e ${oldestNode?.name || "desconhecido"}${oldestNode?.birthYear ? ` (nasc. ${oldestNode.birthYear})` : ""}.`,
      },
      {
        id: "migracoes",
        title: "Rotas e deslocamentos",
        body: knownTimeline.length
          ? `Foram identificados ${knownTimeline.length} eventos com ano conhecido para compor a linha de tempo geografica.`
          : "Ainda nao ha eventos suficientes com ano conhecido para compor uma linha de tempo completa.",
      },
      {
        id: "curiosidades",
        title: "Voce sabia?",
        body: insights.data
          .slice(0, 3)
          .map((item) => `${item.title}: ${item.value}.`)
          .join(" "),
      },
    ];

    const highlights = insights.data.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.title,
      value: item.value,
    }));

    const warnings = [
      ...new Set([...(summary.warnings || []), ...(timeline.warnings || [])]),
    ];

    return buildResponse(
      {
        title: `Documentario familiar de ${personName}`,
        person: summary.data,
        chapters,
        highlights,
      },
      { maxDepth },
      warnings
    );
  }
}

module.exports = {
  GenealogyService,
};

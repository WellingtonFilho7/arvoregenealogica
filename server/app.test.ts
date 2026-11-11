export {};

const request = require("supertest");
const { createApp } = require("./app");

function makeService() {
  return {
    getHealth: jest.fn(() => ({ status: "ok", dbPath: "FamilyTree.rmtree" })),
    searchPeople: jest.fn(() => ({
      data: [{ id: 1, name: "Jose Silva", birthYear: 1991, deathYear: null }],
      meta: { count: 1 },
      warnings: [],
    })),
    getPersonSummary: jest.fn((id) => ({
      data: { id, name: "Jose Silva", birthYear: 1991, deathYear: null },
      meta: {},
      warnings: [],
    })),
    getAncestralPath: jest.fn(() => ({
      data: { nodes: [{ id: 1, name: "Jose Silva" }], edges: [], generations: 0 },
      meta: { mode: "oldest" },
      warnings: [],
    })),
    getGenerationDistribution: jest.fn(() => ({
      data: [{ generation: 0, count: 1 }],
      meta: {},
      warnings: [],
    })),
    getInsights: jest.fn(() => ({
      data: [{ id: "deep_branch", title: "Ramo profundo", value: 17, cta: "path" }],
      meta: {},
      warnings: [],
    })),
    getMigrationTimeline: jest.fn(() => ({
      data: [{ personId: 1, placeName: "Caico", year: 1991, lat: null, lon: null }],
      meta: {},
      warnings: ["Some events have no coordinates"],
    })),
    getNetwork: jest.fn(() => ({
      data: {
        nodes: [{ id: 1, name: "Jose Silva", depth: 0 }],
        edges: [],
      },
      meta: { depth: 1 },
      warnings: [],
    })),
    getRelationshipPath: jest.fn(() => ({
      data: { nodes: [{ id: 1 }, { id: 2 }], edges: [{ sourceId: 1, targetId: 2 }], distance: 1 },
      meta: {},
      warnings: [],
    })),
    getStory: jest.fn(() => ({
      data: {
        title: "Historia familiar",
        chapters: [{ id: "origem", title: "Origem", body: "..." }],
        highlights: [],
      },
      meta: {},
      warnings: [],
    })),
    getNotableAncestors: jest.fn(() => ({
      data: [
        {
          id: 10,
          name: "Dom Duarte",
          birthYear: 1433,
          deathYear: 1490,
          score: 9,
          reasons: ["Nome com titulo historico", "Conecta diferentes ramos familiares"],
          evidence: "/path",
        },
      ],
      meta: { maxDepth: 20, limit: 8 },
      warnings: [],
    })),
    searchPeopleV2: jest.fn(() => ({
      data: [
        {
          id: 1,
          name: "Jose Silva",
          yearsLabel: "1991 - ?",
          estimatedDepth: 17,
          connectivitySignal: "high",
        },
      ],
      meta: { count: 1, generatedAt: "2026-03-11T00:00:00.000Z" },
      warnings: [],
    })),
    getV2Experience: jest.fn(() => ({
      data: {
        hero: {
          personId: 1,
          name: "Jose Silva",
          arcSummary: "Da pessoa base ate Leonor Rodrigues Ribeiro (1270).",
          confidence: "high",
        },
        lineageSpine: [{ id: 1, name: "Jose Silva", depth: 0 }],
        topClaims: [{ id: "deep_lineage", title: "Linhagem profunda", confidence: "high" }],
        keyMilestones: [],
        notableAncestors: [],
        dataQuality: { missingBirthYears: 0, mapCoverage: 0.42 },
      },
      meta: {
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      warnings: [],
    })),
    getV2Claims: jest.fn(() => ({
      data: [
        {
          id: "deep_lineage",
          title: "Linhagem profunda",
          value: "17 geracoes",
          why: "Ha 17 saltos parentais validos no recorte.",
          confidence: "high",
          evidenceIds: ["path:main"],
          actions: [{ type: "open_evidence", target: "deep_lineage" }],
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      warnings: [],
    })),
    getV2Evidence: jest.fn(() => ({
      data: {
        claimId: "deep_lineage",
        title: "Linhagem profunda",
        confidence: "high",
        origin: "path:main",
        proof: [{ type: "path", nodes: [{ id: 1, name: "Jose Silva" }] }],
        limitations: [],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z" },
      warnings: [],
    })),
    getV2Map: jest.fn(() => ({
      data: {
        points: [
          {
            eventId: 1,
            year: 1695,
            placeName: "Portugal",
            lat: 39.39,
            lon: -8.22,
            geoMode: "matched",
            geoConfidence: "medium",
          },
        ],
        routes: [],
      },
      meta: {
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 0, medium: 1, low: 0 },
      },
      warnings: [],
    })),
    getV2Network: jest.fn(() => ({
      data: {
        nodes: [{ id: 1, name: "Jose Silva", depth: 0 }],
        edges: [],
        highlights: [],
      },
      meta: {
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      warnings: [],
    })),
    getV2Documentary: jest.fn(() => ({
      data: {
        title: "Documentario de Jose Silva",
        chapters: [{ id: "abertura", title: "Abertura", body: "Inicio da jornada." }],
        highlights: [{ id: "deep_lineage", label: "Linhagem", value: "17 geracoes" }],
      },
      meta: {
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      warnings: [],
    })),
  };
}

describe("API contracts", () => {
  test("GET /api/health returns status payload", async () => {
    const app = createApp({ service: makeService() });
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: "ok", dbPath: "FamilyTree.rmtree" },
      meta: {},
      warnings: [],
    });
  });

  test("GET /api/search validates query and returns normalized payload", async () => {
    const service = makeService();
    const app = createApp({ service });

    const badResponse = await request(app).get("/api/search");
    expect(badResponse.status).toBe(400);
    expect(badResponse.body.warnings.length).toBeGreaterThan(0);

    const response = await request(app).get("/api/search?q=jose");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: 1, name: "Jose Silva", birthYear: 1991, deathYear: null }],
      meta: { count: 1 },
      warnings: [],
    });
    expect(service.searchPeople).toHaveBeenCalledWith("jose");
  });

  test("GET /api/person/:id endpoints return data and warnings", async () => {
    const app = createApp({ service: makeService() });

    const summary = await request(app).get("/api/person/1/summary");
    expect(summary.status).toBe(200);
    expect(summary.body.data.id).toBe(1);

    const path = await request(app).get("/api/person/1/ancestral-path");
    expect(path.status).toBe(200);
    expect(path.body.data.generations).toBe(0);

    const distribution = await request(app).get(
      "/api/person/1/generation-distribution"
    );
    expect(distribution.status).toBe(200);
    expect(distribution.body.data[0]).toEqual({ generation: 0, count: 1 });

    const insights = await request(app).get("/api/person/1/insights");
    expect(insights.status).toBe(200);
    expect(insights.body.data[0].id).toBe("deep_branch");

    const migration = await request(app).get("/api/person/1/migration-timeline");
    expect(migration.status).toBe(200);
    expect(migration.body.warnings).toEqual(["Some events have no coordinates"]);

    const network = await request(app).get("/api/person/1/network?depth=1");
    expect(network.status).toBe(200);
    expect(network.body.meta.depth).toBe(1);

    const relationship = await request(app).get(
      "/api/person/1/relationship-path?toId=2"
    );
    expect(relationship.status).toBe(200);
    expect(relationship.body.data.distance).toBe(1);

    const story = await request(app).get("/api/person/1/story");
    expect(story.status).toBe(200);
    expect(story.body.data.chapters).toHaveLength(1);

    const notable = await request(app).get("/api/person/1/notable-ancestors");
    expect(notable.status).toBe(200);
    expect(notable.body.data[0].name).toMatch(/duarte/i);
  });

  test("GET /api/person/:id/relationship-path validates toId", async () => {
    const app = createApp({ service: makeService() });
    const response = await request(app).get("/api/person/1/relationship-path");

    expect(response.status).toBe(400);
    expect(response.body.warnings[0]).toMatch(/toId/i);
  });

  test("GET /api/v2/search validates query and returns rich preview", async () => {
    const service = makeService();
    const app = createApp({ service });

    const badResponse = await request(app).get("/api/v2/search");
    expect(badResponse.status).toBe(400);
    expect(badResponse.body.warnings.length).toBeGreaterThan(0);

    const response = await request(app).get("/api/v2/search?q=jose");
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      id: 1,
      name: "Jose Silva",
      estimatedDepth: 17,
      connectivitySignal: "high",
    });
    expect(service.searchPeopleV2).toHaveBeenCalledWith("jose");
  });

  test("GET /api/v2/person/:id experience/claims/evidence/map/network/documentary contracts", async () => {
    const service = makeService();
    const app = createApp({ service });

    const experience = await request(app).get("/api/v2/person/1/experience");
    expect(experience.status).toBe(200);
    expect(experience.body.data.hero.name).toBe("Jose Silva");
    expect(experience.body.meta.confidenceSummary.high).toBeGreaterThanOrEqual(1);

    const claims = await request(app).get("/api/v2/person/1/claims?page=1&pageSize=10");
    expect(claims.status).toBe(200);
    expect(claims.body.data[0].evidenceIds).toContain("path:main");
    expect(service.getV2Claims).toHaveBeenCalledWith(1, {
      maxDepth: 20,
      page: 1,
      pageSize: 10,
    });

    const evidence = await request(app).get(
      "/api/v2/person/1/evidence/deep_lineage"
    );
    expect(evidence.status).toBe(200);
    expect(evidence.body.data.claimId).toBe("deep_lineage");

    const map = await request(app).get("/api/v2/person/1/map");
    expect(map.status).toBe(200);
    expect(map.body.data.points[0].geoMode).toBe("matched");

    const network = await request(app).get("/api/v2/person/1/network?depth=3");
    expect(network.status).toBe(200);
    expect(network.body.data.nodes).toHaveLength(1);
    expect(service.getV2Network).toHaveBeenCalledWith(1, {
      depth: 3,
      maxNodesPerDepth: 8,
    });

    const documentary = await request(app).get("/api/v2/person/1/documentary");
    expect(documentary.status).toBe(200);
    expect(documentary.body.data.chapters).toHaveLength(1);
  });
});

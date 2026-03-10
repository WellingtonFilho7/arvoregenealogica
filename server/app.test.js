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
  });

  test("GET /api/person/:id/relationship-path validates toId", async () => {
    const app = createApp({ service: makeService() });
    const response = await request(app).get("/api/person/1/relationship-path");

    expect(response.status).toBe(400);
    expect(response.body.warnings[0]).toMatch(/toId/i);
  });
});

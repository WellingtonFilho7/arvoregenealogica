export {};

const request = require("supertest");
const { buildRuntime } = require("./index");

describe("real database integration", () => {
  let app;
  let db;

  beforeAll(() => {
    const runtime = buildRuntime();
    app = runtime.app;
    db = runtime.db;
  });

  afterAll(() => {
    db.close();
  });

  test("search and core endpoints work against FamilyTree.rmtree", async () => {
    const search = await request(app).get("/api/search").query({ q: "Jo" });
    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.data)).toBe(true);
    expect(search.body.data.length).toBeGreaterThan(0);

    const personId = search.body.data[0].id;
    const summary = await request(app).get(`/api/person/${personId}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.id).toBe(personId);

    const path = await request(app).get(`/api/person/${personId}/ancestral-path`);
    expect(path.status).toBe(200);
    expect(Array.isArray(path.body.data.nodes)).toBe(true);

    const insights = await request(app).get(`/api/person/${personId}/insights`);
    expect(insights.status).toBe(200);
    expect(Array.isArray(insights.body.data)).toBe(true);

    const story = await request(app).get(`/api/person/${personId}/story`);
    expect(story.status).toBe(200);
    expect(Array.isArray(story.body.data.chapters)).toBe(true);
  });

  test("v2 endpoints return consistent narrative contracts", async () => {
    const search = await request(app).get("/api/v2/search").query({ q: "Jo" });
    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.data)).toBe(true);
    expect(search.body.data.length).toBeGreaterThan(0);

    const personId = search.body.data[0].id;
    const experience = await request(app).get(`/api/v2/person/${personId}/experience`);
    expect(experience.status).toBe(200);
    expect(experience.body.data.hero.personId).toBe(personId);
    expect(experience.body.meta.confidenceSummary).toBeDefined();

    const claims = await request(app)
      .get(`/api/v2/person/${personId}/claims`)
      .query({ page: 1, pageSize: 5 });
    expect(claims.status).toBe(200);
    expect(Array.isArray(claims.body.data)).toBe(true);
    expect(claims.body.data.length).toBeGreaterThan(0);

    const claimId = claims.body.data[0].id;
    const evidence = await request(app).get(
      `/api/v2/person/${personId}/evidence/${claimId}`
    );
    expect(evidence.status).toBe(200);
    expect(evidence.body.data.claimId).toBe(claimId);

    const map = await request(app).get(`/api/v2/person/${personId}/map`);
    expect(map.status).toBe(200);
    expect(Array.isArray(map.body.data.points)).toBe(true);
    expect(Array.isArray(map.body.data.routes)).toBe(true);

    const network = await request(app).get(`/api/v2/person/${personId}/network`);
    expect(network.status).toBe(200);
    expect(Array.isArray(network.body.data.nodes)).toBe(true);
    expect(Array.isArray(network.body.data.edges)).toBe(true);

    const documentary = await request(app).get(
      `/api/v2/person/${personId}/documentary`
    );
    expect(documentary.status).toBe(200);
    expect(Array.isArray(documentary.body.data.chapters)).toBe(true);
  });
});

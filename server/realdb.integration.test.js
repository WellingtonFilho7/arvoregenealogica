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
});

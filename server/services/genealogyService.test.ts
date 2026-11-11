export {};

const { GenealogyService } = require("./genealogyService");

function createMemoryCache() {
  const storage = new Map();
  return {
    getOrSet(key, _ttlMs, resolver) {
      if (storage.has(key)) {
        return storage.get(key);
      }
      const value = resolver();
      storage.set(key, value);
      return value;
    },
  };
}

describe("GenealogyService.getNotableAncestors", () => {
  test("falls back to connected network when selected person has no known parents", () => {
    const repository = {
      getAllPeople: jest.fn(() => [
        { id: 1, name: "Pessoa Base", birthYear: 1600, deathYear: null, surname: "Silva" },
        { id: 2, name: "Dom Gaspar", birthYear: 1580, deathYear: null, surname: "Silva" },
      ]),
      getParentLinks: jest.fn(() => [{ childId: 2, parentId: 1, relation: "father" }]),
      getPersonEvents: jest.fn(() => [
        {
          eventId: 1,
          personId: 2,
          eventType: "Birth",
          dateRaw: "1580",
          lat: null,
          lon: null,
          placeName: "Portugal",
        },
        {
          eventId: 2,
          personId: 2,
          eventType: "Death",
          dateRaw: "1640",
          lat: null,
          lon: null,
          placeName: "Portugal",
        },
      ]),
    };

    const service = new GenealogyService({
      repository,
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getNotableAncestors(1, { maxDepth: 20, limit: 5 });

    expect(result.meta.mode).toBe("network_fallback");
    expect(result.warnings).toEqual([]);
    expect(result.data.map((item) => item.id)).toEqual([2]);
  });

  test("keeps ancestor-only mode when direct ancestral branch exists", () => {
    const repository = {
      getAllPeople: jest.fn(() => [
        { id: 1, name: "Pessoa Base", birthYear: 1700, deathYear: null, surname: "Silva" },
        { id: 2, name: "Filho", birthYear: 1730, deathYear: null, surname: "Silva" },
        { id: 3, name: "Avo Antigo", birthYear: 1660, deathYear: null, surname: "Silva" },
      ]),
      getParentLinks: jest.fn(() => [
        { childId: 1, parentId: 3, relation: "father" },
        { childId: 2, parentId: 1, relation: "father" },
      ]),
      getPersonEvents: jest.fn(() => []),
    };

    const service = new GenealogyService({
      repository,
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getNotableAncestors(1, { maxDepth: 20, limit: 5 });

    expect(result.meta.mode).toBe("ancestors");
    expect(result.data.map((item) => item.id)).toEqual([3]);
  });
});

describe("GenealogyService v2 narrative experience", () => {
  function createRepositoryFixture() {
    return {
      health: jest.fn(() => true),
      searchPeople: jest.fn(() => [
        {
          id: 1,
          name: "Pessoa Base",
          birthYear: 1990,
          deathYear: null,
          given: "Pessoa",
          surname: "Base",
          sex: 0,
          living: 1,
        },
      ]),
      getPersonSummary: jest.fn((id) => ({
        id,
        name: id === 1 ? "Pessoa Base" : "Avo Antigo",
        given: id === 1 ? "Pessoa" : "Avo",
        surname: id === 1 ? "Base" : "Antigo",
        birthYear: id === 1 ? 1990 : 1710,
        deathYear: null,
        sex: 0,
        living: 0,
      })),
      getAllPeople: jest.fn(() => [
        { id: 1, name: "Pessoa Base", given: "Pessoa", surname: "Base", birthYear: 1990, deathYear: null, sex: 0, living: 1 },
        { id: 2, name: "Avo Antigo", given: "Avo", surname: "Antigo", birthYear: 1710, deathYear: null, sex: 0, living: 0 },
        { id: 3, name: "Conector Historico", given: "Conector", surname: "Historico", birthYear: 1750, deathYear: 1820, sex: 0, living: 0 },
        { id: 4, name: "Lateral 1", given: "Lateral", surname: "Um", birthYear: 1770, deathYear: null, sex: 0, living: 0 },
        { id: 5, name: "Lateral 2", given: "Lateral", surname: "Dois", birthYear: 1772, deathYear: null, sex: 0, living: 0 },
        { id: 6, name: "Lateral 3", given: "Lateral", surname: "Tres", birthYear: 1774, deathYear: null, sex: 0, living: 0 },
      ]),
      getParentLinks: jest.fn(() => [
        { childId: 1, parentId: 2, relation: "father" },
        { childId: 2, parentId: 3, relation: "father" },
        { childId: 4, parentId: 3, relation: "father" },
        { childId: 5, parentId: 3, relation: "father" },
        { childId: 6, parentId: 3, relation: "father" },
      ]),
      getPersonEvents: jest.fn(() => [
        {
          eventId: 101,
          personId: 1,
          eventType: "Birth",
          dateRaw: "1990",
          lat: -6.45,
          lon: -37.1,
          placeName: "Caico, Rio Grande do Norte, Brasil",
        },
        {
          eventId: 102,
          personId: 2,
          eventType: "Birth",
          dateRaw: "1710",
          lat: null,
          lon: null,
          placeName: "Portugal",
        },
        {
          eventId: 103,
          personId: 3,
          eventType: "Death",
          dateRaw: "1820",
          lat: null,
          lon: null,
          placeName: "Lugar sem coordenada mapeada",
        },
      ]),
    };
  }

  test("builds claims with confidence and evidence references", () => {
    const service = new GenealogyService({
      repository: createRepositoryFixture(),
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getV2Claims(1, { page: 1, pageSize: 10, maxDepth: 20 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).toHaveProperty("confidence");
    expect(result.data[0]).toHaveProperty("evidenceIds");
    expect(result.meta).toHaveProperty("confidenceSummary");
  });

  test("resolves map points with geoMode precedence and builds chronological routes", () => {
    const service = new GenealogyService({
      repository: createRepositoryFixture(),
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getV2Map(1, { maxDepth: 20 });
    const modes = new Set(result.data.points.map((point) => point.geoMode));
    expect(modes.has("exact")).toBe(true);
    expect(modes.has("matched")).toBe(true);
    expect(modes.has("estimated")).toBe(true);
    expect(result.data.routes.length).toBeGreaterThan(0);
  });

  test("clusters dense levels in v2 network payload", () => {
    const service = new GenealogyService({
      repository: createRepositoryFixture(),
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getV2Network(3, { depth: 2, maxNodesPerDepth: 2 });
    const clusterNodes = result.data.nodes.filter((node) => node.cluster === true);
    expect(clusterNodes.length).toBeGreaterThan(0);
  });

  test("returns documentary with chapter evidence trace", () => {
    const service = new GenealogyService({
      repository: createRepositoryFixture(),
      cache: createMemoryCache(),
      dbPath: "memory",
    });

    const result = service.getV2Documentary(1, { maxDepth: 20 });
    expect(result.data.title).toMatch(/Pessoa Base/i);
    expect(result.data.chapters.length).toBeGreaterThan(0);
    expect(result.data.chapters[0]).toHaveProperty("evidenceIds");
  });
});

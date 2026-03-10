const {
  createGenealogyIndex,
  findOldestAncestralPath,
  getGenerationDistribution,
  findShortestRelationshipPath,
  buildNetwork,
} = require("./genealogy");

function fixture() {
  const people = [
    { id: 1, name: "Pessoa Base", birthYear: 1990 },
    { id: 2, name: "Mae", birthYear: 1965 },
    { id: 3, name: "Pai", birthYear: 1960 },
    { id: 4, name: "Avo Materna", birthYear: 1930 },
    { id: 5, name: "Avo Materno", birthYear: 1935 },
    { id: 6, name: "Avo Paterno", birthYear: 1920 },
  ];

  const parentLinks = [
    { childId: 1, parentId: 2, relation: "mother" },
    { childId: 1, parentId: 3, relation: "father" },
    { childId: 2, parentId: 4, relation: "mother" },
    { childId: 2, parentId: 5, relation: "father" },
    { childId: 3, parentId: 6, relation: "father" },
  ];

  return { people, parentLinks };
}

describe("genealogy algorithms", () => {
  test("finds oldest reachable ancestral path", () => {
    const { people, parentLinks } = fixture();
    const index = createGenealogyIndex(people, parentLinks);

    const path = findOldestAncestralPath(index, 1, 6);
    const ids = path.nodes.map((node) => node.id);

    expect(ids).toEqual([1, 3, 6]);
    expect(path.generations).toBe(2);
    expect(path.warnings).toEqual([]);
  });

  test("returns generation distribution", () => {
    const { people, parentLinks } = fixture();
    const index = createGenealogyIndex(people, parentLinks);

    const distribution = getGenerationDistribution(index, 1, 6);

    expect(distribution).toEqual([
      { generation: 0, count: 1 },
      { generation: 1, count: 2 },
      { generation: 2, count: 3 },
    ]);
  });

  test("finds shortest relationship path between two people", () => {
    const { people, parentLinks } = fixture();
    const index = createGenealogyIndex(people, parentLinks);

    const path = findShortestRelationshipPath(index, 4, 6, 8);

    expect(path.distance).toBe(4);
    expect(path.nodes.map((node) => node.id)).toEqual([4, 2, 1, 3, 6]);
    expect(path.edges).toHaveLength(4);
  });

  test("builds local network by depth", () => {
    const { people, parentLinks } = fixture();
    const index = createGenealogyIndex(people, parentLinks);

    const network = buildNetwork(index, 1, 1);
    const nodeIds = network.nodes.map((node) => node.id).sort((a, b) => a - b);
    const edges = network.edges.map((edge) => `${edge.sourceId}-${edge.targetId}`);

    expect(nodeIds).toEqual([1, 2, 3]);
    expect(edges.sort()).toEqual(["1-2", "1-3"]);
  });
});

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

function makeExperience(personName, oldestName, oldestYear) {
  return {
    data: {
      hero: {
        personId: personName === "Jose Silva" ? 1 : 2,
        name: personName,
        arcSummary: `Da pessoa base ate ${oldestName} (${oldestYear}).`,
        confidence: "high",
        generations: 17,
      },
      lineageSpine: [
        { id: 1, name: personName, depth: 0, birthYear: 1991 },
        { id: 10, name: oldestName, depth: 17, birthYear: oldestYear },
      ],
      topClaims: [
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
      keyMilestones: [
        {
          eventId: 91,
          year: 1695,
          placeName: "Portugal",
          personName: oldestName,
          eventType: "Birth",
          geoMode: "matched",
          geoConfidence: "medium",
        },
      ],
      notableAncestors: [
        {
          id: 11,
          name: oldestName,
          birthYear: oldestYear,
          deathYear: null,
          score: 8,
          reasons: ["Conecta ramos", "Nascimento antigo"],
          evidence: "/api/person/11/summary",
        },
      ],
      dataQuality: {
        totalPeople: 28,
        missingBirthYears: 2,
        totalEvents: 40,
        inferredGeoCount: 3,
        mapCoverage: 0.72,
      },
    },
    meta: {
      generatedAt: "2026-03-11T00:00:00.000Z",
      confidenceSummary: { high: 1, medium: 0, low: 0 },
    },
    warnings: [],
  };
}

function mockApi(overrides = {}) {
  const base = {
    "/api/v2/search?q=jose": {
      data: [
        {
          id: 1,
          name: "Jose Silva",
          yearsLabel: "1991 - ?",
          estimatedDepth: 17,
          connectivitySignal: "high",
        },
      ],
      meta: { count: 1, generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/search?q=ma": {
      data: [
        {
          id: 2,
          name: "Maria Oliveira",
          yearsLabel: "1987 - ?",
          estimatedDepth: 14,
          connectivitySignal: "medium",
        },
      ],
      meta: { count: 1, generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 0, medium: 1, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/1/experience?maxDepth=20": makeExperience(
      "Jose Silva",
      "Leonor Rodrigues Ribeiro",
      1270
    ),
    "/api/v2/person/2/experience?maxDepth=20": makeExperience(
      "Maria Oliveira",
      "Margarida Freire de Araujo",
      1735
    ),
    "/api/v2/person/1/claims?page=1&pageSize=12&maxDepth=20": {
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
        pageSize: 12,
        total: 1,
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 1, medium: 0, low: 0 },
      },
      warnings: [],
    },
    "/api/v2/person/2/claims?page=1&pageSize=12&maxDepth=20": {
      data: [
        {
          id: "deep_lineage",
          title: "Linhagem profunda",
          value: "14 geracoes",
          why: "Ha 14 saltos parentais validos no recorte.",
          confidence: "medium",
          evidenceIds: ["path:main"],
          actions: [{ type: "open_evidence", target: "deep_lineage" }],
        },
      ],
      meta: {
        page: 1,
        pageSize: 12,
        total: 1,
        generatedAt: "2026-03-11T00:00:00.000Z",
        confidenceSummary: { high: 0, medium: 1, low: 0 },
      },
      warnings: [],
    },
    "/api/v2/person/1/evidence/deep_lineage?maxDepth=20": {
      data: {
        claimId: "deep_lineage",
        title: "Linhagem profunda",
        confidence: "high",
        origin: "path:main",
        proof: [{ type: "path", nodes: [{ id: 1, name: "Jose Silva" }] }],
        limitations: [],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/2/evidence/deep_lineage?maxDepth=20": {
      data: {
        claimId: "deep_lineage",
        title: "Linhagem profunda",
        confidence: "medium",
        origin: "path:main",
        proof: [{ type: "path", nodes: [{ id: 2, name: "Maria Oliveira" }] }],
        limitations: ["Parte da trilha sem ano de nascimento."],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 0, medium: 1, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/1/map?maxDepth=20": {
      data: {
        points: [
          {
            eventId: 1,
            personId: 1,
            personName: "Jose Silva",
            eventType: "Birth",
            year: 1991,
            placeName: "Caico, Rio Grande do Norte, Brasil",
            lat: -6.45,
            lon: -37.1,
            geoMode: "exact",
            geoConfidence: "high",
          },
          {
            eventId: 2,
            personId: 10,
            personName: "Leonor Rodrigues Ribeiro",
            eventType: "Birth",
            year: 1270,
            placeName: "Portugal",
            lat: 39.39,
            lon: -8.22,
            geoMode: "matched",
            geoConfidence: "medium",
          },
          {
            eventId: 3,
            personId: 12,
            personName: "Pessoa sem lugar",
            eventType: "Death",
            year: 1320,
            placeName: "Lugar desconhecido",
            lat: 21.2,
            lon: 16.6,
            geoMode: "estimated",
            geoConfidence: "low",
          },
        ],
        routes: [
          {
            id: "2-3",
            fromEventId: 2,
            toEventId: 3,
            fromLat: 39.39,
            fromLon: -8.22,
            toLat: 21.2,
            toLon: 16.6,
          },
          {
            id: "3-1",
            fromEventId: 3,
            toEventId: 1,
            fromLat: 21.2,
            fromLon: 16.6,
            toLat: -6.45,
            toLon: -37.1,
          },
        ],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 1, low: 1 } },
      warnings: [],
    },
    "/api/v2/person/2/map?maxDepth=20": {
      data: { points: [], routes: [] },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 0, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/1/network?depth=3&maxNodesPerDepth=8": {
      data: {
        nodes: [
          { id: 1, name: "Jose Silva", depth: 0 },
          { id: 20, name: "Conector Historico", depth: 1 },
        ],
        edges: [{ sourceId: 1, targetId: 20, relation: "father" }],
        highlights: [],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/2/network?depth=3&maxNodesPerDepth=8": {
      data: { nodes: [{ id: 2, name: "Maria Oliveira", depth: 0 }], edges: [], highlights: [] },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/1/documentary?maxDepth=20": {
      data: {
        title: "Documentario genealogico de Jose Silva",
        chapters: [{ id: "abertura", title: "Abertura", body: "Inicio da jornada", evidenceIds: ["deep_lineage"] }],
        highlights: [{ id: "deep_lineage", label: "Linhagem profunda", value: "17 geracoes", confidence: "high", evidenceIds: ["path:main"] }],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 1, medium: 0, low: 0 } },
      warnings: [],
    },
    "/api/v2/person/2/documentary?maxDepth=20": {
      data: {
        title: "Documentario genealogico de Maria Oliveira",
        chapters: [{ id: "abertura", title: "Abertura", body: "Jornada de Maria", evidenceIds: ["deep_lineage"] }],
        highlights: [{ id: "deep_lineage", label: "Linhagem profunda", value: "14 geracoes", confidence: "medium", evidenceIds: ["path:main"] }],
      },
      meta: { generatedAt: "2026-03-11T00:00:00.000Z", confidenceSummary: { high: 0, medium: 1, low: 0 } },
      warnings: [],
    },
  };

  const responses = { ...base, ...overrides };

  global.fetch = jest.fn(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    const path = url.replace("http://localhost:4000", "");
    const payload = responses[path];
    if (!payload) {
      return {
        ok: false,
        json: async () => ({
          data: null,
          meta: {},
          warnings: [`No mock for ${path}`],
        }),
      };
    }
    return {
      ok: true,
      json: async () => payload,
    };
  });
}

async function selectBasePerson(query, personName) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText(/buscar pessoa base/i));
  await user.type(screen.getByLabelText(/buscar pessoa base/i), query);
  await user.click(screen.getByRole("button", { name: /buscar/i }));
  await user.click(await screen.findByRole("button", { name: new RegExp(personName, "i") }));
  return user;
}

describe("Atlas V2 story-first", () => {
  beforeEach(() => {
    mockApi();
  });

  test("renders story-first journey for selected base person", async () => {
    render(<App />);

    await selectBasePerson("jose", "Jose Silva");

    expect(
      await screen.findByRole("heading", { name: /^jose silva$/i, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/da pessoa base ate/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /descobertas acionaveis/i })).toBeInTheDocument();
    expect(screen.queryByText(/evidencia aberta:/i)).not.toBeInTheDocument();
  });

  test("opens evidence panel from a claim card", async () => {
    render(<App />);
    const user = await selectBasePerson("jose", "Jose Silva");

    await user.click(await screen.findByRole("button", { name: /ver evidencia/i }));

    expect(await screen.findByRole("heading", { name: /painel de evidencia/i })).toBeInTheDocument();
    expect(screen.getByText(/origem: path:main/i)).toBeInTheDocument();
    expect(screen.getByText(/claim: deep_lineage/i)).toBeInTheDocument();
  });

  test("shows map routes and confidence legend", async () => {
    render(<App />);
    await selectBasePerson("jose", "Jose Silva");

    expect((await screen.findAllByTestId("map-point")).length).toBeGreaterThan(0);
    expect((await screen.findAllByTestId("map-route")).length).toBeGreaterThan(0);
    expect(screen.getByText(/exact/i)).toBeInTheDocument();
    expect(screen.getByText(/matched/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated/i)).toBeInTheDocument();
  });

  test("recalculates all narrative modules when changing base person", async () => {
    render(<App />);
    await selectBasePerson("jose", "Jose Silva");

    expect(await screen.findByText(/documentario genealogico de jose silva/i)).toBeInTheDocument();

    await selectBasePerson("ma", "Maria Oliveira");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /^maria oliveira$/i, level: 2 })
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/documentario genealogico de maria oliveira/i)).toBeInTheDocument();
  });
});

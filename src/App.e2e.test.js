import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

function mockApi(overrides = {}) {
  const base = {
    "/api/search?q=jose": {
      data: [{ id: 1, name: "Jose Silva", birthYear: 1991, deathYear: null }],
      meta: { count: 1 },
      warnings: [],
    },
    "/api/person/1/summary": {
      data: { id: 1, name: "Jose Silva", birthYear: 1991, deathYear: null },
      meta: {},
      warnings: [],
    },
    "/api/person/1/ancestral-path": {
      data: {
        nodes: [
          { id: 1, name: "Jose Silva", birthYear: 1991, depth: 0 },
          { id: 10, name: "Antepassado Antigo", birthYear: 1700, depth: 1 },
        ],
        edges: [{ sourceId: 1, targetId: 10 }],
        generations: 1,
      },
      meta: {},
      warnings: [],
    },
    "/api/person/1/generation-distribution": {
      data: [
        { generation: 0, count: 1 },
        { generation: 1, count: 2 },
      ],
      meta: {},
      warnings: [],
    },
    "/api/person/1/insights": {
      data: [
        {
          id: "deep_branch",
          title: "Ramo mais profundo",
          value: "17 geracoes",
          description: "Descricao",
          cta: "/path",
        },
      ],
      meta: {},
      warnings: [],
    },
    "/api/person/1/migration-timeline": {
      data: [
        {
          eventId: 1,
          personId: 1,
          personName: "Jose Silva",
          eventType: "Birth",
          year: 1991,
          placeName: "Caico",
          lat: -6.45,
          lon: -37.1,
        },
      ],
      meta: {},
      warnings: [],
    },
    "/api/person/1/network?depth=3": {
      data: {
        nodes: [
          { id: 1, name: "Jose Silva", depth: 0 },
          { id: 2, name: "Parente", depth: 1 },
        ],
        edges: [{ sourceId: 1, targetId: 2, relation: "father" }],
      },
      meta: { depth: 3 },
      warnings: [],
    },
    "/api/person/1/story": {
      data: {
        title: "Documentario familiar de Jose Silva",
        chapters: [{ id: "origem", title: "Origem", body: "Capitulo inicial" }],
        highlights: [{ id: "deep_branch", label: "Ramo", value: "17 geracoes" }],
      },
      meta: {},
      warnings: [],
    },
    "/api/person/1/relationship-path?toId=2": {
      data: {
        nodes: [
          { id: 1, name: "Jose Silva" },
          { id: 2, name: "Parente" },
        ],
        edges: [{ sourceId: 1, targetId: 2 }],
        distance: 1,
      },
      meta: {},
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
        json: async () => ({ data: null, meta: {}, warnings: [`No mock for ${path}`] }),
      };
    }

    return {
      ok: true,
      json: async () => payload,
    };
  });
}

describe("Genealogy explorer flows", () => {
  beforeEach(() => {
    mockApi();
  });

  test("updates all modules after selecting base person", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/buscar pessoa base/i), "jose");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await user.click(await screen.findByRole("button", { name: /jose silva/i }));

    expect(
      await screen.findByRole("heading", { name: /jose silva/i, level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^documentario familiar$/i, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/ramo mais profundo/i)).toBeInTheDocument();
  });

  test("opens evidence when clicking curiosity card action", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/buscar pessoa base/i), "jose");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await user.click(await screen.findByRole("button", { name: /jose silva/i }));

    await user.click(await screen.findByRole("button", { name: /ver evidencia/i }));
    expect(await screen.findByText(/evidencia aberta: \/path/i)).toBeInTheDocument();
  });

  test("shows relationship path between selected person and target", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/buscar pessoa base/i), "jose");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await user.click(await screen.findByRole("button", { name: /jose silva/i }));

    await user.clear(screen.getByLabelText(/id de destino/i));
    await user.type(screen.getByLabelText(/id de destino/i), "2");
    await user.click(screen.getByRole("button", { name: /encontrar ligacao/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/caminho encontrado: jose silva -> parente/i)
      ).toBeInTheDocument();
    });
  });
});

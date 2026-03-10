const express = require("express");
const cors = require("cors");

function normalizeResult(result) {
  return {
    data: result?.data ?? null,
    meta: result?.meta ?? {},
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  };
}

function asPersonId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function createApp({ service }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const data = service.getHealth();
    res.json({
      data,
      meta: {},
      warnings: [],
    });
  });

  app.get("/api/search", (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({
        data: [],
        meta: {},
        warnings: ["Query parameter 'q' is required"],
      });
    }

    const result = service.searchPeople(query);
    return res.json(normalizeResult(result));
  });

  app.get("/api/person/:id/summary", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: null,
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    return res.json(normalizeResult(service.getPersonSummary(personId)));
  });

  app.get("/api/person/:id/ancestral-path", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: null,
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 20;
    const mode = String(req.query.mode || "oldest");
    return res.json(
      normalizeResult(service.getAncestralPath(personId, { maxDepth, mode }))
    );
  });

  app.get("/api/person/:id/generation-distribution", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: [],
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 20;
    return res.json(
      normalizeResult(service.getGenerationDistribution(personId, { maxDepth }))
    );
  });

  app.get("/api/person/:id/insights", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: [],
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 20;
    return res.json(normalizeResult(service.getInsights(personId, { maxDepth })));
  });

  app.get("/api/person/:id/migration-timeline", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: [],
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 20;
    return res.json(
      normalizeResult(service.getMigrationTimeline(personId, { maxDepth }))
    );
  });

  app.get("/api/person/:id/network", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: { nodes: [], edges: [] },
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const depth = Number(req.query.depth) || 3;
    return res.json(normalizeResult(service.getNetwork(personId, { depth })));
  });

  app.get("/api/person/:id/relationship-path", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: { nodes: [], edges: [], distance: -1 },
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const toId = asPersonId(req.query.toId);
    if (!toId) {
      return res.status(400).json({
        data: { nodes: [], edges: [], distance: -1 },
        meta: {},
        warnings: ["Query parameter 'toId' is required"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 8;
    return res.json(
      normalizeResult(service.getRelationshipPath(personId, toId, { maxDepth }))
    );
  });

  app.get("/api/person/:id/story", (req, res) => {
    const personId = asPersonId(req.params.id);
    if (!personId) {
      return res.status(400).json({
        data: null,
        meta: {},
        warnings: ["Invalid person id"],
      });
    }
    const maxDepth = Number(req.query.maxDepth) || 20;
    return res.json(normalizeResult(service.getStory(personId, { maxDepth })));
  });

  app.use((error, _req, res, _next) => {
    return res.status(500).json({
      data: null,
      meta: {},
      warnings: [error.message || "Internal server error"],
    });
  });

  return app;
}

module.exports = {
  createApp,
};

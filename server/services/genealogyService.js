const {
  createGenealogyIndex,
  findOldestAncestralPath,
  getGenerationDistribution,
  findShortestRelationshipPath,
  buildNetwork,
} = require("../lib/genealogy");

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

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

class GenealogyService {
  constructor({ repository, cache, dbPath, cacheTtlMs = DEFAULT_CACHE_TTL }) {
    this.repository = repository;
    this.cache = cache;
    this.dbPath = dbPath;
    this.cacheTtlMs = cacheTtlMs;
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

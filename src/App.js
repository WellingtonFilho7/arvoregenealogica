import React, { useEffect, useMemo, useState } from "react";
import {
  searchPeople,
  getPersonSummary,
  getAncestralPath,
  getGenerationDistribution,
  getInsights,
  getMigrationTimeline,
  getNetwork,
  getRelationshipPath,
  getStory,
} from "./api/client";
import "./App.css";

function safeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function lonToX(lon) {
  return ((lon + 180) / 360) * 900;
}

function latToY(lat) {
  return ((90 - lat) / 180) * 450;
}

function buildStoryHtml(story) {
  const chapterHtml = (story.chapters || [])
    .map(
      (chapter) => `
      <section style="margin-bottom:24px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#1f2d20">${chapter.title}</h2>
        <p style="margin:0;line-height:1.6;color:#37493a">${chapter.body}</p>
      </section>
    `
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${story.title}</title>
</head>
<body style="margin:0;background:#f5f2e9;font-family:Georgia,serif;padding:32px">
  <main style="max-width:860px;margin:0 auto;background:#fff;padding:40px;border:1px solid #e2dccd">
    <h1 style="margin:0 0 24px;color:#1f2d20">${story.title}</h1>
    ${chapterHtml}
  </main>
</body>
</html>`;
}

function App() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [evidence, setEvidence] = useState("");
  const [relationshipTargetId, setRelationshipTargetId] = useState("");
  const [relationshipMessage, setRelationshipMessage] = useState("");
  const [mapYear, setMapYear] = useState(null);

  const [summary, setSummary] = useState(null);
  const [pathData, setPathData] = useState({ nodes: [], edges: [], generations: 0 });
  const [distribution, setDistribution] = useState([]);
  const [insights, setInsights] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [network, setNetwork] = useState({ nodes: [], edges: [] });
  const [story, setStory] = useState({ title: "", chapters: [], highlights: [] });
  const [relationshipPath, setRelationshipPath] = useState({
    nodes: [],
    edges: [],
    distance: -1,
  });

  const knownYears = useMemo(() => {
    return timeline
      .map((item) => item.year)
      .filter((year) => year !== null && year !== undefined);
  }, [timeline]);

  const minYear = knownYears.length ? Math.min(...knownYears) : 1200;
  const maxYear = knownYears.length ? Math.max(...knownYears) : 2025;

  const visibleTimeline = useMemo(() => {
    if (!mapYear) {
      return timeline;
    }
    return timeline.filter((event) => event.year === null || event.year <= mapYear);
  }, [timeline, mapYear]);

  const networkPositions = useMemo(() => {
    const byDepth = new Map();
    for (const node of network.nodes) {
      const depth = safeNumber(node.depth, 0);
      if (!byDepth.has(depth)) {
        byDepth.set(depth, []);
      }
      byDepth.get(depth).push(node);
    }

    const coordinates = new Map();
    const depths = [...byDepth.keys()].sort((a, b) => a - b);
    depths.forEach((depth) => {
      const nodesAtDepth = byDepth.get(depth);
      nodesAtDepth.forEach((node, index) => {
        const x = 120 + depth * 180;
        const y = 80 + index * 80;
        coordinates.set(node.id, { x, y });
      });
    });
    return coordinates;
  }, [network.nodes]);

  useEffect(() => {
    if (!selectedPerson?.id) {
      return undefined;
    }

    let active = true;
    setLoadingData(true);
    setDataError("");
    setWarnings([]);

    async function loadModules() {
      try {
        const personId = selectedPerson.id;
        const [
          summaryRes,
          pathRes,
          distributionRes,
          insightsRes,
          timelineRes,
          networkRes,
          storyRes,
        ] = await Promise.all([
          getPersonSummary(personId),
          getAncestralPath(personId),
          getGenerationDistribution(personId),
          getInsights(personId),
          getMigrationTimeline(personId),
          getNetwork(personId, 3),
          getStory(personId),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryRes.data || null);
        setPathData(pathRes.data || { nodes: [], edges: [], generations: 0 });
        setDistribution(distributionRes.data || []);
        setInsights(insightsRes.data || []);
        setTimeline(timelineRes.data || []);
        setNetwork(networkRes.data || { nodes: [], edges: [] });
        setStory(storyRes.data || { title: "", chapters: [], highlights: [] });
        setMapYear(null);

        const mergedWarnings = [
          ...(summaryRes.warnings || []),
          ...(pathRes.warnings || []),
          ...(insightsRes.warnings || []),
          ...(timelineRes.warnings || []),
          ...(storyRes.warnings || []),
        ];
        setWarnings([...new Set(mergedWarnings)]);
      } catch (error) {
        if (!active) {
          return;
        }
        setDataError(error.message || "Falha ao carregar dados da pessoa selecionada");
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    }

    loadModules();

    return () => {
      active = false;
    };
  }, [selectedPerson]);

  async function handleSearch(event) {
    event.preventDefault();
    setSearchError("");
    setSearchResults([]);
    if (!query.trim()) {
      setSearchError("Digite um nome para buscar.");
      return;
    }

    setSearchLoading(true);
    try {
      const response = await searchPeople(query.trim());
      setSearchResults(response.data || []);
    } catch (error) {
      setSearchError(error.message || "Nao foi possivel buscar pessoas.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleRelationshipSearch() {
    if (!selectedPerson?.id) {
      setRelationshipMessage("Selecione uma pessoa base antes de buscar ligacao.");
      return;
    }

    const target = safeNumber(relationshipTargetId, 0);
    if (!target) {
      setRelationshipMessage("Informe um ID de destino valido.");
      return;
    }

    try {
      const response = await getRelationshipPath(selectedPerson.id, target);
      const path = response.data || { nodes: [], edges: [], distance: -1 };
      setRelationshipPath(path);
      if (path.nodes.length > 0) {
        const names = path.nodes.map((node) => node.name || `#${node.id}`);
        setRelationshipMessage(`Caminho encontrado: ${names.join(" -> ")}`);
      } else {
        setRelationshipMessage("Nao foi encontrado caminho entre as pessoas.");
      }
    } catch (error) {
      setRelationshipMessage(error.message || "Erro ao buscar ligacao.");
    }
  }

  function handleExportStory() {
    if (!story?.title) {
      return;
    }

    const html = buildStoryHtml(story);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "documentario-familiar.html";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="explorer-app">
      <header className="hero">
        <p className="hero-tag">Acervo familiar</p>
        <h1>Atlas Genealogico Interativo</h1>
        <p className="hero-text">
          Selecione uma pessoa base para revelar trilhas ancestrais, curiosidades e conexoes entre
          ramos familiares.
        </p>
      </header>

      <main className="layout">
        <section className="card search-card">
          <h2>Pessoa base</h2>
          <form onSubmit={handleSearch} className="search-form">
            <label htmlFor="search-input">Buscar pessoa base</label>
            <div className="search-row">
              <input
                id="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ex: Jose, Maria, Pereira..."
              />
              <button type="submit" className="btn-primary" disabled={searchLoading}>
                {searchLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>
          {searchError && <p className="inline-error">{searchError}</p>}
          <div className="search-results">
            {searchResults.map((person) => (
              <button
                key={person.id}
                type="button"
                className="result-item"
                onClick={() => {
                  setSelectedPerson(person);
                  setRelationshipTargetId("");
                  setRelationshipMessage("");
                  setEvidence("");
                }}
              >
                <strong>{person.name}</strong>
                <span>
                  {person.birthYear || "?"}
                  {person.deathYear ? ` - ${person.deathYear}` : ""}
                </span>
              </button>
            ))}
            {!searchLoading && searchResults.length === 0 && query && !searchError && (
              <p className="muted">Nenhum resultado para esta busca.</p>
            )}
          </div>
        </section>

        {!selectedPerson && (
          <section className="card empty-state">
            <h2>Explore os dados</h2>
            <p>Use a busca acima e selecione uma pessoa para abrir todos os modulos.</p>
            <button type="button" className="btn-primary" onClick={() => setQuery("jose")}>
              Preencher exemplo de busca
            </button>
          </section>
        )}

        {selectedPerson && (
          <>
            <section className="card">
              <h2>{summary?.name || selectedPerson.name}</h2>
              <p className="subtle">
                Nascimento: {summary?.birthYear || "desconhecido"} | Obito:{" "}
                {summary?.deathYear || "desconhecido"}
              </p>
              {loadingData && <p className="muted">Atualizando modulos...</p>}
              {dataError && <p className="inline-error">{dataError}</p>}
              {warnings.length > 0 && (
                <ul className="warning-list">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card two-col">
              <div>
                <h2>Trilha ancestral</h2>
                <p className="subtle">{pathData.generations} geracoes no caminho principal</p>
                <ol className="path-list">
                  {pathData.nodes.map((node) => (
                    <li key={node.id}>
                      <span>{node.name}</span>
                      <small>{node.birthYear || "ano desconhecido"}</small>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>Distribuicao por geracao</h3>
                <ul className="distribution">
                  {distribution.map((item) => (
                    <li key={item.generation}>
                      <span>Geracao {item.generation}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="card">
              <h2>Curiosidades acionaveis</h2>
              {evidence && <p className="evidence">Evidencia aberta: {evidence}</p>}
              <div className="insights-grid">
                {insights.map((insight) => (
                  <article key={insight.id} className="insight-card">
                    <h3>{insight.title}</h3>
                    <p className="insight-value">{insight.value}</p>
                    <p>{insight.description}</p>
                    <button type="button" onClick={() => setEvidence(insight.cta)}>
                      Ver evidencia
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Mapa temporal de migracao</h2>
              <div className="map-controls">
                <label htmlFor="timeline-year">
                  Filtro por ano
                  <input
                    id="timeline-year"
                    type="range"
                    min={minYear}
                    max={maxYear}
                    value={mapYear || maxYear}
                    onChange={(event) => setMapYear(Number(event.target.value))}
                  />
                </label>
                <span>{mapYear || maxYear}</span>
              </div>
              <svg viewBox="0 0 900 450" className="map-svg" aria-label="Mapa temporal">
                <rect x="0" y="0" width="900" height="450" />
                {visibleTimeline
                  .filter((event) => event.lat !== null && event.lon !== null)
                  .map((event) => (
                    <circle
                      key={event.eventId}
                      cx={lonToX(event.lon)}
                      cy={latToY(event.lat)}
                      r="5"
                    />
                  ))}
              </svg>
              <ul className="timeline-list">
                {visibleTimeline.slice(0, 12).map((event) => (
                  <li key={event.eventId}>
                    <span>{event.year || "Ano desconhecido"}</span>
                    <strong>{event.placeName}</strong>
                    <small>
                      {event.personName} - {event.eventType}
                    </small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>Grafo de ligacoes</h2>
              <svg viewBox="0 0 820 420" className="network-svg" aria-label="Grafo familiar">
                <rect x="0" y="0" width="820" height="420" />
                {network.edges.map((edge) => {
                  const from = networkPositions.get(edge.sourceId);
                  const to = networkPositions.get(edge.targetId);
                  if (!from || !to) {
                    return null;
                  }
                  return (
                    <line
                      key={`${edge.sourceId}-${edge.targetId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                    />
                  );
                })}
                {network.nodes.map((node) => {
                  const position = networkPositions.get(node.id);
                  if (!position) {
                    return null;
                  }
                  return (
                    <g key={node.id}>
                      <circle cx={position.x} cy={position.y} r="14" />
                      <text x={position.x + 20} y={position.y + 4}>
                        {node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="relationship-box">
                <label htmlFor="target-id">ID de destino</label>
                <input
                  id="target-id"
                  value={relationshipTargetId}
                  onChange={(event) => setRelationshipTargetId(event.target.value)}
                  placeholder="Ex: 2"
                />
                <button type="button" onClick={handleRelationshipSearch}>
                  Encontrar ligacao
                </button>
              </div>
              {relationshipMessage && <p className="relationship-message">{relationshipMessage}</p>}
              {relationshipPath.distance >= 0 && (
                <p className="subtle">Distancia no grafo: {relationshipPath.distance}</p>
              )}
            </section>

            <section className="card story-card">
              <h2>Documentario familiar</h2>
              <h3>{story.title}</h3>
              <div className="highlights">
                {story.highlights?.map((highlight) => (
                  <span key={highlight.id}>
                    {highlight.label}: {highlight.value}
                  </span>
                ))}
              </div>
              <div className="chapters">
                {story.chapters?.map((chapter) => (
                  <article key={chapter.id}>
                    <h4>{chapter.title}</h4>
                    <p>{chapter.body}</p>
                  </article>
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={handleExportStory}>
                Exportar HTML
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

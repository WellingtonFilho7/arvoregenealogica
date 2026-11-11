import React, { useMemo, useState } from "react";
import {
  searchPeopleV2,
  getExperienceV2,
  getClaimsV2,
  getEvidenceV2,
  getMapV2,
  getNetworkV2,
  getDocumentaryV2,
} from "./api/client";
import "./App.css";

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function lonToX(lon) {
  return ((lon + 180) / 360) * 980;
}

function latToY(lat) {
  return ((90 - lat) / 180) * 460;
}

function shortLabel(value, maxLength = 24) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
}

function buildNetworkLayout(network) {
  const width = 980;
  const horizontalPadding = 84;
  const laneHeight = 68;
  const nodes = Array.isArray(network?.nodes) ? network.nodes : [];
  const edges = Array.isArray(network?.edges) ? network.edges : [];
  if (nodes.length === 0) {
    return { width, height: 420, positions: new Map(), nodes: [], edges: [] };
  }

  const byDepth = new Map();
  for (const node of nodes) {
    const depth = safeNumber(node.depth, 0);
    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }
    byDepth.get(depth).push(node);
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const maxNodesByDepth = depths.reduce((max, depth) => {
    const count = byDepth.get(depth)?.length || 0;
    return Math.max(max, count);
  }, 1);
  const height = Math.max(420, 180 + (maxNodesByDepth - 1) * laneHeight);
  const positions = new Map();

  depths.forEach((depth, depthIndex) => {
    const nodesAtDepth = [...(byDepth.get(depth) || [])].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    const x =
      depths.length <= 1
        ? width / 2
        : horizontalPadding +
          (depthIndex * (width - horizontalPadding * 2)) / (depths.length - 1);
    const stackHeight = (nodesAtDepth.length - 1) * laneHeight;
    const startY = (height - stackHeight) / 2;
    nodesAtDepth.forEach((node, idx) => {
      positions.set(node.id, { x, y: startY + idx * laneHeight });
    });
  });

  return { width, height, positions, nodes, edges };
}

function buildDocumentaryHtml(documentary, hero, evidencePanel) {
  const chapterHtml = (documentary?.chapters || [])
    .map(
      (chapter) => `
        <section style="margin-bottom:24px">
          <h2 style="margin:0 0 8px;font-size:24px;color:#1e2a21">${chapter.title}</h2>
          <p style="margin:0;line-height:1.65;color:#2f3a33">${chapter.body}</p>
          <small style="display:block;margin-top:6px;color:#4e5d53">Evidencias: ${(chapter.evidenceIds || []).join(", ") || "sem referencias"}</small>
        </section>
      `
    )
    .join("");

  const evidenceHtml = evidencePanel
    ? `
      <section style="border-top:1px solid #e2dbcc;padding-top:16px;margin-top:20px">
        <h3 style="margin:0 0 8px;color:#1e2a21">Painel de evidencia (ultimo aberto)</h3>
        <p style="margin:0 0 6px;color:#3f4e45">Origem: ${evidencePanel.origin || "-"}</p>
        <p style="margin:0 0 6px;color:#3f4e45">Confianca: ${evidencePanel.confidence || "-"}</p>
        <p style="margin:0;color:#3f4e45">${evidencePanel.title || ""}</p>
      </section>
    `
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentary?.title || "Documentario genealogico"}</title>
  </head>
  <body style="margin:0;background:#f3efe6;padding:32px;font-family:'Georgia',serif">
    <main style="max-width:900px;margin:0 auto;background:#fff;border:1px solid #e2dbcc;border-radius:12px;padding:36px">
      <p style="margin:0 0 8px;color:#8a5f2a;font-weight:700;text-transform:uppercase">Atlas Genealogico</p>
      <h1 style="margin:0 0 12px;color:#1e2a21">${documentary?.title || "Documentario genealogico"}</h1>
      <p style="margin:0 0 22px;color:#3f4e45">${hero?.arcSummary || ""}</p>
      ${chapterHtml}
      ${evidenceHtml}
    </main>
  </body>
</html>`;
}

function App() {
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [loadingExperience, setLoadingExperience] = useState(false);
  const [experienceError, setExperienceError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const [experience, setExperience] = useState(null);
  const [claims, setClaims] = useState([]);
  const [mapData, setMapData] = useState({ points: [], routes: [] });
  const [network, setNetwork] = useState({ nodes: [], edges: [], highlights: [] });
  const [documentary, setDocumentary] = useState({ title: "", chapters: [], highlights: [] });
  const [periodFilter, setPeriodFilter] = useState("all");

  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [evidencePanel, setEvidencePanel] = useState(null);

  const networkLayout = useMemo(() => buildNetworkLayout(network), [network]);
  const availableYears = useMemo(
    () =>
      mapData.points
        .map((point) => point.year)
        .filter((year) => year !== null && year !== undefined),
    [mapData.points]
  );
  const oldestYear = availableYears.length ? Math.min(...availableYears) : null;
  const latestYear = availableYears.length ? Math.max(...availableYears) : null;

  const filteredMap = useMemo(() => {
    if (periodFilter === "all") {
      return mapData;
    }
    if (periodFilter === "before1800") {
      const points = mapData.points.filter((point) => point.year === null || point.year < 1800);
      const validPointIds = new Set(points.map((point) => point.eventId));
      return {
        points,
        routes: mapData.routes.filter(
          (route) =>
            validPointIds.has(route.fromEventId) && validPointIds.has(route.toEventId)
        ),
      };
    }
    if (periodFilter === "from1800") {
      const points = mapData.points.filter((point) => point.year === null || point.year >= 1800);
      const validPointIds = new Set(points.map((point) => point.eventId));
      return {
        points,
        routes: mapData.routes.filter(
          (route) =>
            validPointIds.has(route.fromEventId) && validPointIds.has(route.toEventId)
        ),
      };
    }
    return mapData;
  }, [mapData, periodFilter]);

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
      const response = await searchPeopleV2(query.trim());
      setSearchResults(response.data || []);
    } catch (error) {
      setSearchError(error.message || "Nao foi possivel buscar pessoas.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSelectPerson(personId) {
    setSelectedPersonId(personId);
    setLoadingExperience(true);
    setExperienceError("");
    setWarnings([]);
    setEvidenceError("");
    setEvidencePanel(null);
    setEvidenceLoading(false);
    setPeriodFilter("all");

    try {
      const [
        experienceRes,
        claimsRes,
        mapRes,
        networkRes,
        documentaryRes,
      ] = await Promise.all([
        getExperienceV2(personId, 20),
        getClaimsV2(personId, 1, 12, 20),
        getMapV2(personId, 20),
        getNetworkV2(personId, 3, 8),
        getDocumentaryV2(personId, 20),
      ]);

      setExperience(experienceRes.data || null);
      setClaims(claimsRes.data || []);
      setMapData(mapRes.data || { points: [], routes: [] });
      setNetwork(networkRes.data || { nodes: [], edges: [], highlights: [] });
      setDocumentary(documentaryRes.data || { title: "", chapters: [], highlights: [] });

      const mergedWarnings = [
        ...(experienceRes.warnings || []),
        ...(claimsRes.warnings || []),
        ...(mapRes.warnings || []),
        ...(networkRes.warnings || []),
        ...(documentaryRes.warnings || []),
      ];
      setWarnings([...new Set(mergedWarnings)]);
    } catch (error) {
      setExperienceError(
        error.message || "Falha ao carregar experiencia narrativa desta pessoa."
      );
    } finally {
      setLoadingExperience(false);
    }
  }

  async function handleOpenEvidence(claimId) {
    if (!selectedPersonId || !claimId) {
      return;
    }
    setEvidenceLoading(true);
    setEvidenceError("");
    try {
      const response = await getEvidenceV2(selectedPersonId, claimId, 20);
      const payload = response.data || {};
      setEvidencePanel({
        claimId: payload.claimId || claimId,
        title: payload.title || "Evidencia",
        confidence: payload.confidence || "low",
        origin: payload.origin || "desconhecida",
        proof: payload.proof || [],
        limitations: payload.limitations || [],
      });
    } catch (error) {
      setEvidencePanel(null);
      setEvidenceError(error.message || "Nao foi possivel abrir a evidencia.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  function handleExportDocumentary() {
    if (!documentary?.title) {
      return;
    }
    const html = buildDocumentaryHtml(documentary, experience?.hero, evidencePanel);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "atlas-genealogico-documentario.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="atlas-app">
      <header className="top-hero">
        <p className="eyebrow">Atlas Genealogico V2</p>
        <h1>Sua historia familiar em modo documentario</h1>
        <p className="hero-copy">
          Uma experiencia story-first para emocionar, informar e evidenciar cada descoberta.
        </p>
      </header>

      <main className="atlas-layout">
        <section className="panel search-panel">
          <h2>Pessoa base</h2>
          <form onSubmit={handleSearch} className="search-form">
            <label htmlFor="search-input">Buscar pessoa base</label>
            <div className="search-row">
              <input
                id="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ex: Jose, Maria, Valcacer..."
              />
              <button type="submit" disabled={searchLoading}>
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
                className={`search-result ${selectedPersonId === person.id ? "active" : ""}`}
                onClick={() => {
                  void handleSelectPerson(person.id);
                }}
              >
                <strong>{person.name}</strong>
                <span>{person.yearsLabel}</span>
                <small>
                  Profundidade: {person.estimatedDepth} | Conectividade: {person.connectivitySignal}
                </small>
              </button>
            ))}
            {!searchLoading && searchResults.length === 0 && query && !searchError && (
              <p className="muted">Nenhuma pessoa encontrada para essa busca.</p>
            )}
          </div>
        </section>

        {!selectedPersonId && (
          <section className="panel empty-panel">
            <h2>Comece sua jornada</h2>
            <p>Selecione uma pessoa base para abrir trilha, descobertas, mapa, grafo e documentario.</p>
            <button type="button" onClick={() => setQuery("jose")}>
              Preencher exemplo
            </button>
          </section>
        )}

        {selectedPersonId && (
          <>
            <section className="panel opening-panel">
              <h2>{experience?.hero?.name || "Carregando pessoa..."}</h2>
              <p className="arc">{experience?.hero?.arcSummary || "Montando arco narrativo..."}</p>
              <p className="hero-metrics">
                Geracoes: {experience?.hero?.generations || 0} | Confianca:{" "}
                {experience?.hero?.confidence || "low"}
              </p>
              {loadingExperience && <p className="muted">Atualizando experiencia...</p>}
              {experienceError && <p className="inline-error">{experienceError}</p>}
              {warnings.length > 0 && (
                <ul className="warning-list">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel lineage-panel">
              <h2>Trilha hoje -> ancestral antigo</h2>
              <ol className="lineage-list">
                {(experience?.lineageSpine || []).map((node) => (
                  <li key={node.id}>
                    <span>{node.name}</span>
                    <small>{node.birthYear || "ano desconhecido"}</small>
                  </li>
                ))}
              </ol>
            </section>

            <section className="panel claims-panel">
              <h2>Descobertas acionaveis</h2>
              <div className="claims-grid">
                {claims.map((claim) => (
                  <article key={claim.id} className="claim-card">
                    <h3>{claim.title}</h3>
                    <p className="claim-value">{claim.value}</p>
                    <p>{claim.why}</p>
                    <p className="claim-confidence">Confianca: {claim.confidence}</p>
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenEvidence(claim.id);
                      }}
                    >
                      Ver evidencia
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel map-panel">
              <div className="map-header">
                <h2>Mapa da jornada familiar</h2>
                <label htmlFor="period-filter">
                  Filtro de periodo
                  <select
                    id="period-filter"
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value)}
                  >
                    <option value="all">Todo o periodo</option>
                    <option value="before1800">Antes de 1800</option>
                    <option value="from1800">1800 em diante</option>
                  </select>
                </label>
              </div>
              <p className="map-range">
                Intervalo de anos: {oldestYear || "?"} - {latestYear || "?"}
              </p>
              <ul className="map-legend">
                <li>Exact: coordenada direta do evento</li>
                <li>Matched: correspondencia local por nome de lugar</li>
                <li>Online: geocoder online em cache</li>
                <li>Estimated: estimativa deterministica</li>
              </ul>
              <svg viewBox="0 0 980 460" className="map-canvas" aria-label="Mapa temporal v2">
                <rect x="0" y="0" width="980" height="460" />
                {filteredMap.routes.map((route) => (
                  <line
                    key={route.id}
                    data-testid="map-route"
                    className="map-route"
                    x1={lonToX(route.fromLon)}
                    y1={latToY(route.fromLat)}
                    x2={lonToX(route.toLon)}
                    y2={latToY(route.toLat)}
                  />
                ))}
                {filteredMap.points.map((point) => (
                  <circle
                    key={point.eventId}
                    data-testid="map-point"
                    className={`map-point map-point-${point.geoMode}`}
                    cx={lonToX(point.lon)}
                    cy={latToY(point.lat)}
                    r={point.geoMode === "exact" ? 5 : 4}
                  />
                ))}
              </svg>
            </section>

            <section className="panel network-panel">
              <h2>Rede de ligacoes</h2>
              <div className="network-scroll">
                <svg
                  viewBox={`0 0 ${networkLayout.width} ${networkLayout.height}`}
                  className="network-canvas"
                  aria-label="Rede familiar v2"
                >
                  <rect x="0" y="0" width={networkLayout.width} height={networkLayout.height} />
                  {networkLayout.edges.map((edge, index) => {
                    const from = networkLayout.positions.get(edge.sourceId);
                    const to = networkLayout.positions.get(edge.targetId);
                    if (!from || !to) {
                      return null;
                    }
                    return (
                      <line
                        key={`${edge.sourceId}-${edge.targetId}-${index}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                      />
                    );
                  })}
                  {networkLayout.nodes.map((node) => {
                    const position = networkLayout.positions.get(node.id);
                    if (!position) {
                      return null;
                    }
                    return (
                      <g key={node.id}>
                        <circle
                          className={node.cluster ? "network-node cluster" : "network-node"}
                          cx={position.x}
                          cy={position.y}
                          r="16"
                        />
                        <text x={position.x} y={position.y + 4} textAnchor="middle">
                          {safeNumber(node.depth, 0)}
                        </text>
                        <text className="node-label" x={position.x} y={position.y + 30} textAnchor="middle">
                          {shortLabel(node.name, 22)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>

            <section className="panel documentary-panel">
              <h2>Documentario familiar</h2>
              <h3>{documentary?.title}</h3>
              <div className="highlight-row">
                {(documentary?.highlights || []).map((highlight) => (
                  <button
                    type="button"
                    key={highlight.id}
                    className="highlight-chip"
                    onClick={() => {
                      void handleOpenEvidence(highlight.id);
                    }}
                  >
                    {highlight.label}: {highlight.value}
                  </button>
                ))}
              </div>
              <div className="chapter-list">
                {(documentary?.chapters || []).map((chapter) => (
                  <article key={chapter.id}>
                    <h4>{chapter.title}</h4>
                    <p>{chapter.body}</p>
                  </article>
                ))}
              </div>
              <button type="button" onClick={handleExportDocumentary}>
                Exportar HTML
              </button>
            </section>
          </>
        )}
      </main>

      {(evidencePanel || evidenceLoading || evidenceError) && (
        <aside className="evidence-drawer" id="evidence-drawer" aria-live="polite">
          <h2>Painel de evidencia</h2>
          {evidenceLoading && <p className="muted">Carregando evidencia...</p>}
          {evidenceError && <p className="inline-error">{evidenceError}</p>}
          {evidencePanel && (
            <>
              <p className="drawer-row">Claim: {evidencePanel.claimId}</p>
              <p className="drawer-row">Origem: {evidencePanel.origin}</p>
              <p className="drawer-row">Confianca: {evidencePanel.confidence}</p>
              <h3>{evidencePanel.title}</h3>
              <p className="muted">Registros de prova: {evidencePanel.proof.length}</p>
              {evidencePanel.limitations.length > 0 && (
                <ul className="warning-list">
                  {evidencePanel.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}

export default App;

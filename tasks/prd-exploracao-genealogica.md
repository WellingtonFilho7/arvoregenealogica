# PRD: Plataforma de Exploracao Genealogica (Read-only)

## 1. Introducao/Visao Geral

Construir uma plataforma web interativa para explorar um acervo genealogico existente em SQLite (`FamilyTree.rmtree`), priorizando descoberta de curiosidades, navegacao por conexoes familiares e trilhas de hoje ate ancestrais antigos.  
A primeira versao e privada (ambiente local/self-hosted), desktop-first e somente leitura.

## 2. Goals

- Permitir selecionar rapidamente uma pessoa base e explorar sua ancestralidade.
- Entregar trilha ancestral clara (geracoes e caminho ate ancestral antigo alcancavel).
- Exibir curiosidades acionaveis com evidencia navegavel.
- Entregar mapa temporal de migracao e grafo de ligacoes entre ramos.
- Oferecer modo narrativo ("documentario") com exportacao HTML.
- Manter experiencia fluida, com fallback amigavel para dados incompletos.

## 3. User Stories

### US-001: Selecionar pessoa base
**Description:** Como membro da familia, quero buscar e selecionar uma pessoa base para personalizar toda a exploracao.

**Acceptance Criteria:**
- [ ] Campo de busca retorna pessoas por nome/sobrenome via API.
- [ ] Ao selecionar pessoa base, todos os modulos atualizam em cadeia.
- [ ] Estado inicial sem pessoa selecionada mostra empty state com proxima acao.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Visualizar trilha ancestral
**Description:** Como membro da familia, quero ver o caminho da pessoa base ate ancestrais antigos para entender continuidade historica.

**Acceptance Criteria:**
- [ ] Trilha mostra sequencia de pessoas por geracao, com anos quando disponiveis.
- [ ] Exibe quantidade de geracoes percorridas.
- [ ] Permite alternar foco em um no da trilha para recalcular visoes.
- [ ] Se algum dado estiver incompleto, mostrar aviso sem bloquear a tela.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Descobrir curiosidades acionaveis
**Description:** Como membro da familia, quero receber insights prontos para descobrir fatos relevantes sem precisar investigar manualmente.

**Acceptance Criteria:**
- [ ] Painel mostra cards de curiosidade (profundidade, seculo predominante, lacunas, sobrenomes etc.).
- [ ] Cada card possui CTA para abrir evidencia (trilha/grafo/lista).
- [ ] Curiosidades incluem metadados de confianca/limite quando ha dados ausentes.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Explorar migracao no mapa temporal
**Description:** Como membro da familia, quero acompanhar deslocamentos por epoca para entender trajetorias geograficas.

**Acceptance Criteria:**
- [ ] Mapa temporal exibe marcadores por evento/local com controle de periodo.
- [ ] Locais sem coordenada aparecem em fallback textual.
- [ ] Alterar pessoa base recalcula eventos exibidos no mapa.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Encontrar ligacoes entre ramos
**Description:** Como membro da familia, quero visualizar um grafo de conexoes e achar caminho minimo entre duas pessoas.

**Acceptance Criteria:**
- [ ] Grafo interativo mostra rede local da pessoa base com profundidade configuravel.
- [ ] Usuario escolhe pessoa destino e ve menor caminho de parentesco.
- [ ] Caminho selecionado fica destacado na visualizacao.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Consumir modo documentario
**Description:** Como membro da familia, quero uma narrativa automatica em capitulos para compartilhar historia familiar de forma acessivel.

**Acceptance Criteria:**
- [ ] Story mode gera capitulos com base em trilha, eventos e curiosidades.
- [ ] Exibe blocos "Voce sabia?" vinculados a fatos reais.
- [ ] Permite exportar narrativa em HTML standalone.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Garantir API read-only confiavel
**Description:** Como desenvolvedor, quero APIs read-only estaveis para suportar frontend e testes sem risco de mutacao do banco.

**Acceptance Criteria:**
- [ ] Endpoints publicos respondem no formato padrao `{ data, meta, warnings }`.
- [ ] Endpoint `health` valida acesso ao banco.
- [ ] Nenhuma rota realiza escrita no SQLite.
- [ ] Testes de integracao cobrem erros e fallback.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O sistema deve oferecer busca por pessoas em `GET /api/search?q=`.
- FR-2: O sistema deve fornecer resumo de pessoa em `GET /api/person/:id/summary`.
- FR-3: O sistema deve retornar trilha ancestral em `GET /api/person/:id/ancestral-path`.
- FR-4: O sistema deve retornar distribuicao por geracao em `GET /api/person/:id/generation-distribution`.
- FR-5: O sistema deve retornar curiosidades em `GET /api/person/:id/insights`.
- FR-6: O sistema deve retornar migracao temporal em `GET /api/person/:id/migration-timeline`.
- FR-7: O sistema deve retornar subgrafo em `GET /api/person/:id/network`.
- FR-8: O sistema deve retornar menor caminho entre duas pessoas em `GET /api/person/:id/relationship-path?toId=`.
- FR-9: O sistema deve retornar narrativa estruturada em `GET /api/person/:id/story`.
- FR-10: O sistema deve retornar status de saude em `GET /api/health`.
- FR-11: Todos os endpoints devem ser somente leitura.
- FR-12: Dados ausentes devem gerar avisos (`warnings`) e fallback de exibicao.

## 5. Non-Goals (Out of Scope)

- Edicao de registros genealogicos no v1.
- Autenticacao/autorizacao no v1.
- Publicacao em ambiente publico aberto no v1.
- Correcao automatica de inconsistencias historicas no banco.
- Sincronizacao com provedores externos (FamilySearch/Ancestry) no v1.

## 6. Design Considerations

- Aplicacao desktop-first com degradacao funcional para mobile.
- Foco em legibilidade de dados densos e navegacao em poucos cliques.
- Cada empty state deve oferecer uma unica proxima acao clara.
- Curiosidades devem ser clicaveis e levar para evidencia especifica.

## 7. Technical Considerations

- Fonte de dados unica: `FamilyTree.rmtree`.
- Backend Node/TypeScript com acesso SQLite em modo read-only.
- Cache em memoria com TTL para consultas recursivas e grafo.
- Frontend React com separacao por modulos (F1/F2/F3).
- Tests:
  - Unitarios para algoritmos genealogicos.
  - Integracao para contratos de API.
  - E2E de fluxos criticos no frontend.

## 8. Success Metrics

- Usuario encontra uma trilha ancestral e pelo menos 5 insights uteis em poucos cliques.
- Troca de pessoa base recalcula modulos sem travamentos perceptiveis.
- Caminho minimo entre duas pessoas e obtido sem erro para casos validos.
- Falhas por dados ausentes nao interrompem experiencia (fallback + warning).

## 9. Open Questions

- No v1, exportacao HTML do documentario deve incluir estilo completo embutido ou template minimo?
- No v2, qual modelo de permissao para habilitar colaboracao com sugestoes moderadas?

# Exploracao Genealogica Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar uma plataforma genealogica read-only com APIs publicas e 5 modulos de exploracao (trilha, curiosidades, mapa, grafo e story mode).

**Architecture:** Backend Node com SQLite read-only e servicos de dominio para grafo genealogioco; frontend React modular consumindo APIs; testes unitarios, integracao de rotas e fluxos E2E de UI. O desenvolvimento segue TDD (red -> green -> refactor) por bloco funcional.

**Tech Stack:** Node.js, Express, better-sqlite3, React 18 (CRA), Jest, Supertest, Testing Library.

### Task 1: Configuracao de stack e scripts

**Files:**
- Modify: `package.json`
- Create: `jest.server.config.cjs`
- Create: `.gitignore`

**Steps:**
1. Adicionar scripts `start:api`, `start:web`, `start`, `test:server`, `test:client`, `test`.
2. Adicionar dependencias para backend e testes (`express`, `better-sqlite3`, `cors`, `supertest`, `jest`, `concurrently`).
3. Configurar Jest servidor para testes `server/**/*.test.js`.
4. Garantir `.gitignore` cobrindo `node_modules`, `build`, WAL/SHM e artefatos.

### Task 2: TDD de algoritmos genealogicos

**Files:**
- Test: `server/lib/genealogy.test.js`
- Create: `server/lib/genealogy.js`

**Steps:**
1. Escrever testes falhando para:
   - trilha ancestral mais antiga
   - distribuicao por geracao
   - menor caminho entre duas pessoas
   - subgrafo por profundidade
2. Rodar `npm run test:server -- server/lib/genealogy.test.js` e validar falha.
3. Implementar funcoes minimas para passar.
4. Rodar testes novamente e manter verde.

### Task 3: TDD da camada API read-only

**Files:**
- Test: `server/app.test.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `server/db.js`
- Create: `server/cache.js`
- Create: `server/repository.js`
- Create: `server/services/genealogyService.js`

**Steps:**
1. Escrever testes de contrato para endpoints principais e fallback de warnings.
2. Rodar testes e validar falha (rotas inexistentes).
3. Implementar app express com injecao de service/repository.
4. Implementar repository read-only no SQLite e service com cache TTL.
5. Rodar testes de integracao e ajustar payload padrao `{ data, meta, warnings }`.

### Task 4: TDD de frontend (F1 + F2 + F3)

**Files:**
- Test: `src/App.e2e.test.js`
- Modify: `src/App.js`
- Modify: `src/index.js`
- Replace/Create: `src/App.css`, `src/index.css`
- Create: `src/api/client.js`
- Create: `src/components/*` (Search, Path, Insights, Map, Network, Story)

**Steps:**
1. Escrever testes de fluxo:
   - selecionar pessoa base atualiza modulos
   - clicar curiosidade abre evidencia
   - caminho entre duas pessoas aparece
2. Rodar `npm run test:client -- --runInBand src/App.e2e.test.js` e validar falha.
3. Implementar UI modular com carregamento, erro local e empty states acionaveis.
4. Implementar exportacao HTML no story mode.
5. Rodar testes de frontend e manter verde.

### Task 5: Verificacao final e qualidade

**Files:**
- Modify: `README.md` (se necessario)

**Steps:**
1. Rodar `npm run test`.
2. Rodar `npm run build`.
3. Rodar `npm run lint`.
4. Validar `GET /api/health` com servidor local.
5. Registrar observacoes finais e riscos residuais.

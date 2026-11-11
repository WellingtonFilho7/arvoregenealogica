# Mapa, Grafo e Notaveis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir mapa sem pontos, reorganizar grafo para leitura clara e adicionar secao de antepassados importantes/famosos.

**Architecture:** Manter API read-only atual, adicionando um endpoint dedicado de notaveis no backend. No frontend, aplicar fallback de coordenadas por local textual para o mapa e layout em niveis com altura dinamica para o grafo.

**Tech Stack:** React (CRA), Express API, Jest + Testing Library.

### Task 1: Regressao de UX (RED)

**Files:**
- Modify: `src/App.e2e.test.js`
- Modify: `server/app.test.ts`

1. Adicionar teste e2e para timeline sem coordenadas reais e validar renderizacao com fallback visual no mapa.
2. Adicionar teste e2e para secao "Antepassados importantes/famosos" apos selecionar pessoa base.
3. Adicionar contrato de API para `GET /api/person/:id/notable-ancestors`.
4. Rodar `npm run test -- src/App.e2e.test.js` e `npm run test:server` confirmando falha inicial.

### Task 2: Implementacao backend notaveis (GREEN)

**Files:**
- Modify: `server/services/genealogyService.ts`
- Modify: `server/app.ts`

1. Criar `getNotableAncestors(personId, { maxDepth, limit })` com score explicavel por regras (antiguidade, conectividade, titulos no nome, volume de eventos).
2. Expor rota read-only `GET /api/person/:id/notable-ancestors`.
3. Retornar formato estavel: `[{ id, name, birthYear, deathYear, score, reasons, evidence }]`.
4. Rodar `npm run test:server` e garantir verde.

### Task 3: Implementacao frontend mapa/grafo/notaveis (GREEN)

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/App.js`
- Modify: `src/App.css`

1. Consumir endpoint de notaveis e renderizar nova secao em card dedicado.
2. Adicionar fallback de coordenadas por lugar textual no mapa (real, aproximado, estimado) com legenda.
3. Reorganizar grafo por niveis com altura dinamica + labels truncados para legibilidade.
4. Rodar `npm run test -- src/App.e2e.test.js` e depois `npm run test`.

### Task 4: Verificacao final

**Files:**
- None

1. Rodar `npm run test`.
2. Rodar `npm run build`.
3. Validar manualmente no browser com pessoa real (ex.: id 1054) para confirmar mapa com fallback e secao de notaveis preenchida.

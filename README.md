# Atlas Genealogico Interativo

Aplicacao web para exploracao genealogica read-only usando o banco `FamilyTree.rmtree`.

## O que foi implementado

- API Node/Express read-only com endpoints de busca, trilha ancestral, curiosidades, mapa temporal, grafo, caminho de ligacao e story mode.
- Frontend React com 5 modulos:
  - Trilha ancestral
  - Curiosidades acionaveis
  - Mapa temporal de migracao
  - Grafo de ligacoes + menor caminho
  - Documentario familiar com exportacao HTML
- Testes:
  - Unitarios de algoritmos genealogicos
  - Contratos de API
  - Integracao com banco real
  - Fluxos E2E de frontend

## Requisitos

- Node.js 18+
- Arquivo `FamilyTree.rmtree` na raiz do projeto

## Scripts

- `npm run start`: sobe API (`:4000`) + frontend (`:3000`)
- `npm run start:api`: sobe somente API
- `npm run start:web`: sobe somente frontend
- `npm run test`: executa testes server + client
- `npm run lint`: lint do frontend
- `npm run build`: build de producao do frontend

## Endpoints da API

- `GET /api/health`
- `GET /api/search?q=`
- `GET /api/person/:id/summary`
- `GET /api/person/:id/ancestral-path`
- `GET /api/person/:id/generation-distribution`
- `GET /api/person/:id/insights`
- `GET /api/person/:id/migration-timeline`
- `GET /api/person/:id/network?depth=3`
- `GET /api/person/:id/relationship-path?toId=`
- `GET /api/person/:id/story`

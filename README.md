# planIT Meals

Meal planner for the busy ones — planificare mese, frigider digital, listă cumpărături, tracking nutrițional.

## Documentație academică (Semestrul 3)

| Document | Rol |
|----------|-----|
| **[RAPORT_SEMESTRUL_3.md](docs/RAPORT_SEMESTRUL_3.md)** | **Raport principal (~12–15 pag.) + anexe → **15–20 pag. total** |
| [ANEXA_B_UML.md](docs/ANEXA_B_UML.md) | Diagrame UML: use-case, clase, ER, secvență, componente, activitate |
| [ANEXA_A_VIDEO.md](docs/ANEXA_A_VIDEO.md) | Checklist demonstrație video (obligatoriu) |
| [SCENARII_TEST.md](docs/SCENARII_TEST.md) | Protocol evaluare + scenarii test (Anexa C) |
| [DOCUMENTATIE_SEMESTRUL_3.md](docs/DOCUMENTATIE_SEMESTRUL_3.md) | Referință tehnică extinsă (supliment, nu raportul de predat) |

## Quick start

```bash
nvm use
cd backend && cp .env.example .env && npm install && npm run dev:clean
cd frontend && npm install && npm start
```

- UI: http://localhost:5173  
- API: http://localhost:5060/api/health  

Set `USE_MEMORY_MONGO=true` in `backend/.env` to run without Docker (dev only).

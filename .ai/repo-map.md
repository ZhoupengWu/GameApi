# Repo Map

## Root

- `package.json`: metadata, dipendenze, script Node
- `package-lock.json`: lock npm
- `README.md`: guida rapida installazione e uso API
- `AGENTS.md`: istruzioni operative repository-level
- `.ai/project-context.md`: contesto sintetico del progetto
- `.ai/repo-map.md`: mappa rapida del repository
- `.ai/frontend-notes.md`: note operative sul client statico
- `.ai/backend-notes.md`: note operative sulle API e sulla persistenza

## Backend

- `src/index.js`: bootstrap server Express
- `src/swagger.js`: spec Swagger
- `src/middleware/auth.js`: API key auth
- `src/routes/auth.js`: registrazione utente
- `src/routes/games.js`: giochi, player, mosse
- `src/db/database.js`: storage JSON locale

## Frontend statico

- `static/index.html`: pagina principale
- `static/index.js`: bootstrap SPA frontend
- `static/index.css`: stile custom
- `static/client_auth.js`: wrapper browser per API
- `static/session_storage.js`: sessione locale
- `static/utils/dom.js`: helper DOM
- `static/game/tetris_engine.js`: logica Tetris
- `static/views/register_view.js`: accesso / registrazione
- `static/views/lobby_view.js`: lobby
- `static/views/match_view.js`: partita
- `static/jsconfig.json`: type checking JS lato editor
- `static/pages/splash.html`: pagina ausiliaria legacy / non integrata
- `static/favicon.ico`: favicon
- `static/img/undo.ico`: asset immagine
- `static/img/undo.ico.old`: versione precedente asset

## Data

- `data/users.json`: utenti registrati
- `data/games.json`: giochi persistiti

## Priorita utili quando si analizza il repo

- Prima guardare `src/index.js` per capire routing e static serving
- Poi leggere `src/routes/*.js` per comportamento API reale
- Poi leggere `src/db/database.js` per modello dati e limiti della persistenza
- Solo dopo aggiornare o usare il frontend in `static/`
- Se serve contesto veloce, allineare anche i file in `.ai/` quando il comportamento reale cambia

# Project Context

## Identita del progetto

- Repository: `GameApi`
- Tipo: server Node.js con Express
- Dominio attuale: backend REST per gestione utenti e partite, con frontend statico leggero
- Gioco in focus: Tetris
- Obiettivo frontend attuale: registrazione o accesso con API key condivisa, lobby e match Tetris a due

## Stack tecnico

- Runtime: Node.js
- Package manager: npm
- Module system: ES modules
- Server HTTP: Express 4
- Middleware: `cors`, `express.json()`
- Documentazione API: `swagger-jsdoc` + `swagger-ui-express`
- ID generation: `uuid`
- Persistenza: file JSON locali in `data/`

## Script disponibili

- `npm run dev`: `node --watch src/index.js`
- `npm start`: `node src/index.js`

## Entry points principali

- Server: `src/index.js`
- Frontend statico: `static/index.html`
- Entry JS frontend: `static/index.js`
- Client API browser: `static/client_auth.js`
- Vista match Tetris: `static/views/match_view.js`
- Motore di gioco Tetris: `static/game/tetris_engine.js`

## Routing reale

- Frontend statico servito da: `/frontend`
- Favicon servita da: `/favicon.ico`
- Health check: `/health`
- Swagger UI: `/api-docs`
- Auth pubblica: `/auth/register`
- Route protette giochi: `/games`

## Autenticazione

- Le route protette usano header `X-API-Key`
- Il middleware che valida l'API key e in `src/middleware/auth.js`
- L'utente autenticato viene assegnato a `req.user`

## Persistenza

- Database file-based, nessun DB esterno
- Utenti: `data/users.json`
- Giochi: `data/games.json`
- I file vengono inizializzati automaticamente al load di `src/db/database.js`
- I dati non sono mock: nel repository sono gia presenti record reali nei JSON

## Regole operative per modifiche future

- Trattare il repo come backend-first; il frontend esiste ma e secondario al server Node
- Non assumere bundler, React, Vue o TypeScript build pipeline se non introdotti esplicitamente
- Il codice in `static/` deve funzionare direttamente nel browser
- Gli import client devono essere relativi e compatibili con moduli ES browser
- Prima di toccare il frontend verificare sempre il path reale di serving da `src/index.js`
- Prima di toccare le API verificare le restrizioni reali in `src/routes/*.js`, non solo il README
- Evitare librerie nuove se la feature si puo fare in JS vanilla e CSS locale

## Stato attuale da ricordare

- `static/index.html` include Bootstrap 4.3.1 via CDN, ma la UI corrente usa soprattutto CSS custom
- `static/index.js` gestisce il routing hash tra lobby e match
- `static/client_auth.js` esporta `Player`
- Il frontend salva la sessione locale del giocatore in `localStorage` con chiave `tetris-player-session`
- Ogni tab salva il player locale scelto in `sessionStorage` e il nome preferito in `localStorage`
- La sincronizzazione del match tra tab usa `BroadcastChannel` e fallback su evento `storage`, con refresh on demand
- Il motore Tetris client non usa solo i pezzi classici `I/O/T`: il catalogo include piu forme custom definite in `static/game/tetris_engine.js`

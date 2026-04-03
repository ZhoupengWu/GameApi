# Backend Notes

## Server entrypoint

- File: `src/index.js`
- Configura `express.json()` e `cors()`
- Logga ogni request con timestamp ISO, metodo e path
- Serve i file statici da `/frontend`
- Espone `/favicon.ico`, `/auth`, `/api-docs`, `/games`, `/health`
- Ha middleware finale per errori e 404 JSON

## Moduli backend

- `src/routes/auth.js`: registrazione utente
- `src/routes/games.js`: CRUD giochi, player, moves
- `src/middleware/auth.js`: autenticazione via API key
- `src/db/database.js`: persistenza file-based
- `src/swagger.js`: configurazione OpenAPI / Swagger

## Auth

- Unica route auth presente: `POST /auth/register`
- Valida che `username` sia stringa non vuota
- Ritorna `id`, `username`, `apiKey`, `createdAt`
- Non esiste endpoint di login tradizionale
- Non esiste refresh session, revoke key o lookup utente

## Database file-based

- Gli utenti sono salvati in `data/users.json`
- I giochi sono salvati in `data/games.json`
- Scrittura e lettura sono sincrone via `fs`
- Non c'e locking, concorrenza avanzata o validazione schema persistente

## API games disponibili

- `POST /games`: crea gioco del proprietario autenticato
- `GET /games`: lista giochi del proprietario autenticato
- `GET /games/:gameId`: ritorna gioco solo se owner
- `PUT /games/:gameId`: aggiorna gioco solo se owner
- `DELETE /games/:gameId`: elimina gioco solo se owner
- `POST /games/:gameId/players`: aggiunge player al gioco solo se owner
- `GET /games/:gameId/players`: lista player solo se owner
- `DELETE /games/:gameId/players/:playerId`: rimuove player solo se owner
- `POST /games/:gameId/moves`: aggiunge mossa se owner o player del gioco
- `GET /games/:gameId/moves`: lista mosse se owner o player del gioco
- `GET /games/:gameId/moves/:moveId`: dettaglio mossa solo se owner

## Modello dati reale

- User: `id`, `username`, `apiKey`, `createdAt`
- Game: `id`, `name`, `ownerId`, `players`, `moves`, `status`, `createdAt`, `updatedAt`
- Player embedded nel game: `id`, `name`, `joinedAt`
- Move embedded nel game: `id`, `playerId`, `data`, `timestamp`
- Lo stato Tetris completo viene salvato dentro `move.data.gameState` dal frontend

## Osservazioni importanti

- `game.players` contiene player embedded, non utenti registrati del sistema
- Per questo in `POST /games/:gameId/moves` il controllo `game.players.some(p => p.id === req.user.id)` puo non corrispondere quasi mai a un utente registrato reale
- In pratica il proprietario del gioco puo sempre inviare mosse; l'uso di utenti registrati come player e al momento incoerente
- Il README mostra esempi base, ma la fonte di verita sulle autorizzazioni e il codice route
- `src/swagger.js` punta a un server URL hardcoded di sviluppo remoto, non a `http://localhost:3000`
- Il frontend corrente aggira questa incoerenza usando di fatto la API key del proprietario per creare player embedded e inviare mosse del match

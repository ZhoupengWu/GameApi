# GameApi
Api Rest for WEB online games

## Requirements
- Node.js
- npm

## Install
```bash
npm install
```

## Start the application (Node.js)
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API listens on `PORT` (default: `3000`).

## Frontend
Il client statico di registrazione Tetris e servito dal backend Express su:

```text
http://localhost:3000/frontend
```

L'entry point browser e `static/index.js`, mentre il client per autenticazione e chiamate API e in `static/client_auth.js`.

## API Docs
Swagger UI is available at:

```
http://localhost:3000/api-docs
```

## Consume the API
Register a user to get an API key (required for protected routes):

```bash
curl -X POST http://localhost:3000/auth/register \
	-H "Content-Type: application/json" \
	-d '{"username":"john_doe"}'
```

Use the returned `apiKey` in the `X-API-Key` header:

```bash
# List games
curl http://localhost:3000/games \
	-H "X-API-Key: <apiKey>"

# Create a game
curl -X POST http://localhost:3000/games \
	-H "Content-Type: application/json" \
	-H "X-API-Key: <apiKey>" \
	-d '{"name":"Chess Game 1"}'
```

## Browser API client
`static/client_auth.js` esporta la classe `Player`, che registra automaticamente l'utente e incapsula le route protette.

Metodi disponibili:

- `waitUntilReady()`: restituisce il profilo registrato con `username` e `apiKey`.
- `createGame(name)`: crea una partita.
- `listGame()`: elenca le partite dell'utente autenticato.
- `getGame(gameId)`: legge una partita specifica.
- `updateGame(gameId, name, status)`: aggiorna nome o stato.
- `deleteGame(gameId)`: elimina una partita.
- `addPlayerToGame(gameId, playerName)`: aggiunge un player alla partita.
- `getGamePlayers(gameId)`: restituisce i player della partita.
- `removePlayerFromGame(gameId, playerId)`: rimuove un player dalla partita.
- `addMoveToGame(gameId, playerId, moveData)`: registra una mossa.
- `getGameMoves(gameId)`: elenca le mosse della partita.
- `getGameMove(gameId, moveId)`: legge una singola mossa.

Esempio minimo:

```js
import { Player } from "./client_auth.js";

const player = new Player("LineClear99");
const profile = await player.waitUntilReady();
const created = await player.createGame("Tetris Lobby");

console.log(profile.apiKey);
console.log(created.game.id);
```

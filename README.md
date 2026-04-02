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
Il client statico Tetris e servito dal backend Express su:

```text
http://localhost:3000/frontend
```

L'entry point browser è `static/index.js`, mentre il client per autenticazione e chiamate API è in `static/client_auth.js`.

Struttura frontend attuale:

- `static/index.js`: bootstrap SPA con routing hash tra lobby e partita.
- `static/session_storage.js`: persistenza locale della sessione.
- `static/utils/dom.js`: helper DOM condivisi.
- `static/game/tetris_engine.js`: logica Tetris client-side.
- `static/views/register_view.js`: schermata di registrazione.
- `static/views/lobby_view.js`: schermata post-login con creazione lobby e apertura partita.
- `static/views/match_view.js`: partita Tetris a due con player locale per tab.

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
- `fromApiKey(apiKey, label)`: crea una sessione client partendo da una API key gia condivisa.
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

## Multiplayer con API key condivisa
Il flusso previsto dal frontend e questo:

1. Un browser registra un utente e ottiene la `API key`.
2. La stessa `API key` viene incollata nel secondo browser o tab usando la schermata iniziale.
3. Entrambe le finestre aprono la stessa lobby.
4. Dentro la partita ogni finestra sceglie il proprio nome player locale.
5. Le mosse vengono salvate tramite le API esistenti `/games`, `/games/:gameId/players` e `/games/:gameId/moves`.

## Tetris implementato

- Due griglie `8x8`, una per player.
- Coda pezzi composta da `I`, `O`, `T`, `L`, `J`, `S`, `Z`, servita dal backend statico su `/frontend`.
- Interazione via drag and drop dal pannello pezzi alla propria griglia.
- Turni alternati tra i due player, con indicatore del turno corrente in partita.
- Se completi una o piu righe o colonne, nella griglia dell'altro player compare un pezzo casuale completo in una posizione valida casuale per ogni linea completata.
- I blocchi gia piazzati restano fissi sulla griglia finche non vengono rimossi dal completamento di una riga o colonna.
- Se un player non ha piu nessun piazzamento valido con i pezzi disponibili, la partita mostra vittoria o sconfitta e blocca ulteriori mosse.
- La sincronizzazione tra i browser usa le mosse salvate via API e aggiornamenti locali via `BroadcastChannel` o evento `storage`.

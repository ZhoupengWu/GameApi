# Flusso Di Gioco Tetris

## Scopo

Questo documento descrive il flusso reale del gioco Tetris nel repository: routing,
richieste HTTP, payload, risposte, funzioni client chiamate, funzioni backend
coinvolte, persistenza e sincronizzazione tra tab.

Il frontend non e una app standalone: viene servito dal server Express sotto
`/frontend` e usa route relative verso lo stesso backend.

## Entry Point

- Server: `src/index.js`
- Frontend servito da: `GET /frontend`
- File HTML: `static/index.html`
- Entry JS browser: `static/index.js`
- Client API browser: `static/client_auth.js`
- Vista registrazione: `static/views/register_view.js`
- Vista lobby: `static/views/lobby_view.js`
- Vista match: `static/views/match_view.js`
- Motore Tetris: `static/game/tetris_engine.js`

`src/index.js` monta:

- `/auth` come route pubblica
- `/games` come route protetta da `apiKeyAuth`
- `/frontend` come static serving della cartella `static/`

## Modello Dati

### User

Creato da `registerUser(username)` in `src/db/database.js`.

```json
{
  "id": "uuid",
  "username": "Player",
  "apiKey": "uuid+uuid",
  "createdAt": "ISO timestamp"
}
```

Persistenza: `data/users.json`.

### Game

Creato da `createGame(userId, gameName)` in `src/db/database.js`.

```json
{
  "id": "uuid",
  "name": "Tetris Duel",
  "ownerId": "user uuid",
  "players": [],
  "moves": [],
  "status": "active",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Persistenza: `data/games.json`.

### Player Embedded Nel Game

Creato da `addPlayerToGame(gameId, playerName)`.

```json
{
  "id": "uuid",
  "name": "Player Rosso",
  "joinedAt": "ISO timestamp"
}
```

Nota importante: questo player non e un utente registrato in `users.json`.
E un player locale embedded dentro `game.players`.

### Move

Creato da `addMoveToGame(gameId, playerId, moveData)`.

```json
{
  "id": "uuid",
  "playerId": "embedded player uuid",
  "data": {},
  "timestamp": "ISO timestamp"
}
```

Nel Tetris il payload reale di `data` ha questa forma:

```json
{
  "type": "tetris-turn",
  "gameState": {
    "version": 1,
    "boardSize": 12,
    "currentTurnUserId": "next embedded player uuid",
    "players": {
      "embedded player uuid": {
        "userId": "embedded player uuid",
        "name": "Player Rosso",
        "board": [[0, 0, 1]],
        "upcomingPieces": ["I", "O", "T"],
        "linesCleared": 0,
        "garbageReceived": 0
      }
    }
  },
  "summary": {
    "pieceId": "I",
    "rotation": 0,
    "position": { "x": 0, "y": 0 },
    "clearedRows": [],
    "clearedColumns": [],
    "garbageTargets": [],
    "currentTurnUserId": "next embedded player uuid"
  }
}
```

`board` e una matrice quadrata 12x12:

- `0`: cella vuota
- `1`: blocco piazzato dal player
- `2`: pezzo disturbo ricevuto

## Sessioni Browser

### Sessione Utente/API Key

Gestita da `static/session_storage.js`.

- `getSavedSession()` legge `localStorage["tetris-player-session"]`
- `saveSession(profile)` salva il profilo utente/API key
- `clearSavedSession()` cancella la sessione
- `createSharedSession(apiKey, label)` crea un profilo locale fittizio per usare una API key condivisa

La sessione salvata contiene:

```json
{
  "id": "user uuid oppure shared-api-key-session",
  "username": "Player",
  "apiKey": "api key",
  "createdAt": "ISO timestamp"
}
```

### Player Locale Di Una Tab

Gestito in `static/views/match_view.js`.

- `sessionStorage["tetris-local-player:<gameId>"]`: id del player embedded scelto dalla tab corrente
- `localStorage["tetris-local-player-name:<apiKey>:<gameId>"]`: nome preferito per quella API key e lobby

Questo permette a due tab/browser con la stessa API key di selezionare player
locali diversi nella stessa partita.

## Routing Frontend

`static/index.js` decide la vista da mostrare.

1. `renderApp()` legge `getSavedSession()`.
2. Se non c'e sessione o l'utente vuole cambiarla, chiama `renderRegisterView(...)`.
3. Se l'hash ha forma `#game=<gameId>`, chiama `renderMatchView(...)`.
4. Altrimenti chiama `renderLobbyView(...)`.

Funzioni principali:

- `getRouteGameId()`: estrae il game id da `window.location.hash`
- `renderApp()`: router principale
- `onOpenGame(nextGameId)`: imposta `window.location.hash = "#game=<id>"`
- `onBack()`: svuota l'hash e torna alla lobby

## Autenticazione API

Le route sotto `/games` richiedono sempre:

```http
X-API-Key: <api key>
```

Il middleware `apiKeyAuth` in `src/middleware/auth.js`:

1. legge `req.headers["x-api-key"]`
2. cerca l'utente con `getUserByApiKey(apiKey)`
3. se valido assegna `req.user = user`
4. altrimenti risponde `401`

Il client browser centralizza le chiamate autenticate in
`Player.#request(path, options)`.

## Flusso 1: Registrazione Nuovo Utente

### UI

File: `static/views/register_view.js`.

L'utente compila il form `#register-form` con `username`.

Funzioni chiamate:

1. submit listener del form
2. `new Player(username)`
3. `Player.#register()`
4. `player.waitUntilReady()`
5. `renderPlayerCard(profile)`
6. `options.onRegistered(profile)`
7. `saveSession(profile)`
8. `renderApp()`

### Richiesta

```http
POST /auth/register
Content-Type: application/json
```

Payload:

```json
{
  "username": "LineClear99"
}
```

### Backend

Route: `router.post("/register")` in `src/routes/auth.js`.

Funzioni backend:

1. valida `username`
2. chiama `registerUser(username.trim())`
3. `registerUser` genera `id`, `apiKey`, `createdAt`
4. scrive in `data/users.json`

### Risposta OK

Status: `201`

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "username": "LineClear99",
    "apiKey": "api key",
    "createdAt": "ISO timestamp"
  }
}
```

### Errori

- `400 { "error": "Invalid username" }`
- `400 { "error": "User already exists" }`

## Flusso 2: Accesso Con API Key Condivisa

### UI

File: `static/views/register_view.js`.

L'utente compila `#shared-session-form` con:

- `shared-api-key`
- `shared-session-label`

Funzioni chiamate:

1. submit listener del form condiviso
2. `createSharedSession(apiKey, label)`
3. `renderPlayerCard(profile)`
4. `options.onRegistered(profile)`
5. `saveSession(profile)`
6. `renderApp()`

### Richieste HTTP

Nessuna richiesta viene fatta in questa fase.
La API key viene solo salvata localmente e validata alla prima chiamata
autenticata verso `/games`.

## Flusso 3: Caricamento Lobby

### UI

File: `static/views/lobby_view.js`.

Quando `renderLobbyView(root, profile, options)` viene montata:

1. crea `const player = Player.fromProfile(profile)`
2. chiama subito `loadAccessibleGames()`
3. `loadAccessibleGames()` chiama `player.listGame()`

### Richiesta

```http
GET /games
X-API-Key: <api key>
```

### Client

Metodo: `Player.listGame()`.

Internamente:

1. `Player.#request("/games", { method: "GET" })`
2. ritorna `data.games`

### Backend

Route: `router.get("/")` in `src/routes/games.js`.

Funzioni backend:

1. `apiKeyAuth`
2. `getGamesByUserId(req.user.id)`

### Risposta OK

```json
{
  "count": 1,
  "games": [
    {
      "id": "uuid",
      "name": "Tetris Duel",
      "ownerId": "user uuid",
      "players": [],
      "moves": [],
      "status": "active",
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ]
}
```

Nota: vengono mostrate solo le partite create dall'utente proprietario della
API key.

## Flusso 4: Creazione Partita

### UI

File: `static/views/lobby_view.js`.

L'utente invia `#create-game-form`.

Funzioni chiamate:

1. submit listener del form
2. `player.createGame(name)`
3. `loadAccessibleGames()`
4. `options.onOpenGame(result.game.id)`
5. `static/index.js` aggiorna l'hash a `#game=<gameId>`
6. `renderApp()` monta `renderMatchView(...)`

### Richiesta

```http
POST /games
X-API-Key: <api key>
Content-Type: application/json
```

Payload:

```json
{
  "name": "Tetris Duel"
}
```

### Client

Metodo: `Player.createGame(name_game)`.

Internamente:

1. `Player.#request("/games", { method: "POST", body })`

### Backend

Route: `router.post("/")` in `src/routes/games.js`.

Funzioni backend:

1. `apiKeyAuth`
2. valida `name`
3. `createGame(req.user.id, name.trim())`
4. scrive il game in `data/games.json`

### Risposta OK

Status: `201`

```json
{
  "message": "Game created successfully",
  "game": {
    "id": "uuid",
    "name": "Tetris Duel",
    "ownerId": "user uuid",
    "players": [],
    "moves": [],
    "status": "active",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp"
  }
}
```

## Flusso 5: Apertura Match

### UI

File: `static/index.js` e `static/views/match_view.js`.

Una partita si apre in due modi:

- click su una card lobby: `options.onOpenGame(game.id)`
- input manuale id partita: `openGameById()`

Entrambi impostano:

```js
window.location.hash = `#game=${gameId}`;
```

Poi `renderApp()` chiama:

```js
renderMatchView(root, savedSession, gameId, { onBack, onLogout });
```

### Caricamento iniziale del match

Alla fine di `renderMatchView(...)`:

1. crea `const player = Player.fromProfile(profile)`
2. configura `BroadcastChannel`, se disponibile
3. configura listener `window.storage`
4. chiama `refreshGameState()`

### Richieste

`refreshGameState()` esegue in parallelo:

```http
GET /games/<gameId>
X-API-Key: <api key>
```

```http
GET /games/<gameId>/moves
X-API-Key: <api key>
```

### Client

Metodi:

- `Player.getGame(gameId)`
- `Player.getGameMoves(gameId)`

### Backend

Per `GET /games/:gameId`:

1. `apiKeyAuth`
2. `getGameById(req.params.gameId)`
3. verifica `game.ownerId === req.user.id`
4. risponde `{ game }`

Per `GET /games/:gameId/moves`:

1. `apiKeyAuth`
2. `getGameById(req.params.gameId)`
3. verifica owner o player
4. `getGameMoves(req.params.gameId)`
5. risponde `{ gameId, count, moves }`

Nota pratica: nel flusso Tetris corrente le tab usano la API key del
proprietario, quindi passano i controlli owner.

### Ricostruzione Stato

Dopo le risposte:

1. `ensureLocalPlayerSelection(game)` prova a selezionare/creare il player locale
2. `renderGame(game, moves)`
3. `getLatestGameState(game.players, moves)` cerca l'ultima mossa con `data.gameState`
4. se non ci sono mosse valide, `createInitialGameState(players)`

## Flusso 6: Scelta O Creazione Player Locale

### Quando Serve

Se in `sessionStorage["tetris-local-player:<gameId>"]` non c'e un player valido,
`renderGame(...)` chiama `renderPlayerSetup(game)`.

La tab puo:

- selezionare un player gia presente
- creare un nuovo player se `game.players.length < 2`

### Creazione Player

Funzioni chiamate:

1. submit listener di `#local-player-form`
2. `saveLocalPlayerName(name)`
3. se non esiste un player con lo stesso nome, `player.addPlayerToGame(gameId, name)`
4. `saveLocalPlayerId(result.player.id)`
5. `broadcastMatchUpdate("player-added")`
6. `refreshGameState()`

### Richiesta

```http
POST /games/<gameId>/players
X-API-Key: <api key>
Content-Type: application/json
```

Payload:

```json
{
  "name": "Player Rosso"
}
```

### Backend

Route: `router.post("/:gameId/players")`.

Funzioni backend:

1. `apiKeyAuth`
2. `getGameById(gameId)`
3. verifica `game.ownerId === req.user.id`
4. valida `name`
5. `addPlayerToGame(gameId, name.trim())`
6. scrive il player embedded in `data/games.json`

### Risposta OK

Status: `201`

```json
{
  "message": "Player added successfully",
  "player": {
    "id": "uuid",
    "name": "Player Rosso",
    "joinedAt": "ISO timestamp"
  }
}
```

### Selezione Player Esistente

Nessuna richiesta HTTP.

Funzioni chiamate:

1. click su elemento `[data-select-player]`
2. `saveLocalPlayerId(gamePlayerId)`
3. `saveLocalPlayerName(selectedPlayer.name)`
4. `renderGame(game, currentMoves)`

## Flusso 7: Rendering Board E Turni

Quando esiste un player locale valido:

1. `renderGame(game, moves)` calcola `gameState = getLatestGameState(game.players, moves)`
2. identifica `selfPlayer` da `sessionStorage`
3. identifica `opponentPlayer`
4. legge `ownState` e `opponentState`
5. chiama `ensureMatchCompleted(game, gameState)`
6. chiama `renderBoardLayout(...)`

Funzioni del motore coinvolte:

- `getLatestGameState(players, moves)`
- `createInitialGameState(players)`
- `getPlayerUserId(player)`
- `getPieceCatalog()`
- `getPieceCellsForRender(pieceId, rotation)`
- `findFirstValidPosition(board, pieceId, rotation)`
- `getPreviewCells(board, pieceId, rotation, position)`

Regole principali:

- la board e 12x12
- ogni player ha almeno 3 pezzi in `upcomingPieces`
- con meno di 2 player non si puo giocare
- con 2 player il turno valido e `gameState.currentTurnUserId`
- i pezzi sono trascinabili solo se e il turno locale
- la rotazione usata dalla UI corrente e sempre `0`

## Flusso 8: Drag And Drop Di Una Mossa

### Drag Start

File: `static/views/match_view.js`, funzione `bindBoardInteractions(...)`.

Evento: `dragstart` su un bottone `[data-piece-id]`.

Funzioni/azioni:

1. `canInteractThisTurn()`
2. `getLiveOwnState()`
3. legge `pieceId` da `dataset.pieceId`
4. imposta `dataTransfer`
5. calcola `localState.dragAnchorCell`
6. imposta `localState.draggedPieceId`
7. imposta `isDraggingPiece = true`

### Drag Over

Evento: `dragover` sulla board locale.

Funzioni/azioni:

1. `canInteractThisTurn()`
2. `getLiveOwnState()`
3. calcola cella target da `data-cell-x` e `data-cell-y`
4. `clampPosition(board, pieceId, 0, position)`
5. `setPlacementPreview(pieceId, x, y)`
6. `updateOwnBoardPreview(ownState)`
7. `getPreviewCells(...)` aggiorna solo le classi preview del DOM

### Drop

Evento: `drop` sulla board locale.

Funzioni/azioni:

1. `canInteractThisTurn()`
2. `getLiveOwnState()`
3. legge `pieceId`
4. calcola `position`
5. `clampPosition(...)`
6. `getPreviewCells(...)`
7. se valido, `submitCurrentMove(selfPlayer.id, pieceId, clampedPosition)`

## Flusso 9: Invio Mossa

Funzione: `submitCurrentMove(localPlayerId, pieceId, position)`.

### Validazioni Client

1. esiste `currentGame`
2. non c'e gia `isSubmitting`
3. `getLatestGameState(currentGame.players, currentMoves)`
4. esiste `gameState.players[localPlayerId]`

### Applicazione Locale

Chiama:

```js
applyMove(gameState, localPlayerId, pieceId, 0, position)
```

`applyMove(...)`:

1. clona lo stato con `cloneGameState(state)`
2. verifica che il player esista
3. verifica il turno corrente
4. verifica che `pieceId` sia in `upcomingPieces`
5. calcola celle con `getPieceCells(pieceId, rotation)`
6. verifica collisioni con `canPlacePiece(...)`
7. scrive `1` nelle celle della board
8. risolve righe/colonne complete con `resolveCompletedLines(...)`
9. incrementa `linesCleared`
10. rimuove il pezzo usato dalla queue
11. riempie la queue con `refillUpcomingPieces(...)`
12. propaga disturbi con `propagateGarbage(...)`
13. aggiorna `currentTurnUserId` con `getNextTurnUserId(...)`
14. incrementa `version`
15. ritorna `{ nextState, summary }`

### Optimistic UI

Prima della persistenza:

1. crea una mossa temporanea `optimistic-<timestamp>`
2. aggiunge la mossa a `currentMoves`
3. chiama `renderBoardLayout(...)` con `nextState`

### Richiesta

```http
POST /games/<gameId>/moves
X-API-Key: <api key>
Content-Type: application/json
```

Payload:

```json
{
  "playerId": "embedded player uuid",
  "data": {
    "type": "tetris-turn",
    "gameState": {},
    "summary": {}
  }
}
```

### Client

Metodo: `Player.addMoveToGame(gameId, playerId, moveData)`.

Internamente:

1. `Player.#request("/games/<gameId>/moves", { method: "POST", body })`

### Backend

Route: `router.post("/:gameId/moves")`.

Funzioni backend:

1. `apiKeyAuth`
2. `getGameById(gameId)`
3. verifica owner oppure player
4. valida `playerId`
5. valida `data` come object
6. verifica che `playerId` esista in `game.players`
7. `addMoveToGame(gameId, playerId, data)`
8. scrive la mossa in `data/games.json`

### Risposta OK

Status: `201`

```json
{
  "message": "Move added successfully",
  "move": {
    "id": "uuid",
    "playerId": "embedded player uuid",
    "data": {
      "type": "tetris-turn",
      "gameState": {},
      "summary": {}
    },
    "timestamp": "ISO timestamp"
  }
}
```

### Dopo La Risposta

1. sostituisce la mossa optimistic con quella persistita
2. `broadcastMatchUpdate("move-placed")`
3. mostra stato "Mossa registrata."
4. `refreshGameState()`

Se fallisce:

1. cancella preview
2. ripristina `currentMoves = previousMoves`
3. `renderGame(currentGame, currentMoves)`
4. mostra errore

## Flusso 10: Sincronizzazione Tra Tab

File: `static/views/match_view.js`.

La chiave/canale dipende dalla lobby:

```txt
tetris-match-sync:<gameId>
```

### BroadcastChannel

Se disponibile:

1. `syncChannel = new BroadcastChannel(getMatchSyncChannelName())`
2. `broadcastMatchUpdate(reason)` invia `{ reason, gameId, timestamp }`
3. `onSyncMessage(event)` riceve il messaggio
4. se `event.data.gameId === gameId`, chiama `refreshGameState()`

### Fallback Storage

In ogni broadcast viene scritto anche:

```js
localStorage.setItem(getMatchSyncChannelName(), JSON.stringify(payload));
```

Le altre tab ricevono `storage`:

1. `onStorage(event)`
2. verifica `event.key === getMatchSyncChannelName()`
3. chiama `refreshGameState()`

### Motivi Di Broadcast Usati

- `player-added`
- `player-removed`
- `move-placed`
- `manual-refresh`
- `match-completed`
- `player-left-after-match`

### Refresh Durante Drag

Se arriva un refresh mentre il player sta trascinando:

1. `refreshGameState()` vede `isDraggingPiece`
2. imposta `pendingRefreshAfterDrag = true`
3. non ridisegna subito la board
4. `finishDragInteraction()` rilancia il refresh dopo il drag

Questo evita che il DOM cambi durante il drop.

## Flusso 11: Fine Partita

La partita finisce quando ci sono due player e solo uno dei due puo ancora
piazzare almeno un pezzo.

Funzioni coinvolte:

- `hasPlayablePiece(board, upcomingPieces)`
- `getMatchOutcome(gameState, selfPlayerId, opponentPlayerId)`
- `getMatchCompletion(gameState, players)`
- `ensureMatchCompleted(game, gameState)`

### Calcolo Vincitore

`getMatchCompletion(...)`:

1. richiede `players.length >= 2`
2. legge i due board state
3. calcola `firstCanMove`
4. calcola `secondCanMove`
5. se entrambi possono o entrambi non possono muovere, non conclude
6. se solo uno puo muovere, quello e il vincitore

Status finale:

```txt
completed - winner: <winnerName>
```

### Richiesta Di Aggiornamento

```http
PUT /games/<gameId>
X-API-Key: <api key>
Content-Type: application/json
```

Payload:

```json
{
  "name": "Tetris Duel",
  "status": "completed - winner: Player Rosso"
}
```

### Client

Metodo: `Player.updateGame(gameId, game.name, completion.status)`.

### Backend

Route: `router.put("/:gameId")`.

Funzioni backend:

1. `apiKeyAuth`
2. `getGameById(gameId)`
3. verifica `game.ownerId === req.user.id`
4. costruisce `updates` con `name` e/o `status`
5. `updateGame(gameId, updates)`

### Dopo L'Aggiornamento

1. salva `finalizedMatchStatus`
2. `broadcastMatchUpdate("match-completed")`
3. le tab aggiornano la UI mostrando vittoria/sconfitta

## Flusso 12: Rimozione Player E Uscita

### Rimuovi Player Durante Match

Click su `#remove-local-player-button`.

Funzioni:

1. `player.removePlayerFromGame(game.id, selfPlayer.id)`
2. `clearLocalPlayerId()`
3. `clearPlacementPreview()`
4. `broadcastMatchUpdate("player-removed")`
5. ricarica `player.getGame(...)` e `player.getGameMoves(...)`
6. `renderGame(updatedGame, updatedMoves)`

Richiesta:

```http
DELETE /games/<gameId>/players/<playerId>
X-API-Key: <api key>
```

Backend:

1. `apiKeyAuth`
2. `getGameById(gameId)`
3. verifica owner
4. `removePlayerFromGame(gameId, playerId)`

### Esci Dopo Match

Click su `#leave-match-button`.

Funzioni:

1. `player.removePlayerFromGame(game.id, selfPlayer.id)`
2. `clearLocalPlayerId()`
3. `clearPlacementPreview()`
4. `broadcastMatchUpdate("player-left-after-match")`
5. `options.onBack()`

## Flusso 13: Eliminazione Partita Dalla Lobby

File: `static/views/lobby_view.js`.

Click su bottone `[data-delete-game]`.

Funzioni:

1. conferma `window.confirm(...)`
2. `player.deleteGame(deleteGameId)`
3. `loadAccessibleGames()`

Richiesta:

```http
DELETE /games/<gameId>
X-API-Key: <api key>
```

Backend:

1. `apiKeyAuth`
2. `getGameById(gameId)`
3. verifica owner
4. `deleteGame(gameId)`

Risposta:

```json
{
  "message": "Game deleted successfully"
}
```

## API Usate Dal Flusso Tetris

| Fase | Metodo client | Request |
| --- | --- | --- |
| Registrazione | `Player.#register()` | `POST /auth/register` |
| Lista lobby | `Player.listGame()` | `GET /games` |
| Crea lobby | `Player.createGame(name)` | `POST /games` |
| Dettaglio lobby | `Player.getGame(gameId)` | `GET /games/:gameId` |
| Aggiorna stato finale | `Player.updateGame(...)` | `PUT /games/:gameId` |
| Elimina lobby | `Player.deleteGame(gameId)` | `DELETE /games/:gameId` |
| Aggiungi player locale | `Player.addPlayerToGame(...)` | `POST /games/:gameId/players` |
| Rimuovi player locale | `Player.removePlayerFromGame(...)` | `DELETE /games/:gameId/players/:playerId` |
| Salva mossa | `Player.addMoveToGame(...)` | `POST /games/:gameId/moves` |
| Leggi mosse | `Player.getGameMoves(gameId)` | `GET /games/:gameId/moves` |

## Funzioni Principali Per File

### `static/index.js`

- `getRouteGameId()`
- `renderApp()`

### `static/client_auth.js`

- `Player.constructor(name, existingProfile)`
- `Player.fromProfile(profile)`
- `Player.fromApiKey(apiKey, label)`
- `Player.waitUntilReady()`
- `Player.getProfile()`
- `Player.#register()`
- `Player.#request(path, options)`
- `Player.createGame(name_game)`
- `Player.listGame()`
- `Player.getGame(game_id)`
- `Player.updateGame(game_id, new_name, new_status)`
- `Player.deleteGame(game_id)`
- `Player.addPlayerToGame(game_id, player_name)`
- `Player.getGamePlayers(game_id)`
- `Player.removePlayerFromGame(game_id, player_id)`
- `Player.addMoveToGame(game_id, player_id, move_data)`
- `Player.getGameMoves(game_id)`
- `Player.getGameMove(game_id, move_id)`

### `static/views/register_view.js`

- `renderRegisterView(root, options)`
- `setStatus(message, type)`
- `setSharedStatus(message, type)`
- `renderPlayerCard(profile)`
- `setLoading(isLoading)`
- `setSharedLoading(isLoading)`

### `static/views/lobby_view.js`

- `renderLobbyView(root, profile, options)`
- `loadAccessibleGames()`
- `renderAccessibleGames(games)`
- `openGameById()`
- `setCreateLoading(isLoading)`
- `setStatus(element, message, type)`

### `static/views/match_view.js`

- `renderMatchView(root, profile, gameId, options)`
- `refreshGameState()`
- `renderGame(game, moves)`
- `renderPlayerSetup(game)`
- `renderBoardLayout(...)`
- `bindBoardInteractions(...)`
- `submitCurrentMove(localPlayerId, pieceId, position)`
- `ensureLocalPlayerSelection(game)`
- `broadcastMatchUpdate(reason)`
- `ensureMatchCompleted(game, gameState)`
- `getMatchCompletion(gameState, players)`
- `getMatchOutcome(gameState, selfPlayerId, opponentPlayerId)`
- `getPersistedMatchOutcome(game, selfPlayer)`
- `hasPlayablePiece(board, upcomingPieces)`
- `isPlayerTurn(gameState, playerId)`
- `clearPlacementPreview()`
- `finishDragInteraction()`
- `setPlacementPreview(pieceId, x, y)`

### `static/game/tetris_engine.js`

- `getPieceCatalog()`
- `getPieceCellsForRender(pieceId, rotation)`
- `createInitialGameState(players)`
- `getLatestGameState(players, moves)`
- `applyMove(state, userId, pieceId, rotation, position)`
- `getPreviewCells(board, pieceId, rotation, position)`
- `clampPosition(board, pieceId, rotation, position)`
- `findFirstValidPosition(board, pieceId, rotation)`
- `hasAnyMove(board)`
- `getPlayerUserId(player)`

### Backend

- `apiKeyAuth(req, res, next)` in `src/middleware/auth.js`
- `registerUser(username)` in `src/db/database.js`
- `getUserByApiKey(apiKey)` in `src/db/database.js`
- `createGame(userId, gameName)` in `src/db/database.js`
- `getGamesByUserId(userId)` in `src/db/database.js`
- `getGameById(gameId)` in `src/db/database.js`
- `updateGame(gameId, updates)` in `src/db/database.js`
- `deleteGame(gameId)` in `src/db/database.js`
- `addPlayerToGame(gameId, playerName)` in `src/db/database.js`
- `removePlayerFromGame(gameId, playerId)` in `src/db/database.js`
- `getGamePlayers(gameId)` in `src/db/database.js`
- `addMoveToGame(gameId, playerId, moveData)` in `src/db/database.js`
- `getGameMoves(gameId)` in `src/db/database.js`

## Limiti E Attenzioni

- Le route `/games` sono protette da API key, ma i player Tetris sono embedded
  nel game e non utenti registrati.
- Nel backend `POST /games/:gameId/moves` controlla owner oppure player, ma il
  confronto player usa `game.players[].id` contro `req.user.id`; questi id
  normalmente non coincidono. Nel flusso reale funziona perche viene usata la
  API key del proprietario della partita.
- `GET /games/:gameId` e molte route player richiedono ownership della partita.
  Per questo la condivisione tra tab usa la stessa API key del proprietario.
- Non c'e polling fisso: la sincronizzazione avviene tramite broadcast locale e
  refresh espliciti verso backend.
- Lo stato Tetris persistito e sempre l'ultimo `move.data.gameState` valido.
  Le mosse precedenti restano come storico, ma la ricostruzione prende lo stato
  valido piu recente partendo dalla fine dell'array.
- La UI corrente non invia rotazioni diverse da `0`.
- La partita e pensata per due player: la UI blocca la creazione oltre due
  player, anche se il backend non impone direttamente quel limite.

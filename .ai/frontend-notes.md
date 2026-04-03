# Frontend Notes

## Architettura frontend

- Cartella principale: `static/`
- Nessun bundler
- Nessun framework frontend
- `static/index.html` carica Bootstrap CDN e `./index.css`
- `static/index.html` carica `./index.js` come modulo ES
- `static/jsconfig.json` abilita `checkJs` per il codice client

## File importanti

- `static/index.html`: shell HTML principale
- `static/index.js`: router hash-based leggero per lobby e match
- `static/index.css`: look Tetris / arcade
- `static/client_auth.js`: client API browser-side
- `static/session_storage.js`: persistenza sessione locale
- `static/utils/dom.js`: helper DOM condivisi
- `static/game/tetris_engine.js`: regole Tetris lato client
- `static/views/register_view.js`: registrazione o accesso via API key condivisa
- `static/views/lobby_view.js`: creazione lobby e apertura match
- `static/views/match_view.js`: gameplay a due usando stessa API key
- `static/pages/splash.html`: pagina secondaria molto semplice, attualmente separata dal flusso principale
- `static/img/undo.ico`: asset usato in `static/pages/splash.html`

## Registrazione utente

- La registrazione frontend usa `Player` da `static/client_auth.js`
- `new Player(username)` effettua la registrazione automaticamente chiamando `POST /auth/register`
- Per ottenere i dati registrati usare `await player.waitUntilReady()`
- `getProfile()` restituisce il profilo utente una volta completata la registrazione
- Il frontend salva il profilo registrato in `localStorage` con chiave `tetris-player-session`

## UI attuale

- Schermata iniziale con due ingressi: registrazione nuova API key o incolla API key condivisa
- Lobby con creazione partita, lista partite e apertura tramite id
- Match view dove ogni tab seleziona il proprio player locale nella lobby
- Gameplay Tetris a due con doppia griglia, turni alternati, queue di tre pezzi e pezzi disturbo sull'avversario
- Catalogo pezzi piu ampio dei tetramini classici: il motore include anche forme custom in `static/game/tetris_engine.js`
- Sincronizzazione match tra tab/browser tramite `BroadcastChannel` e fallback `storage`; il refresh backend avviene quando serve, non con polling periodico fisso

## Vincoli tecnici

- Il client usa route relative come `/auth/register` e `/games`
- Questo funziona perche il frontend viene servito dallo stesso server Node
- Gli elementi DOM in `static/index.js` sono recuperati con helper tipizzato `getRequiredElement()`
- Questo e stato introdotto per ridurre warning `checkJs` su elementi potenzialmente `null`
- Il player locale della lobby viene ricordato per tab in `sessionStorage`
- Il nome player preferito viene ricordato per coppia `apiKey + gameId` in `localStorage`

## Comportamenti backend che impattano il frontend

- Username duplicati vengono rifiutati con errore `User already exists`
- Username vuoti vengono rifiutati come `Invalid username`
- Le route `/games` richiedono sempre `X-API-Key`
- `GET /games` mostra le lobby create dall'utente proprietario della API key
- `POST /games/:gameId/players` viene usata per registrare i nomi player locali dentro la partita
- `POST /games/:gameId/moves` viene usata per sincronizzare lo stato Tetris
- `GET /games/:gameId/moves` e `POST /games/:gameId/moves` permettono di operare al proprietario del game; il controllo "player autenticato" nel backend resta disallineato rispetto agli embedded player

## Attenzioni utili

- Bootstrap e presente ma la UI corrente non dipende fortemente dalle sue classi
- Se si aggiungono nuove schermate, mantenere compatibilita con moduli ES browser
- Non introdurre dipendenze che richiedano build step finche il progetto resta statico
- Se si vuole supportare login reale oltre alla sola registrazione, il backend oggi non espone un endpoint di login

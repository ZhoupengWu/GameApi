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
- `static/index.js`: render pagina e logica registrazione
- `static/index.css`: look Tetris / arcade
- `static/client_auth.js`: client API browser-side
- `static/pages/splash.html`: pagina secondaria molto semplice, attualmente separata dal flusso principale
- `static/img/undo.ico`: asset usato in `static/pages/splash.html`

## Registrazione utente

- La registrazione frontend usa `Player` da `static/client_auth.js`
- `new Player(username)` effettua la registrazione automaticamente chiamando `POST /auth/register`
- Per ottenere i dati registrati usare `await player.waitUntilReady()`
- `getProfile()` restituisce il profilo utente una volta completata la registrazione
- Il frontend salva il profilo registrato in `localStorage` con chiave `tetris-player-session`

## UI attuale

- Tema visivo: Tetris lobby / arcade
- Hero panel a sinistra, card registrazione a destra
- Tetromini decorativi renderizzati via HTML/CSS
- Stato della richiesta mostrato in pagina
- Card sessione visibile dopo registrazione o ripristino da `localStorage`

## Vincoli tecnici

- Il client usa route relative come `/auth/register` e `/games`
- Questo funziona perche il frontend viene servito dallo stesso server Node
- Gli elementi DOM in `static/index.js` sono recuperati con helper tipizzato `getRequiredElement()`
- Questo e stato introdotto per ridurre warning `checkJs` su elementi potenzialmente `null`

## Comportamenti backend che impattano il frontend

- Username duplicati vengono rifiutati con errore `User already exists`
- Username vuoti vengono rifiutati come `Invalid username`
- Le route `/games` richiedono sempre `X-API-Key`
- Il frontend attuale registra utenti ma non ha ancora una vera schermata per creare o gestire partite

## Attenzioni utili

- Bootstrap e presente ma la UI corrente non dipende fortemente dalle sue classi
- Se si aggiungono nuove schermate, mantenere compatibilita con moduli ES browser
- Non introdurre dipendenze che richiedano build step finche il progetto resta statico
- Se si vuole supportare login reale oltre alla sola registrazione, il backend oggi non espone un endpoint di login

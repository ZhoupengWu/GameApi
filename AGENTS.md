# AGENTS.md

Questo repository e un server Node.js con Express.

Regole operative:

- Tratta il progetto prima di tutto come backend Node/Express, non come app frontend standalone.
- Non modificare `src/` se la richiesta puo essere risolta nel client statico; per questo repository le correzioni Tetris/Codespaces vanno fatte in `static/` salvo richiesta esplicita dell'utente.
- Usa ES modules: `import` / `export`, coerente con `"type": "module"` in `package.json`.
- Il frontend e servito come statico da `src/index.js` sotto `/frontend`.
- I file client stanno in `static/` e girano nel browser senza bundler.
- Per il codice client evita dipendenze non necessarie, transpiler o assunzioni da framework.
- Se un file browser importa un altro modulo, il modulo deve esportare esplicitamente cio che serve.
- Le API pubbliche non protette sono sotto `/auth`; le route protette usano header `X-API-Key`.
- Prima di cambiare il frontend, verifica sempre come il backend espone le route e da quale path viene servito il client.
- Evita sprechi: fai modifiche piccole, riusa i moduli esistenti e non introdurre librerie o strutture nuove senza motivo.

Contesto attuale:

- Gioco in sviluppo: Tetris.
- Registrazione frontend collegata a `static/client_auth.js`.
- Entry point frontend: `static/index.js`.

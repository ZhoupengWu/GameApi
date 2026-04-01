import { Player } from "../client_auth.js";

/**
 * @typedef {{
 *     id: string,
 *     username: string,
 *     apiKey: string,
 *     createdAt: string
 * }} PlayerProfile
 */

/**
 * @typedef {{
 *     id: string,
 *     name: string,
 *     ownerId: string,
 *     players: Array<unknown>,
 *     moves: Array<unknown>,
 *     status: string,
 *     createdAt: string,
 *     updatedAt: string
 * }} GameSummary
 */

/**
 * @param {HTMLDivElement} root
 * @param {PlayerProfile} profile
 * @param {{ onLogout: () => void }} options
 */
export function renderLobbyView(root, profile, options) {
    root.innerHTML = `
        <main class="dashboard-shell">
            <section class="dashboard-hero">
                <div>
                    <p class="eyebrow">Sessione attiva</p>
                    <h1 class="dashboard-title">Benvenuto ${escapeHtml(profile.username)}</h1>
                    <p class="hero-copy">
                        La tua API key è salvata localmente. Da qui puoi creare una nuova partita Tetris e rivedere quelle che possiedi.
                    </p>
                </div>

                <div class="player-card">
                    <p class="panel-kicker">API Key</p>
                    <p class="api-key-value">${escapeHtml(profile.apiKey)}</p>
                    <button id="logout-button" class="secondary-button" type="button">Esci</button>
                </div>
            </section>

            <section class="dashboard-grid">
                <article class="register-panel">
                    <div class="panel-header">
                        <p class="panel-kicker">Nuova partita</p>
                        <h2>Crea una lobby</h2>
                    </div>

                    <form id="create-game-form" class="register-form">
                        <label class="field">
                            <span>Nome partita</span>
                            <input
                                id="game-name"
                                name="game-name"
                                type="text"
                                minlength="1"
                                maxlength="50"
                                placeholder="es. Tetris Ranked Room"
                                required
                            >
                        </label>

                        <button id="create-game-button" type="submit">Crea partita</button>
                    </form>

                    <p id="create-status" class="status" role="status" aria-live="polite"></p>
                </article>

                <article class="register-panel">
                    <div class="panel-header panel-header-inline">
                        <div>
                            <p class="panel-kicker">Le tue partite</p>
                            <h2>Lobby create</h2>
                        </div>
                        <button id="refresh-games-button" class="secondary-button" type="button">Aggiorna</button>
                    </div>

                    <p id="games-status" class="status" role="status" aria-live="polite"></p>
                    <div id="games-list" class="games-list"></div>
                </article>
            </section>
        </main>
    `;

    const player = Player.fromProfile(profile);
    const logoutButton = getRequiredElement(root, "#logout-button", HTMLButtonElement);
    const refreshButton = getRequiredElement(root, "#refresh-games-button", HTMLButtonElement);
    const createForm = getRequiredElement(root, "#create-game-form", HTMLFormElement);
    const gameNameInput = getRequiredElement(root, "#game-name", HTMLInputElement);
    const createButton = getRequiredElement(root, "#create-game-button", HTMLButtonElement);
    const createStatus = getRequiredElement(root, "#create-status", HTMLParagraphElement);
    const gamesStatus = getRequiredElement(root, "#games-status", HTMLParagraphElement);
    const gamesList = getRequiredElement(root, "#games-list", HTMLDivElement);

    /**
     * @param {HTMLParagraphElement} target
     * @param {string} message
     * @param {"idle" | "success" | "error"} type
     */
    function setStatus(target, message, type = "idle") {
        target.textContent = message;
        target.dataset.state = type;
    }

    /**
     * @param {boolean} isLoading
     */
    function setCreateLoading(isLoading) {
        createButton.disabled = isLoading;
        gameNameInput.disabled = isLoading;
        createButton.textContent = isLoading ? "Creazione..." : "Crea partita";
    }

    /**
     * @param {boolean} isLoading
     */
    function setRefreshLoading(isLoading) {
        refreshButton.disabled = isLoading;
        refreshButton.textContent = isLoading ? "Aggiornamento..." : "Aggiorna";
    }

    /**
     * @param {Array<GameSummary>} games
     */
    function renderGames(games) {
        if (games.length === 0) {
            gamesList.innerHTML = `
                <div class="empty-state">
                    <p>Nessuna partita creata.</p>
                    <p class="muted-copy">Usa il pannello a sinistra per aprire la tua prima lobby.</p>
                </div>
            `;

            return;
        }

        gamesList.innerHTML = games.map((game) => `
            <article class="game-card">
                <div class="game-card-header">
                    <h3>${escapeHtml(game.name)}</h3>
                    <span class="status-pill">${escapeHtml(game.status)}</span>
                </div>
                <dl class="game-meta">
                    <div>
                        <dt>ID</dt>
                        <dd>${escapeHtml(game.id)}</dd>
                    </div>
                    <div>
                        <dt>Giocatori</dt>
                        <dd>${String(game.players.length)}</dd>
                    </div>
                    <div>
                        <dt>Mosse</dt>
                        <dd>${String(game.moves.length)}</dd>
                    </div>
                    <div>
                        <dt>Aggiornata</dt>
                        <dd>${formatDate(game.updatedAt)}</dd>
                    </div>
                </dl>
            </article>
        `).join("");
    }

    async function loadGames() {
        setRefreshLoading(true);
        setStatus(gamesStatus, "Caricamento partite...", "idle");

        try {
            const games = await player.listGame();
            renderGames(games);

            if (games.length > 0) {
                setStatus(gamesStatus, `${games.length} partite caricate.`, "success");
            } else {
                setStatus(gamesStatus, "Nessuna partita presente per questo utente.", "idle");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            setStatus(gamesStatus, message, "error");
            gamesList.innerHTML = "";
        } finally {
            setRefreshLoading(false);
        }
    }

    logoutButton.addEventListener("click", () => {
        options.onLogout();
    });

    refreshButton.addEventListener("click", () => {
        loadGames();
    });

    createForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const gameName = gameNameInput.value.trim();

        if (gameName.length < 1) {
            setStatus(createStatus, "Il nome della partita è obbligatorio.", "error");
            return;
        }

        setCreateLoading(true);
        setStatus(createStatus, "Creazione partita in corso...", "idle");

        try {
            const result = await player.createGame(gameName);
            gameNameInput.value = "";
            setStatus(createStatus, `Partita creata: ${result.game.name}`, "success");
            await loadGames();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            setStatus(createStatus, message, "error");
        } finally {
            setCreateLoading(false);
        }
    });

    loadGames();
}

/**
 * @template {Element} T
 * @param {ParentNode} scope
 * @param {string} selector
 * @param {new () => T} expectedType
 * @returns {T}
 */
function getRequiredElement(scope, selector, expectedType) {
    const element = scope.querySelector(selector);

    if (!(element instanceof expectedType)) {
        throw new Error(`Required element not found: ${selector}`);
    }

    return element;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
    return new Date(isoDate).toLocaleString("it-IT");
}

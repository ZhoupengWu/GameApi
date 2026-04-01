import { Player } from "../client_auth.js";
import { escapeHtml, getRequiredElement } from "../utils/dom.js";

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
 *     players: Array<{id: string, userId?: string | null, name: string}>,
 *     moves: Array<unknown>,
 *     status: string,
 *     createdAt: string,
 *     updatedAt: string
 * }} GameSummary
 */

/**
 * @param {HTMLDivElement} root
 * @param {PlayerProfile} profile
 * @param {{ onLogout: () => void, onOpenGame: (gameId: string) => void }} options
 * @returns {() => void}
 */
export function renderLobbyView(root, profile, options) {
    root.innerHTML = `
        <main class="dashboard-shell">
            <section class="dashboard-hero">
                <div>
                    <p class="eyebrow">Lobby Tetris</p>
                    <h1 class="dashboard-title">Benvenuto ${escapeHtml(profile.username)}</h1>
                    <p class="hero-copy">
                        Usa la stessa API key su due browser o due tab diversi, poi dentro ogni partita scegli il nome del player locale.
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
                            <input id="game-name" type="text" maxlength="50" placeholder="es. Tetris Duel" required>
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
                    <form id="open-game-form" class="register-form compact-form">
                        <label class="field">
                            <span>Apri partita da ID</span>
                            <input id="open-game-id" type="text" placeholder="es. id lobby esistente">
                        </label>
                        <button id="open-game-button" class="secondary-button" type="submit">Apri</button>
                    </form>
                    <div id="games-list" class="games-list"></div>
                </article>
            </section>
        </main>
    `;

    const player = Player.fromProfile(profile);
    const logoutButton = getRequiredElement(root, "#logout-button", HTMLButtonElement);
    const createForm = getRequiredElement(root, "#create-game-form", HTMLFormElement);
    const createGameInput = getRequiredElement(root, "#game-name", HTMLInputElement);
    const createButton = getRequiredElement(root, "#create-game-button", HTMLButtonElement);
    const createStatus = getRequiredElement(root, "#create-status", HTMLParagraphElement);
    const refreshGamesButton = getRequiredElement(root, "#refresh-games-button", HTMLButtonElement);
    const openGameForm = getRequiredElement(root, "#open-game-form", HTMLFormElement);
    const openGameInput = getRequiredElement(root, "#open-game-id", HTMLInputElement);
    const gamesStatus = getRequiredElement(root, "#games-status", HTMLParagraphElement);
    const gamesList = getRequiredElement(root, "#games-list", HTMLDivElement);

    /**
     * @param {HTMLParagraphElement} element
     * @param {string} message
     * @param {"idle" | "success" | "error"} type
     */
    function setStatus(element, message, type = "idle") {
        element.textContent = message;
        element.dataset.state = type;
    }

    /**
     * @param {boolean} isLoading
     */
    function setCreateLoading(isLoading) {
        createButton.disabled = isLoading;
        createGameInput.disabled = isLoading;
        createButton.textContent = isLoading ? "Creazione..." : "Crea partita";
    }

    /**
     * @param {Array<GameSummary>} games
     */
    function renderAccessibleGames(games) {
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
                    <div>
                        <h3>${escapeHtml(game.name)}</h3>
                        <p class="game-subtitle">${escapeHtml(game.id)}</p>
                    </div>
                    <span class="status-pill">${escapeHtml(game.status)}</span>
                </div>
                <dl class="game-meta">
                    <div>
                        <dt>Giocatori</dt>
                        <dd>${String(game.players.length)}</dd>
                    </div>
                    <div>
                        <dt>Mosse</dt>
                        <dd>${String(game.moves.length)}</dd>
                    </div>
                </dl>
                <button class="secondary-button lobby-action" type="button" data-open-game="${escapeHtml(game.id)}">Apri partita</button>
            </article>
        `).join("");
    }

    async function loadAccessibleGames() {
        refreshGamesButton.disabled = true;
        setStatus(gamesStatus, "Caricamento partite...", "idle");

        try {
            const games = await player.listGame();
            renderAccessibleGames(games);
            setStatus(gamesStatus, `${games.length} partite caricate.`, games.length > 0 ? "success" : "idle");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            gamesList.innerHTML = "";
            setStatus(gamesStatus, message, "error");
        } finally {
            refreshGamesButton.disabled = false;
        }
    }

    function openGameById() {
        const gameId = openGameInput.value.trim();

        if (!gameId) {
            setStatus(gamesStatus, "Inserisci un id partita valido.", "error");
            return;
        }

        options.onOpenGame(gameId);
    }

    logoutButton.addEventListener("click", () => {
        options.onLogout();
    });

    createForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = createGameInput.value.trim();

        if (!name) {
            setStatus(createStatus, "Il nome della partita e obbligatorio.", "error");
            return;
        }

        setCreateLoading(true);
        setStatus(createStatus, "Creazione partita in corso...", "idle");

        try {
            const result = await player.createGame(name);
            setStatus(createStatus, `Partita creata: ${result.game.name}`, "success");
            createGameInput.value = "";
            await loadAccessibleGames();
            options.onOpenGame(result.game.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            setStatus(createStatus, message, "error");
        } finally {
            setCreateLoading(false);
        }
    });

    refreshGamesButton.addEventListener("click", () => {
        loadAccessibleGames();
    });

    openGameForm.addEventListener("submit", (event) => {
        event.preventDefault();
        openGameById();
    });

    gamesList.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const gameId = target.dataset.openGame;

        if (gameId) {
            options.onOpenGame(gameId);
        }
    });

    loadAccessibleGames();

    return () => {};
}

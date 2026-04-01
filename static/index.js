import { Player } from "./client_auth.js";

const STORAGE_KEY = "tetris-player-session";

/**
 * @typedef {{
 *     id: string,
 *     username: string,
 *     apiKey: string,
 *     createdAt: string
 * }} PlayerProfile
 */

/**
 * Restituisce un elemento DOM tipizzato oppure fallisce subito.
 *
 * @template {Element} T
 * @param {string} selector
 * @param {new () => T} expectedType
 * @returns {T}
 */
function getRequiredElement(selector, expectedType) {
    const element = document.querySelector(selector);

    if (!(element instanceof expectedType)) {
        throw new Error(`Required element not found: ${selector}`);
    }

    return element;
}

const root = getRequiredElement("#app", HTMLDivElement);

root.innerHTML = `
    <main class="landing-shell">
        <section class="hero-panel">
            <p class="eyebrow">Tetris Game API</p>
            <h1>Entra nella lobby e registra il tuo pilota.</h1>
            <p class="hero-copy">
                Scegli un nickname, ottieni la tua API key e preparati a costruire la tua prossima partita di Tetris.
            </p>

            <div class="tetromino-grid" aria-hidden="true">
                <span class="block cyan"></span>
                <span class="block cyan"></span>
                <span class="block cyan"></span>
                <span class="block cyan"></span>
                <span class="block yellow"></span>
                <span class="block yellow"></span>
                <span class="block yellow"></span>
                <span class="block yellow"></span>
                <span class="block purple"></span>
                <span class="block purple"></span>
                <span class="block purple"></span>
                <span class="block orange"></span>
                <span class="block purple"></span>
                <span class="block orange"></span>
                <span class="block orange"></span>
                <span class="block orange"></span>
            </div>
        </section>

        <section class="register-panel">
            <div class="panel-header">
                <p class="panel-kicker">Registrazione</p>
                <h2>Crea il tuo profilo giocatore</h2>
            </div>

            <form id="register-form" class="register-form">
                <label class="field">
                    <span>Nickname</span>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        minlength="3"
                        maxlength="20"
                        autocomplete="nickname"
                        placeholder="es. LineClear99"
                        required
                    >
                </label>

                <button id="submit-button" type="submit">Registrati</button>
            </form>

            <p id="status" class="status" role="status" aria-live="polite"></p>

            <section id="player-card" class="player-card hidden" aria-live="polite">
                <p class="panel-kicker">Sessione attiva</p>
                <h3 id="player-name">-</h3>
                <dl class="player-meta">
                    <div>
                        <dt>ID</dt>
                        <dd id="player-id">-</dd>
                    </div>
                    <div>
                        <dt>API Key</dt>
                        <dd id="player-api-key">-</dd>
                    </div>
                    <div>
                        <dt>Creato il</dt>
                        <dd id="player-created-at">-</dd>
                    </div>
                </dl>
            </section>
        </section>
    </main>
`;

const form = getRequiredElement("#register-form", HTMLFormElement);
const usernameInput = getRequiredElement("#username", HTMLInputElement);
const submitButton = getRequiredElement("#submit-button", HTMLButtonElement);
const statusElement = getRequiredElement("#status", HTMLParagraphElement);
const playerCard = getRequiredElement("#player-card", HTMLElement);
const playerName = getRequiredElement("#player-name", HTMLHeadingElement);
const playerId = getRequiredElement("#player-id", HTMLElement);
const playerApiKey = getRequiredElement("#player-api-key", HTMLElement);
const playerCreatedAt = getRequiredElement("#player-created-at", HTMLElement);

/**
 * @param {string} message
 * @param {"idle" | "success" | "error"} type
 */
function setStatus(message, type = "idle") {
    statusElement.textContent = message;
    statusElement.dataset.state = type;
}

/**
 * @param {PlayerProfile} profile
 */
function renderPlayerCard(profile) {
    playerName.textContent = profile.username;
    playerId.textContent = profile.id;
    playerApiKey.textContent = profile.apiKey;
    playerCreatedAt.textContent = new Date(profile.createdAt).toLocaleString("it-IT");
    playerCard.classList.remove("hidden");
}

/**
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    usernameInput.disabled = isLoading;
    submitButton.textContent = isLoading ? "Registrazione..." : "Registrati";
}

const savedSession = localStorage.getItem(STORAGE_KEY);

if (savedSession) {
    try {
        /** @type {PlayerProfile} */
        const profile = JSON.parse(savedSession);
        renderPlayerCard(profile);
        setStatus(`Bentornato ${profile.username}, la tua sessione locale e pronta.`, "success");
        usernameInput.value = profile.username;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();

    if (username.length < 1) {
        setStatus("Il nickname deve avere almeno 1 carattere.", "error");

        return;
    }

    setLoading(true);
    setStatus("Registrazione in corso...", "idle");

    try {
        const player = new Player(username);
        const profile = await player.waitUntilReady();

        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        renderPlayerCard(profile);
        setStatus(`Registrazione completata. ${profile.username} e pronto a giocare.`, "success");
        form.reset();
        usernameInput.value = profile.username;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Errore sconosciuto";
        setStatus(message, "error");
    } finally {
        setLoading(false);
    }
});

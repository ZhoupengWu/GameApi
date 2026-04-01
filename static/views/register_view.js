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
 * @param {HTMLDivElement} root
 * @param {{ onRegistered: (profile: PlayerProfile) => void }} options
 */
export function renderRegisterView(root, options) {
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
                    <p class="welcome-copy">Benvenuto nella lobby di Tetris.</p>
                    <dl class="player-meta">
                        <div>
                            <dt>API Key</dt>
                            <dd id="player-api-key">-</dd>
                        </div>
                    </dl>
                </section>
            </section>
        </main>
    `;

    const form = getRequiredElement(root, "#register-form", HTMLFormElement);
    const usernameInput = getRequiredElement(root, "#username", HTMLInputElement);
    const submitButton = getRequiredElement(root, "#submit-button", HTMLButtonElement);
    const statusElement = getRequiredElement(root, "#status", HTMLParagraphElement);
    const playerCard = getRequiredElement(root, "#player-card", HTMLElement);
    const playerName = getRequiredElement(root, "#player-name", HTMLHeadingElement);
    const playerApiKey = getRequiredElement(root, "#player-api-key", HTMLElement);

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
        playerApiKey.textContent = profile.apiKey;
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

            renderPlayerCard(profile);
            setStatus(`Registrazione completata. ${profile.username} e pronto a giocare.`, "success");
            options.onRegistered(profile);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            setStatus(message, "error");
        } finally {
            setLoading(false);
        }
    });
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

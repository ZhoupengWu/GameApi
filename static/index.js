import { clearSavedSession, getSavedSession, saveSession } from "./session_storage.js";
import { renderMatchView } from "./views/match_view.js";
import { renderLobbyView } from "./views/lobby_view.js";
import { renderRegisterView } from "./views/register_view.js";
import { getRequiredElement } from "./utils/dom.js";

/**
 * @typedef {{
 *     id: string,
 *     username: string,
 *     apiKey: string,
 *     createdAt: string
 * }} PlayerProfile
 */

const root = getRequiredElement(document, "#app", HTMLDivElement);
let cleanupCurrentView = () => {};
let showSessionChooser = false;

/**
 * Legge l'hash della pagina e restituisce l'id della partita selezionata.
 * @returns {string | null}
 */
function getRouteGameId() {
    const hash = window.location.hash;

    if (!hash.startsWith("#game=")) {
        return null;
    }

    return hash.slice("#game=".length).trim() || null;
}

/**
 * Decide quale vista mostrare in base alla sessione salvata e alla route corrente.
 */
function renderApp() {
    cleanupCurrentView();
    cleanupCurrentView = () => {};

    const savedSession = getSavedSession();

    if (!savedSession || showSessionChooser) {
        renderRegisterView(root, {
            existingSession: savedSession,
            onRegistered(profile) {
                saveSession(profile);
                showSessionChooser = false;
                renderApp();
            },
            onResumeSession() {
                showSessionChooser = false;
                renderApp();
            },
            onForgetSession() {
                clearSavedSession();
                showSessionChooser = false;
                renderApp();
            }
        });
        return;
    }

    const gameId = getRouteGameId();

    if (gameId) {
        cleanupCurrentView = renderMatchView(root, savedSession, gameId, {
            onBack() {
                window.location.hash = "";
            },
            onLogout() {
                window.location.hash = "";
                showSessionChooser = true;
                renderApp();
            }
        });
        return;
    }

    cleanupCurrentView = renderLobbyView(root, savedSession, {
        onLogout() {
            showSessionChooser = true;
            renderApp();
        },
        onOpenGame(nextGameId) {
            window.location.hash = `#game=${nextGameId}`;
        }
    });
}

window.addEventListener("hashchange", renderApp);
renderApp();

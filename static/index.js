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

/**
 * @returns {string | null}
 */
function getRouteGameId() {
    const hash = window.location.hash;

    if (!hash.startsWith("#game=")) {
        return null;
    }

    return hash.slice("#game=".length).trim() || null;
}

function renderApp() {
    cleanupCurrentView();
    cleanupCurrentView = () => {};

    const savedSession = getSavedSession();

    if (!savedSession) {
        renderRegisterView(root, {
            onRegistered(profile) {
                saveSession(profile);
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
                clearSavedSession();
                window.location.hash = "";
                renderApp();
            }
        });
        return;
    }

    cleanupCurrentView = renderLobbyView(root, savedSession, {
        onLogout() {
            clearSavedSession();
            renderApp();
        },
        onOpenGame(nextGameId) {
            window.location.hash = `#game=${nextGameId}`;
        }
    });
}

window.addEventListener("hashchange", renderApp);
renderApp();

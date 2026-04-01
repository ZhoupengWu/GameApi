import { getSavedSession, clearSavedSession, saveSession } from "./session_storage.js";
import { renderLobbyView } from "./views/lobby_view.js";
import { renderRegisterView } from "./views/register_view.js";

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

/**
 * @param {PlayerProfile} profile
 */
function showLobby(profile) {
    renderLobbyView(root, profile, {
        onLogout() {
            clearSavedSession();
            showRegister();
        }
    });
}

function showRegister() {
    renderRegisterView(root, {
        onRegistered(profile) {
            saveSession(profile);
            showLobby(profile);
        }
    });
}

const savedSession = getSavedSession();

if (savedSession) {
    showLobby(savedSession);
} else {
    showRegister();
}
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
 * Recupera la sessione salvata dal browser e la valida prima di restituirla.
 * @returns {PlayerProfile | null}
 */
export function getSavedSession() {
    const rawSession = localStorage.getItem(STORAGE_KEY);

    if (!rawSession) return null;

    try {
        const session = JSON.parse(rawSession);

        if (
            typeof session?.id !== "string" ||
            typeof session?.username !== "string" ||
            typeof session?.apiKey !== "string" ||
            typeof session?.createdAt !== "string"
        ) {
            throw new Error("Invalid session payload");
        }

        return session;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        
        return null;
    }
}

/**
 * Salva nel browser il profilo della sessione corrente.
 * @param {PlayerProfile} profile
 */
export function saveSession(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Rimuove dal browser qualsiasi sessione Tetris precedentemente salvata.
 */
export function clearSavedSession() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Crea un profilo locale temporaneo a partire da una API key condivisa.
 * @param {string} apiKey
 * @param {string} [label]
 * @returns {PlayerProfile}
 */
export function createSharedSession(apiKey, label = "Sessione condivisa") {
    return {
        id: "shared-api-key-session",
        username: label,
        apiKey,
        createdAt: new Date().toISOString()
    };
}

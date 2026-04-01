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
 * @param {PlayerProfile} profile
 */
export function saveSession(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearSavedSession() {
    localStorage.removeItem(STORAGE_KEY);
}

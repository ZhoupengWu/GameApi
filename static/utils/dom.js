/**
 * Cerca un elemento nel DOM e verifica che sia del tipo richiesto.
 * @template {Element} T
 * @param {ParentNode} scope
 * @param {string} selector
 * @param {new () => T} expectedType
 * @returns {T}
 */
export function getRequiredElement(scope, selector, expectedType) {
    const element = scope.querySelector(selector);

    if (!(element instanceof expectedType)) {
        throw new Error(`Required element not found: ${selector}`);
    }

    return element;
}

/**
 * Escapa i caratteri HTML per stampare testo utente senza interpretarlo come markup.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/**
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

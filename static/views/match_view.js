import { Player } from "../client_auth.js";
import {
    applyMove,
    findFirstValidPosition,
    getLatestGameState,
    getPieceCatalog,
    getPieceCellsForRender,
    getPreviewCells
} from "../game/tetris_engine.js";
import { escapeHtml, getRequiredElement } from "../utils/dom.js";

const SHARED_SESSION_LABEL = "Sessione condivisa";
const MATCH_SYNC_KEY_PREFIX = "tetris-match-sync";

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
 *     players: Array<{id: string, name: string}>,
 *     moves: Array<{id: string, playerId: string, data: Record<string, unknown>, timestamp: string}>,
 *     status: string,
 *     createdAt: string,
 *     updatedAt: string
 * }} GameDetails
 */

/**
 * @typedef {{
 *     userId: string,
 *     name: string,
 *     board: number[][],
 *     upcomingPieces: Array<string>,
 *     linesCleared: number,
 *     garbageReceived: number
 * }} PlayerBoardState
 */

/**
 * @param {HTMLDivElement} root
 * @param {PlayerProfile} profile
 * @param {string} gameId
 * @param {{ onBack: () => void, onLogout: () => void }} options
 * @returns {() => void}
 */
export function renderMatchView(root, profile, gameId, options) {
    root.innerHTML = `
        <main class="dashboard-shell">
            <section class="dashboard-hero match-hero">
                <div>
                    <p class="eyebrow">Partita Tetris</p>
                    <h1 class="dashboard-title">Lobby ${escapeHtml(gameId)}</h1>
                    <p class="hero-copy">
                        Ogni player riceve tre pezzi generati dal sistema. Trascina un pezzo sulla tua griglia per bloccarlo.
                    </p>
                </div>

                <div class="player-card">
                    <p class="panel-kicker">Navigazione</p>
                    <p class="muted-copy">La partita si sincronizza automaticamente quando un player entra, esce o piazza un blocco.</p>
                    <div class="match-actions">
                        <button id="back-button" class="secondary-button" type="button">Schermata principale</button>
                        <button id="logout-button" class="secondary-button" type="button">Cambia sessione</button>
                    </div>
                </div>
            </section>

            <section class="register-panel">
                <div class="panel-header">
                    <div>
                        <p class="panel-kicker">Stato match</p>
                        <h2 id="game-name-heading">Caricamento...</h2>
                    </div>
                </div>

                <p id="match-status" class="status" role="status" aria-live="polite"></p>
                <div id="match-content"></div>
            </section>
        </main>
    `;

    const player = Player.fromProfile(profile);
    const backButton = getRequiredElement(root, "#back-button", HTMLButtonElement);
    const logoutButton = getRequiredElement(root, "#logout-button", HTMLButtonElement);
    const statusElement = getRequiredElement(root, "#match-status", HTMLParagraphElement);
    const gameNameHeading = getRequiredElement(root, "#game-name-heading", HTMLHeadingElement);
    const matchContent = getRequiredElement(root, "#match-content", HTMLDivElement);

    const localState = {
        draggedPieceId: null,
        previewPosition: null
    };

    /** @type {GameDetails | null} */
    let currentGame = null;
    /** @type {Array<{id: string, playerId: string, data: Record<string, unknown>, timestamp: string}>} */
    let currentMoves = [];
    let isSubmitting = false;
    let disposed = false;
    let isEditingLocalPlayerName = false;
    let localPlayerDraftName = "";
    let isAutoSelectingLocalPlayer = false;
    /** @type {BroadcastChannel | null} */
    let syncChannel = null;

    /**
     * @param {string} message
     * @param {"idle" | "success" | "error"} type
     */
    function setStatus(message, type = "idle") {
        statusElement.textContent = message;
        statusElement.dataset.state = type;
    }

    /**
     * @returns {string}
     */
    function getMatchSyncChannelName() {
        return `${MATCH_SYNC_KEY_PREFIX}:${gameId}`;
    }

    /**
     * @returns {string}
     */
    function getLocalPlayerStorageKey() {
        return `tetris-local-player:${gameId}`;
    }

    /**
     * @returns {string}
     */
    function getLocalPlayerNameStorageKey() {
        return `tetris-local-player-name:${profile.apiKey}:${gameId}`;
    }

    /**
     * @returns {string | null}
     */
    function getLocalPlayerId() {
        return sessionStorage.getItem(getLocalPlayerStorageKey());
    }

    /**
     * @param {string} playerId
     */
    function saveLocalPlayerId(playerId) {
        sessionStorage.setItem(getLocalPlayerStorageKey(), playerId);
    }

    function clearLocalPlayerId() {
        sessionStorage.removeItem(getLocalPlayerStorageKey());
    }

    /**
     * @returns {string}
     */
    function getSuggestedLocalPlayerName() {
        const rememberedName = localStorage.getItem(getLocalPlayerNameStorageKey())?.trim();

        if (rememberedName) {
            return rememberedName;
        }

        if (profile.id !== "shared-api-key-session") {
            return profile.username;
        }

        return profile.username === SHARED_SESSION_LABEL ? "" : profile.username;
    }

    /**
     * @param {string} playerName
     */
    function saveLocalPlayerName(playerName) {
        const normalizedName = playerName.trim();

        if (!normalizedName) {
            localStorage.removeItem(getLocalPlayerNameStorageKey());
            return;
        }

        localStorage.setItem(getLocalPlayerNameStorageKey(), normalizedName);
    }

    /**
     * @param {string} reason
     */
    function broadcastMatchUpdate(reason) {
        const payload = {
            reason,
            gameId,
            timestamp: Date.now()
        };

        if (syncChannel) {
            syncChannel.postMessage(payload);
        }

        localStorage.setItem(getMatchSyncChannelName(), JSON.stringify(payload));
    }

    function clearPlacementPreview() {
        localState.draggedPieceId = null;
        localState.previewPosition = null;
    }

    /**
     * @param {string} pieceId
     * @param {number} x
     * @param {number} y
     */
    function setPlacementPreview(pieceId, x, y) {
        localState.draggedPieceId = pieceId;
        localState.previewPosition = { x, y };
    }

    /**
     * @param {PlayerBoardState} ownState
     * @returns {Array<{x: number, y: number}>}
     */
    function getCurrentPreviewCells(ownState) {
        if (!localState.draggedPieceId || !localState.previewPosition) {
            return [];
        }

        return getPreviewCells(ownState.board, localState.draggedPieceId, 0, localState.previewPosition);
    }

    /**
     * @param {number[][]} board
     * @param {Array<string>} upcomingPieces
     * @returns {boolean}
     */
    function hasPlayablePiece(board, upcomingPieces) {
        return upcomingPieces.some((pieceId) => findFirstValidPosition(board, pieceId, 0) !== null);
    }

    /**
     * @param {{ currentTurnUserId?: string | null, players: Record<string, PlayerBoardState> }} gameState
     * @param {string} playerId
     * @returns {boolean}
     */
    function isPlayerTurn(gameState, playerId) {
        const playerIds = Object.keys(gameState.players);

        if (playerIds.length <= 1) {
            return true;
        }

        return gameState.currentTurnUserId === playerId;
    }

    /**
     * @param {GameDetails} game
     * @returns {Promise<boolean>}
     */
    async function ensureLocalPlayerSelection(game) {
        const selectedPlayerId = getLocalPlayerId();

        if (selectedPlayerId && game.players.some((entry) => entry.id === selectedPlayerId)) {
            return false;
        }

        if (isAutoSelectingLocalPlayer) {
            return false;
        }

        const preferredName = getSuggestedLocalPlayerName();

        if (!preferredName) {
            return false;
        }

        const matchingPlayer = game.players.find((entry) => entry.name.toLowerCase() === preferredName.toLowerCase()) || null;

        if (matchingPlayer) {
            saveLocalPlayerId(matchingPlayer.id);
            saveLocalPlayerName(matchingPlayer.name);
            localPlayerDraftName = matchingPlayer.name;
            return true;
        }

        if (game.players.length >= 2 || profile.username === SHARED_SESSION_LABEL) {
            return false;
        }

        isAutoSelectingLocalPlayer = true;

        try {
            const result = await player.addPlayerToGame(gameId, preferredName);
            saveLocalPlayerId(result.player.id);
            saveLocalPlayerName(result.player.name);
            localPlayerDraftName = result.player.name;
            broadcastMatchUpdate("player-added");
            return true;
        } finally {
            isAutoSelectingLocalPlayer = false;
        }
    }

    /**
     * @param {Array<string>} upcomingPieces
     * @returns {string}
     */
    function renderPieceQueueHtml(upcomingPieces, canDragPieces) {
        if (upcomingPieces.length === 0) {
            return `
                <div class="empty-state">
                    <p>Nessun pezzo disponibile.</p>
                </div>
            `;
        }

        return `
            <div id="pieces-picker" class="pieces-picker">
                ${upcomingPieces.map((pieceId) => `
                    <button
                        type="button"
                        class="piece-card"
                        data-piece-id="${escapeHtml(pieceId)}"
                        aria-label="Pezzo ${escapeHtml(pieceId)}"
                        title="${escapeHtml(pieceId)}"
                        draggable="${canDragPieces ? "true" : "false"}"
                        ${canDragPieces ? "" : "disabled"}
                    >
                        ${renderPieceMiniBoard(pieceId)}
                    </button>
                `).join("")}
            </div>
        `;
    }

    /**
     * @param {string} pieceId
     * @returns {string}
     */
    function renderPieceMiniBoard(pieceId) {
        const cells = getPieceCellsForRender(pieceId, 0);
        const occupied = new Set(cells.map(([x, y]) => `${x}:${y}`));

        return `
            <span class="piece-mini-board" aria-hidden="true">
                ${Array.from({ length: 16 }, (_, index) => {
                    const x = index % 4;
                    const y = Math.floor(index / 4);

                    return `
                        <span class="piece-mini-cell ${occupied.has(`${x}:${y}`) ? "piece-mini-cell-filled" : ""}"></span>
                    `;
                }).join("")}
            </span>
        `;
    }

    /**
     * @param {PlayerBoardState} ownState
     */
    function updateOwnBoardPreview(ownState) {
        const ownBoard = root.querySelector("#own-board");

        if (!(ownBoard instanceof HTMLDivElement)) {
            return;
        }

        ownBoard.innerHTML = renderBoardHtml(ownState.board, getCurrentPreviewCells(ownState), true);
    }

    /**
     * @param {GameDetails} game
     * @param {{ currentTurnUserId?: string | null, version: number, players: Record<string, PlayerBoardState> }} gameState
     * @param {PlayerBoardState} ownState
     * @param {{id: string, name: string}} selfPlayer
     * @param {{id: string, name: string} | null} opponentPlayer
     * @param {PlayerBoardState | null} opponentState
     */
    function renderBoardLayout(game, gameState, ownState, selfPlayer, opponentPlayer, opponentState) {
        const previewCells = getCurrentPreviewCells(ownState);
        const canMoveAtAll = hasPlayablePiece(ownState.board, ownState.upcomingPieces);
        const isLocalTurn = isPlayerTurn(gameState, selfPlayer.id);
        const turnLabel = gameState.currentTurnUserId
            ? game.players.find((entry) => entry.id === gameState.currentTurnUserId)?.name || "Player sconosciuto"
            : "In attesa";
        const turnNumber = gameState.version + 1;

        matchContent.innerHTML = `
            <div class="match-player-banner">
                <div class="match-player-badge">
                    <span class="panel-kicker">Stai giocando come</span>
                    <strong>${escapeHtml(selfPlayer.name)}</strong>
                </div>
                <div class="match-player-badge">
                    <span class="panel-kicker">Turno corrente</span>
                    <strong>${escapeHtml(turnLabel)}</strong>
                    <span>Turno ${String(turnNumber)}</span>
                </div>
                <div class="match-player-actions">
                    <button id="change-local-player-button" class="secondary-button" type="button">Cambia player locale</button>
                    <button id="remove-local-player-button" class="secondary-button" type="button">Rimuovi player</button>
                </div>
            </div>

            <div class="match-grid">
                <section class="board-section">
                    <div class="panel-header panel-header-inline">
                        <div>
                            <p class="panel-kicker">La tua griglia</p>
                            <h3>${escapeHtml(selfPlayer.name)}</h3>
                        </div>
                        <div class="score-card">
                            <span>Linee</span>
                            <strong>${String(ownState.linesCleared)}</strong>
                        </div>
                    </div>

                    <div class="match-sidebar-card">
                        <p class="panel-kicker">Pezzi disponibili</p>
                        <p class="muted-copy">Trascina un pezzo sulla griglia quando e il tuo turno. Se completi una riga o colonna, sull'avversario compare un pezzo casuale in una posizione valida.</p>
                        ${renderPieceQueueHtml(ownState.upcomingPieces, isLocalTurn && canMoveAtAll)}
                    </div>

                    <div id="own-board" class="board" aria-label="Griglia personale">
                        ${renderBoardHtml(ownState.board, previewCells, true)}
                    </div>

                    <p class="status ${canMoveAtAll ? "" : "status-inline-error"}" data-state="${canMoveAtAll ? "idle" : "error"}">
                        ${!isLocalTurn
                            ? "Attendi il turno dell'altro player."
                            : canMoveAtAll
                                ? "Posiziona un pezzo trascinandolo sulla tua griglia."
                                : "Nessun pezzo disponibile entra nella griglia attuale."}
                    </p>
                </section>

                <section class="board-section">
                    <div class="panel-header panel-header-inline">
                        <div>
                            <p class="panel-kicker">Griglia avversaria</p>
                            <h3>${escapeHtml(opponentPlayer ? opponentPlayer.name : "In attesa del secondo player")}</h3>
                        </div>
                        <div class="score-card">
                            <span>Linee</span>
                            <strong>${String(opponentState ? opponentState.linesCleared : 0)}</strong>
                        </div>
                    </div>

                    <div class="board" aria-label="Griglia avversaria">
                        ${renderBoardHtml(opponentState ? opponentState.board : createEmptyBoard(), [], false)}
                    </div>

                    <div class="match-sidebar-card">
                        <p class="panel-kicker">${opponentPlayer ? "Effetti" : "Stato lobby"}</p>
                        <p class="muted-copy">
                            ${opponentPlayer
                                ? "Quando l'avversario completa righe o colonne, nella tua griglia compare un pezzo casuale completo in una posizione valida per ogni linea completata."
                                : "Apri un secondo browser o tab, usa la stessa API key e scegli il nome dell'avversario in questa stessa lobby."}
                        </p>
                        <p class="muted-copy">
                            ${opponentPlayer
                                ? `Pezzi disturbo ricevuti: <strong>${String(ownState.garbageReceived)}</strong>`
                                : "Quando l'altro player entra o piazza un blocco, questa schermata si sincronizza automaticamente."}
                        </p>
                    </div>
                </section>
            </div>
        `;

        bindBoardInteractions(game, selfPlayer, ownState);
    }

    /**
     * @param {GameDetails} game
     * @param {Array<{id: string, playerId: string, data: Record<string, unknown>, timestamp: string}>} moves
     */
    function renderGame(game, moves) {
        currentGame = game;
        currentMoves = moves;
        gameNameHeading.textContent = game.name;

        const selectedPlayerId = getLocalPlayerId();
        const selfPlayer = selectedPlayerId ? game.players.find((entry) => entry.id === selectedPlayerId) || null : null;
        const opponentPlayer = selfPlayer ? game.players.find((entry) => entry.id !== selfPlayer.id) || null : null;
        const gameState = getLatestGameState(game.players, moves);
        const ownState = selfPlayer ? gameState.players[selfPlayer.id] : null;
        const opponentState = opponentPlayer ? gameState.players[opponentPlayer.id] : null;

        if (selectedPlayerId && !selfPlayer) {
            clearLocalPlayerId();
            renderGame(game, moves);
            return;
        }

        if (!selfPlayer || !ownState) {
            renderPlayerSetup(game);
            return;
        }

        renderBoardLayout(game, gameState, ownState, selfPlayer, opponentPlayer, opponentState);
    }

    /**
     * @param {GameDetails} game
     */
    function renderPlayerSetup(game) {
        const canCreateNewPlayer = game.players.length < 2;
        const draftName = localPlayerDraftName || getSuggestedLocalPlayerName();

        matchContent.innerHTML = `
            <div class="player-setup-grid">
                <section class="board-preview-card">
                    <p class="panel-kicker">Scegli il tuo player locale</p>
                    <h3>Questa finestra deve usare un nome giocatore</h3>
                    <p class="muted-copy">La stessa API key resta condivisa. Il nome che scegli qui identifica solo il player dentro questa partita.</p>

                    <form id="local-player-form" class="register-form">
                        <label class="field">
                            <span>Nome player locale</span>
                            <input id="local-player-name" type="text" maxlength="20" value="${escapeHtml(draftName)}" placeholder="es. Player Rosso" ${canCreateNewPlayer ? "" : "disabled"}>
                        </label>
                        <button id="local-player-submit" type="submit" ${canCreateNewPlayer ? "" : "disabled"}>Usa questo nome</button>
                    </form>
                    <p id="local-player-status" class="status" role="status" aria-live="polite"></p>
                </section>

                <section class="board-preview-card">
                    <p class="panel-kicker">Player gia presenti</p>
                    <div id="existing-players-list" class="player-slot-list">
                        ${game.players.length === 0 ? `
                            <div class="empty-state">
                                <p>Nessun player ancora aggiunto a questa partita.</p>
                            </div>
                        ` : game.players.map((gamePlayer) => `
                            <button class="player-slot" type="button" data-select-player="${escapeHtml(gamePlayer.id)}">
                                <strong>${escapeHtml(gamePlayer.name)}</strong>
                                <span>${escapeHtml(gamePlayer.id)}</span>
                            </button>
                        `).join("")}
                    </div>
                    <p class="muted-copy">${canCreateNewPlayer ? "Puoi creare un nuovo player oppure selezionarne uno esistente se questa tab lo aveva gia scelto." : "La partita ha gia due player registrati. Selezionane uno esistente in questa tab."}</p>
                </section>
            </div>
        `;

        const localPlayerForm = root.querySelector("#local-player-form");
        const localPlayerNameInput = root.querySelector("#local-player-name");
        const localPlayerStatus = root.querySelector("#local-player-status");
        const existingPlayersList = root.querySelector("#existing-players-list");

        /**
         * @param {string} message
         * @param {"idle" | "success" | "error"} type
         */
        function setLocalPlayerStatus(message, type = "idle") {
            if (!(localPlayerStatus instanceof HTMLParagraphElement)) {
                return;
            }

            localPlayerStatus.textContent = message;
            localPlayerStatus.dataset.state = type;
        }

        if (localPlayerNameInput instanceof HTMLInputElement) {
            localPlayerNameInput.addEventListener("input", () => {
                localPlayerDraftName = localPlayerNameInput.value;
            });

            localPlayerNameInput.addEventListener("focus", () => {
                isEditingLocalPlayerName = true;
            });

            localPlayerNameInput.addEventListener("blur", () => {
                isEditingLocalPlayerName = false;
                localPlayerDraftName = localPlayerNameInput.value;
            });
        }

        localPlayerForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!(localPlayerNameInput instanceof HTMLInputElement)) {
                return;
            }

            const name = localPlayerNameInput.value.trim();

            if (!name) {
                setLocalPlayerStatus("Inserisci un nome player valido.", "error");
                return;
            }

            localPlayerDraftName = name;
            saveLocalPlayerName(name);

            try {
                const matchingPlayer = game.players.find((entry) => entry.name.toLowerCase() === name.toLowerCase()) || null;

                if (matchingPlayer) {
                    saveLocalPlayerId(matchingPlayer.id);
                    saveLocalPlayerName(matchingPlayer.name);
                    setLocalPlayerStatus(`Player selezionato: ${matchingPlayer.name}`, "success");
                    renderGame(game, currentMoves);
                    return;
                }

                if (game.players.length >= 2) {
                    setLocalPlayerStatus("La partita ha gia due player. Selezionane uno esistente.", "error");
                    return;
                }

                setLocalPlayerStatus("Creazione player in corso...", "idle");
                const result = await player.addPlayerToGame(gameId, name);
                saveLocalPlayerId(result.player.id);
                saveLocalPlayerName(result.player.name);
                setLocalPlayerStatus(`Player creato: ${result.player.name}`, "success");
                broadcastMatchUpdate("player-added");
                await refreshGameState();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Errore sconosciuto";
                setLocalPlayerStatus(message, "error");
            }
        });

        existingPlayersList?.addEventListener("click", (event) => {
            const target = event.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const gamePlayerId = target.closest("[data-select-player]")?.getAttribute("data-select-player");

            if (!gamePlayerId) {
                return;
            }

            saveLocalPlayerId(gamePlayerId);
            const selectedPlayer = game.players.find((entry) => entry.id === gamePlayerId);

            if (selectedPlayer) {
                saveLocalPlayerName(selectedPlayer.name);
                localPlayerDraftName = selectedPlayer.name;
            }

            setLocalPlayerStatus("Player locale selezionato.", "success");
            renderGame(game, currentMoves);
        });
    }

    /**
     * @param {GameDetails} game
     * @param {{id: string, name: string}} selfPlayer
     * @param {PlayerBoardState} ownState
     */
    function bindBoardInteractions(game, selfPlayer, ownState) {
        const piecesPicker = root.querySelector("#pieces-picker");
        const ownBoard = root.querySelector("#own-board");
        const changeLocalPlayerButton = root.querySelector("#change-local-player-button");
        const removeLocalPlayerButton = root.querySelector("#remove-local-player-button");

        function canInteractThisTurn() {
            if (!currentGame) {
                return false;
            }

            const gameState = getLatestGameState(currentGame.players, currentMoves);
            return isPlayerTurn(gameState, selfPlayer.id);
        }

        piecesPicker?.addEventListener("dragstart", (event) => {
            if (!canInteractThisTurn()) {
                event.preventDefault();
                setStatus("Non e il tuo turno.", "error");
                return;
            }

            const target = event.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const pieceButton = target.closest("[data-piece-id]");

            if (!(pieceButton instanceof HTMLElement)) {
                return;
            }

            const pieceId = pieceButton.dataset.pieceId;

            if (!pieceId) {
                return;
            }

            const dragEvent = /** @type {DragEvent} */ (event);
            const pieceMiniBoard = pieceButton.querySelector(".piece-mini-board");
            dragEvent.dataTransfer?.setData("text/plain", pieceId);
            dragEvent.dataTransfer?.setData("application/x-tetris-piece", pieceId);

            if (pieceMiniBoard instanceof HTMLElement) {
                const { left, top, width, height } = pieceMiniBoard.getBoundingClientRect();
                const offsetX = clampDragOffset(dragEvent.clientX - left, width);
                const offsetY = clampDragOffset(dragEvent.clientY - top, height);
                dragEvent.dataTransfer?.setDragImage(pieceMiniBoard, offsetX, offsetY);
            } else {
                dragEvent.dataTransfer?.setDragImage(pieceButton, 24, 24);
            }

            localState.draggedPieceId = pieceId;
            localState.previewPosition = null;
        });

        piecesPicker?.addEventListener("dragend", () => {
            clearPlacementPreview();
            updateOwnBoardPreview(ownState);
        });

        ownBoard?.addEventListener("dragover", (event) => {
            if (!canInteractThisTurn()) {
                return;
            }

            const dragEvent = /** @type {DragEvent} */ (event);
            const target = dragEvent.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const cell = target.closest("[data-cell-x][data-cell-y]");

            if (!(cell instanceof HTMLElement)) {
                return;
            }

            const pieceId = dragEvent.dataTransfer?.getData("application/x-tetris-piece") || localState.draggedPieceId;

            if (!pieceId) {
                return;
            }

            dragEvent.preventDefault();
            const x = Number(cell.dataset.cellX);
            const y = Number(cell.dataset.cellY);

            if (!localState.previewPosition || localState.previewPosition.x !== x || localState.previewPosition.y !== y || localState.draggedPieceId !== pieceId) {
                setPlacementPreview(pieceId, x, y);
                updateOwnBoardPreview(ownState);
            }
        });

        ownBoard?.addEventListener("dragleave", (event) => {
            const relatedTarget = /** @type {DragEvent} */ (event).relatedTarget;

            if (relatedTarget instanceof Node && ownBoard.contains(relatedTarget)) {
                return;
            }

            if (localState.previewPosition) {
                clearPlacementPreview();
                updateOwnBoardPreview(ownState);
            }
        });

        ownBoard?.addEventListener("drop", async (event) => {
            if (!canInteractThisTurn()) {
                event.preventDefault();
                setStatus("Non e il tuo turno.", "error");
                return;
            }

            const dragEvent = /** @type {DragEvent} */ (event);
            const target = dragEvent.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const cell = target.closest("[data-cell-x][data-cell-y]");

            if (!(cell instanceof HTMLElement)) {
                return;
            }

            const pieceId = dragEvent.dataTransfer?.getData("application/x-tetris-piece") || localState.draggedPieceId;

            if (!pieceId) {
                return;
            }

            dragEvent.preventDefault();

            const position = {
                x: Number(cell.dataset.cellX),
                y: Number(cell.dataset.cellY)
            };

            const previewCells = getPreviewCells(ownState.board, pieceId, 0, position);

            if (previewCells.length === 0) {
                setStatus("Posizione non valida per il pezzo selezionato.", "error");
                clearPlacementPreview();
                updateOwnBoardPreview(ownState);
                return;
            }

            await submitCurrentMove(selfPlayer.id, pieceId, position);
        });

        changeLocalPlayerButton?.addEventListener("click", () => {
            clearLocalPlayerId();
            clearPlacementPreview();
            if (currentGame) {
                renderGame(currentGame, currentMoves);
            }
        });

        removeLocalPlayerButton?.addEventListener("click", async () => {
            try {
                setStatus("Rimozione player in corso...", "idle");
                await player.removePlayerFromGame(game.id, selfPlayer.id);
                clearLocalPlayerId();
                clearPlacementPreview();
                broadcastMatchUpdate("player-removed");
                await refreshGameState();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Errore sconosciuto";
                setStatus(message, "error");
            }
        });
    }

    /**
     * @param {string} localPlayerId
     * @param {string} pieceId
     * @param {{x: number, y: number}} position
     */
    async function submitCurrentMove(localPlayerId, pieceId, position) {
        if (!currentGame || isSubmitting) {
            return;
        }

        const gameState = getLatestGameState(currentGame.players, currentMoves);
        const ownState = gameState.players[localPlayerId];

        if (!ownState) {
            setStatus("Player locale non trovato nella partita.", "error");
            return;
        }

        isSubmitting = true;
        setStatus("Invio mossa in corso...", "idle");

        try {
            const { nextState, summary } = applyMove(
                gameState,
                localPlayerId,
                pieceId,
                0,
                position
            );

            const selfPlayer = currentGame.players.find((entry) => entry.id === localPlayerId) || null;
            const opponentPlayer = selfPlayer
                ? currentGame.players.find((entry) => entry.id !== selfPlayer.id) || null
                : null;
            const nextOwnState = nextState.players[localPlayerId] || null;
            const nextOpponentState = opponentPlayer ? nextState.players[opponentPlayer.id] || null : null;

            clearPlacementPreview();

            if (selfPlayer && nextOwnState) {
                renderBoardLayout(currentGame, nextState, nextOwnState, selfPlayer, opponentPlayer, nextOpponentState);
            }

            await player.addMoveToGame(currentGame.id, localPlayerId, {
                type: "tetris-turn",
                gameState: nextState,
                summary
            });

            broadcastMatchUpdate("move-placed");
            setStatus("Mossa registrata.", "success");
            await refreshGameState();
        } catch (error) {
            clearPlacementPreview();

            if (currentGame) {
                renderGame(currentGame, currentMoves);
            }

            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            setStatus(message, "error");
        } finally {
            isSubmitting = false;
        }
    }

    async function refreshGameState() {
        if (disposed) {
            return;
        }

        try {
            let [game, moves] = await Promise.all([
                player.getGame(gameId),
                player.getGameMoves(gameId)
            ]);

            const localPlayerSelectionChanged = await ensureLocalPlayerSelection(game);

            if (localPlayerSelectionChanged) {
                [game, moves] = await Promise.all([
                    player.getGame(gameId),
                    player.getGameMoves(gameId)
                ]);
            }

            currentGame = game;
            currentMoves = moves;
            gameNameHeading.textContent = game.name;

            if (isEditingLocalPlayerName && !getLocalPlayerId()) {
                setStatus(`Partita sincronizzata. Mosse totali: ${moves.length}.`, "success");
                return;
            }

            renderGame(game, moves);
            setStatus(`Partita sincronizzata. Mosse totali: ${moves.length}.`, "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Errore sconosciuto";
            matchContent.innerHTML = `
                <div class="empty-state">
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
            setStatus(message, "error");
        }
    }

    /**
     * @param {MessageEvent} event
     */
    function onSyncMessage(event) {
        if (disposed) {
            return;
        }

        if (event.data?.gameId !== gameId) {
            return;
        }

        refreshGameState();
    }

    /**
     * @param {StorageEvent} event
     */
    function onStorage(event) {
        if (disposed || event.key !== getMatchSyncChannelName() || !event.newValue) {
            return;
        }

        refreshGameState();
    }

    backButton.addEventListener("click", () => {
        options.onBack();
    });

    logoutButton.addEventListener("click", () => {
        options.onLogout();
    });

    if (typeof BroadcastChannel !== "undefined") {
        syncChannel = new BroadcastChannel(getMatchSyncChannelName());
        syncChannel.addEventListener("message", onSyncMessage);
    }

    window.addEventListener("storage", onStorage);
    refreshGameState();

    return () => {
        disposed = true;
        window.removeEventListener("storage", onStorage);

        if (syncChannel) {
            syncChannel.removeEventListener("message", onSyncMessage);
            syncChannel.close();
        }
    };
}

/**
 * @param {number[][]} board
 * @param {Array<{x: number, y: number}>} previewCells
 * @param {boolean} interactive
 * @returns {string}
 */
function renderBoardHtml(board, previewCells, interactive) {
    const previewIndex = new Set(previewCells.map((cell) => `${cell.x}:${cell.y}`));

    return `
        <div class="board-grid ${interactive ? "board-grid-interactive" : ""}">
            ${board.map((row, y) => row.map((cell, x) => {
                const isPreview = previewIndex.has(`${x}:${y}`);
                const classNames = ["board-cell"];

                if (cell === 1) {
                    classNames.push("board-cell-filled");
                } else if (cell === 2) {
                    classNames.push("board-cell-garbage");
                }

                if (isPreview) {
                    classNames.push("board-cell-preview");
                }

                return `
                    <button
                        type="button"
                        class="${classNames.join(" ")}"
                        ${interactive ? `data-cell-x="${x}" data-cell-y="${y}"` : "disabled"}
                    ></button>
                `;
            }).join("")).join("")}
        </div>
    `;
}

/**
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
function clampDragOffset(value, max) {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(value, max));
}

/**
 * @returns {number[][]}
 */
function createEmptyBoard() {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
}

import { Player } from "../client_auth.js";
import {
    applyMove,
    clampPosition,
    findFirstValidPosition,
    getLatestGameState,
    getPieceCatalog,
    getPreviewCells,
    hasAnyMove
} from "../game/tetris_engine.js";
import { escapeHtml, getRequiredElement } from "../utils/dom.js";

const POLL_INTERVAL_MS = 2000;
const SHARED_SESSION_LABEL = "Sessione condivisa";

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
                        Usate la stessa API key su due browser o due tab. Dentro questa lobby ogni finestra sceglie il proprio nome giocatore locale.
                    </p>
                </div>

                <div class="player-card">
                        <p class="panel-kicker">Controlli</p>
                        <p class="muted-copy">Freccie per muovere, Q/E o R per ruotare, 1/2/3 per scegliere la pedina, Invio per piazzare.</p>
                        <div class="match-actions">
                        <button id="back-button" class="secondary-button" type="button">Schermata principale</button>
                        <button id="logout-button" class="secondary-button" type="button">Cambia sessione</button>
                        </div>
                </div>
            </section>

            <section class="register-panel">
                <div class="panel-header panel-header-inline">
                    <div>
                        <p class="panel-kicker">Stato match</p>
                        <h2 id="game-name-heading">Caricamento...</h2>
                    </div>
                    <button id="refresh-match-button" class="secondary-button" type="button">Aggiorna</button>
                </div>

                <p id="match-status" class="status" role="status" aria-live="polite"></p>
                <div id="match-content"></div>
            </section>
        </main>
    `;

    const player = Player.fromProfile(profile);
    const backButton = getRequiredElement(root, "#back-button", HTMLButtonElement);
    const logoutButton = getRequiredElement(root, "#logout-button", HTMLButtonElement);
    const refreshButton = getRequiredElement(root, "#refresh-match-button", HTMLButtonElement);
    const statusElement = getRequiredElement(root, "#match-status", HTMLParagraphElement);
    const gameNameHeading = getRequiredElement(root, "#game-name-heading", HTMLHeadingElement);
    const matchContent = getRequiredElement(root, "#match-content", HTMLDivElement);

    const localState = {
        selectedPieceId: "I",
        rotation: 0,
        position: { x: 0, y: 0 }
    };

    /** @type {GameDetails | null} */
    let currentGame = null;
    /** @type {Array<{id: string, playerId: string, data: Record<string, unknown>, timestamp: string}>} */
    let currentMoves = [];
    let isSubmitting = false;
    let pollHandle = 0;
    let disposed = false;
    let isEditingLocalPlayerName = false;
    let localPlayerDraftName = "";
    let isAutoSelectingLocalPlayer = false;

    /**
     * @param {string} message
     * @param {"idle" | "success" | "error"} type
     */
    function setStatus(message, type = "idle") {
        statusElement.textContent = message;
        statusElement.dataset.state = type;
    }

    /**
     * @param {boolean} isLoading
     */
    function setRefreshLoading(isLoading) {
        refreshButton.disabled = isLoading;
        refreshButton.textContent = isLoading ? "Aggiornamento..." : "Aggiorna";
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
            return true;
        } finally {
            isAutoSelectingLocalPlayer = false;
        }
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

        syncSelectionWithBoard(ownState.board);
        const previewCells = getPreviewCells(ownState.board, localState.selectedPieceId, localState.rotation, localState.position);
        const canPlace = previewCells.length > 0;
        const canMoveAtAll = hasAnyMove(ownState.board);

        if (!opponentPlayer) {
            matchContent.innerHTML = `
                <div class="waiting-room">
                    <div class="empty-state">
                        <p>Player locale selezionato: <strong>${escapeHtml(selfPlayer.name)}</strong></p>
                        <p class="muted-copy">Apri un secondo browser o tab, usa la stessa API key e scegli il nome dell'avversario in questa stessa lobby.</p>
                        <button id="change-local-player-button" class="secondary-button" type="button">Cambia player locale</button>
                    </div>
                    <div class="board-preview-card">
                        <p class="panel-kicker">La tua griglia</p>
                        ${renderBoardHtml(ownState.board, previewCells, false)}
                    </div>
                </div>
            `;

            bindWaitingActions();
            return;
        }

        matchContent.innerHTML = `
            <div class="match-player-banner">
                <div class="match-player-badge">
                    <span class="panel-kicker">Stai giocando come</span>
                    <strong>${escapeHtml(selfPlayer.name)}</strong>
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

                    <div id="pieces-picker" class="pieces-picker">
                        ${getPieceCatalog().map((piece, index) => `
                            <button
                                type="button"
                                class="piece-chip ${piece.id === localState.selectedPieceId ? "piece-chip-active" : ""}"
                                data-piece-id="${escapeHtml(piece.id)}"
                            >
                                ${index + 1}. ${escapeHtml(piece.label)}
                            </button>
                        `).join("")}
                    </div>

                    <div id="own-board" class="board" aria-label="Griglia personale">
                        ${renderBoardHtml(ownState.board, previewCells, true)}
                    </div>

                    <div class="control-cluster">
                        <div class="direction-pad">
                            <button type="button" class="secondary-button" data-control="up">Su</button>
                            <div class="direction-row">
                                <button type="button" class="secondary-button" data-control="left">Sinistra</button>
                                <button type="button" class="secondary-button" data-control="down">Giu</button>
                                <button type="button" class="secondary-button" data-control="right">Destra</button>
                            </div>
                        </div>
                        <div class="rotation-pad">
                            <button type="button" class="secondary-button" data-control="rotate-left">Ruota -90</button>
                            <button type="button" class="secondary-button" data-control="rotate-right">Ruota +90</button>
                            <button type="button" id="place-piece-button" ${canPlace && !isSubmitting ? "" : "disabled"}>Blocca pedina</button>
                        </div>
                    </div>

                    <p class="status ${canMoveAtAll ? "" : "status-inline-error"}" data-state="${canMoveAtAll ? "idle" : "error"}">
                        ${canMoveAtAll ? "Scegli una pedina e posizionala sulla tua griglia." : "Nessuna pedina disponibile entra piu nella griglia attuale."}
                    </p>
                </section>

                <section class="board-section">
                    <div class="panel-header panel-header-inline">
                        <div>
                            <p class="panel-kicker">Griglia avversaria</p>
                            <h3>${escapeHtml(opponentPlayer.name)}</h3>
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
                        <p class="panel-kicker">Effetti</p>
                        <p class="muted-copy">Quando l'avversario completa righe o colonne, nella tua griglia arriva un blocco casuale di disturbo per ogni linea completata.</p>
                        <p class="muted-copy">Disturbi ricevuti: <strong>${String(ownState.garbageReceived)}</strong></p>
                    </div>
                </section>
            </div>
        `;

        bindDynamicControls(game, moves, selfPlayer);
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
                    await refreshGameState();
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
                await refreshGameState();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Errore sconosciuto";
                setLocalPlayerStatus(message, "error");
            }
        });

        existingPlayersList?.addEventListener("click", async (event) => {
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
            await refreshGameState();
        });
    }

    function bindWaitingActions() {
        root.querySelector("#change-local-player-button")?.addEventListener("click", () => {
            clearLocalPlayerId();
            if (currentGame) {
                renderGame(currentGame, currentMoves);
            }
        });
    }

    /**
     * @param {number[][]} board
     */
    function syncSelectionWithBoard(board) {
        localState.position = clampPosition(board, localState.selectedPieceId, localState.rotation, localState.position);

        if (getPreviewCells(board, localState.selectedPieceId, localState.rotation, localState.position).length > 0) {
            return;
        }

        for (const piece of getPieceCatalog()) {
            for (const rotation of [0, 1, 2, 3]) {
                const position = findFirstValidPosition(board, piece.id, rotation);

                if (position) {
                    localState.selectedPieceId = piece.id;
                    localState.rotation = rotation;
                    localState.position = position;
                    return;
                }
            }
        }
    }

    /**
     * @param {GameDetails} game
     * @param {Array<{id: string, playerId: string, data: Record<string, unknown>, timestamp: string}>} moves
     * @param {{id: string, name: string}} selfPlayer
     */
    function bindDynamicControls(game, moves, selfPlayer) {
        const ownBoard = root.querySelector("#own-board");
        const piecesPicker = root.querySelector("#pieces-picker");
        const placeButton = root.querySelector("#place-piece-button");
        const changeLocalPlayerButton = root.querySelector("#change-local-player-button");
        const removeLocalPlayerButton = root.querySelector("#remove-local-player-button");

        piecesPicker?.addEventListener("click", (event) => {
            const target = event.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const pieceId = target.dataset.pieceId;

            if (!pieceId) {
                return;
            }

            localState.selectedPieceId = pieceId;
            localState.rotation = 0;
            renderGame(game, moves);
        });

        ownBoard?.addEventListener("click", (event) => {
            const target = event.target;

            if (!(target instanceof HTMLElement)) {
                return;
            }

            const x = target.dataset.cellX;
            const y = target.dataset.cellY;

            if (x === undefined || y === undefined) {
                return;
            }

            localState.position = {
                x: Number(x),
                y: Number(y)
            };

            renderGame(game, moves);
        });

        root.querySelectorAll("[data-control]").forEach((button) => {
            button.addEventListener("click", () => {
                const control = button.getAttribute("data-control");

                if (control === "left") {
                    moveSelection(-1, 0);
                } else if (control === "right") {
                    moveSelection(1, 0);
                } else if (control === "up") {
                    moveSelection(0, -1);
                } else if (control === "down") {
                    moveSelection(0, 1);
                } else if (control === "rotate-left") {
                    rotateSelection(-1);
                } else if (control === "rotate-right") {
                    rotateSelection(1);
                }
            });
        });

        placeButton?.addEventListener("click", async () => {
            await submitCurrentMove(selfPlayer.id);
        });

        changeLocalPlayerButton?.addEventListener("click", () => {
            clearLocalPlayerId();
            if (currentGame) {
                renderGame(currentGame, currentMoves);
            }
        });

        removeLocalPlayerButton?.addEventListener("click", async () => {
            try {
                setStatus("Rimozione player in corso...", "idle");
                await player.removePlayerFromGame(game.id, selfPlayer.id);
                clearLocalPlayerId();
                await refreshGameState();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Errore sconosciuto";
                setStatus(message, "error");
            }
        });
    }

    /**
     * @param {number} deltaX
     * @param {number} deltaY
     */
    function moveSelection(deltaX, deltaY) {
        const selfPlayerId = getLocalPlayerId();

        if (!currentGame || !selfPlayerId) {
            return;
        }

        const gameState = getLatestGameState(currentGame.players, currentMoves);
        const ownState = gameState.players[selfPlayerId];

        if (!ownState) {
            return;
        }

        localState.position = clampPosition(ownState.board, localState.selectedPieceId, localState.rotation, {
            x: localState.position.x + deltaX,
            y: localState.position.y + deltaY
        });

        renderGame(currentGame, currentMoves);
    }

    /**
     * @param {number} delta
     */
    function rotateSelection(delta) {
        const selfPlayerId = getLocalPlayerId();

        if (!currentGame || !selfPlayerId) {
            return;
        }

        const gameState = getLatestGameState(currentGame.players, currentMoves);
        const ownState = gameState.players[selfPlayerId];

        if (!ownState) {
            return;
        }

        localState.rotation = ((localState.rotation + delta) % 4 + 4) % 4;
        localState.position = clampPosition(ownState.board, localState.selectedPieceId, localState.rotation, localState.position);
        renderGame(currentGame, currentMoves);
    }

    /**
     * @param {string} localPlayerId
     */
    async function submitCurrentMove(localPlayerId) {
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
                localState.selectedPieceId,
                localState.rotation,
                localState.position
            );

            await player.addMoveToGame(currentGame.id, localPlayerId, {
                type: "tetris-turn",
                gameState: nextState,
                summary
            });

            setStatus("Mossa registrata.", "success");
            await refreshGameState();
        } catch (error) {
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

        setRefreshLoading(true);

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
        } finally {
            setRefreshLoading(false);
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    function onKeyDown(event) {
        if (disposed || !currentGame || !getLocalPlayerId()) {
            return;
        }

        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveSelection(-1, 0);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            moveSelection(1, 0);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveSelection(0, -1);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            moveSelection(0, 1);
        } else if (event.key.toLowerCase() === "q") {
            event.preventDefault();
            rotateSelection(-1);
        } else if (event.key.toLowerCase() === "e" || event.key.toLowerCase() === "r") {
            event.preventDefault();
            rotateSelection(1);
        } else if (event.key === "1" || event.key === "2" || event.key === "3") {
            const piece = getPieceCatalog()[Number(event.key) - 1];

            if (piece) {
                event.preventDefault();
                localState.selectedPieceId = piece.id;
                localState.rotation = 0;
                renderGame(currentGame, currentMoves);
            }
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            submitCurrentMove(getLocalPlayerId() || "");
        }
    }

    backButton.addEventListener("click", () => {
        options.onBack();
    });

    logoutButton.addEventListener("click", () => {
        options.onLogout();
    });

    refreshButton.addEventListener("click", () => {
        refreshGameState();
    });

    window.addEventListener("keydown", onKeyDown);
    refreshGameState();
    pollHandle = window.setInterval(() => {
        refreshGameState();
    }, POLL_INTERVAL_MS);

    return () => {
        disposed = true;
        window.removeEventListener("keydown", onKeyDown);
        window.clearInterval(pollHandle);
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
 * @returns {number[][]}
 */
function createEmptyBoard() {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
}

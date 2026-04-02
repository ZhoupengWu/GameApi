const BOARD_SIZE = 8;

const PIECES = {
    I: {
        id: "I",
        label: "Linea",
        cells: [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0]
        ]
    },
    O: {
        id: "O",
        label: "Quadrato",
        cells: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1]
        ]
    },
    T: {
        id: "T",
        label: "T",
        cells: [
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1]
        ]
    }
};

/**
 * @typedef {{
 *     id: string,
 *     userId?: string | null,
 *     name: string,
 *     joinedAt: string
 * }} GamePlayer
 */

/**
 * @typedef {{
 *     id: string,
 *     playerId: string,
 *     data: Record<string, unknown>,
 *     timestamp: string
 * }} GameMove
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
 * @typedef {{
 *     version: number,
 *     boardSize: number,
 *     currentTurnUserId: string | null,
 *     players: Record<string, PlayerBoardState>
 * }} TetrisGameState
 */

/**
 * @returns {Array<{id: string, label: string}>}
 */
export function getPieceCatalog() {
    return Object.values(PIECES).map((piece) => ({
        id: piece.id,
        label: piece.label
    }));
}

/**
 * @param {string} pieceId
 * @param {number} [rotation]
 * @returns {Array<[number, number]>}
 */
export function getPieceCellsForRender(pieceId, rotation = 0) {
    return getPieceCells(pieceId, rotation);
}

/**
 * @param {Array<GamePlayer>} players
 * @returns {TetrisGameState}
 */
export function createInitialGameState(players) {
    const statePlayers = {};

    for (const player of players) {
        const userId = getPlayerUserId(player);
        statePlayers[userId] = {
            userId,
            name: player.name,
            board: createEmptyBoard(BOARD_SIZE),
            upcomingPieces: createUpcomingPieces(),
            linesCleared: 0,
            garbageReceived: 0
        };
    }

    return {
        version: 0,
        boardSize: BOARD_SIZE,
        currentTurnUserId: players.length > 0 ? getPlayerUserId(players[0]) : null,
        players: statePlayers
    };
}

/**
 * @param {Array<GamePlayer>} players
 * @param {Array<GameMove>} moves
 * @returns {TetrisGameState}
 */
export function getLatestGameState(players, moves) {
    for (let index = moves.length - 1; index >= 0; index -= 1) {
        const move = moves[index];
        const candidate = move.data?.gameState;

        if (isGameState(candidate)) {
            return normalizeGameState(candidate, players);
        }
    }

    return createInitialGameState(players);
}

/**
 * @param {TetrisGameState} state
 * @param {string} userId
 * @param {string} pieceId
 * @param {number} rotation
 * @param {{x: number, y: number}} position
 */
export function applyMove(state, userId, pieceId, rotation, position) {
    const nextState = cloneGameState(state);
    const actorState = nextState.players[userId];

    if (!actorState) {
        throw new Error("Player not found in game state");
    }

    const activePlayerIds = getActivePlayerIds(nextState.players);

    if (
        activePlayerIds.length > 1 &&
        nextState.currentTurnUserId &&
        nextState.currentTurnUserId !== userId
    ) {
        throw new Error("Non e il turno di questo player");
    }

    const upcomingPieceIndex = actorState.upcomingPieces.findIndex((candidate) => candidate === pieceId);

    if (upcomingPieceIndex === -1) {
        throw new Error("La pedina selezionata non e disponibile");
    }

    const pieceCells = getPieceCells(pieceId, rotation);

    if (!canPlacePiece(actorState.board, pieceCells, position)) {
        throw new Error("Posizione non valida per la pedina selezionata");
    }

    for (const [cellX, cellY] of pieceCells) {
        actorState.board[position.y + cellY][position.x + cellX] = 1;
    }

    const clearedRows = [];
    const clearedColumns = [];

    for (let row = 0; row < nextState.boardSize; row += 1) {
        if (actorState.board[row].every((cell) => cell > 0)) {
            clearedRows.push(row);
        }
    }

    for (let column = 0; column < nextState.boardSize; column += 1) {
        let isFilled = true;

        for (let row = 0; row < nextState.boardSize; row += 1) {
            if (actorState.board[row][column] === 0) {
                isFilled = false;
                break;
            }
        }

        if (isFilled) {
            clearedColumns.push(column);
        }
    }

    for (const row of clearedRows) {
        for (let column = 0; column < nextState.boardSize; column += 1) {
            actorState.board[row][column] = 0;
        }
    }

    for (const column of clearedColumns) {
        for (let row = 0; row < nextState.boardSize; row += 1) {
            actorState.board[row][column] = 0;
        }
    }

    actorState.linesCleared += clearedRows.length + clearedColumns.length;
    actorState.upcomingPieces.splice(upcomingPieceIndex, 1);
    refillUpcomingPieces(actorState.upcomingPieces);

    const awardedPieces = [];
    const awardedPieceCount = clearedRows.length + clearedColumns.length;

    if (awardedPieceCount > 0) {
        for (const [targetUserId, targetState] of Object.entries(nextState.players)) {
            if (targetUserId === userId) {
                continue;
            }

            const pieces = addAwardedPieces(targetState.upcomingPieces, awardedPieceCount);
            targetState.garbageReceived += pieces.length;
            awardedPieces.push({
                targetUserId,
                pieces
            });
        }
    }

    nextState.currentTurnUserId = getNextTurnUserId(activePlayerIds, userId);
    nextState.version += 1;

    return {
        nextState,
        summary: {
            pieceId,
            rotation,
            position,
            clearedRows,
            clearedColumns,
            awardedPieces,
            currentTurnUserId: nextState.currentTurnUserId
        }
    };
}

/**
 * @param {number[][]} board
 * @param {string} pieceId
 * @param {number} rotation
 * @param {{x: number, y: number}} position
 * @returns {Array<{x: number, y: number}>}
 */
export function getPreviewCells(board, pieceId, rotation, position) {
    const pieceCells = getPieceCells(pieceId, rotation);

    if (!canPlacePiece(board, pieceCells, position)) {
        return [];
    }

    return pieceCells.map(([cellX, cellY]) => ({
        x: position.x + cellX,
        y: position.y + cellY
    }));
}

/**
 * @param {number[][]} board
 * @param {string} pieceId
 * @param {number} rotation
 * @param {{x: number, y: number}} position
 * @returns {{x: number, y: number}}
 */
export function clampPosition(board, pieceId, rotation, position) {
    const cells = getPieceCells(pieceId, rotation);
    const bounds = getPieceBounds(cells);

    return {
        x: clamp(position.x, 0, board[0].length - bounds.width),
        y: clamp(position.y, 0, board.length - bounds.height)
    };
}

/**
 * @param {number[][]} board
 * @param {string} pieceId
 * @param {number} rotation
 * @returns {{x: number, y: number} | null}
 */
export function findFirstValidPosition(board, pieceId, rotation) {
    const cells = getPieceCells(pieceId, rotation);
    const bounds = getPieceBounds(cells);

    for (let y = 0; y <= board.length - bounds.height; y += 1) {
        for (let x = 0; x <= board[0].length - bounds.width; x += 1) {
            if (canPlacePiece(board, cells, { x, y })) {
                return { x, y };
            }
        }
    }

    return null;
}

/**
 * @param {number[][]} board
 * @returns {boolean}
 */
export function hasAnyMove(board) {
    return getPieceCatalog().some((piece) =>
        [0, 1, 2, 3].some((rotation) => findFirstValidPosition(board, piece.id, rotation) !== null)
    );
}

/**
 * @param {GamePlayer} player
 * @returns {string}
 */
export function getPlayerUserId(player) {
    return player.userId || player.id;
}

/**
 * @param {string} pieceId
 * @param {number} rotation
 * @returns {Array<[number, number]>}
 */
function getPieceCells(pieceId, rotation) {
    const piece = PIECES[pieceId];

    if (!piece) {
        throw new Error(`Unknown piece: ${pieceId}`);
    }

    let cells = piece.cells.map(([x, y]) => [x, y]);

    for (let step = 0; step < normalizeRotation(rotation); step += 1) {
        cells = rotateCells(cells);
    }

    return normalizeCells(cells);
}

/**
 * @param {Array<[number, number]>} cells
 * @returns {Array<[number, number]>}
 */
function rotateCells(cells) {
    return cells.map(([x, y]) => [-y, x]);
}

/**
 * @param {Array<[number, number]>} cells
 * @returns {Array<[number, number]>}
 */
function normalizeCells(cells) {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));

    return cells.map(([x, y]) => [x - minX, y - minY]);
}

/**
 * @param {number[][]} board
 * @param {Array<[number, number]>} cells
 * @param {{x: number, y: number}} position
 * @returns {boolean}
 */
function canPlacePiece(board, cells, position) {
    return cells.every(([cellX, cellY]) => {
        const x = position.x + cellX;
        const y = position.y + cellY;

        return (
            y >= 0 &&
            y < board.length &&
            x >= 0 &&
            x < board[0].length &&
            board[y][x] === 0
        );
    });
}

/**
 * @param {Array<[number, number]>} cells
 */
function getPieceBounds(cells) {
    const maxX = Math.max(...cells.map(([x]) => x));
    const maxY = Math.max(...cells.map(([, y]) => y));

    return {
        width: maxX + 1,
        height: maxY + 1
    };
}

/**
 * @param {Array<string>} upcomingPieces
 * @param {number} count
 * @returns {Array<string>}
 */
function addAwardedPieces(upcomingPieces, count) {
    const pieces = [];

    for (let index = 0; index < count; index += 1) {
        pieces.push(getRandomPieceId());
    }

    upcomingPieces.push(...pieces);
    return pieces;
}

/**
 * @param {Record<string, PlayerBoardState>} players
 * @returns {Array<string>}
 */
function getActivePlayerIds(players) {
    return Object.keys(players);
}

/**
 * @param {string | null | undefined} currentTurnUserId
 * @param {Array<string>} activePlayerIds
 * @returns {string | null}
 */
function normalizeCurrentTurnUserId(currentTurnUserId, activePlayerIds) {
    if (activePlayerIds.length === 0) {
        return null;
    }

    if (currentTurnUserId && activePlayerIds.includes(currentTurnUserId)) {
        return currentTurnUserId;
    }

    return activePlayerIds[0];
}

/**
 * @param {Array<string>} activePlayerIds
 * @param {string} currentUserId
 * @returns {string | null}
 */
function getNextTurnUserId(activePlayerIds, currentUserId) {
    if (activePlayerIds.length === 0) {
        return null;
    }

    if (activePlayerIds.length === 1) {
        return activePlayerIds[0];
    }

    const currentIndex = activePlayerIds.indexOf(currentUserId);

    if (currentIndex === -1) {
        return activePlayerIds[0];
    }

    return activePlayerIds[(currentIndex + 1) % activePlayerIds.length];
}

/**
 * @param {Array<GamePlayer>} players
 * @param {TetrisGameState} state
 * @returns {TetrisGameState}
 */
function normalizeGameState(state, players) {
    const nextState = cloneGameState(state);

    for (const player of players) {
        const userId = getPlayerUserId(player);

        if (!nextState.players[userId]) {
            nextState.players[userId] = {
                userId,
                name: player.name,
                board: createEmptyBoard(nextState.boardSize),
                upcomingPieces: createUpcomingPieces(),
                linesCleared: 0,
                garbageReceived: 0
            };
        } else {
            nextState.players[userId].name = player.name;
            nextState.players[userId].upcomingPieces = normalizeUpcomingPieces(nextState.players[userId].upcomingPieces);
        }
    }

    const activePlayerIds = players.map((player) => getPlayerUserId(player));
    nextState.currentTurnUserId = normalizeCurrentTurnUserId(nextState.currentTurnUserId, activePlayerIds);

    return nextState;
}

/**
 * @param {unknown} value
 * @returns {value is TetrisGameState}
 */
function isGameState(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        typeof /** @type {TetrisGameState} */ (value).boardSize === "number" &&
        typeof /** @type {TetrisGameState} */ (value).version === "number" &&
        /** @type {TetrisGameState} */ (value).players
    );
}

/**
 * @param {TetrisGameState} state
 * @returns {TetrisGameState}
 */
function cloneGameState(state) {
    return {
        version: state.version,
        boardSize: state.boardSize,
        currentTurnUserId: typeof state.currentTurnUserId === "string" || state.currentTurnUserId === null
            ? state.currentTurnUserId
            : null,
        players: Object.fromEntries(
            Object.entries(state.players).map(([userId, player]) => [
                userId,
                {
                    userId: player.userId,
                    name: player.name,
                    board: player.board.map((row) => [...row]),
                    upcomingPieces: normalizeUpcomingPieces(player.upcomingPieces),
                    linesCleared: player.linesCleared,
                    garbageReceived: player.garbageReceived
                }
            ])
        )
    };
}

/**
 * @param {number} size
 * @returns {number[][]}
 */
function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

/**
 * @returns {Array<string>}
 */
function createUpcomingPieces() {
    const upcomingPieces = [];
    refillUpcomingPieces(upcomingPieces);
    return upcomingPieces;
}

/**
 * @param {unknown} upcomingPieces
 * @returns {Array<string>}
 */
function normalizeUpcomingPieces(upcomingPieces) {
    const normalized = Array.isArray(upcomingPieces)
        ? upcomingPieces.filter((pieceId) => typeof pieceId === "string" && pieceId in PIECES)
        : [];

    refillUpcomingPieces(normalized);
    return normalized;
}

/**
 * @param {Array<string>} upcomingPieces
 */
function refillUpcomingPieces(upcomingPieces) {
    while (upcomingPieces.length < 3) {
        upcomingPieces.push(getRandomPieceId());
    }
}

/**
 * @returns {string}
 */
function getRandomPieceId() {
    const pieceIds = Object.keys(PIECES);
    return pieceIds[Math.floor(Math.random() * pieceIds.length)];
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * @param {number} rotation
 * @returns {number}
 */
function normalizeRotation(rotation) {
    return ((rotation % 4) + 4) % 4;
}

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
 *     linesCleared: number,
 *     garbageReceived: number
 * }} PlayerBoardState
 */

/**
 * @typedef {{
 *     version: number,
 *     boardSize: number,
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
            linesCleared: 0,
            garbageReceived: 0
        };
    }

    return {
        version: 0,
        boardSize: BOARD_SIZE,
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
    const pieceCells = getPieceCells(pieceId, rotation);
    const nextState = cloneGameState(state);
    const actorState = nextState.players[userId];

    if (!actorState) {
        throw new Error("Player not found in game state");
    }

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

    const garbageTargets = [];
    const garbageCount = clearedRows.length + clearedColumns.length;

    if (garbageCount > 0) {
        for (const [targetUserId, targetState] of Object.entries(nextState.players)) {
            if (targetUserId === userId) {
                continue;
            }

            const cells = addRandomGarbage(targetState.board, garbageCount);
            targetState.garbageReceived += cells.length;
            garbageTargets.push({
                targetUserId,
                cells
            });
        }
    }

    nextState.version += 1;

    return {
        nextState,
        summary: {
            pieceId,
            rotation,
            position,
            clearedRows,
            clearedColumns,
            garbageTargets
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
 * @param {number[][]} board
 * @param {number} count
 * @returns {Array<{x: number, y: number}>}
 */
function addRandomGarbage(board, count) {
    const emptyCells = [];

    for (let y = 0; y < board.length; y += 1) {
        for (let x = 0; x < board[y].length; x += 1) {
            if (board[y][x] === 0) {
                emptyCells.push({ x, y });
            }
        }
    }

    shuffle(emptyCells);

    const selected = emptyCells.slice(0, count);

    for (const cell of selected) {
        board[cell.y][cell.x] = 2;
    }

    return selected;
}

/**
 * @param {Array<{x: number, y: number}>} cells
 */
function shuffle(cells) {
    for (let index = cells.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const current = cells[index];
        cells[index] = cells[swapIndex];
        cells[swapIndex] = current;
    }
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
                linesCleared: 0,
                garbageReceived: 0
            };
        } else {
            nextState.players[userId].name = player.name;
        }
    }

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
        players: Object.fromEntries(
            Object.entries(state.players).map(([userId, player]) => [
                userId,
                {
                    userId: player.userId,
                    name: player.name,
                    board: player.board.map((row) => [...row]),
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

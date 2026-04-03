const BOARD_SIZE = 12;

const PIECES = {
    Q: {
        id: "Q",
        label: "Quadratino",
        cells: [
            [0, 0]
        ]
    },
    D: {
        id: "D",
        label: "Domino",
        cells: [
            [0, 0],
            [1, 0]
        ]
    },
    d: {
        id: "d",
        label: "Domino verticale",
        cells: [
            [0, 0],
            [0, 1]
        ]
    },
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
    },
    L: {
        id: "L",
        label: "L",
        cells: [
            [0, 0],
            [0, 1],
            [0, 2],
            [1, 2]
        ]
    },
    J: {
        id: "J",
        label: "J",
        cells: [
            [1, 0],
            [1, 1],
            [1, 2],
            [0, 2]
        ]
    },
    S: {
        id: "S",
        label: "S",
        cells: [
            [1, 0],
            [2, 0],
            [0, 1],
            [1, 1]
        ]
    },
    Z: {
        id: "Z",
        label: "Z",
        cells: [
            [0, 0],
            [1, 0],
            [1, 1],
            [2, 1]
        ]
    },
    U: {
        id: "U",
        label: "U",
        cells: [
            [0, 0],
            [2, 0],
            [0, 1],
            [1, 1],
            [2, 1]
        ]
    },
    P: {
        id: "P",
        label: "P",
        cells: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [0, 2]
        ]
    },
    X: {
        id: "X",
        label: "Croce",
        cells: [
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [1, 2]
        ]
    },
    r: {
        id: "r",
        label: "L ruotata",
        cells: [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 1]
        ]
    },
    t: {
        id: "t",
        label: "T ruotata",
        cells: [
            [0, 0],
            [0, 1],
            [1, 1],
            [0, 2]
        ]
    },
    u: {
        id: "u",
        label: "U ruotata",
        cells: [
            [0, 0],
            [1, 0],
            [0, 1],
            [0, 2],
            [1, 2]
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
 * Restituisce il catalogo semplificato dei pezzi disponibili nel motore.
 * @returns {Array<{id: string, label: string}>}
 */
export function getPieceCatalog() {
    return Object.values(PIECES).map((piece) => ({
        id: piece.id,
        label: piece.label
    }));
}

/**
 * Restituisce le celle di un pezzo gia ruotato, pronte per la renderizzazione.
 * @param {string} pieceId
 * @param {number} [rotation]
 * @returns {Array<[number, number]>}
 */
export function getPieceCellsForRender(pieceId, rotation = 0) {
    return getPieceCells(pieceId, rotation);
}

/**
 * Costruisce lo stato iniziale della partita a partire dai player presenti.
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
            upcomingPieces: createInitialUpcomingPieces(userId),
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
 * Ricostruisce l'ultimo stato valido della partita leggendo le mosse salvate.
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
 * Applica una mossa al game state, aggiorna turni, linee e pezzi disturbo.
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

    const initialResolution = resolveCompletedLines(actorState.board);
    const clearedRows = [...initialResolution.clearedRows];
    const clearedColumns = [...initialResolution.clearedColumns];

    actorState.linesCleared += clearedRows.length + clearedColumns.length;
    actorState.upcomingPieces.splice(upcomingPieceIndex, 1);
    refillUpcomingPieces(actorState.upcomingPieces);

    const garbageTargets = [];
    propagateGarbage(nextState, userId, clearedRows.length + clearedColumns.length, garbageTargets);

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
            garbageTargets,
            currentTurnUserId: nextState.currentTurnUserId
        }
    };
}

/**
 * Calcola le celle di anteprima di un pezzo se la posizione richiesta e valida.
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
 * Riporta la posizione del pezzo entro i limiti disponibili della griglia.
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
 * Cerca la prima posizione valida in cui il pezzo puo essere piazzato.
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
 * Verifica se sulla griglia esiste almeno una mossa disponibile.
 * @param {number[][]} board
 * @returns {boolean}
 */
export function hasAnyMove(board) {
    return getPieceCatalog().some((piece) =>
        [0, 1, 2, 3].some((rotation) => findFirstValidPosition(board, piece.id, rotation) !== null)
    );
}

/**
 * Restituisce l'identificatore logico del player preferendo `userId` quando presente.
 * @param {GamePlayer} player
 * @returns {string}
 */
export function getPlayerUserId(player) {
    return player.userId || player.id;
}

/**
 * Costruisce le coordinate normalizzate del pezzo dopo aver applicato la rotazione richiesta.
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
 * Ruota di 90 gradi il set di celle di un pezzo.
 * @param {Array<[number, number]>} cells
 * @returns {Array<[number, number]>}
 */
function rotateCells(cells) {
    return cells.map(([x, y]) => [-y, x]);
}

/**
 * Trasla le celle del pezzo in modo che partano dall'origine della griglia.
 * @param {Array<[number, number]>} cells
 * @returns {Array<[number, number]>}
 */
function normalizeCells(cells) {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));

    return cells.map(([x, y]) => [x - minX, y - minY]);
}

/**
 * Controlla se tutte le celle del pezzo entrano in griglia senza collisioni.
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
 * Trova righe e colonne complete, le svuota e restituisce quali sono state pulite.
 * @param {number[][]} board
 * @returns {{clearedRows: Array<number>, clearedColumns: Array<number>}}
 */
function resolveCompletedLines(board) {
    const clearedRows = [];
    const clearedColumns = [];

    for (let row = 0; row < board.length; row += 1) {
        if (board[row].every((cell) => cell > 0)) {
            clearedRows.push(row);
        }
    }

    for (let column = 0; column < board[0].length; column += 1) {
        let isFilled = true;

        for (let row = 0; row < board.length; row += 1) {
            if (board[row][column] === 0) {
                isFilled = false;
                break;
            }
        }

        if (isFilled) {
            clearedColumns.push(column);
        }
    }

    for (const row of clearedRows) {
        for (let column = 0; column < board[row].length; column += 1) {
            board[row][column] = 0;
        }
    }

    for (const column of clearedColumns) {
        for (let row = 0; row < board.length; row += 1) {
            board[row][column] = 0;
        }
    }

    return {
        clearedRows,
        clearedColumns
    };
}

/**
 * Propaga i pezzi disturbo sugli avversari in base alle linee appena completate.
 * @param {TetrisGameState} state
 * @param {string} sourceUserId
 * @param {number} garbageCount
 * @param {Array<{targetUserId: string, placements: Array<{pieceId: string, rotation: number, position: {x: number, y: number}}>, clearedRows: Array<number>, clearedColumns: Array<number>}>} garbageTargets
 */
function propagateGarbage(state, sourceUserId, garbageCount, garbageTargets) {
    if (garbageCount <= 0) {
        return;
    }

    for (const [targetUserId, targetState] of Object.entries(state.players)) {
        if (targetUserId === sourceUserId) {
            continue;
        }

        const placements = [];
        const garbageClearedRows = [];
        const garbageClearedColumns = [];

        for (let index = 0; index < garbageCount; index += 1) {
            const placedPiece = addRandomGarbagePiece(targetState.board);

            if (!placedPiece) {
                break;
            }

            placements.push(placedPiece);
            const resolvedLines = resolveCompletedLines(targetState.board);

            if (resolvedLines.clearedRows.length > 0 || resolvedLines.clearedColumns.length > 0) {
                garbageClearedRows.push(...resolvedLines.clearedRows);
                garbageClearedColumns.push(...resolvedLines.clearedColumns);
                targetState.linesCleared += resolvedLines.clearedRows.length + resolvedLines.clearedColumns.length;
                propagateGarbage(
                    state,
                    targetUserId,
                    resolvedLines.clearedRows.length + resolvedLines.clearedColumns.length,
                    garbageTargets
                );
            }
        }

        targetState.garbageReceived += placements.length;
        garbageTargets.push({
            targetUserId,
            placements,
            clearedRows: garbageClearedRows,
            clearedColumns: garbageClearedColumns
        });
    }
}

/**
 * Calcola larghezza e altezza minime necessarie a contenere un pezzo.
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
 * Inserisce casualmente un pezzo disturbo in una posizione valida della griglia.
 * @param {number[][]} board
 * @returns {{pieceId: string, rotation: number, position: {x: number, y: number}} | null}
 */
function addRandomGarbagePiece(board) {
    const candidates = [];

    for (const pieceId of Object.keys(PIECES)) {
        for (let rotation = 0; rotation < 4; rotation += 1) {
            const cells = getPieceCells(pieceId, rotation);
            const bounds = getPieceBounds(cells);

            for (let y = 0; y <= board.length - bounds.height; y += 1) {
                for (let x = 0; x <= board[0].length - bounds.width; x += 1) {
                    const position = { x, y };

                    if (canPlacePiece(board, cells, position)) {
                        candidates.push({
                            pieceId,
                            rotation,
                            position,
                            cells
                        });
                    }
                }
            }
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    for (const [cellX, cellY] of selected.cells) {
        board[selected.position.y + cellY][selected.position.x + cellX] = 2;
    }

    return {
        pieceId: selected.pieceId,
        rotation: selected.rotation,
        position: selected.position
    };
}

/**
 * Restituisce gli id dei player ancora presenti nello stato della partita.
 * @param {Record<string, PlayerBoardState>} players
 * @returns {Array<string>}
 */
function getActivePlayerIds(players) {
    return Object.keys(players);
}

/**
 * Normalizza il turno corrente assicurando che punti a un player ancora attivo.
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
 * Calcola a chi passa il turno dopo la mossa del player corrente.
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
 * Allinea uno stato salvato ai player attuali, aggiungendo eventuali board mancanti.
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
                upcomingPieces: createInitialUpcomingPieces(userId),
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
 * Verifica in modo leggero se un valore ha la forma minima di uno stato Tetris.
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
 * Clona profondamente lo stato di gioco per applicare modifiche senza mutare l'originale.
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
 * Crea una griglia quadrata vuota della dimensione richiesta.
 * @param {number} size
 * @returns {number[][]}
 */
function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

/**
 * Genera una nuova coda casuale di pezzi con la lunghezza minima richiesta dal gioco.
 * @returns {Array<string>}
 */
function createUpcomingPieces() {
    const upcomingPieces = [];
    refillUpcomingPieces(upcomingPieces);
    return upcomingPieces;
}

/**
 * Genera una coda iniziale deterministica per un player cosi da avere sempre
 * gli stessi primi pezzi prima che esista una mossa persistita.
 * @param {string} seed
 * @returns {Array<string>}
 */
function createInitialUpcomingPieces(seed) {
    const pieceIds = Object.keys(PIECES);
    const upcomingPieces = [];
    let cursor = Math.abs(hashString(seed));

    while (upcomingPieces.length < 3) {
        upcomingPieces.push(pieceIds[cursor % pieceIds.length]);
        cursor = Math.floor(cursor / pieceIds.length) + 1;
    }

    return upcomingPieces;
}

/**
 * Filtra una coda di pezzi non valida e la completa fino alla lunghezza minima.
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
 * Aggiunge pezzi casuali finche la coda non contiene almeno tre elementi.
 * @param {Array<string>} upcomingPieces
 */
function refillUpcomingPieces(upcomingPieces) {
    while (upcomingPieces.length < 3) {
        upcomingPieces.push(getRandomPieceId());
    }
}

/**
 * Estrae casualmente l'id di un pezzo dal catalogo disponibile.
 * @returns {string}
 */
function getRandomPieceId() {
    const pieceIds = Object.keys(PIECES);
    return pieceIds[Math.floor(Math.random() * pieceIds.length)];
}

/**
 * Calcola un hash numerico stabile a partire da una stringa.
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index);
        hash |= 0;
    }

    return hash;
}

/**
 * Limita un numero all'interno dell'intervallo indicato.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Normalizza la rotazione nel range da 0 a 3.
 * @param {number} rotation
 * @returns {number}
 */
function normalizeRotation(rotation) {
    return ((rotation % 4) + 4) % 4;
}

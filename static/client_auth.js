/**
 * @typedef {Object} user - User data
 * @property {string} user.id - ID of the user
 * @property {string} user.username - Name of the user
 * @property {string} user.apiKey - Api key of the user
 * @property {string} user.createdAt - Timestamp of the creation of the user
 */

/**
 * @typedef {Object} game - Game data
 * @property {string} game.id - ID of the game
 * @property {string} game.name - Name of the game
 * @property {string} game.ownerId - Owner of the game
 * @property {Array<string>} game.players - List of the player in the game
 * @property {Array<string>} game.moves - List of the move in the game
 * @property {string} game.status - Status of the game
 * @property {string} game.createdAt - Timestamp of the creation of the game
 * @property {string} game.updatedAt - Timestamp of the update of the game
 */

/**
 * @typedef {Object} gamePlayer - Player data inside a game
 * @property {string} gamePlayer.id - ID of the player in the game
 * @property {string} gamePlayer.name - Display name of the player in the game
 * @property {string} gamePlayer.joinedAt - Timestamp of when the player joined
 */

/**
 * @typedef {Object} gameMove - Move data
 * @property {string} gameMove.id - ID of the move
 * @property {string} gameMove.playerId - ID of the player who made the move
 * @property {Record<string, unknown>} gameMove.data - Payload of the move
 * @property {string} gameMove.timestamp - Timestamp of when the move was recorded
 */

/**
 * Rappresents a player in the game system.
 * Automatically registers the player upon creation, manages the api key and provides methods for game creation, listing and joining.
 *
 * @example
 * const player = new Player("Maheeh");
 * await player.createGame();
 */
export class Player {
    /**
     * @type {string}
     */
    #name_player;

    /**
     * @type {Promise<void>}
     */
    #ready;

    /**
     * @type {user}
     */
    // @ts-ignore
    #player_information;

    /**
     * Create and register a new player
     * @param {string} name name of the player
     */
    constructor(name) {
        this.#name_player = name;
        this.#ready = this.#register()
            .then(user => {
                this.#player_information = user;
            })
            .catch(err => {
                throw new Error(err.message);
            });
    }

    /**
     * Get the name of the player
     * @returns {string}
     */
    getName() {
        return this.#name_player;
    }

    /**
     * Wait until the player registration has completed
     * @returns {Promise<user>}
     */
    async waitUntilReady() {
        await this.#ensureReady();
        return this.getProfile();
    }

    /**
     * Get the registered player information
     * @returns {user}
     */
    getProfile() {
        if (!this.#player_information) {
            throw new Error("[ERROR] Player information is not initialized");
        }

        return { ...this.#player_information };
    }

    /**
     * Get the api key
     * @returns {string}
     */
    #getApiKey() {
        if (!this.#player_information || !this.#player_information.apiKey) {
            throw new Error("[ERROR] API key is not initialized");
        }

        return this.#player_information.apiKey;
    }

    /**
     * Wait until the player registration has completed
     * @returns {Promise<void>}
     */
    async #ensureReady() {
        await this.#ready;
    }

    /**
     * Register the user
     * @returns {Promise<user>} information of the player
     */
    async #register() {
        const response = await fetch("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "username": this.getName()
            })
        });

        if (!response.ok) {
            let errorMessage = "Registration failed";

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        /**
         * @type {{message: string, user: user}}
         */
        const data = await response.json();
        return data.user;
    }

    /**
     * Execute an authenticated API request and normalize error handling.
     * @template T
     * @param {string} path
     * @param {RequestInit} [options]
     * @returns {Promise<T>}
     */
    async #request(path, options = {}) {
        await this.#ensureReady();

        const response = await fetch(path, {
            ...options,
            headers: {
                "X-API-Key": this.#getApiKey(),
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            let errorMessage = "Request failed";

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        if (response.status === 204) {
            return /** @type {T} */ (undefined);
        }

        return /** @type {Promise<T>} */ (response.json());
    }

    /**
     * Create a game
     * @param {string} name_game name of the game
     * @returns {Promise<{message: string, game: game}>}
     */
    async createGame(name_game) {
        return this.#request("/games", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": name_game
            })
        });
    }

    /**
     * Show a list of games
     * @returns {Promise<Array<game>>}
     */
    async listGame() {
        const data = await this.#request("/games", {
            method: "GET",
        });

        return data.games;
    }

    /**
     * Get a game
     * @param {string} game_id game id
     * @returns {Promise<game>}
     */
    async getGame(game_id) {
        /**
         * @type {{game: game}}
         */
        const data = await this.#request(`/games/${game_id}`, {
            method: "GET"
        });

        return data.game;
    }

    /**
     * Update the game
     * @param {string} game_id game id
     * @param {string} new_name set new name of the game
     * @param {string} new_status set new status (active / inactive)
     * @returns {Promise<game>}
     */
    async updateGame(game_id, new_name, new_status) {
        /**
         * @type {{game: game}}
         */
        const data = await this.#request(`/games/${game_id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": new_name,
                "status": new_status
            })
        });

        return data.game;
    }

    /**
     * Delete a game
     * @param {string} game_id game id
     * @returns {Promise<string>}
     */
    async deleteGame(game_id) {
        const data = await this.#request(`/games/${game_id}`, {
            method: "DELETE"
        });

        return data;
    }

    /**
     * Add a player to a game.
     * @param {string} game_id
     * @param {string} player_name
     * @returns {Promise<{message: string, player: gamePlayer}>}
     */
    async addPlayerToGame(game_id, player_name) {
        return this.#request(`/games/${game_id}/players`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": player_name
            })
        });
    }

    /**
     * Get all players for a game.
     * @param {string} game_id
     * @returns {Promise<Array<gamePlayer>>}
     */
    async getGamePlayers(game_id) {
        const data = await this.#request(`/games/${game_id}/players`, {
            method: "GET"
        });

        return data.players;
    }

    /**
     * Remove a player from a game.
     * @param {string} game_id
     * @param {string} player_id
     * @returns {Promise<{message: string}>}
     */
    async removePlayerFromGame(game_id, player_id) {
        return this.#request(`/games/${game_id}/players/${player_id}`, {
            method: "DELETE"
        });
    }

    /**
     * Add a move to a game.
     * @param {string} game_id
     * @param {string} player_id
     * @param {Record<string, unknown>} move_data
     * @returns {Promise<{message: string, move: gameMove}>}
     */
    async addMoveToGame(game_id, player_id, move_data) {
        return this.#request(`/games/${game_id}/moves`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "playerId": player_id,
                "data": move_data
            })
        });
    }

    /**
     * Get all moves for a game.
     * @param {string} game_id
     * @returns {Promise<Array<gameMove>>}
     */
    async getGameMoves(game_id) {
        const data = await this.#request(`/games/${game_id}/moves`, {
            method: "GET"
        });

        return data.moves;
    }

    /**
     * Get a single move for a game.
     * @param {string} game_id
     * @param {string} move_id
     * @returns {Promise<gameMove>}
     */
    async getGameMove(game_id, move_id) {
        const data = await this.#request(`/games/${game_id}/moves/${move_id}`, {
            method: "GET"
        });

        return data.move;
    }
}
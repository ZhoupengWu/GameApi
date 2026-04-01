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
 * Rappresents a player in the game system.
 * Automatically registers the player upon creation, manages the api key and provides methods for game creation, listing and joining.
 *
 * @example
 * const player = new Player("Maheeh");
 * await player.createGame();
 */
class Player {
    /**
     * @type {string}
     */
    #name_player;

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
        this.#register()
            .then(user => {
                this.#player_information = user;
            })
            .catch(err => {
                throw new Error(`[ERROR] ${err}`);
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
     * Get the api key
     * @returns {string}
     */
    #getApiKey() {
        if (!this.#player_information.apiKey) {
            throw new Error("[ERROR] API key is not initialized");
        }

        return this.#player_information.apiKey;
    }

    /**
     * Register the user
     * @returns {Promise<user>} information of the player
     */
    async #register() {
        const response = await fetch("http://127.0.0.1:3000/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "username": this.getName()
            })
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {{message: string, user: user}}
         */
        const data = await response.json();
        console.log(data.user);

        return data.user;
    }

    /**
     * Create a game
     * @param {string} name_game name of the game
     * @returns {Promise<{message: string, game: game}>}
     */
    async createGame(name_game) {
        const response = await fetch("/games", {
            method: "POST",
            headers: {
                "X-API-Key": this.#getApiKey(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": name_game
            })
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {{message: string, game: game}}
         */
        const data = await response.json();

        return data;
    }

    /**
     * Show a list of games
     * @returns {Promise<Array<game>>}
     */
    async listGame() {
        const response = await fetch("/games", {
            method: "GET",
            headers: {
                "X-API-Key": this.#getApiKey(),
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {{count: number, games: Array<game>}}
         */
        const data = await response.json();

        return data.games;
    }

    /**
     * Get a game
     * @param {string} game_id game id
     * @returns {Promise<game>}
     */
    async getGame(game_id) {
        const response = await fetch(`/games/${game_id}`, {
            method: "GET",
            headers: {
                "X-API-Key": this.#getApiKey(),
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {{game: game}}
         */
        const data = await response.json();

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
        const response = await fetch(`/games/${game_id}`, {
            method: "PUT",
            headers: {
                "X-API-Key": this.#getApiKey(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": new_name,
                "status": new_status
            })
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {{message: string, game: game}}
         */
        const data = await response.json();

        return data.game;
    }

    /**
     * Delete a game
     * @param {string} game_id game id
     * @returns {Promise<string>}
     */
    async deleteGame(game_id) {
        const response = await fetch(`/games/${game_id}`, {
            method: "DELETE",
            headers: {
                "X-API-Key": this.#getApiKey(),
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`[ERROR] ${response}`);
        }

        /**
         * @type {string} successful or error message
         */
        const data = await response.json();

        return data;
    }
}

const player1 = new Player("Alessia");
const game = player1.createGame("lotto");
game.then((data) => {
    console.log(data);
}).catch((err) => {
    console.error(err);
});
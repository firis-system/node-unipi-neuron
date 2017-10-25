"use strict";

let EventEmitter = require("events").EventEmitter;
let Board        = require("./Board");
let RtuConnection = require("./RtuConnection");
let TcpConnection = require("./TcpConnection");

/**
 * The board managers initiates boards based on the given config.
 */
class BoardManager extends EventEmitter {

    /**
     * Constructor
     *
     * @param {[{}]} config
     *   Each object should contain these properties:
     *     - name: 'local' (Defaults to local, but should be something different if there is more than one board)
     *     - type: 'tcp' or 'rtu'
     *     - ip: '127.0.0.1' (if type is tcp)
     *     - port: '502' (if type is tcp)
     *     - socket: '/dev/extcomm/0/0' (if type is socket)
     *     - id: 15 (if type is socket)
     *     - groups: 3 (Normally 1 for S type and extension boards, 2 for M type boards and 3 for L type boards)
     *     - interval: 100 (The interval in milliseconds at which to update the board values)
     */
    constructor (config) {
        super();
        this.boards = {};

        for (let i = 0; i < config.length; i++) {
            this.init(config[i]);
        }
    }

    /**
     * Initiates a single board
     *
     * @param {{}} config
     *   A single object from the constructor config array.
     */
    init(config) {
        let self = this;
        let name = 'local';
        let id = 0;
        let connection = {};

        if (config.name) {
            name = config.name;
        }
        if (config.id) {
            id = config.id;
        }

        // Switch between tcp and rtu connections.
        switch (config.type) {
            case 'tcp':
                connection = new TcpConnection(config.ip, config.port);
                break;

            default:
                connection = new RtuConnection(config.socket);
        }

        // Create a new board
        let board = new Board(connection, id, config.groups);

        // Update the board values according to the config interval.
        setInterval(function() {
            board.update();
        }, config.interval);

        // Forward the board update event.
        board.on('update', function (id, value) {
            self.emit('update', name + '-' + id, value);
        });

        // Add the board to the boards variable for later reference.
        this.boards[name] = board;
    }

    /**
     * Convert a given string id to an id object with a board name and io id.
     *
     * @param id
     *   e.g. local-DO1.1
     * @returns {{}}
     */
    id (id) {
        let result = {};
        let arr = id.split('-');
        result.board = arr[0];
        result.id = arr[1];
        return result;
    }

    /**
     * Set an io to the given value
     *
     * @param id
     *   e.g. local-DO1.1
     * @param {boolean} value
     */
    set (id, value) {
        id = this.id(id);
        this.boards[id.board].set(id.id, value);
    }

    /**
     * Get the value of the given io id.
     *
     * @param id
     *   e.g. local-DO1.1
     */
    get (id) {
        id = this.id(id);
        return this.boards[id.board].get(id.id);
    }

    /**
     * Gets all io's in all initiated boards.
     *
     * @returns {{}}
     */
    getAll () {
        let data = {};
        for (let name in this.boards) {
            if (this.boards.hasOwnProperty(name)) {
                for (let id in this.boards[name].data) {
                    if (this.boards[name].data.hasOwnProperty(id)) {
                        data[name + '-' + id] = this.boards[name].data[id];
                    }
                }
            }
        }
        return data;
    }

}

module.exports = BoardManager;
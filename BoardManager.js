"use strict";

const EventEmitter = require("events").EventEmitter;
const Board = require("./Board");
const Neuron = require('./Neuron');

const debug = require('debug');
const info = debug('unipi-boards:boards:info');
const warn = debug('unipi-boards:boards:warn');
const log = debug('unipi-boards:boards:log');
const error = debug('unipi-boards:boards:error');

/**
 * The board managers initiates boards based on the given config.
 * 
 * @class BoardManager
 * @extends {EventEmitter}
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
    constructor(config) {
        super();
        this.boards = {};

        if (config == null || config.length === 0) {
            config = [{}];
        }

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
        config.interval = config.interval || 10;
        config.id = config.id || 0;
        if (config.id === 0) config.name = config.name || 'local';
        else config.name = config.name || config.id.toString();
        config.type = config.type || 'tcp';

        let name = config.name;
        let id = config.id;

        // Create a new board
        let board = new Board(config);

        // Forward the board update event.
        board.on('update', (id, value) => {
            this.emit('update', name + '-' + id, value);
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
    id(id) {
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
    set(id, value) {
        id = this.id(id);
        this.boards[id.board].set(id.id, value);
    }

    /**
     * Get the value of the given io id.
     *
     * @param id
     *   e.g. local-DO1.1
     */
    getState(id) {
        id = this.id(id);
        try {
            return this.boards[id.board].getState(id.id);
        } catch (err) {
            error('Bad board address');
            return {
                "error": 'Bad board address'
            };
        }
    }

    /**
     * Get the value of the given io id.
     *
     * @param id
     *   e.g. local-DI1.1
     */
    getCount(id) {
        id = this.id(id);
        try {
            return this.boards[id.board].getCount(id.id);
        } catch (err) {
            error('Bad board address');
            return {
                "error": 'Bad board address'
            };
        }
    }

    /**
     * Gets all io's in all initiated boards.
     *
     * @returns {{}}
     */
    getAllStates() {
        let data = {};
        for (let name in this.boards) {
            if (this.boards.hasOwnProperty(name)) {
                for (let id in this.boards[name].state) {
                    if (this.boards[name].state.hasOwnProperty(id)) {
                        data[name + '-' + id] = this.boards[name].state[id];
                    }
                }
            }
        }
        return data;
    }

    /**
     * Gets all io's in all initiated boards.
     *
     * @returns {{}}
     */
    getAllCounts() {
        let data = {};
        for (let name in this.boards) {
            if (this.boards.hasOwnProperty(name)) {
                for (let id in this.boards[name].counter) {
                    if (this.boards[name].counter.hasOwnProperty(id)) {
                        data[name + '-' + id] = this.boards[name].counter[id];
                    }
                }
            }
        }
        return data;
    }

}

module.exports = BoardManager;
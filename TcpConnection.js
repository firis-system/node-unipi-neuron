"use strict";

let ModbusRTU = require("modbus-serial");

/**
 * A TCP connection.
 */
class TcpConnection extends ModbusRTU {

    /**
     * Constructor
     *
     * @param {string} ip
     * @param {int} port
     */
    constructor (ip, port) {
        super();
        this.ip = ip || "127.0.0.1";
        this.port = port || 502;
    }

    /**
     * Connect over TCP.
     *
     * @param callback
     */
    connect (callback) {
        this.connectTCP(this.ip, { port: this.port }).then(function () {
            callback();
        });
    }
}

module.exports = TcpConnection;

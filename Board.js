"use strict";

const EventEmitter = require('events').EventEmitter;
const Neuron = require('./Neuron');
const RtuConnection = require("./RtuConnection");
const TcpConnection = require("./TcpConnection");
const math = require('mathjs');

const debug = require('debug');
const info = debug('unipi-neuron:board:info');
const warn = debug('unipi-neuron:board:warn');
const log = debug('unipi-neuron:board:log');
const error = debug('unipi-neuron:board:error');

/**
 * Modbus exceptions codes
 */

const MODBUS_ERRNO = {
    0x01: "Illegal Function",
    0x02: "Illegal Data Address",
    0x03: "Illegal Data Value",
    0x04: "Failure In Associated Device",
    0x05: "Acknowledge",
    0x06: "Busy, Rejected Message",
    0x07: "NAK – Negative Acknowledgement",
    0x08: "Memory Parity Error",
    0x0A: "Gateway Path Unavailable",
    0x0B: "Gateway Target Device Failed to respond"
};

/**
 * Represents a single board.
 * 
 * @class Board
 * @extends {EventEmitter}
 */
class Board extends EventEmitter {

    /**
     * Create a single board.
     *
     * @param config.type
     *   A TCP or RTU connection type.
     * @param config.id
     *   The board id to connect to.
     * @param config.groups
     *   The number of groups.
     * @param config.
     */
    constructor(config) {
        super();

        config.interval = config.interval || 10;
        config.id = config.id || 0;
        if (config.id === 0) config.name = config.name || 'local';
        else config.name = config.name || config.id.toString();
        config.type = config.type || 'tcp';

        // Switch between tcp and rtu connections.
        switch (config.type) {
            case 'tcp':
                config.port = config.port || 502;
                config.ip = config.ip || '127.0.0.1';
                this.client = new TcpConnection(config.ip, config.port);
                break;

            default:
                config.socket = config.socket || '/dev/extcomm/0/0';
                this.client = new RtuConnection(config.socket);
        }

        const name = config.name;
        const id = config.id;
        const client = this.client;
        let groups = config.groups;

        this.state = {};
        this.counter = {};
        this.groups = [];
        this.id = id || 0;
        this.name = name || 'local';

        // try to guess neuron model and set the config.groups accordinaly
        if (client.port && id === 0) {
            const neuron = Neuron.getNeuronProperties();
            if (neuron && neuron.model) {
                this.model = neuron.model;
                groups = neuron.model.groups;
            }
        }

        // Connect to the board.
        this.client.connect(() => {
            this.client.setID(id);

            // Read board possibilities
            for (let i = 0; i < groups; i++) {
                // We can read the input and output capabilities of group one on register 1001, for group two on 1101
                // and so on.
                let start = 1001 + (i * 100);
                this.client.readHoldingRegisters(start, 2)
                    .then(data => {
                        let bin = this.dec2bin(data.data[0]);
                        /// Cannot calc AO AI and SERIAL numbers, unknown bitwise operation to apply to modbus reading ???
                        /// TODO: better parsing hw_definitions files from evok !
                        //let ext = this.dec2bin(data.data[1]);
                        // On first register adress : first eight bits are for the input number, second eight bits are for the output number.
                        // On second register address : first four bits are for the serial port number, second four bits are for the analog input number, third eight bits are for the analog output number.
                        this.groups[i] = {
                            'id': (i + 1),
                            'di': (parseInt(bin.slice(0, 8), 2)),
                            'do': (parseInt(bin.slice(8, 16), 2)),
                            //'ao': (parseInt(ext.slice(4, 8), 2)),
                            //'ai': (parseInt(ext.slice(8, 16), 2)),
                            //'serial': (parseInt(ext.slice(0, 4), 2)),
                        };
                        // Add fixed registers
                        if (id === 0 && i === 0) {
                            // for main board
                            this.groups[0].led = 4;
                            this.groups[0].ai = 1;
                            this.groups[0].ao = 1;
                        }
                    })
                    .catch(err => {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, ref: pins enums, register: ${start}, length: 2)`);
                        else error(err);
                    });
            }

            // Update the board state according to the config interval.
            this.updateStateLoopId = setInterval(() => {
                this.updateState();
            }, config.interval);

            // Update the board count according to the config interval (times five).
            this.updateCountLoopId = setInterval(() => {
                this.updateCount();
            }, (config.interval * 5));

        });
    }

    /**
     * Validate that the given id is known to this board.
     *
     * @param id
     *   e.g. local-DO1.1
     */
    validate(id) {
        if (this.getState(id) === undefined) {
            throw new SyntaxError('Unknown ID: ' + id);
        }
    }

    /**
     * Get the value of the given io id.
     *
     * @param id
     *   e.g. DO1.1
     */
    getState(id) {
        return this.state[id];
    }

    /**
     * Get the value of the given DI id.
     *
     * @param id
     *   e.g. DI1.1
     */
    getCount(id) {
        return this.counter[id];
    }

    /**
     * Set an io to the given value
     *
     * @param id
     *   e.g. local-DO1.1
     * @param {boolean} value
     * @param {int} retries
     *   Used internally to check how many retries have been tried.
     */
    set(id, value) {
        this.validate(id);

        let arr = id.split('.');
        let group = parseInt(arr[0].substr(arr[0].length - 1, 1));
        let num = arr[1];
        arr = arr[0].split('-');
        let pin = arr[0];
        let type = pin.substring(0, pin.length - 1).toLowerCase();
        let coilId;
        let registerId;

        // set coilId
        if (type === 'di') {
            info('Cannot set state on digital input');
            return;
        } else if (type === 'ai') {
            info('Cannot set state on analog input');
            return;
        } else if (type === 'do') {
            coilId = (group - 1) * 100 + (num - 1);
            this._writeCoil(coilId, id, value);
        } else if (type === 'led' && group === 1) {
            coilId = this.groups[0].do + this.groups[0].di + (num - 1);
            this._writeCoil(coilId, id, value);
        } else if (type === 'ao') {
            // TODO: get AO register and set via _writeRegister()
            //registerId = num;
            //this._writeRegister(registerId, id, value);
        }
    }

    _writeRegister(registerId, id, value, retries = 0) {
        this.client.writeRegister(registerId, value)
            .catch(err => {
                warn(`Cannot write ${value} to register ${registerId} (pin: ${id}) on board ${this.name}`);
                const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                if (errdesc) error(`ModBus::writeRegister Error: ${errdesc} (board: ${this.name}, ref: ${id}, register: ${registerId}, value: ${value})`);
                else error(err);
            });

        // Writing can sometimes fail, especially on boards connected over a (bad) UART connection. Validating the write
        // and retrying the write after a small delay mitigates the problem.
        if (retries < 5) {
            setTimeout(() => {
                if (this.getState(id) != value) {
                    retries++;
                    console.log('Retry (' + retries + ')');
                    this._writeRegister(registerId, id, value, retries);
                }
            }, (100 * (retries + 1)));
        }
    }

    /**
     * Actual write to the board DOs and LEDs.
     * 
     * @param {any} coilId 
     * @param {any} value 
     * @memberof Board
     */
    _writeCoil(coilId, id, value, retries = 0) {
        this.client.writeCoil(coilId, value)
            .catch(err => {
                warn(`Cannot write ${value} to coil ${coilId} (pin: ${id}) on board ${this.name}`);
                const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                if (errdesc) error(errdesc);
                else error(`ModBus::writeCoil Error: ${errdesc} (board: ${this.name}, ref: ${id}, coil: ${coilId}, value: ${value})`);
            });

        // Writing can sometimes fail, especially on boards connected over a (bad) UART connection. Validating the write
        // and retrying the write after a small delay mitigates the problem.
        if (retries < 5) {
            setTimeout(() => {
                if (this.getState(id) != value) {
                    retries++;
                    console.log('Retry (' + retries + ')');
                    this._writeCoil(coilId, id, value, retries);
                }
            }, (100 * (retries + 1)));
        }
    }

    /**
     * Convert the given decimal value to a 16bit binary string.
     *
     * @param dec
     * @returns {string}
     */
    dec2bin(dec) {
        // Convert decimal string to binary.
        let bin = parseInt(dec, 10).toString(2);
        // Pad to a 16bit binary number.
        return ('0000000000000000' + bin.toString()).slice(-16);
    }

    /**
     * Convert and store the given group array data in the data variable for DI/DO.
     *
     * @param prefix
     *   The io prefix (e.g. DO, DI ...)
     * @param value
     *   The value array from readHoldingRegisters
     * @param length
     *   The length of the io group, defaults to 16.
     */
    storeDigitalState(prefix, value, length = 16) {
        const bin = this.dec2bin(value);

        // Convert to an array and reverse the values (first bit -> first value)
        const arr = bin.split('').reverse();

        for (let i = 0; i < length; i++) {
            const id = prefix + '.' + (i + 1);
            const value = parseInt(arr[i]);
            const currentValue = this.getState(id);
            if (currentValue !== value) {
                this.state[id] = value;
                if (currentValue !== undefined) {
                    this.emit('update', id, value.toString());
                }
            }
        }
    }

    /**
     * Convert and store the given group analogue data in the data variable for AI/AO.
     * 
     * @param {any} prefix 
     * @param {any} group 
     * @param {any} id 
     * @param {any} value 
     * @memberof Board
     */
    storeAnalogueState(prefix, group, id, value) {
        let mode = 0;
        let vref = 0;
        let vrefInt = 0;
        let offset = 0;
        let dev = 0;

        if (group === 1) {
            // Get mode (3 = resistance, 1 = current, 0 = voltage)
            let catched = false;
            this.client.readHoldingRegisters(1019, 1)
                .then(data => {
                    mode = data.data[0];
                    // Get Vref
                    return this.client.readHoldingRegisters(1009, 1);
                })
                .catch(err => {
                    const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                    if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, ref: vref, register: 1019, length: 1)`);
                    else error(err);
                    catched = true;
                })
                .then(data => {
                    vref = data.data[0];
                    // Get vrefInt
                    return this.client.readHoldingRegisters(5, 1);
                })
                .catch(err => {
                    if (catched === false) {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, ref: vrefInt, register: 5, length: 1)`);
                        else error(err);
                        catched = true;
                    }
                })
                .then(data => {
                    vrefInt = data.data[0];
                    // Get offest and deviation
                    if (mode !== 1) {
                        return this.client.readHoldingRegisters(1020 + ((prefix === 'AO') ? 0 : 5), 2);
                    } else if (mode === 1 && group === 1) {
                        return this.client.readHoldingRegisters(1022 + ((prefix === 'AO') ? 0 : 5), 2);
                    }
                })
                .catch(err => {
                    if (catched === false) {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, ref=${prefix}.${group}.${id} register: ${((mode !==1) ? 1020: 1022) + ((prefix === 'AO') ? 0 : 5)}, length: 2)`);
                        else error(err);
                        catched = true;
                    }
                })
                .then(data => {
                    dev = data.data[0];
                    offset = data.data[1];
                    // Calc result (Neuron technical manual p.16)
                    const result = math.round(
                        (3.3 * (vref / vrefInt)) *
                        ((mode === 0) ? 3 : (mode === 1) ? 10 : 1) *
                        (value / 4096) *
                        (1 + (dev / 10000)) + (offset / 1000), 2);
                    const currentValue = this.getState(id);
                    if (currentValue !== result) {
                        this.state[`${prefix}${group}.${id}`] = result;
                        if (currentValue !== undefined) {
                            this.emit('update', id, result);
                        }
                    }
                })
                .catch(err => {
                    if (catched === false) {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, register: ${start}, length: 2)`);
                        else error(err);
                    }
                });
        } else {
            // TODO : check if there are no binary operation to convert the actual value
            if (prefix === 'AO') {
                // convert to real value (Neuron technical manual p.18)
                value = value / 4000 * 10;
            }
            const currentValue = this.getState(id);
            if (currentValue !== value) {
                this.state[`${prefix}${group}.${id}`] = value;
                if (currentValue !== undefined) {
                    this.emit('update', id, value);
                }
            }

        }
    }

    /**
     * Update the board io states by reading the holding registers.
     */
    updateState() {
        for (let i = 0; i < this.groups.length; i++) {
            let group = this.groups[i];
            let start = (group.id - 1) * 100;
            // Read DI and DO states
            this.client.readHoldingRegisters(start, 2)
                .then(data => {
                    this.storeDigitalState('DI' + group.id, data.data[0], group.di);
                    this.storeDigitalState('DO' + group.id, data.data[1], group.do);
                })
                .catch(err => {
                    const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                    if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, register: ${start}, length: 2)`);
                    else error(err);
                });
            // Read LED states
            if (group.id === 1) {
                this.client.readHoldingRegisters(20, 1)
                    .then(data => {
                        this.storeDigitalState('LED' + group.id, data.data[0], group.led);
                    })
                    .catch(err => {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, register: 20, length: 1)`);
                        else error(err);
                    });
            }
            // Read AO and AI states (only on group 1 and not x5xx series for now)
            if (group.id === 1) {
                this.client.readHoldingRegisters(2, 2)
                    .then(data => {
                        this.storeAnalogueState('AO', group.id, 1, data.data[0]);
                        this.storeAnalogueState('AI', group.id, 1, data.data[1]);
                    })
                    .catch(err => {
                        const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                        if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, register: 2, length: 2)`);
                        else error(err);
                    });
            }
        }
    }

    /**
     * Update the board io states by reading the holding registers.
     */
    updateCount() {
        // Look for a better way of determining these.
        let countStart = [8, 103, 203];

        for (let i = 0; i < this.groups.length; i++) {
            let group = this.groups[i];
            // Read DI counters
            this.client.readHoldingRegisters(countStart[i], (group.di * 2))
                .then(data => {
                    for (let j = 0; j < group.di; j++) {
                        let id = 'DI' + group.id + '.' + (j + 1);
                        // Counters are stored over two words.
                        this.counter[id] = data.data[j * 2] + data.data[j * 2 + 1];
                    }
                })
                .catch(err => {
                    const errdesc = MODBUS_ERRNO[parseInt(err.message.split(' ').pop())];
                    if (errdesc) error(`ModBus::readHoldingRegisters Error: ${errdesc} (board: ${this.name}, register: ${countStart[i]}, length: ${group.di * 2})`);
                    else error(err);
                });
        }
    }

    static getNeuronProperties() {
        return Neuron.getNeuronProperties();
    }

}

module.exports = Board;
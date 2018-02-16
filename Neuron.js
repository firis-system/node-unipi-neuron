"use strict";

const os = require('os');
const fs = require('fs');

const debug = require('debug');
const info = debug('unipi-neuron:neuron:info');
const warn = debug('unipi-neuron:neuron:warn');
const log = debug('unipi-neuron:neuron:log');
const error = debug('unipi-neuron:neuron:error');

/**
 * Unipi Neuron models family
 */
const NEURON_MODELS_FAMILY = {
    'S': 0,
    'M': 2,
    'L': 3
};

const getNeuronProperties = (ref, config) => {
    const neuron = ref || {};
    neuron.model = {};
    try {
        const eeprom = fs.readFileSync('/sys/class/i2c-dev/i2c-1/device/1-0057/eeprom');
        if (eeprom.length === 128 && String.fromCharCode(eeprom[96], eeprom[97]) === '\xfa\x55') {
            neuron.model.version = `${eeprom[99]}.${eeprom[98]}`;
            neuron.model.type = eeprom.slice(106, 110).toString();
            const endianness = os.endianness();
            const binary_sn = eeprom.slice(100, 104);
            neuron.model.serial = '0x' + ((endianness === 'LE') ? binary_sn.readInt32LE(0) : binary_sn.readInt32BE(0)).toString(16);
            neuron.groups = NEURON_MODELS_FAMILY[this.model.type[0]] || (config) ? config.groups : null || 0;
        }
    } catch (err) {
        info('Cannot access EEPROM: this machine is not a neuron !');
    }
    return neuron;
};


module.exports.NEURON_MODELS_FAMILY = NEURON_MODELS_FAMILY;
module.exports.getNeuronProperties = getNeuronProperties;
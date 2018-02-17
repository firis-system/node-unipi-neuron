"use strict";

const os = require('os');
const fs = require('fs');
const YAML = require('js-yaml');

const debug = require('debug');
const info = debug('unipi-neuron:neuron:info');
const warn = debug('unipi-neuron:neuron:warn');
const log = debug('unipi-neuron:neuron:log');
const error = debug('unipi-neuron:neuron:error');

/**
 * Unipi Neuron models groups
 */
const NEURON_MODELS_GROUPS = {
    'S': 0,
    'M': 2,
    'L': 3
};

const getNeuronProperties = (ref, config) => {
    const neuron = ref || {};
    let eeprom;
    neuron.model = {};

    // read neuron's eeprom
    try {
        eeprom = fs.readFileSync('/sys/class/i2c-dev/i2c-1/device/1-0057/eeprom');
    } catch (err) {
        error('Cannot access EEPROM: this machine is not a neuron !');
    }

    // parse neuron properties from eeprom
    if (eeprom && eeprom.length === 128 && String.fromCharCode(eeprom[96], eeprom[97]) === '\xfa\x55') {
        
        // read epprom bytes 99 and 98 for neuron's version
        neuron.model.version = `${eeprom[99]}.${eeprom[98]}`;

        // read eeprom bytes 106 to 109 as a string for neuron's type
        neuron.model.type = eeprom.slice(106, 110).toString();

        // Were're little endian here, getting endianness from os to be sure
        const endianness = os.endianness();
        
        // read eeprom bytes 100 to 103 (int32) for neuron's serial number 
        const binary_sn = eeprom.slice(100, 104);
        //neuron.model.serial = '0x' + ('00000000' + ((endianness === 'LE') ? binary_sn.readInt32LE(0) : binary_sn.readInt32BE(0)).toString(16)).substr(-8);
        neuron.model.serial = (endianness === 'LE') ? binary_sn.readInt32LE(0) : binary_sn.readInt32BE(0);
        neuron.model.groups = NEURON_MODELS_GROUPS[neuron.model.type[0]] || 0;
        if (config) config.groups = neuron.model.groups;
    }

    // load neuron definition from evok's hw_definitions files
    if (eeprom && neuron.model && neuron.model.type) {
        
        // get short type
        const type = neuron.model.type.slice(0, -1);

        // get neuron's definition
        try {
            neuron.model.def = YAML.safeLoad(fs.readFileSync(`./hw_definitions/${type}x.yaml`, {encoding: 'utf8'}));
        }
        catch (err) {
            error('Cannot access Neuron\'s definition: this machine is a unknown neuron !');
        }
    }
    return neuron;
};

module.exports.getNeuronProperties = getNeuronProperties;

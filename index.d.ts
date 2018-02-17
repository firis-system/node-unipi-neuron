import { IModbusRTU } from "modbus-serial";
import { EventEmitter } from 'events';


export = BoardManager;

declare class BoardManager extends EventEmitter implements BoardManager.IBoardManager {
    constructor(config: any);
    init(config: any): void;
    id(id: string): { board: string, id: string };
    set(id: string, value: string | number | boolean): void;
    getState(id: string): string | number | boolean;
    getCount(id: string): number;
    getAllStates(): { [id: string]: string | number | boolean };
    getAllCounts(): { [id: string]: number };
    boards: { [id: string]: BoardManager.IBoard };
}

declare namespace BoardManager {
    interface IBoardManager extends EventEmitter {
        init(config: any): void;
        id(id: string): { board: string, id: string };
        set(id: string, value: string | number | boolean): void;
        getState(id: string): string | number | boolean;
        getCount(id: string): number;
        getAllStates(): { [id: string]: string | number | boolean };
        getAllCounts(): { [id: string]: number };
        boards: { [id: string]: IBoard };
    }
    
    
    interface IBoard extends EventEmitter {
        new(client: IRtuConnection | ITcpConnection, id: string, groups: number): IBoard;
        validate(id: string): void;
        getState(id: string): string | number | boolean;
        getCount(id: string): number;
        set(id: string, value: string | number | boolean, retries?: number): void;
        dec2bin(dec: number | string): string;
        storeState(prefix: string, value: string | number | boolean, length?: number): void;
        updateState(): void;
        updateCount(): void;
        state: { [id: string]: string | number | boolean };
        counter: { [id: string]: number };
        model?: INeuron
    }
    
    interface IRtuConnection extends IModbusRTU {
        new(socket?: any): IModbusRTU;
        connect(callback: Function): void;
    }
    
    interface ITcpConnection extends IModbusRTU {
        new(ip?: any, port?: any): IModbusRTU;
        connect(callback: Function): void;
    }
    interface INeuronDefinition {
        type?: string;
        modbus_register_blocks?: [{
            board_index?: number,
            start_reg?: number,
            count?: number,
            frequency?: number
        }]
        modbus_features?: [{
            type?: string,
            count?: number,
            major_group?: number,
            modes?: string[],
            ds_modes?: string[],
            parity_modes: string[],
            speed_modes: string[],
            stopb_modes: string[],
            min_v?: number,
            max_v?: number,
            min_c?: number,
            max_c?: number,
            min_r?: number,
            max_r?: number,
            nv_sav_coil: number,
            reset_coil: number,
            val_coil?: number,
            val_reg?: number,
            res_val_reg?: number,
            cal_reg?: number,
            mode_reg?: number,
            conf_reg?: number,
            start_reg: number,
            counter_reg: number,
            direct_reg: number,
            polar_reg: number,
            pwm_reg: number,
            pwm_ps_reg: number,
            pwm_c_reg: number,
            toggle_reg: number,
            timeout_reg: number,
            tolerances: string
        }]
    }
    interface INeuron {
        type?: string;
        version?: string;
        serial?: number;
        groups?: number;
        def?: INeuronDefinition
    
    }
}

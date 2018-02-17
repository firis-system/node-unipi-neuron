export declare interface INeuronDefinition {
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
export declare interface INeuron {
        type?: string;
        version?: string;
        serial?: number;
        groups?: number;
        def?: INeuronDefinition

    }

export declare function getNeuronProperties(): any;

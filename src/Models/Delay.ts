/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

export class Delay {
    private _delay: string;

    constructor(delay: string) {
        this._delay = delay;
    }

    get delay(): string {
        return this._delay;
    }

    set delay(value: string) {
        this._delay = value;
    }

    /**
     * Returns the delay in seconds.
     */
    public toSeconds(): number {
        const parts = this._delay.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);

        return (hours * 3600) + (minutes * 60) + seconds;
    }
}
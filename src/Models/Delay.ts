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
        return Delay.parseSeconds(this._delay) ?? 0;
    }

    public static parseSeconds(delay: string | number | null): number | null {
        if (typeof delay === "number") return Number.isFinite(delay) ? Math.trunc(delay) : null;
        if (!delay) return null;
        const parts = /^([+-])?(?:(\d+) days? )?(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(delay.trim());
        if (!parts) return null;
        const seconds = Number(parts[2] ?? 0) * 86400 + Number(parts[3]) * 3600 + Number(parts[4]) * 60 + Number(parts[5]);
        return Math.trunc(parts[1] === "-" ? -seconds : seconds);
    }
}

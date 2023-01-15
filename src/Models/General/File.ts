/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { writeFileSync } from "fs";

export class File {
    private readonly _path: string;
    private readonly _name: string;
    private readonly _contents: Buffer;

    constructor(path: string, name: string, contents: Buffer) {
        this._path = path;
        this._name = name;
        this._contents = contents;
    }

    public get path(): string {
        return this._path;
    }

    public get name(): string {
        return this._name;
    }

    public saveSync(): void {
        writeFileSync(`${this._path}/${this._name}`, this._contents);
    }
}
/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

/**
 * A wrapper class for the typescript Array class.
 */
export class Collection<T> {
    private readonly _items: T[];
    constructor(items: T[]) {
        this._items = items;
    }

    /**
     * Gets the first item in the collection.
     */
    public first(): T {
        return this.get(0);
    }

    /**
     * Gets the last item in the collection.
     */
    public last(): T {
        return this.get(this.length - 1);
    }

    public map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
        return this._items.map(callbackfn, thisArg);
    }

    public filter(callbackfn: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[] {
        return this._items.filter(callbackfn, thisArg);
    }

    public toArray(): T[] {
        return this._items;
    }

    public get length(): number {
        return this._items.length;
    }

    public set(index: number, value: T): void {
        this._items[index] = value;
    }

    public get(index: number): T {
        return this._items[index];
    }

    public some(callbackfn: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
        return this._items.some(callbackfn, thisArg);
    }

    public every(callbackfn: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
        return this._items.every(callbackfn, thisArg);
    }
}
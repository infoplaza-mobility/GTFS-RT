/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */
require('dotenv').config();
import { Knex } from 'knex';
import { Knex as Database } from "../Database/Database";


export class Repository {
    protected database: Knex;

    constructor() {
        this.database = Database;
    }
}
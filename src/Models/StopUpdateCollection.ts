/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {RitInfoStopUpdate} from "./RitinfoStopUpdate";
import {Collection} from "./General/Collection";

export class StopUpdateCollection extends Collection<RitInfoStopUpdate> {

    constructor(items: RitInfoStopUpdate[]) {
        super(items);

        this.setFirstStop();
        this.setLastStop();
    }

    private setFirstStop() {
        const firstStop = this.first();
        firstStop.isFirstStop = true;
        this.set(0, firstStop);
    }

    private setLastStop() {
        const lastStop = this.last();
        lastStop.isLastStop = true;
        this.set(this.length - 1, lastStop);
    }
}
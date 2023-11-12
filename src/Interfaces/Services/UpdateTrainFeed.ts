/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {TripIdWithDate} from "../TVVManager";

export interface IFeedManager {
    /**
     * Updates the train feed, fetches the current realtime train data
     * from InfoPlus, then applies the specified removals and saves the generated
     * protobuf file to disk in ./publish/trainUpdates.pb and ./publish/trainUpdates.json
     * @param tripIdsToRemove The trip IDs to mark als "REMOVED"/"CANCELLED" in the feed
     */
    updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void>;
}
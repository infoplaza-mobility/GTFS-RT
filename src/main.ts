/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import path from "path";

import {FeedManager} from "./Services/FeedManager";
import { createApp } from "./Http/createApp";
import {ITVVManager, TripIdWithDate, TVVManager} from "./Interfaces/TVVManager";
import {InfoplusRepository} from "./Repositories/InfoplusRepository";
import {StaticDataRepository} from "./Repositories/StaticDataRepository";
import {IInfoPlusRepository} from "./Interfaces/Repositories/InfoplusRepository";

import {IStaticDataRepository} from "./Interfaces/Repositories/IStaticDataRepository";
import {IFeedManager} from "./Interfaces/Services/UpdateTrainFeed";
import { runRepeatedly } from "./Helpers/Scheduler";

// A single rejected promise must not take the whole generator down (this used to crash Bun and
// restart the container whenever the database was briefly unavailable).
process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled promise rejection", reason);
});

/**
 * Main class of the ProtoBuf constructor. Set's up a timer that runs every 30 seconds to create a new ProtoBuf file.
 */
export class Main {

  private readonly _tvvManager: ITVVManager;
  private readonly _infoplusRepo: IInfoPlusRepository;
  private readonly _staticDataRepo: IStaticDataRepository;

  private readonly _feedManager: IFeedManager;

  private tripIdsThatShouldBeRemoved: TripIdWithDate[] = [];

  constructor() {
    console.log(`[Main] Starting GTFS-RT generator version ${process.env.npm_package_version}`)

    this._infoplusRepo = new InfoplusRepository();
    this._staticDataRepo = new StaticDataRepository();

    this._tvvManager = new TVVManager(this._staticDataRepo, this._infoplusRepo);
    this._feedManager = FeedManager.getInstance(this._infoplusRepo);

    this.startWebServer();

    // Both loops start immediately and independently: a slow or failing TVV lookup must never
    // prevent the train feed from being generated (it previously blocked the feed timer).
    this.setUpTVVTimer();
    this.setUpTimer();
  }

  /**
   * Generates a new ProtoBuf file every 30 seconds. Runs never overlap: the next run is only
   * scheduled once the previous one finished, so a slow database cannot pile up queries.
   * @private
   */
  private setUpTimer() {
    runRepeatedly("Train feed update", 30 * 1000,
        () => this._feedManager.updateTrainFeed(this.tripIdsThatShouldBeRemoved));
  }

  /**
   * Finds all TVV trips that are in the planned data, but not in the InfoPlus data, every 15 minutes.
   * @private
   */
  private setUpTVVTimer() {
    /**
     * We want to find the trips that should be removed from the static data that OTP has loaded in memory.
     * As infoplus train replacing trips are manually added, their train numbers often do not match between the static data and the infoplus data.
     * This creates either: Duplicate trips, or worse, trips that are not actually running (anymore), or their times got changed.
     * By simply removing all static-data trips that cannot be found in InfoPlus, we ensure this does not happen and let InfoPlus be the single
     * source of truth for train replacing trips.
     *
     * On failure the previous list is kept (runRepeatedly logs the error).
     * */
    runRepeatedly("TVV lookup", 15 * 60 * 1000, async () => {
      this.tripIdsThatShouldBeRemoved = await this._tvvManager.findTVVNotInInfoPlus();
    });
  }

  /**
   * Starts a web server that serves the ProtoBuf file.
   * @private
   */
  private startWebServer() {
    const app = createApp(this._feedManager, path.join(__dirname, '../publish'));

    app.listen(9595, () => {
        console.log('Listening on port 9595');
    });
  }
}

new Main();

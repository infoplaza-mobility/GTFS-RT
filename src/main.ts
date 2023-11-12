/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import path from "path";

import {FeedManager, IFeedManager} from "./Services/FeedManager";
import express from 'express';
import {ITVVManager, TripIdWithDate, TVVManager} from "./Interfaces/TVVManager";
import {InfoplusRepository} from "./Repositories/InfoplusRepository";
import {StaticDataRepository} from "./Repositories/StaticDataRepository";
import {IInfoPlusRepository} from "./Interfaces/Repositories/InfoplusRepository";

import {IStaticDataRepository} from "./Interfaces/Repositories/IStaticDataRepository";

require('dotenv').config();

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

    (async() => {
      await this.setUpTVVTimer();
      await this.setUpTimer();
    })();
  }

  /**
   * Sets up a timer that runs every 30 seconds to create a new ProtoBuf file.
   * @private
   */
  private async setUpTimer() {
    await this._feedManager.updateTrainFeed(this.tripIdsThatShouldBeRemoved);
    // await FeedManager.updateTripUpdatesFeed();
    setInterval(async () => {
        await this._feedManager.updateTrainFeed(this.tripIdsThatShouldBeRemoved);
        // await FeedManager.updateTripUpdatesFeed();
    }, 30 * 1000);
  }

  /**
   * Sets up a new timer that runs every hour to find all TVV trips that are in the planned data, but not in the InfoPlus data.
   * @private
   */
  private async setUpTVVTimer() {
    /**
     * We want to find the trips that should be removed from the static data that OTP has loaded in memory.
     * As infoplus train replacing trips are manually added, their train numbers often do not match between the static data and the infoplus data.
     * This creates either: Duplicate trips, or worse, trips that are not actually running (anymore), or their times got changed.
     * By simply removing all static-data trips that cannot be found in InfoPlus, we ensure this does not happen and let InfoPlus be the single
     * source of truth for train replacing trips.
     * */
    this.tripIdsThatShouldBeRemoved = await this._tvvManager.findTVVNotInInfoPlus();

    setInterval(async () => {
      this.tripIdsThatShouldBeRemoved = await this._tvvManager.findTVVNotInInfoPlus();
      //Run every hour
    }, 60 * 60 * 1000);
  }

  /**
   * Starts a web server that serves the ProtoBuf file.
   * @private
   */
  private startWebServer() {
    const app = express();

    // Serve the ProtoBuf files in the root/publish directory.
    app.use(express.static(path.join(__dirname, '../publish')));

    app.listen(9595, () => {
        console.log('Listening on port 9595');
    });
  }
}

new Main();
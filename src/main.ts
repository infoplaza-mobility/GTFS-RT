/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import path from "path";

import {FeedManager} from "./Services/FeedManager";
import express from 'express';
import {ITVVManager, TripIdWithDate, TVVManager} from "./Interfaces/TVVManager";
import {InfoplusRepository} from "./Repositories/InfoplusRepository";
import {IStaticDataRepository, StaticDataRepository} from "./Repositories/StaticDataRepository";

require('dotenv').config();

/**
 * Main class of the ProtoBuf constructor. Set's up a timer that runs every 30 seconds to create a new ProtoBuf file.
 */
export class Main {

  private readonly _tvvManager: ITVVManager;
  private readonly _infoplusRepo: InfoplusRepository;
  private readonly _staticDataRepo: IStaticDataRepository;

  private tripIdsThatShouldbeRemoved: TripIdWithDate[] = [];

  constructor() {
    console.log(`[Main] Starting GTFS-RT generator version ${process.env.npm_package_version}`)

    this._infoplusRepo = new InfoplusRepository();
    this._staticDataRepo = new StaticDataRepository();

    this._tvvManager = new TVVManager(this._staticDataRepo, this._infoplusRepo);

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
    await FeedManager.updateTrainFeed(this.tripIdsThatShouldbeRemoved);
    // await FeedManager.updateTripUpdatesFeed();
    setInterval(async () => {
        await FeedManager.updateTrainFeed(this.tripIdsThatShouldbeRemoved);
        // await FeedManager.updateTripUpdatesFeed();
    }, 30 * 1000);
  }

  private async setUpTVVTimer() {
    this.tripIdsThatShouldbeRemoved = await this._tvvManager.findTVVNotInInfoPlus();

    setInterval(async () => {
      this.tripIdsThatShouldbeRemoved = await this._tvvManager.findTVVNotInInfoPlus();
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
/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import path from "path";
require('dotenv').config();

import {FeedManager} from "./Services/FeedManager";
import express from 'express';

/**
 * Main class of the ProtoBuf constructor. Set's up a timer that runs every 30 seconds to create a new ProtoBuf file.
 */
export class Main {

  constructor() {
    console.log(`[Main] Starting GTFS-RT generator version ${process.env.npm_package_version}`)

    this.startWebServer();

    (async() => {
      await this.setUpTimer();
    })();
  }

  /**
   * Sets up a timer that runs every 30 seconds to create a new ProtoBuf file.
   * @private
   */
  private async setUpTimer() {
    await FeedManager.updateTrainFeed();
    // await FeedManager.updateTripUpdatesFeed();
    setInterval(async () => {
        await FeedManager.updateTrainFeed();
        // await FeedManager.updateTripUpdatesFeed();
    }, 30 * 1000);
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
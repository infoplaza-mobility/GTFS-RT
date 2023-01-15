/*
 * Copyright (c) 2022. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

require('dotenv').config();

import {FeedManager} from "./Services/FeedManager";

/**
 * Main class of the ProtoBuf constructor. Set's up a timer that runs every 30 seconds to create a new ProtoBuf file.
 */
export class Main {

  constructor() {
    (async() => {
      await this.setUpTimer();
    })();
  }

  /**
   *
   * @private
   */
  private async setUpTimer() {
    await FeedManager.updateTrainFeed();
    setInterval(async () => {
        await FeedManager.updateTrainFeed();
    }, 30 * 1000);
  }

}

new Main();
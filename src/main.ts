import { writeFileSync } from 'fs';
import { transit_realtime } from 'gtfs-rb';
import axios from 'axios';

// Deconstruct these classes from GTFS Realtime Bindings
const { FeedMessage, FeedHeader, FeedEntity, TripUpdate, TripDescriptor } = transit_realtime

/**
 * Fetches the train updates from OpenOV.
 */
const fetchFromOVApi = async (): Promise<transit_realtime.FeedMessage> => {
  try {
    console.info('Fetching train updates...');
    const res = await axios.get('http://gtfs.ovapi.nl/nl/trainUpdates.pb', {
      responseType: 'arraybuffer'
    });
    if (res.status !== 200) {
      const error = new Error(`${res.request}: ${res.status} ${res.statusText}`);
      throw error;
    }

    const buffer = await res.data;
    const feed = transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    return feed;

  } catch (error) {
    console.log(error);
    throw error;
  }
}

const changeToModified = (feed: transit_realtime.FeedMessage): transit_realtime.FeedMessage => {
  console.log("Modifying feed...");
  // feed.entity.forEach((entity) => {
  //   if (entity.tripUpdate) {
  //     if(entity.tripUpdate.trip.scheduleRelationship === TripDescriptor.ScheduleRelationship.SCHEDULED)
  //       entity.tripUpdate.trip.scheduleRelationship = 5;
  //   }
  // });

  //Filter out any stop time update that do not have a stop sequence number and a stop 
  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      //Filter out any stop time update that do not have a stop sequence number and a stop id
      entity.tripUpdate.stopTimeUpdate = entity.tripUpdate.stopTimeUpdate?.filter((stopTimeUpdate) => {
        return !(stopTimeUpdate.stopSequence && stopTimeUpdate.stopId);
      });
    }
  });

  console.info(`Feed modified. ${feed.entity.length} entities found.`);

  return feed;
}

const writeToFile = (feed: transit_realtime.FeedMessage) => {
  const buffer = FeedMessage.encode(feed).finish();
  console.info("Writing feed to file...")
  writeFileSync('./TrainUpdates.pb', buffer);
  console.info("Feed written to file.")
}

const writeToJSON = (feed: transit_realtime.FeedMessage) => {
  console.info("Writing feed to file...")
  writeFileSync('./TrainUpdates.json', JSON.stringify(feed));
  console.info("Feed written to file.")
}

const main = async () => {
  const feed = await fetchFromOVApi();
  const modifiedFeed = changeToModified(feed);
  writeToFile(modifiedFeed);
  writeToJSON(modifiedFeed);
}

(async() => {
  await main();
  setInterval(async () => {
    await main();
  }, 1000 * 30);
})();

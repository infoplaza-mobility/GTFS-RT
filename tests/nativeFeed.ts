import { resolve } from "path";
import protobuf from "protobufjs";

// Keep the native decoder independent of the generated OVAPI protobuf root.
const root = protobuf.loadSync(resolve(import.meta.dir, "../proto/gtfs-realtime.proto"), new protobuf.Root());
const feedType = root.lookupType("transit_realtime.FeedMessage");

export function decodeNativeFeed(bytes: Uint8Array) {
    return feedType.toObject(feedType.decode(bytes), { longs: Number });
}

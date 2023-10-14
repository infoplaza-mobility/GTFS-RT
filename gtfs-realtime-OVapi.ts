/* eslint-disable */
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "transit_realtime";

export interface OVapiTripDescriptor {
  /** Matches with realtime_trip_id field in trips.txt */
  realtimeTripId: string;
  /** The trip_short_name of the (added) trip */
  tripShortName: string;
  /** The commercial_mode id of the */
  commercialModeId: string;
}

export interface OVapiVehiclePosition {
  /**
   * Estimated arrival-delay at the next stop (in seconds) can be positive (meaning that the vehicle is late) or
   * negative (meaning that the vehicle is ahead of schedule). Delay of 0
   * means that the vehicle is exactly on time.
   */
  delay: number;
}

export interface OVapiTripUpdate {
  /**
   * The trip_headsign field contains the text that appears on a sign that identifies the trip's destination to passengers
   * Overrides possible trip_headsign's in static GTFS feeds, overrides stop_headsigns in the static feed
   * unless there stop_headsign in a StopTimeUpdate
   */
  tripHeadsign: string;
}

export interface OVapiStopTimeUpdate {
  /**
   * The trip_headsign field contains the text that appears on a sign that identifies the trip's destination to passengers
   * Overrides possible trip_headsign's and stop_headsign's in static GTFS feeds.
   */
  stopHeadsign: string;
  /** The planned platform-code where the trip is scheduled to depart from */
  scheduledTrack: string;
  /** (optional) The actual platform-code where the deviates from the scheduled platform. */
  actualTrack: string;
  /** (optional) The (internal)identifier of a trainstation where the stoptimeupdate applies to */
  stationId: string;
}

export interface OVapiVehicleDescriptor {
  wheelchairAccessible: boolean;
  vehicleType: string;
  vehicleHeadsign: string;
}

function createBaseOVapiTripDescriptor(): OVapiTripDescriptor {
  return { realtimeTripId: "", tripShortName: "", commercialModeId: "" };
}

export const OVapiTripDescriptor = {
  encode(message: OVapiTripDescriptor, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.realtimeTripId !== "") {
      writer.uint32(10).string(message.realtimeTripId);
    }
    if (message.tripShortName !== "") {
      writer.uint32(18).string(message.tripShortName);
    }
    if (message.commercialModeId !== "") {
      writer.uint32(26).string(message.commercialModeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OVapiTripDescriptor {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOVapiTripDescriptor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.realtimeTripId = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.tripShortName = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.commercialModeId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OVapiTripDescriptor {
    return {
      realtimeTripId: isSet(object.realtimeTripId) ? globalThis.String(object.realtimeTripId) : "",
      tripShortName: isSet(object.tripShortName) ? globalThis.String(object.tripShortName) : "",
      commercialModeId: isSet(object.commercialModeId) ? globalThis.String(object.commercialModeId) : "",
    };
  },

  toJSON(message: OVapiTripDescriptor): unknown {
    const obj: any = {};
    if (message.realtimeTripId !== "") {
      obj.realtimeTripId = message.realtimeTripId;
    }
    if (message.tripShortName !== "") {
      obj.tripShortName = message.tripShortName;
    }
    if (message.commercialModeId !== "") {
      obj.commercialModeId = message.commercialModeId;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OVapiTripDescriptor>, I>>(base?: I): OVapiTripDescriptor {
    return OVapiTripDescriptor.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OVapiTripDescriptor>, I>>(object: I): OVapiTripDescriptor {
    const message = createBaseOVapiTripDescriptor();
    message.realtimeTripId = object.realtimeTripId ?? "";
    message.tripShortName = object.tripShortName ?? "";
    message.commercialModeId = object.commercialModeId ?? "";
    return message;
  },
};

function createBaseOVapiVehiclePosition(): OVapiVehiclePosition {
  return { delay: 0 };
}

export const OVapiVehiclePosition = {
  encode(message: OVapiVehiclePosition, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.delay !== 0) {
      writer.uint32(8).int32(message.delay);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OVapiVehiclePosition {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOVapiVehiclePosition();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.delay = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OVapiVehiclePosition {
    return { delay: isSet(object.delay) ? globalThis.Number(object.delay) : 0 };
  },

  toJSON(message: OVapiVehiclePosition): unknown {
    const obj: any = {};
    if (message.delay !== 0) {
      obj.delay = Math.round(message.delay);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OVapiVehiclePosition>, I>>(base?: I): OVapiVehiclePosition {
    return OVapiVehiclePosition.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OVapiVehiclePosition>, I>>(object: I): OVapiVehiclePosition {
    const message = createBaseOVapiVehiclePosition();
    message.delay = object.delay ?? 0;
    return message;
  },
};

function createBaseOVapiTripUpdate(): OVapiTripUpdate {
  return { tripHeadsign: "" };
}

export const OVapiTripUpdate = {
  encode(message: OVapiTripUpdate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.tripHeadsign !== "") {
      writer.uint32(10).string(message.tripHeadsign);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OVapiTripUpdate {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOVapiTripUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.tripHeadsign = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OVapiTripUpdate {
    return { tripHeadsign: isSet(object.tripHeadsign) ? globalThis.String(object.tripHeadsign) : "" };
  },

  toJSON(message: OVapiTripUpdate): unknown {
    const obj: any = {};
    if (message.tripHeadsign !== "") {
      obj.tripHeadsign = message.tripHeadsign;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OVapiTripUpdate>, I>>(base?: I): OVapiTripUpdate {
    return OVapiTripUpdate.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OVapiTripUpdate>, I>>(object: I): OVapiTripUpdate {
    const message = createBaseOVapiTripUpdate();
    message.tripHeadsign = object.tripHeadsign ?? "";
    return message;
  },
};

function createBaseOVapiStopTimeUpdate(): OVapiStopTimeUpdate {
  return { stopHeadsign: "", scheduledTrack: "", actualTrack: "", stationId: "" };
}

export const OVapiStopTimeUpdate = {
  encode(message: OVapiStopTimeUpdate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.stopHeadsign !== "") {
      writer.uint32(10).string(message.stopHeadsign);
    }
    if (message.scheduledTrack !== "") {
      writer.uint32(18).string(message.scheduledTrack);
    }
    if (message.actualTrack !== "") {
      writer.uint32(26).string(message.actualTrack);
    }
    if (message.stationId !== "") {
      writer.uint32(34).string(message.stationId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OVapiStopTimeUpdate {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOVapiStopTimeUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.stopHeadsign = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.scheduledTrack = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.actualTrack = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.stationId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OVapiStopTimeUpdate {
    return {
      stopHeadsign: isSet(object.stopHeadsign) ? globalThis.String(object.stopHeadsign) : "",
      scheduledTrack: isSet(object.scheduledTrack) ? globalThis.String(object.scheduledTrack) : "",
      actualTrack: isSet(object.actualTrack) ? globalThis.String(object.actualTrack) : "",
      stationId: isSet(object.stationId) ? globalThis.String(object.stationId) : "",
    };
  },

  toJSON(message: OVapiStopTimeUpdate): unknown {
    const obj: any = {};
    if (message.stopHeadsign !== "") {
      obj.stopHeadsign = message.stopHeadsign;
    }
    if (message.scheduledTrack !== "") {
      obj.scheduledTrack = message.scheduledTrack;
    }
    if (message.actualTrack !== "") {
      obj.actualTrack = message.actualTrack;
    }
    if (message.stationId !== "") {
      obj.stationId = message.stationId;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OVapiStopTimeUpdate>, I>>(base?: I): OVapiStopTimeUpdate {
    return OVapiStopTimeUpdate.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OVapiStopTimeUpdate>, I>>(object: I): OVapiStopTimeUpdate {
    const message = createBaseOVapiStopTimeUpdate();
    message.stopHeadsign = object.stopHeadsign ?? "";
    message.scheduledTrack = object.scheduledTrack ?? "";
    message.actualTrack = object.actualTrack ?? "";
    message.stationId = object.stationId ?? "";
    return message;
  },
};

function createBaseOVapiVehicleDescriptor(): OVapiVehicleDescriptor {
  return { wheelchairAccessible: false, vehicleType: "", vehicleHeadsign: "" };
}

export const OVapiVehicleDescriptor = {
  encode(message: OVapiVehicleDescriptor, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.wheelchairAccessible === true) {
      writer.uint32(8).bool(message.wheelchairAccessible);
    }
    if (message.vehicleType !== "") {
      writer.uint32(18).string(message.vehicleType);
    }
    if (message.vehicleHeadsign !== "") {
      writer.uint32(26).string(message.vehicleHeadsign);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OVapiVehicleDescriptor {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOVapiVehicleDescriptor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.wheelchairAccessible = reader.bool();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.vehicleType = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.vehicleHeadsign = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OVapiVehicleDescriptor {
    return {
      wheelchairAccessible: isSet(object.wheelchairAccessible)
        ? globalThis.Boolean(object.wheelchairAccessible)
        : false,
      vehicleType: isSet(object.vehicleType) ? globalThis.String(object.vehicleType) : "",
      vehicleHeadsign: isSet(object.vehicleHeadsign) ? globalThis.String(object.vehicleHeadsign) : "",
    };
  },

  toJSON(message: OVapiVehicleDescriptor): unknown {
    const obj: any = {};
    if (message.wheelchairAccessible === true) {
      obj.wheelchairAccessible = message.wheelchairAccessible;
    }
    if (message.vehicleType !== "") {
      obj.vehicleType = message.vehicleType;
    }
    if (message.vehicleHeadsign !== "") {
      obj.vehicleHeadsign = message.vehicleHeadsign;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OVapiVehicleDescriptor>, I>>(base?: I): OVapiVehicleDescriptor {
    return OVapiVehicleDescriptor.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OVapiVehicleDescriptor>, I>>(object: I): OVapiVehicleDescriptor {
    const message = createBaseOVapiVehicleDescriptor();
    message.wheelchairAccessible = object.wheelchairAccessible ?? false;
    message.vehicleType = object.vehicleType ?? "";
    message.vehicleHeadsign = object.vehicleHeadsign ?? "";
    return message;
  },
};

export const ovapiTripdescriptor: Extension<OVapiTripDescriptor | undefined> = {
  number: 1003,
  tag: 8026,
  repeated: false,
  packed: false,
  encode: (value: OVapiTripDescriptor | undefined): Uint8Array[] => {
    const encoded: Uint8Array[] = [];
    const writer = _m0.Writer.create();
    OVapiTripDescriptor.encode(value, writer.fork()).ldelim();
    encoded.push(writer.finish());
    return encoded;
  },
  decode: (tag: number, input: Uint8Array[]): OVapiTripDescriptor | undefined => {
    const reader = _m0.Reader.create(input[input.length - 1] ?? fail());
    return OVapiTripDescriptor.decode(reader, reader.uint32());
  },
};

export const ovapiVehiclePosition: Extension<OVapiVehiclePosition | undefined> = {
  number: 1003,
  tag: 8026,
  repeated: false,
  packed: false,
  encode: (value: OVapiVehiclePosition | undefined): Uint8Array[] => {
    const encoded: Uint8Array[] = [];
    const writer = _m0.Writer.create();
    OVapiVehiclePosition.encode(value, writer.fork()).ldelim();
    encoded.push(writer.finish());
    return encoded;
  },
  decode: (tag: number, input: Uint8Array[]): OVapiVehiclePosition | undefined => {
    const reader = _m0.Reader.create(input[input.length - 1] ?? fail());
    return OVapiVehiclePosition.decode(reader, reader.uint32());
  },
};

export const ovapiTripUpdate: Extension<OVapiTripUpdate | undefined> = {
  number: 1003,
  tag: 8026,
  repeated: false,
  packed: false,
  encode: (value: OVapiTripUpdate | undefined): Uint8Array[] => {
    const encoded: Uint8Array[] = [];
    const writer = _m0.Writer.create();
    OVapiTripUpdate.encode(value, writer.fork()).ldelim();
    encoded.push(writer.finish());
    return encoded;
  },
  decode: (tag: number, input: Uint8Array[]): OVapiTripUpdate | undefined => {
    const reader = _m0.Reader.create(input[input.length - 1] ?? fail());
    return OVapiTripUpdate.decode(reader, reader.uint32());
  },
};

export const ovapiStopTimeUpdate: Extension<OVapiStopTimeUpdate | undefined> = {
  number: 1003,
  tag: 8026,
  repeated: false,
  packed: false,
  encode: (value: OVapiStopTimeUpdate | undefined): Uint8Array[] => {
    const encoded: Uint8Array[] = [];
    const writer = _m0.Writer.create();
    OVapiStopTimeUpdate.encode(value, writer.fork()).ldelim();
    encoded.push(writer.finish());
    return encoded;
  },
  decode: (tag: number, input: Uint8Array[]): OVapiStopTimeUpdate | undefined => {
    const reader = _m0.Reader.create(input[input.length - 1] ?? fail());
    return OVapiStopTimeUpdate.decode(reader, reader.uint32());
  },
};

export const ovapiVehicleDescriptor: Extension<OVapiVehicleDescriptor | undefined> = {
  number: 1003,
  tag: 8026,
  repeated: false,
  packed: false,
  encode: (value: OVapiVehicleDescriptor | undefined): Uint8Array[] => {
    const encoded: Uint8Array[] = [];
    const writer = _m0.Writer.create();
    OVapiVehicleDescriptor.encode(value, writer.fork()).ldelim();
    encoded.push(writer.finish());
    return encoded;
  },
  decode: (tag: number, input: Uint8Array[]): OVapiVehicleDescriptor | undefined => {
    const reader = _m0.Reader.create(input[input.length - 1] ?? fail());
    return OVapiVehicleDescriptor.decode(reader, reader.uint32());
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export interface Extension<T> {
  number: number;
  tag: number;
  singularTag?: number;
  encode?: (message: T) => Uint8Array[];
  decode?: (tag: number, input: Uint8Array[]) => T;
  repeated: boolean;
  packed: boolean;
}

function fail(message?: string): never {
  throw new Error(message ?? "Failed");
}

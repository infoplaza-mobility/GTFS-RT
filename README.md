# InfoPlaza GTFS-RT Constructor (Forked from R-OV)

This repository contains the code that constructs a custom GTFS-RT feed from the received InfoPlus data in the InfoPlaza
InfoPlus Receiver.

To get this code working, you need to have the following installed:

- Node.js (16, 18) (https://nodejs.org/en/)
- npm (https://www.npmjs.com/get-npm)
- typescript (npm install -g typescript)
- ts-node (npm install -g ts-node)

## Installation

1. Clone this repository
2. Run `npm install` in the root of the repository
3. Run `npm run build` in the root of the repository to compile the protobuf files
4. Run `npm run build:ts` in the root of the repository to compile the TypeScript files
## Usage

Before running the code, you will have to probably modify the `InfoPlusRepository` class to use your correct database
instance and tables.

An example query is given, this is the query that runs on the private R-OV/InfoPlaza database, so it will most likely not work for
you without modification.
All data fields are what they are in InfoPlus, without generally any conversions, the names should speak for themselves,
but are translated from the Dutch names in InfoPlus to English.

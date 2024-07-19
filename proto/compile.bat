npx pbjs -t static-module -w commonjs -o compiled.js gtfs-realtime.proto gtfs-realtime-OVAPI.proto mfdz-realtime-extensions.proto
npx pbts -o compiled.d.ts compiled.js
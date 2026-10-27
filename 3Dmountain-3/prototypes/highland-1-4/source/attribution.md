# Everest elevation data

These numerical elevation assets are independently prepared from public Mapzen Terrain Tiles hosted by the Registry of Open Data on AWS. No reference website image, processed elevation asset, satellite image, texture, or implementation is included.

- Dataset and public S3 access: https://registry.opendata.aws/terrain-tiles/
- Tile format and elevation decoding: https://github.com/tilezen/joerd/blob/master/docs/formats.md
- Provider attribution and underlying data terms: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- Data sources: https://github.com/tilezen/joerd/blob/master/docs/data-sources.md

Mapzen Terrain Tiles. SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. Mapzen combines multiple open elevation sources; the provider attribution page governs the applicable underlying data sources.

Run `node prototypes/highland-1-4/source/prepare-dem.cjs` from the repository root, or invoke this script by absolute path. The script caches sixteen public Terrarium PNG tiles at zoom 13, x 6071 through 6074 and y 3430 through 3433, in `everest-tiles/`. It decodes the Terrarium RGB samples, crops a 872 by 758 grid, quantizes to quarter metres, and writes gzip-compressed little-endian unsigned 16-bit grids under `../assets/`. The 436 by 379 phone grid preserves the full crop endpoints. Metadata and numerical statistics are in `../assets/everest-dem.json`.

The output height is `uint16le / 4` metres. Rows run north to south; columns run west to east. The unscaled elevation values retain the source data's vertical reference and are supplied without vertical exaggeration. The source is terrain data, not a surveyed measurement of every peak; raster resolution and the original data's acquisition date limit accuracy.

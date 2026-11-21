# Geographic data attribution

## Boundaries (`albania-municipalities.topo.json`, `albania-counties.topo.json`)

- **Source:** OCHA, *Albania – Subnational Administrative Boundaries* (Common Operational Dataset COD-AB, 2019 revision c), compiled from GADM and UNHCR.
  https://data.humdata.org/dataset/cod-ab-alb
- **Licence:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO 3.0).
- **Levels used:** ADM1 = 12 counties (qarqe), ADM2 = 61 municipalities (bashki, after the 2015 territorial reform). Feature counts are verified by `scripts/build-geo.ts`, which stops if they differ.
- **Processing** (`npm run geo:build`): vertices snapped and topology cleaned, simplified with mapshaper (Visvalingam, 15 %, shapes kept), quantised TopoJSON. The county layer is dissolved from the municipalities so both layers share identical borders. Codes are the dataset P-codes (`AL01`…`AL12`, `AL0101`…).
- **Display-name corrections** (geometry and codes unchanged). The source's Albanian name field uses some genitive forms and contains two errors:
  - AL0104 Skraparit → Skrapar
  - AL0503 Lushnjës → Lushnjë
  - AL0504 Mallakastrës → Mallakastër
  - AL0701 Devollit → Devoll
  - AL0702 Kolonjës → Kolonjë
  - AL0803 Topojë → Tropojë
  - AL0901 Kurbinit → Kurbin
  - AL0903 Mirditës → Mirditë
  - AL1101 labelled "Kavajë" in the source although its English name and code order identify it as **Kamëz** → Kamëz

## Hexagon tile map (`hex-layout.json`)

Derived by `scripts/build-hex-layout.ts` from the municipality centroids above. One hexagon per municipality; positions are approximate by design and do not represent area.

## Population

`data/geo/population.csv` is intentionally empty until verified INSTAT census figures are added (columns `region_code,population,source_year`, codes as above). While it is empty, the "rate per 10,000 residents" layer is disabled. Populations are never estimated.

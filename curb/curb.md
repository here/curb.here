# Curb data — specs and providers

Standards and vendors for **digital curb data**: regulations, zones, loading and parking events, and usage.
This is relevant to the Sunset & Silver Lake focus area because LA (LADOT) created MDS and is listed as a CDS user.
Checked on 2026-11-27.

## Specifications (Open Mobility Foundation)

| | **CDS — Curb Data Specification** | **MDS — Mobility Data Specification** |
|---|---|---|
| Repo | https://github.com/openmobilityfoundation/curb-data-specification | https://github.com/openmobilityfoundation/mobility-data-specification |
| Latest | **1.1.0** (2025-10-27) | **2.1.0** (2026-07-09) |
| APIs | **Curbs** (zones, regulations, policies) · **Events** (real-time or historic curb activity) · **Metrics** (sessions, dwell, occupancy) | Provider · Agency · Policy · Geography · Jurisdiction · Metrics |
| Covers | Commercial curb use: loading, delivery, passenger pickup, parking | Vehicles in the public right of way: micromobility, passenger (taxi/TNC/AV), fleet, delivery |
| Origin | OMF working group, built alongside MDS | Created by **LADOT** in 2018; moved to OMF in Nov 2019 |
| Spec license | CC BY 4.0 | CC BY 4.0 |
| Data license | Set by each publishing city or vendor (the spec doesn't set one) | Set by each city; usually not public, because trip data is sensitive |

- OMF home: https://www.openmobilityfoundation.org
- CDS users list (cities and vendors): https://github.com/openmobilityfoundation/curb-data-specification/wiki/CDS-Users
- **For curb.here:**
  - The **CDS Curbs API** format fits a published Silver Lake curb inventory: zones and regulations as GeoJSON with time rules.
  - **MDS Policy/Geography** is the city-to-operator side, for example where scooters can park.
  - LADOT runs MDS for its permitted operators, but that trip data isn't published.

## Providers

### OpenCurb
- https://opencurb.com/ — "The Coordination Layer for Curb Space."
- Describes itself as coordinating access to curb space across cities, property owners, businesses, fleets, pedestrians, cyclists, delivery services and autonomous systems, with real-time allocation.
- The site is a JavaScript app and the public page says nothing more. Its API, coverage (LA?), pricing, data license and CDS support are **not yet known**, so follow up.

### CDS vendors (short list)
Picked from the OMF CDS users list for LA presence or curb-data focus. The list doesn't say which APIs each one implements.

| Vendor | Based | What they do (curb-related) |
|---|---|---|
| Automotus | Los Angeles | Camera-based curb monitoring and loading-zone management and payments |
| Blue Systems | Los Angeles | Curb and parking technology |
| Populus | San Francisco | Mobility and curb data platform for cities (MDS + CDS) |
| CurbIQ | Toronto | Curb inventory digitization and regulation management |
| INRIX | Kirkland, WA | Traffic and parking data; curb regulation data |
| Vianova | Paris | Mobility and curb data platform for cities |
| Passport | Charlotte, NC | Parking payment and enforcement platform |
| Modii | Denver | Reservable smart loading zones |

All of these are commercial. Their data is licensed per contract (usually to the city) and isn't open, so cost is quote-based.
Other entries on the list include Umojo, Cleverciti, Flowbird, Numina, YCurb, AppyWay, Urban Radar, Univrses, Tranzito, Eleven-X and AglaiaSense.

## Related
- Street-level photos for building a curb inventory: [photos/photos.md](../photos/photos.md) · [photos/photos-other-sources.md](../photos/photos-other-sources.md)
- OSM curb tagging (`parking:*`, `kerb`): [map/map-osm.md](../map/map-osm.md)

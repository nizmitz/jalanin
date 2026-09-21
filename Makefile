.PHONY: basemap assets pmtiles icons gage transit layers
basemap: assets pmtiles
assets:
	bash scripts/fetch-basemap-assets.sh
pmtiles:
	bash scripts/build-pmtiles.sh
icons:
	npx tsx scripts/make-icons.ts
gage:
	npx tsx scripts/fetch-osm.ts --source data/sources/gage.json && npx tsx scripts/build-gage.ts
transit:
	@echo "see Task A5"
layers: gage transit

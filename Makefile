.PHONY: basemap assets pmtiles roads icons
basemap: assets pmtiles
assets:
	bash scripts/fetch-basemap-assets.sh
pmtiles:
	bash scripts/build-pmtiles.sh
roads:
	npx tsx scripts/fetch-roads.ts && npx tsx scripts/trim-roads.ts
icons:
	npx tsx scripts/make-icons.ts

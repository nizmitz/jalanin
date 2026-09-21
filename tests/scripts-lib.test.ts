import { describe, expect, it } from 'vitest';
import type { FeatureCollection, LineString, Position } from 'geojson';
import {
  buildQl,
  buildQuery,
  byteSize,
  clipLine,
  mergeWays,
  normaliseName,
  parseArgs,
  qlString,
  roundCoords,
  simplifyRing,
  type SourceFile,
  type SourceItem,
} from '../scripts/lib.ts';

describe('qlString', () => {
  it('escapes backslashes and quotes for the Overpass string layer', () => {
    expect(qlString('^Jalan M\\.? Thamrin$')).toBe('^Jalan M\\\\.? Thamrin$');
    expect(qlString('say "hi"')).toBe('say \\"hi\\"');
  });
  it('is embedded in the name filter', () => {
    const q = buildQuery('^Jalan D\\.? ?I\\.? Panjaitan$');
    expect(q).toContain('["name"~"^Jalan D\\\\.? ?I\\\\.? Panjaitan$"]');
    expect(q).toMatch(
      /^\[out:json\]\[timeout:60\];area\["ISO3166-2"="ID-JK"\]->\.jk;way\(area\.jk\)/,
    );
  });
});

describe('clipLine', () => {
  const box: [number, number, number, number] = [0, 0, 10, 10];
  it('passes through when no bbox', () => {
    const l = [
      [1, 1],
      [2, 2],
    ];
    expect(clipLine(l, undefined)).toEqual([l]);
  });
  it('drops outside vertices and splits into runs', () => {
    const l = [
      [-1, 5],
      [1, 5],
      [2, 5],
      [11, 5],
      [12, 5],
      [3, 5],
      [4, 5],
    ];
    expect(clipLine(l, box)).toEqual([
      [
        [1, 5],
        [2, 5],
      ],
      [
        [3, 5],
        [4, 5],
      ],
    ]);
  });
  it('discards single-vertex runs', () => {
    expect(
      clipLine(
        [
          [-1, 5],
          [1, 5],
          [11, 5],
        ],
        box,
      ),
    ).toEqual([]);
  });
});

describe('buildQl', () => {
  const bboxSource: SourceFile = {
    bbox: '-6.45,106.55,-6.05,107.05',
    items: [],
  };
  const areaSource: SourceFile = {
    bbox: '-6.45,106.55,-6.05,107.05',
    area: 'ID-JK',
    items: [],
  };

  it('builds a ways query against the bbox', () => {
    const item: SourceItem = {
      id: 'gajah-mada',
      name: 'Jl. Gajah Mada',
      group: 'spine',
      kind: 'ways',
      query: 'way["highway"~"^(primary)$"]["name"~"^Jalan Gajah Mada$"]',
    };
    expect(buildQl(item, bboxSource)).toBe(
      '[out:json][timeout:120];(way["highway"~"^(primary)$"]["name"~"^Jalan Gajah Mada$"]' +
        '(-6.45,106.55,-6.05,107.05););out geom;',
    );
  });

  it('uses an area filter instead of the bbox when the source declares one', () => {
    const item: SourceItem = {
      id: 'gajah-mada',
      name: 'Jl. Gajah Mada',
      group: 'spine',
      kind: 'ways',
      query: 'way["highway"~"^(primary)$"]["name"~"^Jalan Gajah Mada$"]',
    };
    expect(buildQl(item, areaSource)).toBe(
      '[out:json][timeout:120];area["ISO3166-2"="ID-JK"]->.jk;' +
        '(way["highway"~"^(primary)$"]["name"~"^Jalan Gajah Mada$"](area.jk););out geom;',
    );
  });

  it('lets an item override the source area', () => {
    const item: SourceItem = {
      id: 'x',
      name: 'x',
      group: 'x',
      kind: 'ways',
      query: 'way["highway"="primary"]',
      area: 'ID-BT',
    };
    expect(buildQl(item, bboxSource)).toContain('area["ISO3166-2"="ID-BT"]->.jk;');
    expect(buildQl(item, bboxSource)).toContain('(area.jk);');
  });

  // Overpass has no spatial index on relations, so a route_master can't be
  // bbox-filtered directly: its members are relations (routes), which are
  // themselves collections of ways/nodes with no direct geometry either. The
  // item.query for `route_master` kind selects the child ROUTE relations
  // (which are taggable and, once selected, addressable), then buildQl walks
  // up to their masters (`br.r` = backward relations of .r, i.e. parents),
  // back down to every route of those masters (`rel(r.m)`), and finally
  // recurses (`>>`) to the ways/nodes of the masters + routes union so the
  // output has full line geometry (Task A5).
  it('builds a route_master recursion via its child route relations', () => {
    const item: SourceItem = {
      id: 'mrt',
      name: 'MRT Jakarta',
      group: 'mrt',
      kind: 'route_master',
      query: 'relation["type"="route"]["route"="subway"]["network"~"MRT Jakarta"]',
    };
    expect(buildQl(item, bboxSource)).toBe(
      '[out:json][timeout:120];' +
        '(relation["type"="route"]["route"="subway"]["network"~"MRT Jakarta"]' +
        '(-6.45,106.55,-6.05,107.05);)->.r;' +
        '(.r;rel(br.r)["type"="route_master"];)->.m;' +
        '(.m;rel(r.m);)->.rr;' +
        '(.m;.rr;.rr>>;);out geom;',
    );
  });

  it('uses the area filter for route_master when the source declares one', () => {
    const item: SourceItem = {
      id: 'mrt',
      name: 'MRT Jakarta',
      group: 'mrt',
      kind: 'route_master',
      query: 'relation["type"="route"]["route"="subway"]',
    };
    expect(buildQl(item, areaSource)).toBe(
      '[out:json][timeout:120];area["ISO3166-2"="ID-JK"]->.jk;' +
        '(relation["type"="route"]["route"="subway"](area.jk);)->.r;' +
        '(.r;rel(br.r)["type"="route_master"];)->.m;' +
        '(.m;rel(r.m);)->.rr;' +
        '(.m;.rr;.rr>>;);out geom;',
    );
  });

  it('applies the spatial filter to every ;-separated selector in the query', () => {
    const item: SourceItem = {
      id: 'multi',
      name: 'multi',
      group: 'x',
      kind: 'ways',
      query: 'way["highway"="primary"];way["highway"="secondary"]',
    };
    expect(buildQl(item, bboxSource)).toBe(
      '[out:json][timeout:120];' +
        '(way["highway"="primary"](-6.45,106.55,-6.05,107.05);' +
        'way["highway"="secondary"](-6.45,106.55,-6.05,107.05););out geom;',
    );
  });

  it('builds nodes and relations kinds like ways', () => {
    const node: SourceItem = {
      id: 'toll-gates',
      name: 'toll gates',
      group: 'toll',
      kind: 'nodes',
      query: 'node["barrier"="toll_booth"]',
    };
    expect(buildQl(node, bboxSource)).toBe(
      '[out:json][timeout:120];(node["barrier"="toll_booth"](-6.45,106.55,-6.05,107.05););out geom;',
    );
    const rel: SourceItem = {
      id: 'kelurahan',
      name: 'kelurahan',
      group: 'admin',
      kind: 'relations',
      query: 'relation["admin_level"="7"]',
    };
    expect(buildQl(rel, bboxSource)).toBe(
      '[out:json][timeout:120];(relation["admin_level"="7"](-6.45,106.55,-6.05,107.05););out geom;',
    );
  });
});

describe('roundCoords', () => {
  it('rounds every coordinate in a FeatureCollection to the given decimal places', () => {
    const fc: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [106.8123456, -6.1234567],
              [106.8000001, -6.2000009],
            ],
          },
        },
      ],
    };
    const out = roundCoords(fc, 5);
    expect(out.features[0]?.geometry.coordinates).toEqual([
      [106.81235, -6.12346],
      [106.8, -6.2],
    ]);
  });
});

describe('byteSize', () => {
  it('returns the UTF-8 byte length of the JSON-serialised value', () => {
    expect(byteSize({ a: 1 })).toBe(Buffer.byteLength(JSON.stringify({ a: 1 }), 'utf8'));
    expect(byteSize('é')).toBe(Buffer.byteLength(JSON.stringify('é'), 'utf8'));
  });
});

describe('mergeWays', () => {
  it('chains ways that share an endpoint within tolerance', () => {
    const ways: Position[][] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 0.0000001],
        [2, 0],
      ],
    ];
    expect(mergeWays(ways)).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    ]);
  });

  it('reverses a candidate way when its end matches the chain end', () => {
    const ways: Position[][] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [1, 0],
      ],
    ];
    expect(mergeWays(ways)).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    ]);
  });

  it('leaves disjoint ways separate', () => {
    const ways: Position[][] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [5, 5],
        [6, 5],
      ],
    ];
    expect(mergeWays(ways)).toEqual(ways);
  });
});

describe('simplifyRing', () => {
  it('drops points that lie on (near) a straight run', () => {
    const ring: Position[] = [
      [0, 0],
      [1, 0.0000001],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    const out = simplifyRing(ring, 0.001);
    expect(out[0]).toEqual(out[out.length - 1]);
    expect(out).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ]);
  });

  it('keeps rings of 3 points or fewer distinct vertices untouched', () => {
    const ring: Position[] = [
      [0, 0],
      [1, 1],
      [0, 0],
    ];
    expect(simplifyRing(ring, 0.001)).toEqual(ring);
  });

  it('returns the original ring unchanged rather than collapse below a valid ring', () => {
    const ring: Position[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    // A tolerance this large would flatten the square to just its two
    // farthest-apart corners (fewer than 4 positions = not a valid ring).
    expect(simplifyRing(ring, 100)).toEqual(ring);
  });
});

describe('parseArgs', () => {
  it('parses --source, --only and --out', () => {
    expect(
      parseArgs(['--source', 'data/sources/gage.json', '--only', 'a,b', '--out', 'tmp']),
    ).toEqual({
      source: 'data/sources/gage.json',
      only: new Set(['a', 'b']),
      out: 'tmp',
    });
  });

  it('requires --source', () => {
    expect(() => parseArgs([])).toThrow();
  });

  it('rejects --source with a missing value', () => {
    expect(() => parseArgs(['--source'])).toThrow();
  });

  it('rejects --source when the next token looks like another flag', () => {
    expect(() => parseArgs(['--source', '--only', 'a'])).toThrow();
  });

  it('rejects --only with a missing value at the end of argv', () => {
    expect(() => parseArgs(['--source', 'x.json', '--only'])).toThrow();
  });

  it('rejects --out with a missing value', () => {
    expect(() => parseArgs(['--source', 'x.json', '--out'])).toThrow();
  });
});

describe('normaliseName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normaliseName('Jenderal Sudirmán')).toBe('jenderal sudirman');
  });
  it('normalises jl./jalan to the same token', () => {
    expect(normaliseName('Jl. Gajah Mada')).toBe('jalan gajah mada');
    expect(normaliseName('Jalan Gajah Mada')).toBe('jalan gajah mada');
  });
  it('collapses repeated whitespace', () => {
    expect(normaliseName('Jl.   Gajah   Mada')).toBe('jalan gajah mada');
  });
  it('treats "jl." as its own token even with no following whitespace', () => {
    expect(normaliseName('Jl.Sudirman')).toBe('jalan sudirman');
    expect(normaliseName('JL Sudirman')).toBe('jalan sudirman');
  });
});

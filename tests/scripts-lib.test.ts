import { describe, expect, it } from 'vitest';
import { buildQuery, clipLine, qlString } from '../scripts/lib.ts';

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

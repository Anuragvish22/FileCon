import { describe, expect, it } from 'vitest';
import { COST } from '../../src/costs.ts';
import { buildGraph, route } from '../../src/graph/index.ts';
import { fakeConverter, fullGraphOf, registryOf, stepsOf } from '../fakes.ts';

describe('route', () => {
  it('finds a direct route', () => {
    const graph = fullGraphOf(
      registryOf(
        fakeConverter({
          id: 'sharp',
          edges: [{ from: 'png', to: 'jpg', cost: COST.lossyReencode }],
        }),
      ),
    );
    expect(route(graph, 'png', 'jpg')).toEqual({
      steps: [{ converterId: 'sharp', from: 'png', to: 'jpg' }],
      cost: COST.lossyReencode,
      hops: 1,
      lossy: [],
      fanOut: false,
    });
  });

  it('takes a cheap 2-hop route over an expensive 1-hop one', () => {
    const graph = fullGraphOf(
      registryOf(
        fakeConverter({ id: 'direct', edges: [{ from: 'docx', to: 'png', cost: COST.majorLoss }] }),
        fakeConverter({ id: 'office', edges: [{ from: 'docx', to: 'pdf', cost: COST.render }] }),
        fakeConverter({ id: 'poppler', edges: [{ from: 'pdf', to: 'png', cost: COST.container }] }),
      ),
    );
    expect(stepsOf(route(graph, 'docx', 'png'))).toEqual(['office:docx>pdf', 'poppler:pdf>png']);
  });

  it('returns null when the only route needs 4 hops', () => {
    const chain = fakeConverter({
      id: 'chain',
      edges: [
        { from: 'docx', to: 'odt', cost: COST.container },
        { from: 'odt', to: 'rtf', cost: COST.container },
        { from: 'rtf', to: 'pdf', cost: COST.container },
        { from: 'pdf', to: 'png', cost: COST.container },
      ],
    });
    const graph = fullGraphOf(registryOf(chain));
    expect(route(graph, 'docx', 'pdf')?.hops).toBe(3);
    expect(route(graph, 'docx', 'png')).toBeNull();
  });

  it('keeps a dearer short prefix when the cheaper one leaves no hops (capped Dijkstra drops it)', () => {
    const graph = fullGraphOf(
      registryOf(
        fakeConverter({
          id: 'chain',
          edges: [
            { from: 'docx', to: 'odt', cost: COST.container },
            { from: 'odt', to: 'pdf', cost: COST.container },
            { from: 'docx', to: 'pdf', cost: COST.lossyReencode },
            { from: 'pdf', to: 'png', cost: COST.container },
            { from: 'png', to: 'webp', cost: COST.container },
          ],
        }),
      ),
    );
    // The cheapest way to pdf takes 2 hops, so pdf → png → webp would need 4.
    expect(stepsOf(route(graph, 'docx', 'webp'))).toEqual([
      'chain:docx>pdf',
      'chain:pdf>png',
      'chain:png>webp',
    ]);
  });

  it('finds a cheaper route with more hops', () => {
    const graph = fullGraphOf(
      registryOf(
        fakeConverter({
          id: 'direct',
          edges: [{ from: 'docx', to: 'webp', cost: COST.majorLoss }],
        }),
        fakeConverter({
          id: 'chain',
          edges: [
            { from: 'docx', to: 'pdf', cost: COST.container },
            { from: 'pdf', to: 'png', cost: COST.container },
            { from: 'png', to: 'webp', cost: COST.container },
          ],
        }),
      ),
    );
    expect(route(graph, 'docx', 'webp')).toMatchObject({ hops: 3, cost: 3 * COST.container });
  });

  describe('ties', () => {
    it('prefers fewer hops at equal cost', () => {
      const graph = fullGraphOf(
        registryOf(
          fakeConverter({
            id: 'chain',
            edges: [
              { from: 'docx', to: 'odt', cost: COST.losslessReencode },
              { from: 'odt', to: 'pdf', cost: COST.lossyReencode },
              { from: 'docx', to: 'pdf', cost: COST.render },
            ],
          }),
        ),
      );
      expect(stepsOf(route(graph, 'docx', 'pdf'))).toEqual(['chain:docx>pdf']);
    });

    it('keeps the priority converter for the same pair, else the first registered', () => {
      const edges = [{ from: 'docx', to: 'pdf', cost: COST.render }];
      const registry = registryOf(
        fakeConverter({ id: 'alpha', edges }),
        fakeConverter({ id: 'beta', edges }),
      );
      expect(stepsOf(route(fullGraphOf(registry), 'docx', 'pdf'))).toEqual(['alpha:docx>pdf']);
      expect(stepsOf(route(fullGraphOf(registry, ['beta']), 'docx', 'pdf'))).toEqual([
        'beta:docx>pdf',
      ]);
    });

    it('picks the route with better priority ranks at equal cost and hops', () => {
      const registry = registryOf(
        fakeConverter({
          id: 'alpha',
          edges: [
            { from: 'docx', to: 'odt', cost: COST.container },
            { from: 'odt', to: 'pdf', cost: COST.container },
          ],
        }),
        fakeConverter({
          id: 'beta',
          edges: [
            { from: 'docx', to: 'rtf', cost: COST.container },
            { from: 'rtf', to: 'pdf', cost: COST.container },
          ],
        }),
      );
      expect(stepsOf(route(fullGraphOf(registry, ['beta']), 'docx', 'pdf'))).toEqual([
        'beta:docx>rtf',
        'beta:rtf>pdf',
      ]);
    });
  });

  describe('self-edges', () => {
    const graph = fullGraphOf(
      registryOf(
        fakeConverter({
          id: 'sharp',
          edges: [
            { from: 'jpg', to: 'jpg', cost: COST.lossyReencode, lossy: 'recompressed' },
            { from: 'png', to: 'jpg', cost: COST.lossyReencode },
            { from: 'jpg', to: 'webp', cost: COST.lossyReencode },
          ],
        }),
      ),
    );

    it('is the 1-step route from a format to itself', () => {
      expect(route(graph, 'jpg', 'jpg')).toMatchObject({ hops: 1, lossy: ['recompressed'] });
    });

    it('gives null for a format to itself without one', () => {
      expect(route(graph, 'png', 'png')).toBeNull();
    });

    it('never appears inside a multi-hop route', () => {
      expect(stepsOf(route(graph, 'png', 'webp'))).toEqual(['sharp:png>jpg', 'sharp:jpg>webp']);
    });
  });

  describe('fan-out', () => {
    const pdfToPng = { from: 'pdf', to: 'png', cost: COST.container, fanOut: true };
    const pngToGif = { from: 'png', to: 'gif', cost: COST.container, fanOut: true };

    it('allows at most one fan-out per route', () => {
      const graph = fullGraphOf(
        registryOf(fakeConverter({ id: 'pages', edges: [pdfToPng, pngToGif] })),
      );
      expect(route(graph, 'pdf', 'png')?.fanOut).toBe(true);
      expect(route(graph, 'pdf', 'gif')).toBeNull();
    });

    it('still finds a dearer route that saves its one fan-out', () => {
      const graph = fullGraphOf(
        registryOf(
          fakeConverter({
            id: 'pages',
            edges: [
              pdfToPng,
              pngToGif,
              { from: 'pdf', to: 'tiff', cost: COST.container },
              { from: 'tiff', to: 'png', cost: COST.container },
            ],
          }),
        ),
      );
      expect(stepsOf(route(graph, 'pdf', 'gif'))).toEqual([
        'pages:pdf>tiff',
        'pages:tiff>png',
        'pages:png>gif',
      ]);
    });
  });

  it('never visits a format twice', () => {
    const formats = ['docx', 'odt', 'rtf', 'pdf'];
    const everyPair = formats.flatMap((from) =>
      formats.filter((to) => to !== from).map((to) => ({ from, to, cost: COST.container })),
    );
    const graph = fullGraphOf(registryOf(fakeConverter({ id: 'mesh', edges: everyPair })));
    for (const from of formats) {
      for (const to of formats.filter((format) => format !== from)) {
        const visited = [from, ...(route(graph, from, to)?.steps.map((step) => step.to) ?? [])];
        expect(new Set(visited).size).toBe(visited.length);
      }
    }
  });

  it('starts with an empty cache when the graph is rebuilt', () => {
    const registry = registryOf(
      fakeConverter({ id: 'office', edges: [{ from: 'docx', to: 'pdf', cost: COST.render }] }),
    );
    const before = buildGraph({ registry, availableIds: new Set(), priority: [] });
    expect(route(before, 'docx', 'pdf')).toBeNull();
    const rebuilt = buildGraph({ registry, availableIds: new Set(['office']), priority: [] });
    expect(route(rebuilt, 'docx', 'pdf')).not.toBeNull();
    expect(route(rebuilt, 'docx', 'pdf')).toBe(route(rebuilt, 'docx', 'pdf'));
  });
});

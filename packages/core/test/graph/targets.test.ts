import { describe, expect, it } from 'vitest';
import { COST } from '../../src/costs.ts';
import { buildGraph, targets } from '../../src/graph/index.ts';
import { fakeCombiner, fakeConverter, fullGraphOf, registryOf, stepsOf } from '../fakes.ts';

describe('targets', () => {
  const office = fakeConverter({
    id: 'office',
    pack: 'office',
    edges: [{ from: 'docx', to: 'pdf', cost: COST.render, lossy: 'layout-approx' }],
  });
  const poppler = fakeConverter({
    id: 'poppler',
    edges: [{ from: 'pdf', to: 'png', cost: COST.render, fanOut: true, options: ['dpi', 'pages'] }],
  });
  const sharp = fakeConverter({
    id: 'sharp',
    edges: [
      { from: 'png', to: 'jpg', cost: COST.lossyReencode, options: ['quality'] },
      { from: 'jpg', to: 'png', cost: COST.losslessReencode },
      { from: 'png', to: 'pdf', cost: COST.container },
    ],
  });
  const mergePdf = fakeCombiner({ id: 'merge-pdf', accepts: 'pdf', output: 'pdf' });
  const stackPng = fakeCombiner({ id: 'stack-png', accepts: 'png', output: 'png' });
  const registry = registryOf(office, poppler, sharp, mergePdf, stackPng);
  const full = fullGraphOf(registry);
  const everything = { available: full, full };
  const withoutOffice = {
    available: buildGraph({ registry, availableIds: new Set(['poppler', 'sharp']), priority: [] }),
    full,
  };

  it('offers only formats every input reaches, with lossy and options unioned', () => {
    const result = targets({ ...everything, formats: ['docx', 'png'] });
    const jpg = result.convert.find((option) => option.format === 'jpg');
    expect(result.convert.map((option) => option.format).sort()).toEqual(['jpg', 'pdf']); // png has no self-edge
    expect(jpg).toMatchObject({
      status: 'ready',
      lossy: ['layout-approx'],
      fanOut: true,
      options: expect.arrayContaining(['dpi', 'pages', 'quality']) as unknown,
    });
    expect(jpg?.route).toBeUndefined();
  });

  it('sets the route only for a single input format', () => {
    const [pdf] = targets({ ...everything, formats: ['docx'] }).convert;
    expect(stepsOf(pdf?.route ?? null)).toEqual(['office:docx>pdf']);
  });

  it("offers the input's own format only through a self-edge", () => {
    const formatsFor = (inputs: string[]) =>
      targets({ ...everything, formats: inputs }).convert.map((option) => option.format);
    expect(formatsFor(['png'])).not.toContain('png');
    expect(formatsFor(['jpg', 'png'])).not.toContain('png');
    const withSelfEdge = fullGraphOf(
      registryOf(
        fakeConverter({
          id: 'sharp',
          edges: [...sharp.edges, { from: 'png', to: 'png', cost: COST.losslessReencode }],
        }),
      ),
    );
    const selfFormats = (inputs: string[]) =>
      targets({ available: withSelfEdge, full: withSelfEdge, formats: inputs }).convert.map(
        (option) => option.format,
      );
    expect(selfFormats(['png'])).toContain('png');
    expect(selfFormats(['jpg', 'png'])).toContain('png');
  });

  it('labels needs-pack from the full graph, with the missing pack', () => {
    const result = targets({ ...withoutOffice, formats: ['docx'] });
    expect(result.convert.find((option) => option.format === 'png')).toMatchObject({
      status: 'needs-pack',
      pack: 'office',
      fanOut: true,
    });
    expect(result.convert.find((option) => option.format === 'png')?.route).toBeUndefined();
  });

  it('offers a combiner when every input reaches what it accepts', () => {
    const result = targets({ ...everything, formats: ['pdf', 'docx'] });
    expect(result.merge).toContainEqual({
      combinerId: 'merge-pdf',
      output: 'pdf',
      status: 'ready',
      fanOut: false,
    });
    const unreachable = targets({ ...everything, formats: ['xlsx'] });
    expect(unreachable.merge).toEqual([]);
    const missingOffice = targets({ ...withoutOffice, formats: ['docx'] });
    expect(missingOffice.merge).toContainEqual(
      expect.objectContaining({ combinerId: 'merge-pdf', status: 'needs-pack', pack: 'office' }),
    );
  });

  it('marks a merge whose route fans out, so a single file can merge', () => {
    const merge = targets({ ...everything, formats: ['pdf'] }).merge;
    expect(merge.find((entry) => entry.combinerId === 'stack-png')?.fanOut).toBe(true);
    const fromPng = targets({ ...everything, formats: ['png'] }).merge;
    expect(fromPng.find((entry) => entry.combinerId === 'stack-png')?.fanOut).toBe(false);
  });

  it('names the pack of the blocked input, not of one that is ready another way', () => {
    const mixed = registryOf(
      fakeConverter({
        id: 'slow-docx',
        edges: [{ from: 'docx', to: 'pdf', cost: COST.approximate }],
      }),
      fakeConverter({
        id: 'office',
        pack: 'office',
        edges: [{ from: 'docx', to: 'pdf', cost: COST.render }],
      }),
      fakeConverter({
        id: 'media',
        pack: 'media',
        edges: [{ from: 'mp4', to: 'pdf', cost: COST.render }],
      }),
    );
    const result = targets({
      available: buildGraph({
        registry: mixed,
        availableIds: new Set(['slow-docx']),
        priority: [],
      }),
      full: fullGraphOf(mixed),
      formats: ['docx', 'mp4'],
    });
    expect(result.convert.find((option) => option.format === 'pdf')).toMatchObject({
      status: 'needs-pack',
      pack: 'media',
    });
  });

  it('returns nothing for no inputs', () => {
    expect(targets({ ...everything, formats: [] })).toEqual({
      convert: [],
      merge: [],
      extract: [],
    });
  });
});

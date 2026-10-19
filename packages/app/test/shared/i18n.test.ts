import { describe, expect, it } from 'vitest';
import { CATALOGS, createTranslator } from '../../src/shared/i18n.ts';

const catalogs = {
  en: {
    greet: 'Hello {name}',
    'files.one': '{count} file',
    'files.other': '{count} files',
    'only.en': 'English only',
  },
  fr: { greet: 'Bonjour {name}' },
};

const make = (locale: 'en' | 'fr' = 'en') => {
  const warnings: string[] = [];
  const translate = createTranslator({
    locale: locale as 'en',
    catalogs,
    warn: (message) => warnings.push(message),
  });
  return { translate, warnings };
};

describe('translate()', () => {
  it('substitutes {param}', () => {
    expect(make().translate('greet', { name: 'Ada' })).toBe('Hello Ada');
  });

  it('picks .one and .other from the count', () => {
    const { translate } = make();
    expect(translate('files', { count: 1 })).toBe('1 file');
    expect(translate('files', { count: 3 })).toBe('3 files');
    expect(translate('files', { count: 0 })).toBe('0 files');
  });

  it('formats numbers for the locale', () => {
    expect(make().translate('files', { count: 12345 })).toBe('12,345 files');
  });

  it('falls back to en, then to the key', () => {
    const { translate } = make('fr');
    expect(translate('greet', { name: 'Ada' })).toBe('Bonjour Ada');
    expect(translate('only.en')).toBe('English only');
    expect(translate('nope')).toBe('nope');
  });

  it('warns once per missing key and never throws', () => {
    const { translate, warnings } = make();
    translate('nope');
    translate('nope');
    translate('other-nope');
    expect(warnings).toEqual(['missing text key: nope', 'missing text key: other-nope']);
  });

  it('leaves a missing {param} visible', () => {
    expect(make().translate('greet')).toBe('Hello {name}');
  });
});

describe('shipped catalogs', () => {
  it('translates a core error with its params', () => {
    const translate = createTranslator({ locale: 'en', warn: () => undefined });
    expect(translate('error.INPUT_NOT_FOUND', { name: 'a.png' })).toBe('a.png no longer exists');
    expect(Object.keys(CATALOGS)).toEqual(['en']);
  });
});

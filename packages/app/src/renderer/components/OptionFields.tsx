import type { ConvertOptions, OptionKey } from '@filecon/core/types';
import { useId } from 'react';
import { Select } from './ui/Select.tsx';
import { pagesValid } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

const NUMBER_OPTIONS = {
  quality: { min: 1, max: 100 },
  dpi: { min: 72, max: 600 },
  width: { min: 1, max: 65_535 },
  height: { min: 1, max: 65_535 },
} as const;
const PAGE_SIZES = ['auto', 'a4', 'letter'] as const;
const TIFF_COMPRESSIONS = ['lzw', 'deflate', 'jpeg', 'none'] as const;
const DEFAULT_BACKGROUND = '#ffffff'; // content color, the jpg default of CONTRACTS section 2, not a theme color

const INPUT_CLASS =
  'h-8 rounded-control border border-border-strong bg-surface px-2 text-fg aria-invalid:border-danger';

const numberOrUndefined = (text: string): number | undefined =>
  text === '' ? undefined : Number(text);

export interface OptionFieldProps {
  option: OptionKey;
  options: ConvertOptions;
  onChange: (key: OptionKey, value: unknown) => void;
}

/** One option input; a value of `undefined` means "back to the default". */
export const OptionField = ({ option, options, onChange }: OptionFieldProps) => {
  const { translate } = useStore();
  const errorId = useId();
  const label = translate(`option.${option}`);
  const row = 'flex items-center justify-between gap-3';
  switch (option) {
    case 'quality':
    case 'dpi':
    case 'width':
    case 'height':
      return (
        <label className={row}>
          <span>{label}</span>
          <input
            type="number"
            className={INPUT_CLASS}
            {...NUMBER_OPTIONS[option]}
            value={options[option] ?? ''}
            onChange={(event) => onChange(option, numberOrUndefined(event.target.value))}
          />
        </label>
      );
    case 'pageSize':
    case 'tiffCompression': {
      const choices = option === 'pageSize' ? PAGE_SIZES : TIFF_COMPRESSIONS;
      return (
        <label className={row}>
          <span>{label}</span>
          <Select
            label={label}
            value={options[option] ?? choices[0]}
            onValueChange={(value) => onChange(option, value)}
            options={choices.map((choice) => ({
              value: choice,
              label: translate(`option.${option}.${choice}`),
            }))}
          />
        </label>
      );
    }
    case 'pages': {
      const valid = pagesValid(options.pages ?? '');
      return (
        <div>
          <label className={row}>
            <span>{label}</span>
            <input
              type="text"
              className={INPUT_CLASS}
              value={options.pages ?? ''}
              aria-invalid={!valid}
              aria-describedby={valid ? undefined : errorId}
              onChange={(event) =>
                onChange('pages', event.target.value === '' ? undefined : event.target.value)
              }
            />
          </label>
          {!valid && (
            <p id={errorId} className="text-danger">
              {translate('option.pages.invalid')}
            </p>
          )}
        </div>
      );
    }
    case 'grayscale':
    case 'keepMetadata':
      return (
        <label className={row}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={options[option] === true}
            onChange={(event) => onChange(option, event.target.checked ? true : undefined)}
          />
        </label>
      );
    case 'background':
      return (
        <label className={row}>
          <span>{label}</span>
          <input
            type="color"
            value={options.background ?? DEFAULT_BACKGROUND}
            onChange={(event) => onChange('background', event.target.value)}
          />
        </label>
      );
  }
};

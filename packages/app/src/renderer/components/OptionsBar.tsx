import type { ConvertOptions, OptionKey } from '@filecon/core/types';
import { pagesValid, visibleOptions } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

const NUMBER_OPTIONS = {
  quality: { min: 1, max: 100 },
  dpi: { min: 72, max: 600 },
  width: { min: 1, max: 65_535 },
  height: { min: 1, max: 65_535 },
} as const;
const PAGE_SIZES = ['auto', 'a4', 'letter'] as const;
const TIFF_COMPRESSIONS = ['lzw', 'deflate', 'jpeg', 'none'] as const;
const DEFAULT_BACKGROUND = '#ffffff';

const numberOrUndefined = (text: string): number | undefined =>
  text === '' ? undefined : Number(text);

const Field = ({ option, options }: { option: OptionKey; options: ConvertOptions }) => {
  const { actions, translate } = useStore();
  const label = translate(`option.${option}`);
  switch (option) {
    case 'quality':
    case 'dpi':
    case 'width':
    case 'height':
      return (
        <label>
          <span>{label}</span>
          <input
            type="number"
            {...NUMBER_OPTIONS[option]}
            value={options[option] ?? ''}
            onChange={(event) => actions.setOption(option, numberOrUndefined(event.target.value))}
          />
        </label>
      );
    case 'pageSize':
    case 'tiffCompression': {
      const choices = option === 'pageSize' ? PAGE_SIZES : TIFF_COMPRESSIONS;
      return (
        <label>
          <span>{label}</span>
          <select
            value={options[option] ?? choices[0]}
            onChange={(event) => actions.setOption(option, event.target.value)}
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {translate(`option.${option}.${choice}`)}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case 'pages': {
      const valid = pagesValid(options.pages ?? '');
      return (
        <label>
          <span>{label}</span>
          <input
            type="text"
            value={options.pages ?? ''}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : 'pages-error'}
            onChange={(event) =>
              actions.setOption('pages', event.target.value === '' ? undefined : event.target.value)
            }
          />
          {!valid && <span id="pages-error">{translate('option.pages.invalid')}</span>}
        </label>
      );
    }
    case 'grayscale':
    case 'keepMetadata':
      return (
        <label>
          <input
            type="checkbox"
            checked={options[option] === true}
            onChange={(event) => actions.setOption(option, event.target.checked ? true : undefined)}
          />
          <span>{label}</span>
        </label>
      );
    case 'background':
      return (
        <label>
          <span>{label}</span>
          <input
            type="color"
            value={options.background ?? DEFAULT_BACKGROUND}
            onChange={(event) => actions.setOption('background', event.target.value)}
          />
        </label>
      );
  }
};

/** Only the keys the chosen route honours (CONTRACTS section 2). */
export const OptionsBar = () => {
  const { state } = useStore();
  const shown = visibleOptions(state);
  if (shown.length === 0) return null;
  return (
    <div className="options">
      {shown.map((option) => (
        <Field key={option} option={option} options={state.selection.options} />
      ))}
    </div>
  );
};

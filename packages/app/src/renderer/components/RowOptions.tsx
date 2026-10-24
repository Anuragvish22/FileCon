import type { ConvertOptions, OptionKey } from '@filecon/core/types';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover.tsx';
import { OptionField } from './OptionFields.tsx';
import { pagesValid } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

export interface RowOptionsProps {
  /** Names the popover and the button: the file, or the whole batch. */
  title: string;
  /** Only the keys this route honours (CONTRACTS section 2). */
  keys: OptionKey[];
  options: ConvertOptions;
  onChange: (key: OptionKey, value: unknown) => void;
  onReset: () => void;
  onApplyToAll: () => void;
  unavailable?: boolean;
}

const ICON_SIZE = 16;

/** The `[opts]` button and its popover (UI-DESIGN section 3). */
export const RowOptions = ({
  title,
  keys,
  options,
  onChange,
  onReset,
  onApplyToAll,
  unavailable = false,
}: RowOptionsProps) => {
  const { translate } = useStore();
  const none = keys.length === 0;
  const custom = keys.some((key) => options[key] !== undefined);
  const label = translate('options.open', { name: title });
  const button = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      unavailable={unavailable || none}
      reason={none ? translate('options.none') : undefined}
    >
      <SlidersHorizontal size={ICON_SIZE} aria-hidden="true" />
      {custom && (
        <span
          className="size-2 rounded-full bg-accent"
          role="img"
          aria-label={translate('options.custom')}
        />
      )}
    </Button>
  );
  // An unavailable button must not be a popover trigger: Radix would still open on its click.
  if (unavailable || none) return button;
  return (
    <Popover>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent role="dialog" aria-label={label} className="grid w-80 gap-3">
        <h3 className="font-semibold">{title}</h3>
        {keys.map((key) => (
          <OptionField key={key} option={key} options={options} onChange={onChange} />
        ))}
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onReset}>
            {translate('options.reset')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            unavailable={!pagesValid(options.pages ?? '')}
            reason={translate('option.pages.invalid')}
            onClick={onApplyToAll}
          >
            {translate('options.applyToAll')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

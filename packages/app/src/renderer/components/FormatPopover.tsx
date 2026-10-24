import { FORMATS } from '@filecon/core/formats';
import type { Format, FormatCategory } from '@filecon/core/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { CATEGORIES } from '../format.ts';
import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';
import { cx } from './ui/cx.ts';
import { Chip, type ChipState } from './ui/Chip.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover.tsx';

/** What core says a format is for these files; a format with no offer is not possible for them. */
export interface FormatOffer {
  format: Format;
  status: 'ready' | 'needs-pack';
  pack?: string;
  lossy: string[];
}

export interface FormatPopoverProps {
  /** Names the button and the dialog: the file or the batch. */
  title: string;
  /** The source format(s) as text, for "JPG can't be converted to SVG". */
  from: string;
  value: Format | null;
  offers: FormatOffer[];
  unavailable?: boolean;
  onPick: (format: Format) => void;
}

interface Entry {
  format: Format;
  category: FormatCategory;
  state: ChipState;
  offer: FormatOffer | undefined;
}

const STATE_ORDER: Record<ChipState, number> = { available: 0, locked: 1, unavailable: 2 };
const FIRST = 0;
const ICON_SIZE = 16;

/**
 * The format select (UI-DESIGN section 3): a combobox with a search field, categories and one chip per
 * registry format. A format the files can't become is dimmed, never hidden.
 */
export const FormatPopover = ({
  title,
  from,
  value,
  offers,
  unavailable = false,
  onPick,
}: FormatPopoverProps) => {
  const { actions, translate } = useStore();
  const [popover, setPopover] = useState<'open' | 'closed'>('closed');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FormatCategory | undefined>(undefined);
  const [active, setActive] = useState(FIRST);
  const listId = useId();

  const entries: Entry[] = FORMATS.map((info) => {
    const offer = offers.find((candidate) => candidate.format === info.id);
    const state: ChipState =
      offer === undefined ? 'unavailable' : offer.status === 'ready' ? 'available' : 'locked';
    return { format: info.id, category: info.category, state, offer };
  });
  const searching = query.trim() !== '';
  const shownCategory = category ?? CATEGORIES[FIRST];
  const name = (format: Format): string => translate(`format.${format}`);
  const visible = searching
    ? entries
        .filter((entry) => name(entry.format).toLowerCase().includes(query.trim().toLowerCase()))
        .sort((left, right) => STATE_ORDER[left.state] - STATE_ORDER[right.state])
    : entries.filter((entry) => entry.category === shownCategory);
  const activeEntry = visible[Math.min(active, visible.length - 1)];
  const chipId = (format: Format): string => `${listId}-${format}`;

  const choose = (entry: Entry): void => {
    if (entry.state === 'unavailable') return;
    setPopover('closed');
    if (entry.state === 'locked') actions.setPage('engines');
    else onPick(entry.format);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const last = visible.length - 1;
    if (event.key === 'ArrowDown') setActive(Math.min(last, active + 1));
    else if (event.key === 'ArrowUp') setActive(Math.max(FIRST, active - 1));
    else if (event.key === 'Enter' && activeEntry !== undefined) choose(activeEntry);
    else return;
    event.preventDefault();
  };

  const label = translate('picker.open', { name: title });
  const trigger = (
    <Button aria-label={label} unavailable={unavailable}>
      {value === null ? translate('picker.choose') : name(value)}
      <ChevronDown size={ICON_SIZE} aria-hidden="true" />
    </Button>
  );
  // An unavailable button must not be a popover trigger: Radix would still open on its click.
  if (unavailable) return trigger;
  return (
    <Popover
      open={popover === 'open'}
      onOpenChange={(next) => {
        setPopover(next ? 'open' : 'closed');
        setQuery('');
        setActive(FIRST);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent role="dialog" aria-label={label} className="w-[30rem]">
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeEntry === undefined ? undefined : chipId(activeEntry.format)}
          aria-label={translate('picker.search')}
          placeholder={translate('picker.search')}
          className="mb-2 h-8 w-full rounded-control border border-border-strong bg-surface px-2"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(FIRST);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="flex gap-3">
          {!searching && (
            <ul className="grid w-36 content-start gap-1">
              {CATEGORIES.map((candidate) => (
                <li key={candidate}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cx(
                      'w-full justify-between',
                      candidate === shownCategory && 'bg-accent-subtle font-semibold',
                    )}
                    aria-pressed={candidate === shownCategory}
                    onClick={() => {
                      setCategory(candidate);
                      setActive(FIRST);
                    }}
                  >
                    {translate(`category.${candidate}`)}
                    {candidate === shownCategory && (
                      <ChevronRight size={ICON_SIZE} aria-hidden="true" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={translate('picker.formats')}
            className="grid flex-1 grid-cols-3 content-start gap-1"
          >
            {visible.map((entry) => (
              <Chip
                key={entry.format}
                id={chipId(entry.format)}
                role="option"
                aria-selected={entry.format === value}
                aria-pressed={undefined}
                tabIndex={-1}
                flat
                state={entry.state}
                selected={entry.format === value}
                lossy={(entry.offer?.lossy.length ?? 0) > 0}
                title={entry.offer?.lossy.map((id) => translate(`lossy.${id}`)).join(' ')}
                reason={translate('picker.unavailable', { from, to: name(entry.format) })}
                data-active={entry.format === activeEntry?.format}
                onClick={() => choose(entry)}
              >
                {name(entry.format)}
                {entry.offer?.pack !== undefined &&
                  entry.state === 'locked' &&
                  ` ${translate('picker.locked', { pack: translate(`pack.${entry.offer.pack}`) })}`}
              </Chip>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

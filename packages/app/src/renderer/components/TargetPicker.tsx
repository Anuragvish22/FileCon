import type { TargetOption } from '@filecon/core/types';
import { useRef, useState, type KeyboardEvent } from 'react';
import { groupTargets } from '../format.ts';
import { convertibleFiles, offeredTargets } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';
import { moveActive, typeahead } from './listbox.ts';

const TYPEAHEAD_RESET_MS = 700;

export const TargetPicker = () => {
  const { state, actions, translate } = useStore();
  const [active, setActive] = useState(0);
  const typed = useRef({ text: '', at: 0 });
  const { targets } = state;
  const options = offeredTargets(state);
  const label = (option: TargetOption): string => translate(`format.${option.format}`);

  // A locked target never becomes the selection: it leads to the Engines page (UI-DESIGN section 3).
  const choose = (option: TargetOption): void => {
    if (option.status === 'needs-pack') actions.setPage('engines');
    else actions.pickTarget(option.format);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const moved = moveActive(event.key, active, options.length);
    if (moved !== active) {
      event.preventDefault();
      setActive(moved);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option !== undefined) choose(option);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const now = Date.now();
      const text =
        now - typed.current.at > TYPEAHEAD_RESET_MS ? event.key : typed.current.text + event.key;
      typed.current = { text, at: now };
      setActive(typeahead(text, options.map(label), text.length > 1 ? active - 1 : active));
    }
  };

  if (convertibleFiles(state).length === 0) return null;
  if (targets.status === 'loading' || targets.status === 'idle')
    return <p role="status">{translate('target.loading')}</p>;
  if (targets.status === 'failed')
    return <p role="alert">{translate(`error.${targets.error.code}`, targets.error.params)}</p>;
  if (options.length === 0) return <p role="status">{translate('target.none')}</p>;

  return (
    <div>
      <span id="target-label">{translate('target.label')}</span>
      <div
        role="listbox"
        tabIndex={0}
        aria-labelledby="target-label"
        aria-activedescendant={`target-${options[active]?.format ?? ''}`}
        onKeyDown={onKeyDown}
      >
        {groupTargets(options).map((group) => (
          <div
            role="group"
            key={group.category ?? 'other'}
            aria-label={translate(`category.${group.category ?? 'other'}`)}
          >
            <div className="group-title">{translate(`category.${group.category ?? 'other'}`)}</div>
            {group.options.map((option) => (
              <div
                role="option"
                id={`target-${option.format}`}
                key={option.format}
                aria-selected={state.selection.target === option.format}
                data-active={options[active]?.format === option.format}
                data-locked={option.status === 'needs-pack'}
                onClick={() => {
                  setActive(options.indexOf(option));
                  choose(option);
                }}
              >
                <span>{label(option)}</span>
                {option.lossy.length > 0 && <span>{translate('target.lossy')}</span>}
                {option.status === 'needs-pack' && option.pack !== undefined && (
                  <span>
                    {translate('target.locked', { pack: translate(`pack.${option.pack}`) })}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

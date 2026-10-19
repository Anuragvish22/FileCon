import type { Accent, Settings } from '@filecon/core/types';
import { OutputChooser } from '../components/OutputChooser.tsx';
import { CATALOGS } from '../../shared/i18n.ts';
import { ACCENTS } from '../theme/tokens.ts';
import { useStore } from '../store/context.tsx';

const THEMES: readonly Settings['ui']['theme'][] = ['system', 'light', 'dark'];
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;

export const SettingsPage = () => {
  const { state, actions, translate } = useStore();
  const { settings } = state;
  if (settings === null) return <p role="status">{translate('banner.starting')}</p>;
  const { ui, concurrency } = settings;
  const setUi = (patch: Partial<Settings['ui']>): void => {
    void actions.setSettings({ ui: { ...ui, ...patch } });
  };
  return (
    <section className="settings" aria-label={translate('settings.title')}>
      <h2>{translate('settings.title')}</h2>

      <fieldset>
        <legend>{translate('settings.theme')}</legend>
        {THEMES.map((theme) => (
          <label key={theme}>
            <input
              type="radio"
              name="theme"
              checked={ui.theme === theme}
              onChange={() => setUi({ theme })}
            />
            <span>{translate(`settings.theme.${theme}`)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{translate('settings.accent')}</legend>
        {ACCENTS.map((accent: Accent) => (
          <label key={accent} className="swatch" data-accent={accent}>
            <input
              type="radio"
              name="accent"
              checked={ui.accent === accent}
              onChange={() => setUi({ accent })}
            />
            {/* The name is shown next to the color, so color is never the only cue (UI-DESIGN section 7). */}
            <span>{translate(`settings.accent.${accent}`)}</span>
          </label>
        ))}
      </fieldset>

      <label>
        <span>{translate('settings.language')}</span>
        <select
          value={ui.language}
          onChange={(event) =>
            setUi({ language: event.target.value as Settings['ui']['language'] })
          }
        >
          <option value="system">{translate('settings.language.system')}</option>
          {Object.keys(CATALOGS).map((locale) => (
            <option key={locale} value={locale}>
              {translate(`settings.language.${locale}`)}
            </option>
          ))}
        </select>
      </label>

      <OutputChooser />

      <label>
        <span>{translate('settings.concurrency')}</span>
        <select
          value={concurrency === 'auto' ? 'auto' : String(concurrency)}
          onChange={(event) => {
            const { value } = event.target;
            void actions.setSettings({ concurrency: value === 'auto' ? 'auto' : Number(value) });
          }}
        >
          <option value="auto">{translate('settings.concurrency.auto')}</option>
          {Array.from({ length: MAX_CONCURRENCY - MIN_CONCURRENCY + 1 }, (unused, index) => (
            <option key={index} value={index + MIN_CONCURRENCY}>
              {index + MIN_CONCURRENCY}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
};

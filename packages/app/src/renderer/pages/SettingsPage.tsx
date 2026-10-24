import type { Accent, Settings } from '@filecon/core/types';
import { Select } from '../components/ui/Select.tsx';
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

      <div className="flex items-center gap-3">
        <span>{translate('settings.language')}</span>
        <Select
          label={translate('settings.language')}
          value={ui.language}
          onValueChange={(language) => setUi({ language: language as Settings['ui']['language'] })}
          options={[
            { value: 'system', label: translate('settings.language.system') },
            ...Object.keys(CATALOGS).map((locale) => ({
              value: locale,
              label: translate(`settings.language.${locale}`),
            })),
          ]}
        />
      </div>

      <OutputChooser />

      <div className="flex items-center gap-3">
        <span>{translate('settings.concurrency')}</span>
        <Select
          label={translate('settings.concurrency')}
          value={concurrency === 'auto' ? 'auto' : String(concurrency)}
          onValueChange={(value) =>
            void actions.setSettings({ concurrency: value === 'auto' ? 'auto' : Number(value) })
          }
          options={[
            { value: 'auto', label: translate('settings.concurrency.auto') },
            ...Array.from({ length: MAX_CONCURRENCY - MIN_CONCURRENCY + 1 }, (unused, index) => ({
              value: String(index + MIN_CONCURRENCY),
              label: String(index + MIN_CONCURRENCY),
            })),
          ]}
        />
      </div>
    </section>
  );
};

import type { Accent, Settings } from '@filecon/core/types';
import type { ReactNode } from 'react';
import { Select } from '../components/ui/Select.tsx';
import { OutputChooser } from '../components/OutputChooser.tsx';
import { CATALOGS } from '../../shared/i18n.ts';
import { ACCENTS } from '../theme/tokens.ts';
import { useStore } from '../store/context.tsx';

const THEMES: readonly Settings['ui']['theme'][] = ['system', 'light', 'dark'];
const MIN_CONCURRENCY = 1;
const COMMON_CONCURRENCY = 8;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="grid gap-3">
    <h3 className="text-base font-semibold">{title}</h3>
    <div className="grid gap-4 rounded-card border border-border bg-surface-raised p-4">
      {children}
    </div>
  </section>
);

const Choice = ({
  name,
  checked,
  onChange,
  children,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children?: ReactNode;
  label: string;
}) => (
  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3 has-checked:border-accent has-checked:bg-accent-subtle has-focus-visible:outline-2 has-focus-visible:outline-focus-ring">
    <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
    {children}
    {/* The name is shown next to the color, so color is never the only cue (UI-DESIGN section 7). */}
    <span>{label}</span>
  </label>
);

export const SettingsPage = () => {
  const { state, actions, translate } = useStore();
  const { settings } = state;
  if (settings === null) return <p role="status">{translate('banner.starting')}</p>;
  const { ui, concurrency } = settings;
  const setUi = (patch: Partial<Settings['ui']>): void => {
    void actions.setSettings({ ui: { ...ui, ...patch } });
  };
  const maxConcurrency = Math.max(
    COMMON_CONCURRENCY,
    typeof concurrency === 'number' ? concurrency : 0,
  );
  return (
    <section className="grid gap-6" aria-label={translate('settings.title')}>
      <h2 className="text-xl font-semibold">{translate('settings.title')}</h2>

      <Section title={translate('settings.section.appearance')}>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 font-medium">{translate('settings.theme')}</legend>
          {THEMES.map((theme) => (
            <Choice
              key={theme}
              name="theme"
              checked={ui.theme === theme}
              onChange={() => setUi({ theme })}
              label={translate(`settings.theme.${theme}`)}
            />
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 font-medium">{translate('settings.accent')}</legend>
          {ACCENTS.map((accent: Accent) => (
            <Choice
              key={accent}
              name="accent"
              checked={ui.accent === accent}
              onChange={() => setUi({ accent })}
              label={translate(`settings.accent.${accent}`)}
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: `var(--swatch-${accent})` }}
              />
            </Choice>
          ))}
        </fieldset>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{translate('settings.language')}</span>
          <Select
            label={translate('settings.language')}
            value={ui.language}
            onValueChange={(language) =>
              setUi({ language: language as Settings['ui']['language'] })
            }
            options={[
              { value: 'system', label: translate('settings.language.system') },
              ...Object.keys(CATALOGS).map((locale) => ({
                value: locale,
                label: translate(`settings.language.${locale}`),
              })),
            ]}
          />
        </div>
      </Section>

      <Section title={translate('settings.section.output')}>
        <OutputChooser />
      </Section>

      <Section title={translate('settings.section.performance')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{translate('settings.concurrency')}</p>
            <p className="text-muted">{translate('settings.concurrency.hint')}</p>
          </div>
          <Select
            label={translate('settings.concurrency')}
            value={concurrency === 'auto' ? 'auto' : String(concurrency)}
            onValueChange={(value) =>
              void actions.setSettings({ concurrency: value === 'auto' ? 'auto' : Number(value) })
            }
            options={[
              { value: 'auto', label: translate('settings.concurrency.auto') },
              ...Array.from({ length: maxConcurrency - MIN_CONCURRENCY + 1 }, (unused, index) => ({
                value: String(index + MIN_CONCURRENCY),
                label: String(index + MIN_CONCURRENCY),
              })),
            ]}
          />
        </div>
      </Section>
    </section>
  );
};

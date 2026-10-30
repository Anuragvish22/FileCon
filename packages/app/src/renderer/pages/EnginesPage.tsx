import type { EngineInfo } from '@filecon/core/types';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { useStore } from '../store/context.tsx';

const BADGE_STATUS = { ready: 'success', error: 'danger', missing: 'warning' } as const;

const EngineRow = ({ engine }: { engine: EngineInfo }) => {
  const { actions, translate } = useStore();
  const status = engine.error !== undefined ? 'error' : engine.found ? 'ready' : 'missing';
  const { install } = engine;
  const location =
    engine.source === 'bundled'
      ? translate('engine.bundled')
      : [engine.path, engine.version].filter((part) => part !== undefined).join(' · ');
  return (
    <li className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium">
            {translate(`pack.${engine.pack}`)}{' '}
            <span className="font-mono text-xs text-muted">{engine.id}</span>
          </p>
          <p className="truncate text-muted">{location}</p>
        </div>
        <Badge status={BADGE_STATUS[status]}>{translate(`engine.status.${status}`)}</Badge>
      </div>
      {engine.error !== undefined && (
        <p className="text-danger">
          {translate(`engine.error.${engine.error.code}`, engine.error.params)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {engine.source !== 'bundled' && (
          <>
            <Button size="sm" onClick={() => void actions.chooseEnginePath(engine.id)}>
              {translate('engine.setPath')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void actions.openExternal(engine.installUrl)}
            >
              {translate('engine.guide')}
            </Button>
          </>
        )}
        {!engine.found && install?.kind === 'download' && (
          <Button size="sm" variant="primary" onClick={() => void actions.installEngine(engine.id)}>
            {translate('engine.install', { size: Math.round(install.sizeBytes / MEGABYTE) })}
          </Button>
        )}
        {!engine.found &&
          install?.kind === 'command' &&
          install.commands.map((command) => (
            <div key={command.cmd} className="flex items-center gap-2">
              <span className="text-muted">{command.label}</span>
              <code className="rounded-control bg-surface px-2 py-0.5 font-mono text-xs">
                {command.cmd}
              </code>
              <Button size="sm" onClick={() => void navigator.clipboard.writeText(command.cmd)}>
                {translate('engine.copy')}
              </Button>
            </div>
          ))}
      </div>
    </li>
  );
};

const MEGABYTE = 1_000_000;

export const EnginesPage = () => {
  const { state, actions, translate } = useStore();
  const missing = state.engines.filter(
    (engine) => !engine.found || engine.error !== undefined,
  ).length;
  return (
    <section className="grid gap-4" aria-label={translate('engines.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{translate('engines.title')}</h2>
          <p className={missing === 0 ? 'text-success' : 'text-warning'}>
            {missing === 0
              ? translate('engines.allReady')
              : translate('engines.needSetup', { count: missing })}
          </p>
        </div>
        <Button size="sm" onClick={() => void actions.refreshEngines()}>
          {translate('engine.recheck')}
        </Button>
      </div>
      <ul className="rounded-card border border-border bg-surface-raised">
        {state.engines.map((engine) => (
          <EngineRow key={engine.id} engine={engine} />
        ))}
      </ul>
    </section>
  );
};

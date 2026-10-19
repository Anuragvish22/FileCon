import type { EngineInfo } from '@filecon/core/types';
import { useStore } from '../store/context.tsx';

const EngineRow = ({ engine }: { engine: EngineInfo }) => {
  const { actions, translate } = useStore();
  const status = engine.error !== undefined ? 'error' : engine.found ? 'ready' : 'missing';
  const { install } = engine;
  return (
    <tr>
      <td>{translate(`pack.${engine.pack}`)}</td>
      <td>{engine.id}</td>
      <td>
        <span aria-hidden="true">{status === 'ready' ? '✓' : '✗'}</span>{' '}
        {translate(`engine.status.${status}`)}
        {engine.error !== undefined && <div>{engine.error}</div>}
      </td>
      <td>
        {engine.source === 'bundled'
          ? translate('engine.bundled')
          : [engine.path, engine.version].filter((part) => part !== undefined).join(' · ')}
      </td>
      <td>
        {engine.source !== 'bundled' && (
          <>
            <button type="button" onClick={() => void actions.chooseEnginePath(engine.id)}>
              {translate('engine.setPath')}
            </button>
            <button type="button" onClick={() => void actions.openExternal(engine.installUrl)}>
              {translate('engine.guide')}
            </button>
          </>
        )}
        {!engine.found && install?.kind === 'download' && (
          <button type="button" onClick={() => void actions.installEngine(engine.id)}>
            {translate('engine.install', { size: Math.round(install.sizeBytes / MEGABYTE) })}
          </button>
        )}
        {!engine.found &&
          install?.kind === 'command' &&
          install.commands.map((command) => (
            <div key={command.cmd}>
              <span>{command.label}</span> <code>{command.cmd}</code>
              <button type="button" onClick={() => void navigator.clipboard.writeText(command.cmd)}>
                {translate('engine.copy')}
              </button>
            </div>
          ))}
      </td>
    </tr>
  );
};

const MEGABYTE = 1_000_000;

export const EnginesPage = () => {
  const { state, actions, translate } = useStore();
  return (
    <section className="engines" aria-label={translate('engines.title')}>
      <h2>{translate('engines.title')}</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">{translate('engines.pack')}</th>
            <th scope="col">{translate('engines.engine')}</th>
            <th scope="col">{translate('engines.status')}</th>
            <th scope="col">{translate('engines.location')}</th>
            <th scope="col">{translate('engines.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {state.engines.map((engine) => (
            <EngineRow key={engine.id} engine={engine} />
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => void actions.refreshEngines()}>
        {translate('engine.recheck')}
      </button>
    </section>
  );
};

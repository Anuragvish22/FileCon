import type { DetectResult } from '@filecon/core/types';
import type { KeyboardEvent } from 'react';
import { useStore } from '../store/context.tsx';

const ROW_TYPE = 'application/x-filecon-row';

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

const FileRow = ({ file, index, last }: { file: DetectResult; index: number; last: number }) => {
  const { actions, translate } = useStore();
  const unsupported = file.error !== undefined || file.format === null;
  // Alt+Up and Alt+Down reorder from the keyboard (UI-DESIGN section 7).
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.altKey) return;
    const target =
      event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : index;
    if (target === index || target < 0 || target > last) return;
    event.preventDefault();
    actions.moveFile({ from: index, to: target });
  };
  return (
    <li
      className="file-row"
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-unsupported={unsupported}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const from = Number(event.dataTransfer.getData(ROW_TYPE));
        if (event.dataTransfer.types.includes(ROW_TYPE) && from !== index) {
          event.preventDefault();
          actions.moveFile({ from, to: index });
        }
      }}
    >
      {/* Mouse reorder; the keyboard path is Alt+Up and Alt+Down on the row (UI-DESIGN section 7). */}
      <span
        className="drag-handle"
        draggable
        aria-hidden="true"
        onDragStart={(event) => event.dataTransfer.setData(ROW_TYPE, String(index))}
      >
        {translate('file.handle')}
      </span>
      <span className="file-name">{baseName(file.path)}</span>
      {file.format !== null && <span>{translate(`format.${file.format}`)}</span>}
      <span>{new Intl.NumberFormat().format(file.size)}</span>
      {file.mismatch && (
        <span title={translate('file.mismatch.detail')}>{translate('file.mismatch')}</span>
      )}
      {unsupported && (
        <span>
          {file.error === undefined
            ? translate('file.unsupported')
            : translate(`error.${file.error.code}`, file.error.params)}
        </span>
      )}
      <button
        type="button"
        aria-label={translate('file.remove', { name: baseName(file.path) })}
        onClick={() => actions.removeFile(file.path)}
      >
        {translate('file.removeShort')}
      </button>
    </li>
  );
};

export const FileList = () => {
  const { state, actions, translate } = useStore();
  if (state.files.length === 0 && state.detecting.length === 0) return null;
  return (
    <section aria-label={translate('files.title', { count: state.files.length })}>
      <h2>{translate('files.title', { count: state.files.length })}</h2>
      {state.detecting.length > 0 && (
        <p role="status">{translate('files.detecting', { count: state.detecting.length })}</p>
      )}
      <ul>
        {state.files.map((file, index) => (
          <FileRow key={file.path} file={file} index={index} last={state.files.length - 1} />
        ))}
      </ul>
      <button type="button" onClick={actions.clearFiles}>
        {translate('files.clear')}
      </button>
    </section>
  );
};

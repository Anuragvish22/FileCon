import { useState, type DragEvent } from 'react';
import { useStore } from '../store/context.tsx';

export const DropZone = () => {
  const { actions, translate } = useStore();
  const [drag, setDrag] = useState<'over' | 'idle'>('idle');
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDrag('idle');
    void actions.dropFiles([...event.dataTransfer.files]);
  };
  return (
    <div
      className="dropzone"
      data-drag={drag}
      onDragOver={(event) => {
        event.preventDefault();
        setDrag('over');
      }}
      onDragLeave={() => setDrag('idle')}
      onDrop={onDrop}
    >
      <span>{translate('dropzone.prompt')}</span>
      {/* A real button, so Enter and Space open the file dialog (UI-DESIGN section 7). */}
      <button type="button" onClick={() => void actions.chooseFiles()}>
        {translate('dropzone.choose')}
      </button>
    </div>
  );
};

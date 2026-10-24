import { useState, type DragEvent } from 'react';
import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';
import { Mark } from './Mark.tsx';

export const DropZone = ({ slim }: { slim: boolean }) => {
  const { state, actions, translate } = useStore();
  const [drag, setDrag] = useState<'over' | 'idle'>('idle');
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDrag('idle');
    void actions.dropFiles([...event.dataTransfer.files]);
  };
  const waiting = state.core.status !== 'ready';
  return (
    <div
      data-slim={slim}
      data-drag={drag}
      data-waiting={waiting}
      onDragOver={(event) => {
        event.preventDefault();
        setDrag('over');
      }}
      onDragLeave={() => setDrag('idle')}
      onDrop={onDrop}
      className={`flex items-center justify-center gap-3 rounded-card border-2 border-dashed transition-colors data-[drag=over]:border-accent data-[drag=over]:bg-accent-subtle data-[waiting=true]:opacity-60 ${slim ? 'border-border px-4 py-3' : 'flex-col border-border-strong bg-surface px-6 py-16 text-center'}`}
    >
      {!slim && <Mark className="size-12" />}
      <p className={slim ? 'text-sm text-muted' : 'text-lg font-semibold'}>
        {translate('dropzone.prompt')}
      </p>
      {!slim && <p className="text-sm text-muted">{translate('dropzone.hint')}</p>}
      {/* A real button, so Enter and Space open the file dialog (UI-DESIGN section 7). */}
      <Button variant={slim ? 'secondary' : 'primary'} onClick={() => void actions.chooseFiles()}>
        {translate('dropzone.choose')}
      </Button>
    </div>
  );
};

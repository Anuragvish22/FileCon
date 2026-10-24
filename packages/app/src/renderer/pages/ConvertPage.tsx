import { ActionBar } from '../components/ActionBar.tsx';
import { DropZone } from '../components/DropZone.tsx';
import { FileList } from '../components/FileList.tsx';
import { HeaderBar } from '../components/HeaderBar.tsx';
import { useStore } from '../store/context.tsx';

/** The Files screen: one list where each row picks, runs and shows its own result. */
export const ConvertPage = () => {
  const { state } = useStore();
  const empty = state.files.length + state.detecting.length === 0;
  return (
    <div className="convert-page grid gap-3">
      <DropZone slim={!empty} />
      <HeaderBar />
      {!empty && <FileList />}
      <ActionBar />
    </div>
  );
};

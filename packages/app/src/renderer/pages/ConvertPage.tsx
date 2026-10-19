import { ConvertButton } from '../components/ConvertButton.tsx';
import { DropZone } from '../components/DropZone.tsx';
import { FileList } from '../components/FileList.tsx';
import { MergeToggle } from '../components/MergeToggle.tsx';
import { OptionsBar } from '../components/OptionsBar.tsx';
import { OutputChooser } from '../components/OutputChooser.tsx';
import { RouteHint } from '../components/RouteHint.tsx';
import { TargetPicker } from '../components/TargetPicker.tsx';

export const ConvertPage = () => (
  <div className="convert-page">
    <DropZone />
    <FileList />
    <TargetPicker />
    <MergeToggle />
    <RouteHint />
    <OptionsBar />
    <OutputChooser />
    <ConvertButton />
  </div>
);

import { File, FileText, Image, Presentation, Sheet } from 'lucide-react';
import { categoryOf } from '../format.ts';

const ICON_SIZE = 20;

/** A decorative icon for the file's category; the type text beside it carries the meaning. */
export const FileIcon = ({ format }: { format: string | null }) => {
  const props = { size: ICON_SIZE, 'aria-hidden': true } as const;
  switch (format === null ? undefined : categoryOf(format)) {
    case 'image':
      return <Image {...props} />;
    case 'document':
      return <FileText {...props} />;
    case 'spreadsheet':
      return <Sheet {...props} />;
    case 'presentation':
      return <Presentation {...props} />;
    default:
      return <File {...props} />;
  }
};

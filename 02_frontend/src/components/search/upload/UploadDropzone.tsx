import { Upload } from 'lucide-react';

interface UploadDropzoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export default function UploadDropzone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: UploadDropzoneProps) {
  return (
    <div
      className={`
        relative group flex flex-col items-center justify-center gap-4 h-64 w-full rounded-2xl border-2 border-dashed transition-all duration-300
        ${isDragging ? 'border-accent bg-accent/5 scale-[0.99]' : 'border-secondary/30 bg-secondary/5 hover:border-accent/40 hover:bg-secondary/10'}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
    >
      <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform duration-300">
        <Upload size={28} strokeWidth={2.5} />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-primary mb-1">Click or Drag images here</p>
        <p className="text-sm text-primary/40"> Supports JPG, PNG, WEBP</p>
      </div>
    </div>
  );
}

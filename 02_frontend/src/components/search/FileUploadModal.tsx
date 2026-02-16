import { useState, useCallback, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import ResultsDashboard from './ResultsDashboard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { usePipelineUpload } from '@/hooks/usePipelineUpload';
import UploadDropzone from '@/components/search/upload/UploadDropzone';
import ProcessingOverlay from '@/components/search/upload/ProcessingOverlay';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocate: (id: string) => void;
}

export default function FileUploadModal({ isOpen, onClose, onLocate }: FileUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { status, pipelineResults, upload, reset } = usePipelineUpload();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    await upload(files);
    setFiles([]);
  };

  const handleClose = () => {
    if (status.step === 'processing') return; // Prevent closing mid-process
    setFiles([]);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  // Show Results Dashboard if complete and we have results
  if (status.step === 'complete' && pipelineResults.length > 0) {
    return (
      <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" onClick={handleClose} />
        <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden animate-fade-up">
          <ErrorBoundary
            fallback={
              <div className="h-full w-full flex items-center justify-center p-8 text-center text-primary/70 font-semibold">
                Dashboard could not render this batch result payload.
              </div>
            }
          >
            <ResultsDashboard results={pipelineResults} onClose={handleClose} onLocate={onLocate} />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" 
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-fade-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary/10">
          <div>
            <h2 className="text-xl font-bold text-primary m-0">Local Pipeline</h2>
            <p className="text-sm text-primary/40 mt-1">Upload images to run AI categorization & embedding.</p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-secondary/10 transition-colors text-primary/40 hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Overlay (Processing Only) */}
        <ProcessingOverlay status={status} />

        {/* Body */}
        <div className="p-6">
          
          {/* Dropzone */}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*" 
            onChange={handleFileSelect}
          />
          <UploadDropzone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          />

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3 px-1">
                 <h4 className="text-xs font-bold text-primary/40 uppercase tracking-wider">Queue ({files.length})</h4>
                 <button onClick={() => setFiles([])} className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer">Clear All</button>
              </div>
              <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                 {files.map((file, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-secondary/10 border border-secondary/10">
                       <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                       />
                       <button 
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                       >
                          <X size={12} />
                       </button>
                    </div>
                 ))}
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {status.step === 'error' && (
             <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-800 flex items-center gap-3">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{status.message}</span>
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex justify-end">
          <button 
            disabled={files.length === 0}
            onClick={handleUpload}
            className={`
               flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl
               ${files.length > 0 ? 'bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] cursor-pointer' : 'bg-secondary/20 text-primary/20 cursor-not-allowed'}
            `}
          >
            <Sparkles size={20} className={files.length > 0 ? 'animate-pulse' : ''} />
            Run Analysis
          </button>
        </div>

      </div>
    </div>
  );
}

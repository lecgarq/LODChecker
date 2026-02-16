import { useState, useCallback, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import ResultsDashboard from './ResultsDashboard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocate: (id: string) => void;
}

interface UploadStatus {
  step: 'idle' | 'uploading' | 'processing' | 'finishing' | 'complete' | 'error';
  message: string;
  progress: number;
}

interface PipelineRecord {
  id: string;
  name_of_file: string;
  final_category: string;
  provider: string;
  lod: string;
  output_path?: string;
  path_to_image?: string;
}

function normalizePipelineResults(raw: unknown): PipelineRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      name_of_file: String(item.name_of_file ?? 'Unknown file'),
      final_category: String(item.final_category ?? 'Uncategorized'),
      provider: String(item.provider ?? 'Unknown'),
      lod: String(item.lod ?? 'N/A'),
      output_path: typeof item.output_path === 'string' ? item.output_path : undefined,
      path_to_image: typeof item.path_to_image === 'string' ? item.path_to_image : undefined,
    }))
    .filter((item) => item.id.length > 0);
}

export default function FileUploadModal({ isOpen, onClose, onLocate }: FileUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>({
    step: 'idle',
    message: '',
    progress: 0
  });
  const [pipelineResults, setPipelineResults] = useState<PipelineRecord[]>([]);
  
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

    setStatus({ step: 'uploading', message: 'Uploading files...', progress: 10 });

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      // 1. Upload Phase
      const uploadRes = await fetch('http://localhost:5000/api/run/local_pipeline', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.status === 404 || uploadRes.status === 405) {
        throw new Error('Backend stale. Please restart run_viz.py terminal.');
      }
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
      
      setStatus({ step: 'processing', message: 'Running AI Vision Pipeline...', progress: 40 });

      const result = await uploadRes.json();
      
      if (result.success) {
        setStatus({ step: 'finishing', message: 'Finalizing Data...', progress: 90 });
        
        // Ensure results are available
        const records = normalizePipelineResults(result.results);
        setPipelineResults(records);

        setTimeout(() => {
           setStatus({ step: 'complete', message: 'Ready!', progress: 100 });
           // Clear files for next time
           setFiles([]);
        }, 1000);
      } else {
        throw new Error(result.error || 'Pipeline failed');
      }

    } catch (error) {
      console.error(error);
      setStatus({ step: 'error', message: String(error), progress: 0 });
    }
  };

  const handleClose = () => {
    if (status.step === 'processing') return; // Prevent closing mid-process
    setFiles([]);
    setPipelineResults([]);
    setStatus({ step: 'idle', message: '', progress: 0 });
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
        {status.step !== 'idle' && status.step !== 'error' && status.step !== 'complete' && (
           <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 animate-fade-in">
              <div className="relative w-20 h-20">
                 <div className="absolute inset-0 border-4 border-secondary/20 rounded-full" />
                 <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="text-center">
                 <h3 className="text-2xl font-black text-primary mb-2">Processing</h3>
                 <p className="text-primary/60 font-medium">{status.message}</p>
                 <div className="w-64 h-2 bg-secondary/10 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${status.progress}%` }} />
                 </div>
              </div>
           </div>
        )}

        {/* Body */}
        <div className="p-6">
          
          {/* Dropzone */}
          <div 
            className={`
              relative group flex flex-col items-center justify-center gap-4 h-64 w-full rounded-2xl border-2 border-dashed transition-all duration-300
              ${isDragging ? 'border-accent bg-accent/5 scale-[0.99]' : 'border-secondary/30 bg-secondary/5 hover:border-accent/40 hover:bg-secondary/10'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={handleFileSelect}
            />
            
            <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform duration-300">
               <Upload size={28} strokeWidth={2.5} />
            </div>
            <div className="text-center">
               <p className="text-lg font-bold text-primary mb-1">Click or Drag images here</p>
               <p className="text-sm text-primary/40"> Supports JPG, PNG, WEBP</p>
            </div>
          </div>

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

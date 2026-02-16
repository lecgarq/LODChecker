import type { UploadStatus } from '@/hooks/usePipelineUpload';

interface ProcessingOverlayProps {
  status: UploadStatus;
}

export default function ProcessingOverlay({ status }: ProcessingOverlayProps) {
  if (status.step === 'idle' || status.step === 'error' || status.step === 'complete') {
    return null;
  }
  return (
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
  );
}

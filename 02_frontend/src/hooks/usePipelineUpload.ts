import { useCallback, useState } from 'react';
import { runLocalPipeline } from '@/services/api';
import type { PipelineRecord } from '@/types/api';

export interface UploadStatus {
  step: 'idle' | 'uploading' | 'processing' | 'finishing' | 'complete' | 'error';
  message: string;
  progress: number;
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

export function usePipelineUpload() {
  const [status, setStatus] = useState<UploadStatus>({
    step: 'idle',
    message: '',
    progress: 0,
  });
  const [pipelineResults, setPipelineResults] = useState<PipelineRecord[]>([]);

  const reset = useCallback(() => {
    setPipelineResults([]);
    setStatus({ step: 'idle', message: '', progress: 0 });
  }, []);

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setStatus({ step: 'uploading', message: 'Uploading files...', progress: 10 });

    try {
      const result = await runLocalPipeline(files);
      setStatus({ step: 'processing', message: 'Running AI Vision Pipeline...', progress: 40 });

      if (result.success) {
        setStatus({ step: 'finishing', message: 'Finalizing Data...', progress: 90 });
        const records = normalizePipelineResults(result.results);
        setPipelineResults(records);
        setTimeout(() => {
          setStatus({ step: 'complete', message: 'Ready!', progress: 100 });
        }, 1000);
      } else {
        throw new Error(result.error || 'Pipeline failed');
      }
    } catch (error) {
      console.error(error);
      setStatus({ step: 'error', message: String(error), progress: 0 });
    }
  }, []);

  return { status, pipelineResults, upload, reset };
}

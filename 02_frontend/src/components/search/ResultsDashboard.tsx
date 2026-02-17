import { CheckCircle, Image as ImageIcon, MapPin } from 'lucide-react';
import { useCallback } from 'react';

interface PipelineRecord {
  id: string;
  name_of_file: string;
  final_category: string;
  provider: string;
  lod: string;
  output_path?: string;
  path_to_image?: string;
}

interface ResultsDashboardProps {
  results: PipelineRecord[];
  onClose: () => void;
  onLocate: (id: string) => void;
}

export default function ResultsDashboard({ results, onClose, onLocate }: ResultsDashboardProps) {
  const safeResults: PipelineRecord[] = Array.isArray(results)
    ? results
        .filter((r) => !!r && typeof r === 'object')
        .map((r) => ({
          id: String(r.id ?? ''),
          name_of_file: String(r.name_of_file ?? 'Unknown file'),
          final_category: String(r.final_category ?? 'Uncategorized'),
          provider: String(r.provider ?? 'Unknown'),
          lod: String(r.lod ?? 'N/A'),
          output_path: typeof r.output_path === 'string' ? r.output_path : undefined,
          path_to_image: typeof r.path_to_image === 'string' ? r.path_to_image : undefined,
        }))
        .filter((r) => r.id.length > 0)
    : [];
  
  const handleLocate = useCallback((id: string) => {
    onLocate(id);
    onClose();
  }, [onClose, onLocate]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-2">
        <div>
            <h2 className="text-2xl font-black text-primary m-0 flex items-center gap-2">
            <CheckCircle className="text-accent" size={24} strokeWidth={3} />
            Analysis Complete
          </h2>
          <p className="text-primary/40 font-medium mt-1">
            Successfully processed {safeResults.length} item{safeResults.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <button 
          onClick={onClose}
          className="text-sm font-bold text-primary/40 hover:text-primary transition-colors"
        >
          Close
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 custom-scrollbar">
        {safeResults.map((rec) => {
          // Construct thumbnail url from output_path or name_of_file
          const rawPath = rec.output_path || rec.path_to_image || rec.name_of_file || '';
          const filename = rawPath.includes('/') || rawPath.includes('\\') 
            ? rawPath.split(/[\\/]/).pop() 
            : rawPath;
          const thumbUrl = `http://localhost:5000/img/${filename}`;

          return (
            <div key={rec.id} className="bg-secondary/5 rounded-2xl p-3 flex gap-4 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-accent/20 group">
              {/* Image */}
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 relative">
                <img 
                  src={thumbUrl} 
                  alt={rec.name_of_file} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ''; 
                    (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-secondary/10');
                  }} 
                />
                {!thumbUrl && <ImageIcon className="text-primary/20" />}
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h4 className="font-bold text-primary truncate text-sm" title={rec.name_of_file}>
                  {rec.name_of_file}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-white bg-accent px-2 py-0.5 rounded-full truncate max-w-[120px]">
                    {rec.final_category}
                  </span>
                  <span className="text-[10px] font-bold text-primary/40 bg-secondary/10 px-1.5 py-0.5 rounded-md border border-secondary/10">
                    LOD {rec.lod}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                    <button 
                      onClick={() => handleLocate(rec.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-accent transition-colors"
                    >
                      <MapPin size={12} strokeWidth={2.5} />
                      Locate in Graph
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-6 pt-2 border-t border-secondary/5 bg-white/50 backdrop-blur-sm">
        <button 
           onClick={onClose}
           className="w-full py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all hover:scale-[1.01]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { X, Info } from 'lucide-react';
import { getCategoryColor } from '@/lib/colors';

interface ResultRecord {
    id?: string;
    name_of_file?: string;
    final_category?: string;
    lod?: string | number;
    lod_label?: string;
    [key: string]: any;
}

interface ResultsDashboardProps {
    results: ResultRecord[];
    onClose: () => void;
    onLocate?: (id: string) => void;
}

const ResultsDashboard = ({ results, onClose, onLocate }: ResultsDashboardProps) => {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);

    const safeResults: ResultRecord[] = Array.isArray(results)
        ? results.filter((r): r is ResultRecord => !!r && typeof r === 'object')
        : [];

    // Calculate Metrics
    const metrics = useMemo(() => {
        const total = safeResults.length;
        
        // Calculate Average LOD
        let lodSum = 0;
        let lodCount = 0;
        
        safeResults.forEach(r => {
            // Try to extract numeric LOD
            let val = 0;
            const l = String(r.lod || r.lod_label || '').toLowerCase();
            
            if (l.includes('100') || l.includes('low')) val = 100;
            else if (l.includes('200') || l.includes('medium')) val = 200;
            else if (l.includes('300')) val = 300;
            else if (l.includes('350')) val = 350;
            else if (l.includes('400') || l.includes('high')) val = 400;
            
            if (val > 0) {
                lodSum += val;
                lodCount++;
            }
        });
        
        const avgLod = lodCount > 0 ? Math.round(lodSum / lodCount) : 0;
        
        // Calculate Category Distribution
        const catCounts: Record<string, number> = {};
        safeResults.forEach(r => {
            const c = r.final_category || r.category || 'Uncategorized';
            catCounts[c] = (catCounts[c] || 0) + 1;
        });
        
        // Sort categories by count desc
        const sortedCats = Object.entries(catCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6); // Top 6 only

        return { total, avgLod, sortedCats };
    }, [safeResults]);

    // Fetch AI Analysis on Mount (or on demand)
    const fetchAnalysis = async () => {
        if (analysis || isAnalyzing) return;
        setIsAnalyzing(true);
        try {
            const payload = {
                lods: safeResults.map(r => r.lod || r.lod_label),
                categories: safeResults.map(r => r.final_category || r.category)
            };
            const res = await fetch('/api/analyze_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setAnalysis(data.analysis);
        } catch (e) {
            console.error("Analysis failed", e);
            setAnalysis("Could not generate analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-bg/80 backdrop-blur-sm animate-fade-in p-6">
            <div className="w-full max-w-4xl bg-white border border-secondary/60 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-secondary/20">
                    <div>
                        <h2 className="text-2xl font-black text-primary tracking-tight">Batch Results</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-primary/40 uppercase tracking-widest">
                                {metrics.total} Processed Elements
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center transition-colors"
                    >
                        <X size={20} className="text-primary/60" />
                    </button>
                </div>

                {/* Content Grid */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 overflow-y-auto">
                    
                    {/* LEFT COLUMN: LOD GAUGE */}
                    <div className="flex flex-col items-center justify-center">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Gauge Background Ring */}
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle
                                    cx="128" cy="128" r="110"
                                    fill="none"
                                    stroke="#E9E7E2"
                                    strokeWidth="24"
                                    strokeLinecap="round"
                                />
                                {/* Gauge Value Ring */}
                                <circle
                                    cx="128" cy="128" r="110"
                                    fill="none"
                                    stroke="#1A1A1A" // Primary color
                                    strokeWidth="24"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(Math.max(0, Math.min(metrics.avgLod, 400)) / 400) * 691} 691`} 
                                    // 2 * PI * 110 ~= 691
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            
                            {/* Center Text */}
                            <div className="flex flex-col items-center z-10">
                                <span className="text-6xl font-black text-primary tracking-tighter">
                                    {metrics.avgLod}
                                </span>
                                <span className="text-xs font-bold text-primary/40 uppercase tracking-widest mt-1">
                                    AVG LOD Score
                                </span>
                            </div>
                        </div>

                        {/* Range Labels */}
                        <div className="w-64 flex justify-between px-2 mt-4 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                            <span>100 (Low)</span>
                            <span>400 (High)</span>
                        </div>
                        
                        {/* Analysis Button */}
                        <div className="mt-8 w-full max-w-xs relative group">
                            <button
                                onClick={() => { setShowAnalysis(!showAnalysis); fetchAnalysis(); }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-secondary/30 hover:bg-secondary/50 rounded-xl transition-all text-xs font-bold text-primary uppercase tracking-wide group-hover:shadow-md"
                            >
                                <Info size={14} />
                                {showAnalysis ? 'Hide Analysis' : 'Show AI Insight'}
                            </button>

                            {/* Analysis Popover */}
                            {showAnalysis && (
                                <div className="absolute bottom-full left-0 w-full mb-3 bg-white border border-secondary/40 shadow-xl rounded-xl p-4 animate-scale-in origin-bottom">
                                    <div className="text-xs font-medium text-primary/80 leading-relaxed">
                                        {isAnalyzing ? (
                                            <div className="flex items-center gap-2 text-primary/40">
                                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Analyzing...
                                            </div>
                                        ) : (
                                            analysis || "No analysis available."
                                        )}
                                    </div>
                                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-secondary/40 rotate-45" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: CATEGORY DISTRIBUTION */}
                    <div className="flex flex-col justify-center h-full">
                        <h3 className="text-sm font-bold text-primary/40 uppercase tracking-widest mb-6">
                            Category Distribution
                        </h3>
                        
                        <div className="space-y-4">
                            {metrics.sortedCats.map(([cat, count], idx) => {
                                const percentage = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                                const color = getCategoryColor(cat);
                                return (
                                    <div key={cat} className="group">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-xs font-bold text-primary group-hover:text-primary/80 transition-colors">
                                                {cat}
                                            </span>
                                            <span className="text-[10px] font-bold text-primary/30">
                                                {count} ({percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{ 
                                                    width: `${percentage}%`, 
                                                    backgroundColor: color,
                                                    transitionDelay: `${idx * 100}ms`
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {metrics.sortedCats.length === 0 && (
                                <div className="text-xs text-primary/40 italic text-center py-8">
                                    No categories detected.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, ArrowRight, Images, ChevronRight } from 'lucide-react';
import ACCLogo from '@/assets/Autodesk-Symbol.png';
import FileUploadModal from './FileUploadModal';

interface LandingSearchProps {
  onSearch: (query: string) => void;
  onSelectNode: (id: string) => void;
}

/** Full-page search bar for the landing page. */
export default function LandingSearch({ onSearch, onSelectNode }: LandingSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(() => {
    if (query.trim()) onSearch(query.trim());
  }, [query, onSearch]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-10 flex flex-col items-center gap-10 max-w-[600px] w-full px-6 animate-fade-up">

      <div className="text-center flex flex-col items-center gap-4 select-none cursor-default group relative">
        {/* Ambient background glow */}
        <div className="absolute -inset-10 bg-primary/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
        
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-shimmer-text animate-glow-pulse m-0 tracking-tighter leading-tight transition-all duration-500 group-hover:scale-[1.05] active:scale-95">
          LOD Checker
        </h1>
        <div className="h-[20px] overflow-hidden">
           <p className="text-sm font-medium text-text/40 animate-slide-in-right opacity-0 transition-opacity duration-300 group-hover:text-primary/60" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
             AI-Powered BIM Intelligence
           </p>
        </div>
      </div>

      <div className="relative w-full max-w-[520px]" ref={menuRef}>
        {/* Ultra-Minimal Search Bar */}
        <div 
          className={`relative z-20 flex items-center gap-3 w-full px-2 py-2 bg-white rounded-2xl transition-all duration-500 ease-out group ${
            isFocused
              ? 'shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] scale-105'
              : 'shadow-[0_8px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-lg hover:scale-[1.01]'
          }`}
        >
          {/* Animated Border Gradient */}
          <div className={`absolute -inset-[1px] rounded-[18px] bg-gradient-to-r from-primary via-accent to-primary opacity-0 transition-opacity duration-500 -z-10 blur-sm ${isFocused ? 'opacity-40 animate-shimmer' : ''}`} />
          <div className={`absolute -inset-[1px] rounded-[18px] bg-white transition-all duration-300 -z-10 border ${isFocused ? 'border-transparent' : 'border-secondary'}`} />

          {/* Leading Icon Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-none cursor-pointer ${
              isMenuOpen ? 'bg-primary text-white scale-90' : isFocused ? 'bg-primary/5 text-primary' : 'bg-secondary/30 text-primary/40 hover:bg-secondary/50'
            }`}
          >
            <Plus size={20} strokeWidth={2.5} className={`transition-transform duration-500 ${isMenuOpen ? 'rotate-45' : isFocused ? 'rotate-90' : ''}`} />
          </button>

          {/* Input */}
          <input
            type="text"
            placeholder="Ask anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            onFocus={() => {
              setIsFocused(true);
              setIsMenuOpen(false); // Auto-close menu on focus
            }}
            onBlur={() => setIsFocused(false)}
            className="flex-1 border-none outline-none bg-transparent text-lg font-bold text-primary placeholder:text-primary/20 placeholder:font-medium h-full font-sans tracking-tight"
          />

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className={`w-12 h-12 rounded-xl border-none flex items-center justify-center cursor-pointer transition-all duration-300 ${
              query.trim()
                ? 'bg-primary text-white shadow-md scale-100 rotate-0'
                : 'bg-transparent text-primary/10 scale-90 -rotate-12 cursor-default'
            }`}
          >
            <ArrowRight size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Workflow Submenu - Minimalist Vertical List (Icons Only) */}
        <div className={`absolute top-full left-0 mt-2 w-14 flex flex-col gap-2 p-2 bg-white/90 backdrop-blur-xl border border-secondary/20 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 origin-top-left z-10 ${
          isMenuOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
        }`}>
          {[
            { id: 'file', icon: <Images size={20} className="text-black" /> },
            { id: 'acc', icon: <img src={ACCLogo} alt="ACC" className="w-5 h-5 object-contain opacity-100" /> },
          ].map((item) => (
            <button
              key={item.id}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary/10 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border-none bg-transparent group"
              onClick={() => {
                if (item.id === 'file') {
                  setIsUploadModalOpen(true);
                  setIsMenuOpen(false);
                } else {
                  console.log(`Selected workflow: ${item.id}`);
                  setIsMenuOpen(false);
                }
              }}
              title={item.id === 'file' ? 'Local File' : 'Autodesk Construction Cloud'}
            >
               {item.icon}
            </button>
          ))}
        </div>
      </div>

      <FileUploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onLocate={onSelectNode}
      />
    </div>
  );
}

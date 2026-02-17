import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface MinimalLoadingProps {
  isSearching: boolean;
  isGraphStable: boolean;
  onSwipeStart?: () => void;
  onFinished: () => void;
}

/** 
 * Ultimate high-fidelity loading screen.
 * Synchronizes with the graph rendering engine to only reveal when everything is stable.
 */
export default function MinimalLoading({ isSearching, isGraphStable, onSwipeStart, onFinished }: MinimalLoadingProps) {
  const [isReady, setIsReady] = useState(false);
  const [shouldExit, setShouldExit] = useState(false);
  const hasStartedSearch = useRef(false);
  // eslint-disable-next-line react-hooks/purity -- Date.now() in useRef is intentional: captures mount time, not render output
  const startTime = useRef(Date.now());

  // Track if search has actually begun
  useEffect(() => {
    if (isSearching) {
      hasStartedSearch.current = true;
    }
  }, [isSearching]);

  // 1. Detect when processing is done
  useEffect(() => {
    if (!isSearching && hasStartedSearch.current && !isReady) {
      // Minimum duration for "Processing" animation to avoid jitter
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, 1500 - elapsed);

      const readyTimer = setTimeout(() => {
        setIsReady(true);
      }, remaining);

      return () => clearTimeout(readyTimer);
    }
  }, [isSearching, isReady]);

  // 2. The reveal sequence
  useEffect(() => {
    if (isReady) {
      // Step A: Show "Ready" checkmark
      const startRevealTimer = setTimeout(() => {
        
        // Step B: IMPORTANT! Reveal the graph page BEHIND the loading screen.
        // This starts the Graph rendering/simulation while the user still sees "Ready".
        if (onSwipeStart) onSwipeStart();
        
        // Step C: Wait for the graph to signal it is STABLE (onStabilized from SemanticGraph)
        // We set up a polling effect or just use the prop directly.
      }, 800);

      return () => clearTimeout(startRevealTimer);
    }
  }, [isReady, onSwipeStart]);

  // 3. Logic to trigger exit only when Graph is Stable
  useEffect(() => {
    // Only exit if:
    // 1. Search Logic is "Ready"
    // 2. Page has been switched to Graph (onSwipeStart was called)
    // 3. The Graph component itself says it is stable (isGraphStable prop)
    if (isReady && isGraphStable) {
        // Final "Hold" before swipe for maximum smoothness
        const holdTimer = setTimeout(() => {
            setShouldExit(true);
            
            const finishTimer = setTimeout(() => {
                onFinished();
            }, 1200); 
            
            return () => clearTimeout(finishTimer);
        }, 300);

        return () => clearTimeout(holdTimer);
    }
  }, [isReady, isGraphStable, onFinished]);

  return (
    <div 
      className={`fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-bg shadow-2xl transition-all duration-1000 ease-[cubic-bezier(0.85,0,0.15,1)] ${
        shouldExit ? '-translate-x-full opacity-0 blur-2xl scale-110' : 'translate-x-0 opacity-100 blur-0 scale-100'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        {isReady ? (
          <div className="flex flex-col items-center animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
              <Check size={24} strokeWidth={3} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary/40">
              Ready
            </span>
            {isReady && !isGraphStable && (
               <span className="text-[10px] text-primary/20 mt-4 animate-pulse uppercase tracking-widest">
                 Finalizing View...
               </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex gap-1 mb-4 h-6 items-center">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i} 
                  className="w-2.5 h-[2px] bg-primary/20 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/30 animate-pulse">
              AI Processing
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

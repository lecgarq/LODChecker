import LandingSearch from '@/components/search/LandingSearch';
import ParticleBackground from '@/components/effects/ParticleBackground';

interface LandingPageProps {
  onSearch: (query: string) => void;
  onSelectNode: (id: string) => void;
}

/** Landing page with particle background and AI search bar. */
export default function LandingPage({ onSearch, onSelectNode }: LandingPageProps) {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col items-center justify-center font-sans bg-bg">
      <ParticleBackground />
      <LandingSearch onSearch={onSearch} onSelectNode={onSelectNode} />
    </div>
  );
}

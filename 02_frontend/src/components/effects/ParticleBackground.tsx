import { useEffect, useRef } from 'react';

/* ── Config ── */
const CFG = {
  density: 22000,
  minSize: 1,
  maxSize: 3,
  speed: 0.08,
  maxSpeed: 0.18,
  friction: 0.96,
  connectDist: 130,
  lineWidth: 0.4,
  mouseRadius: 180,
  mousePull: 0.04,
  buffer: 50,
} as const;

const dist = (x1: number, y1: number, x2: number, y2: number) =>
  Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);

/* ── Particle ── */
class Particle {
  x: number; y: number; vx: number; vy: number; size: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * CFG.speed;
    this.vy = (Math.random() - 0.5) * CFG.speed;
    this.size = Math.random() * (CFG.maxSize - CFG.minSize) + CFG.minSize;
  }

  update(w: number, h: number, mx: number | null, my: number | null) {
    this.x += this.vx;
    this.y += this.vy;

    // Repulsion from UI Zones
    const cx = w / 2, cy = h / 2;
    
    // 1. Title Repulsion (Circular)
    const tdx = this.x - cx, tdy = this.y - (cy - 80);
    const dTitle = Math.sqrt(tdx*tdx + tdy*tdy);
    if (dTitle < 200) {
      const force = (200 - dTitle) / 200;
      this.vx += (tdx / dTitle) * force * 0.8;
      this.vy += (tdy / dTitle) * force * 0.8;
    }

    // 2. Search Bar Repulsion (Rectangular/Box)
    const boxW = 320, boxH = 60; // Half-dimensions
    const bdx = this.x - cx, bdy = this.y - (cy + 60);
    if (Math.abs(bdx) < boxW && Math.abs(bdy) < boxH) {
      // Calculate push-out direction
      const forceX = (boxW - Math.abs(bdx)) / boxW;
      const forceY = (boxH - Math.abs(bdy)) / boxH;
      if (forceX < forceY) {
        this.vx += (bdx > 0 ? 1 : -1) * forceX * 1.2;
      } else {
        this.vy += (bdy > 0 ? 1 : -1) * forceY * 1.2;
      }
    }

    if (this.x < -CFG.buffer) this.x = w + CFG.buffer;
    if (this.x > w + CFG.buffer) this.x = -CFG.buffer;
    if (this.y < -CFG.buffer) this.y = h + CFG.buffer;
    if (this.y > h + CFG.buffer) this.y = -CFG.buffer;

    if (mx !== null && my !== null) {
      const d = dist(mx, my, this.x, this.y);
      if (d < CFG.mouseRadius && d > 0) {
        const f = ((CFG.mouseRadius - d) / CFG.mouseRadius) * CFG.mousePull;
        this.vx += ((mx - this.x) / d) * f;
        this.vy += ((my - this.y) / d) * f;
      }
    }
    const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (spd > CFG.maxSpeed) { this.vx *= CFG.friction; this.vy *= CFG.friction; }
  }
}

/** Canvas-based particle background animation. */
export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let particles: Particle[] = [];
    const mouse = { x: null as number | null, y: null as number | null };
    let raf: number;

    const init = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const count = Math.floor((w * h) / CFG.density);
      particles = [];
      for (let i = 0; i < count; i++) particles.push(new Particle(w, h));
    };

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(w, h, mouse.x, mouse.y);
        // accent color: #3D5A40 → rgb(61, 90, 64)
        ctx.fillStyle = 'rgba(61, 90, 64, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const d = dist(p.x, p.y, p2.x, p2.y);
          if (d < CFG.connectDist) {
            const alpha = (1 - d / CFG.connectDist) * 0.15;
            ctx.strokeStyle = `rgba(61, 90, 64, ${alpha})`;
            ctx.lineWidth = CFG.lineWidth;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => { init(); };
    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseout', onLeave);

    init();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

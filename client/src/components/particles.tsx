import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);

  const createParticle = useCallback((width: number, height: number, fromMouse = false): Particle => {
    if (fromMouse) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      return {
        x: mouseRef.current.x + (Math.random() - 0.5) * 30,
        y: mouseRef.current.y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1 + Math.random() * 2.5,
        opacity: 0.7 + Math.random() * 0.3,
        life: 0,
        maxLife: 80 + Math.random() * 150,
      };
    }
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.15 - Math.random() * 0.5,
      size: 1 + Math.random() * 2.5,
      opacity: 0.15 + Math.random() * 0.5,
      life: 0,
      maxLife: 300 + Math.random() * 500,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const PARTICLE_COUNT = Math.min(120, Math.max(40, Math.floor((width * height) / 8000)));
    const CONNECTION_DIST = 150;

    particlesRef.current = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle(width, height);
      p.life = Math.random() * p.maxLife * 0.5;
      particlesRef.current.push(p);
    }

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = width + "px";
      canvas!.style.height = height + "px";
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(dpr, dpr);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
      }
    }

    function onClick(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      for (let i = 0; i < 12; i++) {
        particlesRef.current.push(createParticle(width, height, true));
      }
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("click", onClick);

    let spawnTimer = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      spawnTimer++;
      if (spawnTimer % 4 === 0) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (mx > 0 && mx < width && my > 0 && my < height) {
          if (particlesRef.current.length < PARTICLE_COUNT + 40) {
            particlesRef.current.push(createParticle(width, height, true));
          }
        }
      }

      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 180 && dist > 0) {
          const force = (180 - dist) / 180;
          p.vx -= (dx / dist) * force * 0.12;
          p.vy -= (dy / dist) * force * 0.12;
        }

        p.vy += 0.003;
        p.vx *= 0.997;
        p.vy *= 0.997;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -50) p.x = width + 50;
        if (p.x > width + 50) p.x = -50;
        if (p.y < -50) p.y = height + 50;

        if (p.life > p.maxLife || p.y > height + 50) {
          particles.splice(i, 1);
          if (particles.length < PARTICLE_COUNT) {
            particles.push(createParticle(width, height));
          }
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(lifeRatio * 4, 1);
        const fadeOut = lifeRatio > 0.75 ? 1 - (lifeRatio - 0.75) / 0.25 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECTION_DIST * CONNECTION_DIST) {
            const dist = Math.sqrt(distSq);
            const lifeA = particles[i].life / particles[i].maxLife;
            const lifeB = particles[j].life / particles[j].maxLife;
            const fadeA = lifeA > 0.75 ? 1 - (lifeA - 0.75) / 0.25 : Math.min(lifeA * 4, 1);
            const fadeB = lifeB > 0.75 ? 1 - (lifeB - 0.75) / 0.25 : Math.min(lifeB * 4, 1);
            const lineAlpha = (1 - dist / CONNECTION_DIST) * 0.2 * fadeA * fadeB;

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("click", onClick);
      particlesRef.current = [];
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "none" }}
    />
  );
}

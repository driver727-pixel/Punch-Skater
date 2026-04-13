const DEFAULT_CONFETTI_COLORS = [
  "#00ff88",
  "#00ccff",
  "#cc44ff",
  "#ffdd00",
  "#ff6644",
  "#ff44aa",
];

interface CelebrationBurstOptions {
  colors?: string[];
  durationMs?: number;
  particles?: number;
  spreadX?: number;
  spreadY?: number;
}

export function spawnCelebrationBurst(
  container: HTMLElement,
  {
    colors = DEFAULT_CONFETTI_COLORS,
    durationMs = 1600,
    particles = 72,
    spreadX = 360,
    spreadY = 280,
  }: CelebrationBurstOptions = {},
) {
  const particlesToRemove: HTMLSpanElement[] = [];

  for (let i = 0; i < particles; i += 1) {
    const particle = document.createElement("span");
    particle.className = "confetti-particle";
    particle.style.setProperty("--x", `${(Math.random() - 0.5) * spreadX}px`);
    particle.style.setProperty("--y", `${-Math.random() * spreadY - 40}px`);
    particle.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    particle.style.setProperty("--d", `${0.7 + Math.random() * 0.8}s`);
    particle.style.setProperty("--delay", `${Math.random() * 0.14}s`);
    particle.style.setProperty("--s", `${5 + Math.random() * 8}px`);
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.color = particle.style.backgroundColor;
    container.appendChild(particle);
    particlesToRemove.push(particle);
  }

  window.setTimeout(() => {
    particlesToRemove.forEach((particle) => particle.remove());
  }, durationMs);
}

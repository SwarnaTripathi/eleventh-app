import { useState, useEffect } from 'react';

const COLORS = [
  '#10b981', '#34d399', '#0891b2', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#f59e0b', '#fcd34d',
  '#f43f5e', '#fb7185', '#ec4899', '#a78bfa',
];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export default function Confetti({ active, onComplete }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) { setPieces([]); return; }

    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: `${randomBetween(10, 90)}%`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: `${randomBetween(0, 0.5)}s`,
      duration: `${randomBetween(1.8, 3)}s`,
      size: randomBetween(6, 12),
      rotation: randomBetween(0, 360),
      x: randomBetween(-60, 60),
    }));
    setPieces(newPieces);

    const timer = setTimeout(() => {
      setPieces([]);
      onComplete?.();
    }, 3200);

    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (pieces.length === 0) return null;

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: '-10px',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            '--x-drift': `${p.x}px`,
          }}
        />
      ))}
    </div>
  );
}

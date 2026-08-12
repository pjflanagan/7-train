'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useHydrated } from '../../../hooks/useHydrated';
import styles from './SubwayTileBackground.module.scss';

// Deterministic seed-based random generator to ensure exact same colors
// for each tile coordinate (r, c).
function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
}

export const SubwayTileBackground: React.FC = () => {
  const isHydrated = useHydrated();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (!isHydrated) return;
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isHydrated]);

  const W = 40;    // Tile width
  const H = 20;    // Tile height
  const G = 1;     // Grout line gap (pixels)

  // Generate the tiles that fully fill the viewport, starting from negative
  // top-left to positive bottom-right, dynamically.
  const tiles = useMemo(() => {
    if (!isHydrated) return [];

    const tileElements: React.JSX.Element[] = [];
    
    // We start from negative H and fill until we are positive of the screen bottom
    const startY = -H;
    const endY = dimensions.height + H;

    for (let y = startY; y < endY; y += H) {
      const r = Math.round(y / H);
      const isOdd = r % 2 !== 0;
      const shift = isOdd ? W / 2 : 0;

      // We start from negative W (including shift offsets) and fill until screen right
      const startX = -W - (isOdd ? W / 2 : 0);
      const endX = dimensions.width + W;

      for (let x = startX; x < endX; x += W) {
        const c = Math.round((x - shift) / W);

        // Generate a completely unique, stable seed for this specific coordinate
        // This ensures the color for tile (r, c) is completely stable across resizes.
        const tileSeed = r * 10000 + c;
        const rVal = createSeededRandom(tileSeed);

        // Generate subtle, beautiful off-white shades
        const l = 96.0 + rVal() * 3.0;
        const s = 0.1 + rVal() * 1.0;
        const h = 35;
        const color = `hsl(${h}, ${s.toFixed(2)}%, ${l.toFixed(2)}%)`;

        const rxPos = x + G / 2;
        const ryPos = y + G / 2;
        const rWidth = W - G;
        const rHeight = H - G;

        tileElements.push(
          <g key={`tile-${r}-${c}`}>
            {/* Tile Ceramic Base */}
            <rect
              x={rxPos}
              y={ryPos}
              width={rWidth}
              height={rHeight}
              fill={color}
              rx={0.75}
              ry={0.75}
            />
            {/* Soft Ceramic Glaze & Bevel Shading Overlay */}
            <rect
              x={rxPos}
              y={ryPos}
              width={rWidth}
              height={rHeight}
              fill="url(#tile-shading)"
              rx={0.75}
              ry={0.75}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      }
    }

    return tileElements;
  }, [dimensions, isHydrated]);

  return (
    <div className={styles.backgroundContainer}>
      <svg width="100%" height="100%" className={styles.svg}>
        <defs>
          {/* Subtle vertical linear gradient to create beautiful, touchable 3D bevel shading */}
          <linearGradient id="tile-shading" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.65} />
            <stop offset="12%" stopColor="#ffffff" stopOpacity={0.2} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="88%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.07} />
          </linearGradient>
        </defs>

        {/* Grout background color (slate-300 / light grey) */}
        <rect width="100%" height="100%" fill="#d2d6dc" />

        {/* Dynamic, non-repeating tiles covering the entire screen */}
        {tiles}
      </svg>
    </div>
  );
};

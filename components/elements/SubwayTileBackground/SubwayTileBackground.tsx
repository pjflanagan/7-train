'use client';

import React, { useMemo } from 'react';
import styles from './SubwayTileBackground.module.scss';

// Deterministic seed-based random generator to ensure exact same colors
// on both server (SSR) and client, avoiding hydration mismatches.
function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
}

export const SubwayTileBackground: React.FC = () => {
  const PW = 320;  // Pattern width (C * W)
  const PH = 160;  // Pattern height (R * H)
  const W = 40;    // Tile width
  const H = 20;    // Tile height
  const G = 1;     // Grout line gap (pixels)
  const R = 8;     // Rows
  const C = 8;     // Columns

  // Generate tile colors once, deterministically
  const tiles = useMemo(() => {
    const rVal = createSeededRandom(4232912); // Seed
    const colors: string[][] = [];

    for (let r = 0; r < R; r++) {
      const rowColors: string[] = [];
      for (let c = 0; c < C; c++) {
        // Generate beautiful, subtle off-white shades
        // Lightness between 96.0% and 99.0% (subtle premium variations)
        const l = 96.0 + rVal() * 3.0;
        // Saturation between 0.1% and 1.1%
        const s = 0.1 + rVal() * 1.0;
        // Warm/ceramic ivory tone (hue 35)
        const h = 35;
        rowColors.push(`hsl(${h}, ${s.toFixed(2)}%, ${l.toFixed(2)}%)`);
      }
      colors.push(rowColors);
    }

    const tileElements: React.JSX.Element[] = [];

    for (let r = 0; r < R; r++) {
      const isOdd = r % 2 !== 0;
      const shift = isOdd ? W / 2 : 0;
      const y = r * H;

      for (let c = -1; c <= C; c++) {
        const x = c * W + shift;

        // Skip if tile is completely outside the [0, PW] pattern boundary
        if (x + W < 0 || x >= PW) continue;

        // Wrap column index for color lookup
        const cGrid = (c + C) % C;
        const color = colors[r][cGrid];

        // Shrink tile size by the grout gap
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
  }, [PW, PH, W, H, G, R, C]);

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

          {/* Repeating SVG pattern for maximum rendering performance */}
          <pattern
            id="subway-tiles"
            width={PW}
            height={PH}
            patternUnits="userSpaceOnUse"
          >
            {/* Grout background behind tiles (slate-300 / light grey) */}
            <rect width={PW} height={PH} fill="#d2d6dc" />
            
            {/* Generated Tiles */}
            {tiles}
          </pattern>
        </defs>

        {/* Fill the entire screen with the high-performance tile pattern */}
        <rect width="100%" height="100%" fill="url(#subway-tiles)" />
      </svg>
    </div>
  );
};

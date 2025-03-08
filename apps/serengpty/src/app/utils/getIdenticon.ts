'use client';

import { toSvg } from 'jdenticon';

interface IdenticonOptions {
  size?: number;
  hue?: number; // Optional hue value (0-360)
}

export function getIdenticon(
  uniqueId: string,
  options: IdenticonOptions = {}
): string {
  const { size = 200, hue } = options;

  // Determine the hue value
  // If not provided, we'll derive it from the uniqueId to ensure consistent colors per user
  const calculatedHue = hue ?? getHueFromString(uniqueId);

  // Configure jdenticon with our custom options
  const config = {
    hues: [calculatedHue],
    lightness: {
      color: [0.4, 0.8],
      grayscale: [0.3, 0.9],
    },
    saturation: {
      color: 0.5,
      grayscale: 0.0,
    },
    backColor: '#0000', // Transparent background
  };

  // Generate the SVG
  const svgString = toSvg(uniqueId, size, config);

  return (
    'data:image/svg+xml,' +
    encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  );
}

// Generate a consistent hue (0-360) from a string
function getHueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

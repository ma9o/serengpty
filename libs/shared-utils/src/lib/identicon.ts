import { toSvg } from 'jdenticon';

interface IdenticonOptions {
  size?: number;
  hue?: number; // Optional hue value (0-360)
}

/**
 * Generate a deterministic identicon SVG for a given unique ID
 * @param uniqueId - A unique string to generate the identicon from
 * @param options - Optional configuration for the identicon
 * @returns A data URL string containing the SVG image
 */
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

/**
 * Generate a consistent hue (0-360) from a string
 * @param str - Input string to convert to a hue value
 * @returns A number between 0-360 representing a hue
 */
export function getHueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Initialize the countries library
countries.registerLocale(enLocale);

// Get all countries in the format we need
export const ALL_COUNTRIES = [
  // Add Internet as default option
  {
    code: 'INTERNET',
    name: 'Internet',
    flag: '🌐',
  },
  ...Object.entries(countries.getNames('en'))
    .map(([code, name]) => {
      // Convert country code to flag emoji
      const flag = code
        .toUpperCase()
        .replace(/./g, (char) =>
          String.fromCodePoint(char.charCodeAt(0) + 127397)
        );

      return {
        code,
        name,
        flag,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
];

/**
 * Get a country flag emoji based on the country name or code
 * @param country Country name or country code
 * @returns Country flag emoji, or 🌐 if country not found
 */
export function getCountryFlag(country: string): string {
  // If it's already a code (2-letter code or INTERNET)
  if (country === 'INTERNET') {
    return '🌐';
  }

  if (country.length === 2) {
    // Assume it's a 2-letter country code
    const countryEntry = ALL_COUNTRIES.find(
      (c) => c.code.toLowerCase() === country.toLowerCase()
    );
    if (countryEntry) {
      return countryEntry.flag;
    }
  }

  // Try to find by name
  const countryEntry = ALL_COUNTRIES.find(
    (c) => c.name.toLowerCase() === country.toLowerCase()
  );

  if (countryEntry) {
    return countryEntry.flag;
  }

  // Default to globe emoji if not found
  return '🌐';
}

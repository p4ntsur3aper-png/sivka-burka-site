import type { CSSProperties } from 'react';

const legacyGalleryTokens: Record<string, string> = {
  lesson: 'linear-gradient(135deg, #315734, #b67f4a)',
  walk: 'linear-gradient(135deg, #4d6f4f, #d8b978)',
  photo: 'linear-gradient(135deg, #69513a, #e1c7a0)',
  horse: 'linear-gradient(135deg, #352216, #8f6f4d)',
  territory: 'linear-gradient(135deg, #375c42, #d7bc80)',
  briefing: 'linear-gradient(135deg, #214b38, #9fb57a)',
};

export function getMediaStyle(value: string): CSSProperties {
  const normalizedValue = legacyGalleryTokens[value] || value;

  if (!value) {
    return { backgroundImage: 'linear-gradient(135deg, #315734, #b67f4a)', backgroundSize: 'cover', backgroundPosition: 'center' };
  }

  if (normalizedValue.includes('gradient(')) {
    return { backgroundImage: normalizedValue, backgroundSize: 'cover', backgroundPosition: 'center' };
  }

  return {
    backgroundImage: `linear-gradient(180deg, rgba(20, 53, 31, 0.08), rgba(20, 53, 31, 0.45)), url("${normalizedValue}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

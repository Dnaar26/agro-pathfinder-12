/**
 * Coordenadas por defecto cuando una parcela aún no tiene ubicación guardada.
 * Apartadó (Urabá antioqueño). Antes estaba hardcodeado en La Paz, Bolivia.
 */
export const DEFAULT_COORDS = { lat: 7.8819, lng: -76.6259 } as const;

export function coordsOrDefault(lat: unknown, lng: unknown) {
  const la = Number(lat);
  const ln = Number(lng);
  return {
    lat: Number.isFinite(la) && la !== 0 ? la : DEFAULT_COORDS.lat,
    lng: Number.isFinite(ln) && ln !== 0 ? ln : DEFAULT_COORDS.lng,
  };
}

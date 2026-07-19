import { Color } from 'cesium';

export function toCesiumColor(value: string, fallback = Color.WHITE): Color {
  return Color.fromCssColorString(value) ?? fallback;
}

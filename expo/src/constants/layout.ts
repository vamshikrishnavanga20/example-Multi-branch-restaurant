/**
 * Responsive layout helpers.
 *
 * Every screen should use `useIsTablet()` instead of inline
 * `width >= 768` checks so we have a single breakpoint constant.
 */

import { useWindowDimensions } from 'react-native';
import { TABLET_BREAKPOINT } from './theme';

/** Returns `true` when the shortest viewport dimension is ≥ TABLET_BREAKPOINT. */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

/** Calculate responsive column count for grids. */
export function useResponsiveColumns(phoneColumns = 2, tabletColumns = 3): number {
  const isTablet = useIsTablet();
  return isTablet ? tabletColumns : phoneColumns;
}

/** Returns the current window width. Useful for adaptive spacing. */
export function useScreenWidth(): number {
  const { width } = useWindowDimensions();
  return width;
}

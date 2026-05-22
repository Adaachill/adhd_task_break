import { useWindowDimensions } from 'react-native';

import { typography } from '@/theme/tokens';

const DESKTOP_BREAKPOINT = 768;

export function useLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  // PC では 1.25 倍、タブレット境界付近では補間
  const scale = isDesktop ? 1.25 : width >= 600 ? 1.1 : 1;

  return {
    isDesktop,
    width,
    fs: {
      body: typography.body * scale,
      small: typography.small * scale,
      caption: typography.caption * scale,
      title: typography.title * scale,
    },
  };
}

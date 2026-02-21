import { useThemeContext } from '@/hooks/ThemeContext';

// Re-export the hook
export { useThemeContext };

// Helper to get all theme colors
export function useThemeColors() {
  const { colors } = useThemeContext();
  return colors;
}

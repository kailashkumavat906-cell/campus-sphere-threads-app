// Dark Theme Colors
export const colors = {
  background: '#000000',
  primary: '#FFFFFF',
  secondary: '#8E8E8E',
  accent: '#3797EF',
  border: '#262626',
  unreadBg: 'rgba(55, 151, 239, 0.1)',
  danger: '#FF3B30',
};

// Format timestamp helper
export const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return months + 'mo';
  if (weeks > 0) return weeks + 'w';
  if (days > 0) return days + 'd';
  if (hours > 0) return hours + 'h';
  if (minutes > 0) return minutes + 'm';
  return 'now';
};

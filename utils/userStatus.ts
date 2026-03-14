// Helper function to get user status text
export function getUserStatus(user: { isOnline?: boolean; lastSeen?: number; showOnlineStatus?: boolean }): string | null {
  // If user has disabled online status visibility, return null
  if (!user.showOnlineStatus) {
    return null;
  }

  // If user is currently online
  if (user.isOnline) {
    return "Active now";
  }

  // If user has never been seen
  if (!user.lastSeen) {
    return null;
  }

  const minutes = Math.floor((Date.now() - user.lastSeen) / 60000);

  if (minutes < 1) {
    return "Active just now";
  }

  if (minutes < 60) {
    return `Active ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Active ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `Active ${days}d ago`;
}

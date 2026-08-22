import UnifiedAdminConsole from "./UnifiedAdminConsole";

export default function AdminPortal({ currentUser, onNavigateHome }) {
  return (
    <UnifiedAdminConsole
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      customRole="admin"
    />
  );
}

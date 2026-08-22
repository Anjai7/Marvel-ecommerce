import UnifiedAdminConsole from "../admin/UnifiedAdminConsole";

export default function SuperAdminDashboard({ currentUser, onNavigateHome }) {
  return (
    <UnifiedAdminConsole
      currentUser={currentUser}
      onNavigateHome={onNavigateHome}
      customRole="super_admin"
    />
  );
}

/* The console's top-right cluster: the notification bell and the profile menu.
 *
 * Both live in the header rather than the sidebar, because the header is where
 * an operator looks first, and because the profile menu is where "settings"
 * and "sign out" belong. The sidebar footer that used to hold the profile,
 * the storefront shortcut and the sign-out button is gone. */

import { Bell, ChevronDown, LogOut, Settings, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui";
import { displayInitial, displayValue, ROLE_LABELS } from "./adminConstants";

/**
 * The bell, with a count of the alerts that need attention.
 *
 * @param {object} props
 * @param {Array} props.alerts from buildAlerts()
 * @param {(tab: string) => void} props.onOpenTab navigate to the tab that can act
 */
export function AdminNotifications({ alerts = [], onOpenTab }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="admin-topbar-icon-btn"
          aria-label={
            alerts.length > 0
              ? `Notifications, ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`
              : "Notifications"
          }
        >
          <Bell size={18} />
          {alerts.length > 0 && (
            <span className="admin-notification-count" aria-hidden="true">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="admin-alerts-menu">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {alerts.length === 0 ? (
          <p className="admin-alerts-empty">Nothing needs your attention right now.</p>
        ) : (
          alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <DropdownMenuItem
                key={alert.id}
                className={`admin-alert-item admin-alert-${alert.tone}`}
                onSelect={() => onOpenTab?.(alert.tab)}
              >
                <span className="admin-alert-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="admin-alert-text">
                  <span className="admin-alert-title">{alert.title}</span>
                  <span className="admin-alert-detail">{alert.detail}</span>
                </span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The profile menu: who is signed in, plus settings and sign out.
 *
 * @param {object} props
 * @param {object} props.user the signed-in profile
 * @param {string} props.role the role slug
 * @param {boolean} props.isSuperAdmin
 * @param {() => void} props.onOpenSettings
 * @param {() => void} props.onSignOut
 */
export function AdminProfileMenu({ user, role, isSuperAdmin, onOpenSettings, onSignOut }) {
  const roleSlug = isSuperAdmin ? "super_admin" : role || "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="admin-profile-trigger" aria-label="Account menu">
          <span className="admin-profile-avatar" aria-hidden="true">
            {displayInitial(user?.full_name || user?.email)}
          </span>
          <span className="admin-profile-text">
            <span className="admin-profile-name">{displayValue(user?.full_name)}</span>
            <span className="admin-profile-role">{ROLE_LABELS[roleSlug] ?? roleSlug}</span>
          </span>
          <ChevronDown size={15} className="admin-profile-chevron" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="admin-profile-menu">
        <div className="admin-profile-header">
          <span className="admin-profile-header-name">{displayValue(user?.full_name)}</span>
          <span className="admin-profile-header-email">{displayValue(user?.email)}</span>
          <span className="admin-profile-header-role">
            <ShieldCheck size={12} /> {ROLE_LABELS[roleSlug] ?? roleSlug}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Settings size={15} />} onSelect={() => onOpenSettings?.()}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<LogOut size={15} />}
          className="admin-profile-signout"
          onSelect={() => onSignOut?.()}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

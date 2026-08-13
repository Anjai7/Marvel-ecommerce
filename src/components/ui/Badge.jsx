import React from "react";
import { clsx } from "clsx";

export const Badge = React.forwardRef(
  (
    {
      className,
      variant = "default", // default | secondary | success | destructive | outline | warning | accent
      size = "md", // sm | md
      children,
      icon,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={clsx(
          "ui-badge",
          `ui-badge-${variant}`,
          `ui-badge-${size}`,
          className
        )}
        {...props}
      >
        {icon && <span className="ui-badge-icon">{icon}</span>}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = "Badge";

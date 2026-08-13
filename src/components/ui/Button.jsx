import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";

export const Button = React.forwardRef(
  (
    {
      className,
      variant = "default", // default | primary | secondary | outline | ghost | danger | accent | link
      size = "md", // sm | md | lg | icon
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          "ui-btn",
          `ui-btn-${variant}`,
          `ui-btn-${size}`,
          isLoading && "ui-btn-loading",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="ui-btn-spinner" aria-hidden="true" />
        ) : (
          leftIcon && <span className="ui-btn-icon-left">{leftIcon}</span>
        )}
        <span className="ui-btn-content">{children}</span>
        {!isLoading && rightIcon && (
          <span className="ui-btn-icon-right">{rightIcon}</span>
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

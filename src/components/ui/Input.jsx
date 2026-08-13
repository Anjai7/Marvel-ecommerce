import React from "react";
import { clsx } from "clsx";

export const Input = React.forwardRef(
  ({ className, type = "text", leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className={clsx("ui-input-wrapper", error && "has-error")}>
        {leftIcon && <span className="ui-input-icon-left">{leftIcon}</span>}
        <input
          type={type}
          className={clsx(
            "ui-input",
            leftIcon && "has-left-icon",
            rightIcon && "has-right-icon",
            className
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && <span className="ui-input-icon-right">{rightIcon}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

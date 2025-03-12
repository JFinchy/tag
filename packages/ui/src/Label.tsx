import React, { LabelHTMLAttributes, forwardRef } from "react";

const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className = "", ...props }, ref) => {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      ref={ref}
      {...props}
    />
  );
});

Label.displayName = "Label";

export { Label };

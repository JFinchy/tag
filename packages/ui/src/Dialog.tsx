import React, { createContext, useContext, useState } from "react";

// Dialog Context
type DialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

// Dialog Root
interface DialogProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setUncontrolledOpen(newOpen);
    }
  };

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

// Dialog Trigger
interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({
  children,
  asChild = false,
}: DialogTriggerProps) {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("DialogTrigger must be used within a Dialog");
  }

  const { setOpen } = context;

  const handleClick = () => {
    setOpen(true);
  };

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

// Dialog Content
interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function DialogContent({
  children,
  className = "",
  onClose,
}: DialogContentProps) {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("DialogContent must be used within a Dialog");
  }

  const { open, setOpen } = context;

  if (!open) {
    return null;
  }

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleEscape}
      tabIndex={-1}
    >
      <div className={`dialog-content ${className}`}>
        {children}
        <button className="dialog-close" onClick={handleClose}>
          &times;
        </button>
      </div>
    </div>
  );
}

// Dialog Header
interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className = "" }: DialogHeaderProps) {
  return <div className={`dialog-header ${className}`}>{children}</div>;
}

// Dialog Title
interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className = "" }: DialogTitleProps) {
  return <h2 className={`dialog-title ${className}`}>{children}</h2>;
}

// Dialog Description
interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({
  children,
  className = "",
}: DialogDescriptionProps) {
  return <p className={`dialog-description ${className}`}>{children}</p>;
}

// Dialog Footer
interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className = "" }: DialogFooterProps) {
  return <div className={`dialog-footer ${className}`}>{children}</div>;
}

// Export all components
export const DialogRoot = Dialog;

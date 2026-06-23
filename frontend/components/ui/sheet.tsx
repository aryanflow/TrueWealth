"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-[80] bg-black/55 transition-opacity duration-200 motion-reduce:transition-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100 ${className}`}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
};

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className = "", children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={`fixed z-[90] flex h-full w-full max-w-md flex-col border-line bg-canvas shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-75 ${
          side === "right"
            ? "right-0 top-0 border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0"
            : "left-0 top-0 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
        } ${className}`}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

function SheetHeader({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-b border-line px-5 py-4 ${className}`} {...props} />;
}

function SheetTitle({ className = "", ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={`font-display text-lg text-ink ${className}`} {...props} />;
}

function SheetDescription({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={`text-sm text-muted ${className}`} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };

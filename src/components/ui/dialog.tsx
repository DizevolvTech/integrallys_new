"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Standard modal sizes — single source of truth for max-width.
 * Use the `size` prop on DialogContent instead of `max-w-*` on className.
 */
const dialogSizeClass = {
  sm: "max-w-[480px]",      // confirmações, single-question
  md: "max-w-[560px]",      // formulários médios (default)
  lg: "max-w-[720px]",      // formulários complexos
  xl: "max-w-[920px]",      // listagens, multi-coluna
  "2xl": "max-w-[1200px]",  // multi-coluna densa (formulário + sidebar de pagamento)
} as const

type DialogSize = keyof typeof dialogSizeClass

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean
    allowOutsideClose?: boolean
    srTitle?: string
    size?: DialogSize
  }
>(({ className, children, hideCloseButton, allowOutsideClose = false, onInteractOutside, srTitle = "Dialog", size = "md", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div className="fixed inset-0 z-50 overflow-y-auto pointer-events-none">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
        <DialogPrimitive.Content
          ref={ref}
          data-dialog-content=""
          onInteractOutside={(event) => {
            if (!allowOutsideClose) {
              event.preventDefault()
            }
            onInteractOutside?.(event)
          }}
          className={cn(
            "pointer-events-auto relative z-50 grid w-full max-h-[90vh] gap-4 overflow-y-auto overscroll-contain rounded-[16px] border border-app-border bg-app-card p-6 text-app-text-primary shadow-lg transition-[opacity,transform] duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=closed]:scale-95 data-[state=open]:scale-100 dark:border-app-border-dark dark:bg-app-card-dark dark:text-white",
            dialogSizeClass[size],
            className
          )}
          {...props}
        >
          {!hasDialogTitle(children) && <DialogPrimitive.Title className="sr-only">{srTitle}</DialogPrimitive.Title>}
          {children}
          {!hideCloseButton && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // sticky (-bottom-6 = padding p-6 padrão da janela): com o corpo rolando, os botões ficam à vista rente à borda de baixo
      "sticky -bottom-6 z-10 flex flex-col-reverse bg-app-card pb-4 pt-3 dark:bg-app-card-dark sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-normal leading-none tracking-tight",
        className
      )}
      {...props}
    />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

function hasDialogTitle(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false

    const elementType = child.type as { displayName?: string }
    const childProps = child.props as { children?: React.ReactNode }
    if (
      elementType === DialogPrimitive.Title ||
      elementType.displayName === DialogPrimitive.Title.displayName ||
      elementType.displayName === "DialogTitle"
    ) {
      return true
    }

    return hasDialogTitle(childProps.children)
  })
}

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

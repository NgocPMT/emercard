import React, { useEffect, useId, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type RefObject, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-[0_10px_24px_rgb(40_127_155_/_0.18)] hover:bg-primary-strong",
  secondary: "border border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgb(180_35_24_/_0.16)] hover:opacity-90",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  disabled?: boolean;
};

export function LinkButton({
  variant = "secondary",
  size = "md",
  busy = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      aria-disabled={disabled || busy || undefined}
      onClick={(event) => {
        if (disabled || busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function IconButton({ label, size = "md", variant = "ghost", className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(buttonBase, buttonVariants[variant], size === "sm" ? "min-h-10 px-3" : buttonSizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export type FieldErrorProps = {
  error?: string;
  id?: string;
  className?: string;
};

export function FieldError({ error, id, className }: FieldErrorProps) {
  if (!error) return null;
  return (
    <p id={id} className={cn("text-sm text-destructive", className)} role="alert">
      {error}
    </p>
  );
}

export type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode | ((ids: { describedBy?: string; hintId: string; errorId: string }) => ReactNode);
};

export function FormField({ label, htmlFor, hint, error, required, className, children }: FormFieldProps) {
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const content = typeof children === "function" ? children({ describedBy, hintId, errorId }) : children;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        <span>{label}</span>
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
      </label>
      {content}
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

function inputBase(className?: string) {
  return cn(
    "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-white/80 px-4 py-2.5 text-foreground shadow-[0_2px_0_rgb(19_43_53_/_0.02)] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted",
    className,
  );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function TextInput({ label, hint, error, id, className, required, ...props }: TextInputProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <FormField label={label} htmlFor={controlId} hint={hint} error={error} required={required}>
      {({ describedBy }) => (
        <input
          id={controlId}
          className={inputBase(className)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          {...props}
        />
      )}
    </FormField>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function Textarea({ label, hint, error, id, className, required, ...props }: TextareaProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <FormField label={label} htmlFor={controlId} hint={hint} error={error} required={required}>
      {({ describedBy }) => (
        <textarea
          id={controlId}
          className={inputBase(cn("min-h-32 resize-y py-3", className))}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          {...props}
        />
      )}
    </FormField>
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function Select({ label, hint, error, id, className, required, children, ...props }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <FormField label={label} htmlFor={controlId} hint={hint} error={error} required={required}>
      {({ describedBy }) => (
        <select
          id={controlId}
          className={inputBase(cn("pr-10", className))}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          {...props}
        >
          {children}
        </select>
      )}
    </FormField>
  );
}

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function Checkbox({ label, hint, error, id, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={controlId} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-card px-4 py-3 shadow-sm">
        <input
          id={controlId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-4 focus:ring-primary/15"
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <span className="text-sm text-foreground">{label}</span>
      </label>
      {hint ? <p id={hintId} className="text-sm text-muted-foreground">{hint}</p> : null}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export type AlertVariant = "info" | "success" | "warning" | "danger";

const alertVariants: Record<AlertVariant, string> = {
  info: "border-border bg-card text-foreground",
  success: "border-success/30 bg-success-soft text-foreground",
  warning: "border-warning/30 bg-warning-soft text-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-foreground",
};

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: ReactNode;
};

export function Alert({ variant = "info", title, className, children, ...props }: AlertProps) {
  return (
    <div className={cn("rounded-[var(--radius-panel)] border p-4 shadow-[0_8px_24px_rgb(19_43_53_/_0.05)]", alertVariants[variant], className)} role={variant === "danger" ? "alert" : "status"} {...props}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title ? "mt-2" : "")}>{children}</div> : null}
    </div>
  );
}

export type StatusBadgeVariant = "neutral" | "success" | "warning" | "danger" | "primary";

const statusBadgeVariants: Record<StatusBadgeVariant, string> = {
  neutral: "bg-muted text-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
};

export function StatusBadge({ variant = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: StatusBadgeVariant }) {
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusBadgeVariants[variant], className)} {...props} />;
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[var(--radius-panel)] border border-border/90 bg-card p-5 shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function Spinner({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden="true" {...props} />;
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-block animate-pulse rounded bg-muted", className)} aria-hidden="true" {...props} />;
}

export type DialogProps = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  actions?: ReactNode;
};

export function Dialog({ open, title, description, children, onClose, actions, initialFocusRef }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const target = initialFocusRef?.current ?? dialog.querySelector<HTMLElement>("[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      target?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialFocusRef, open]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 m-0 w-[min(100%-1.5rem,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-border bg-card p-0 shadow-2xl backdrop:bg-slate-950/40"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="space-y-5 p-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>
        <div>{children}</div>
        {actions ? <footer className="flex flex-wrap justify-end gap-3">{actions}</footer> : null}
      </div>
    </dialog>
  );
}

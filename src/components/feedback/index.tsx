import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Panel, Spinner } from "../primitives";

export type PageStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "neutral" | "loading" | "danger";
  className?: string;
};

export function PageState({ title, description, action, variant = "neutral", className }: PageStateProps) {
  return (
    <Panel className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        {variant === "loading" ? <Spinner /> : null}
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </Panel>
  );
}

export function EmptyState({ title, description, action, className }: PageStateProps) {
  return <PageState title={title} description={description} action={action} className={className} />;
}

export function PageLoadingState(props: Omit<PageStateProps, "variant">) {
  return <PageState variant="loading" {...props} />;
}

export function RetryState({ title, description, action, className }: PageStateProps) {
  return <PageState variant="danger" title={title} description={description} action={action} className={className} />;
}

export function AccessDeniedState(props: Omit<PageStateProps, "variant">) {
  return <PageState variant="danger" {...props} />;
}

export function ServiceUnavailableState(props: Omit<PageStateProps, "variant">) {
  return <PageState variant="danger" {...props} />;
}

export function NotFoundState(props: Omit<PageStateProps, "variant">) {
  return <PageState {...props} />;
}

export type NotificationRegionProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
  title?: ReactNode;
};

export function NotificationRegion({ tone = "neutral", title, className, children, ...props }: NotificationRegionProps) {
  const toneClasses: Record<NonNullable<NotificationRegionProps["tone"]>, string> = {
    neutral: "border-border bg-card",
    success: "border-success/30 bg-success-soft",
    warning: "border-warning/30 bg-warning-soft",
    danger: "border-destructive/30 bg-destructive/10",
  };

  if (!children && !title) return null;

  return (
    <div
      className={cn("rounded-[var(--radius-panel)] border p-4 shadow-sm", toneClasses[tone], className)}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      {...props}
    >
      {title ? <p className="font-semibold text-foreground">{title}</p> : null}
      {children ? <div className={title ? "mt-2" : undefined}>{children}</div> : null}
    </div>
  );
}

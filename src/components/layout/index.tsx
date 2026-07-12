import React, { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../primitives";

export type NavigationItem = {
  href: string;
  label: string;
  current?: boolean;
};

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
    >
      Bỏ qua đến nội dung chính
    </a>
  );
}

export function PageTitle({ title, description, eyebrow }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="space-y-3">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
      <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">{title}</h1>
      {description ? <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">{description}</p> : null}
    </header>
  );
}

export function AccountMenu({
  busy = false,
  label = "Đăng xuất",
  onSignOut,
}: {
  busy?: boolean;
  label?: string;
  onSignOut: () => Promise<void> | void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      busy={busy}
      onClick={() => {
        void onSignOut();
      }}
    >
      {label}
    </Button>
  );
}

export function ResponsiveNavigation({ items, label = "Điều hướng" }: { items: NavigationItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="w-full">
      <div className="hidden flex-wrap gap-2 md:flex">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              item.current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </a>
        ))}
      </div>

      <details className="group md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
          <span>{label}</span>
          <span aria-hidden="true" className="text-muted-foreground group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-3 rounded-[var(--radius-panel)] border border-border bg-card p-3 shadow-sm">
          <div className="grid gap-2">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "rounded-[var(--radius-control)] px-4 py-3 text-sm font-medium",
                  item.current ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </details>
    </nav>
  );
}

export function NotificationMount({ children }: { children?: ReactNode }) {
  return <div aria-live="polite" aria-atomic="true" className="space-y-3" role="status">{children}</div>;
}

export function ApplicationShell({
  brand,
  title,
  description,
  navigation,
  userLabel,
  actions,
  children,
  notifications,
  mainClassName,
}: {
  brand: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  navigation: NavigationItem[];
  userLabel?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  notifications?: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3 font-black tracking-tight text-foreground">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm text-primary-foreground shadow-sm">EC</span>
            <span>{brand}</span>
          </a>
          <div className="ml-auto hidden md:block">
            <ResponsiveNavigation items={navigation} />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {userLabel ? <div className="hidden sm:block">{userLabel}</div> : null}
            {actions ? <div>{actions}</div> : null}
          </div>
        </div>
        <div className="border-t border-border/60 px-4 py-3 sm:px-6 lg:px-8 md:hidden">
          <ResponsiveNavigation items={navigation} />
        </div>
      </header>
      <main id="main-content" className={cn("mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8", mainClassName)}>
        <div className="space-y-6">
          {title || description ? <PageTitle title={title ?? brand} description={description} /> : null}
          {notifications ? <NotificationMount>{notifications}</NotificationMount> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

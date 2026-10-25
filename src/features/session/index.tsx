import React, { Component, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentSession, logout, sessionKeys } from "../../api/session";
import type { CurrentSession } from "../../api/types";
import { isApiError } from "../../api/http-client";
import { createPageQueryClient } from "../../api/query-client";
export { createPageQueryClient };
import { AccessDeniedState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { AccountMenu, ApplicationShell, type NavigationItem } from "../../components/layout";
import { assignLocation, reloadPage, replaceLocation } from "../../lib/navigation";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "forbidden" | "unavailable";
export type SessionRole = "user" | "admin";

export const homeRoutes: Record<SessionRole, string> = {
  user: "/app/profile",
  admin: "/admin",
};

export function validateReturnTo(returnTo: string | null | undefined, role: SessionRole) {
  const fallback = homeRoutes[role];
  if (!returnTo) return fallback;
  if (returnTo.startsWith("//") || returnTo.includes("://")) return fallback;

  try {
    const url = new URL(returnTo, "http://example.com");
    if (url.origin !== "http://example.com") return fallback;
    const path = url.pathname;
    if (path.startsWith("/e/")) return fallback;
    if (role === "user" && !path.startsWith("/app")) return fallback;
    if (role === "admin" && !path.startsWith("/admin")) return fallback;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginRedirect(returnTo: string | null | undefined, role: SessionRole) {
  const safeReturnTo = validateReturnTo(returnTo, role);
  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

type SessionContextValue = {
  session: CurrentSession | null;
  status: SessionStatus;
  isAuthenticated: boolean;
  isUnavailable: boolean;
  isForbidden: boolean;
  refresh: () => Promise<unknown>;
  clearSessionCache: () => void;
  logoutAndClear: () => Promise<boolean>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function deriveStatus(session: CurrentSession | null | undefined, error: unknown): SessionStatus {
  if (error && isApiError(error)) {
    if (error.status === 401) return "unauthenticated";
    if (error.status === 403) return "forbidden";
    return error.retryable ? "unavailable" : "unavailable";
  }
  if (session) return "authenticated";
  if (error) return "unavailable";
  return "unauthenticated";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: sessionKeys.current,
    queryFn: ({ signal }) => getCurrentSession(signal),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const value = useMemo<SessionContextValue>(
    () => ({
      session: query.data ?? null,
      status: query.isPending ? "loading" : deriveStatus(query.data ?? null, query.error),
      isAuthenticated: deriveStatus(query.data ?? null, query.error) === "authenticated",
      isUnavailable: deriveStatus(query.data ?? null, query.error) === "unavailable",
      isForbidden: deriveStatus(query.data ?? null, query.error) === "forbidden",
      refresh: async () => query.refetch(),
      clearSessionCache: () => queryClient.clear(),
      logoutAndClear: async () => {
        let confirmed = true;
        try {
          await logout();
        } catch {
          confirmed = false;
        } finally {
          queryClient.clear();
        }
        return confirmed;
      },
    }),
    [query.data, query.error, query.isPending, query.refetch, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    return {
      session: null,
      status: "unauthenticated",
      isAuthenticated: false,
      isUnavailable: false,
      isForbidden: false,
      refresh: async () => {},
      clearSessionCache: () => {},
      logoutAndClear: async () => true,
    };
  }
  return context;
}

export class PageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <RetryState
          title="Đã xảy ra lỗi khi hiển thị trang"
          description="Vui lòng tải lại trang. Nội dung kỹ thuật nhạy cảm không được hiển thị ở đây."
          action={
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => reloadPage()}>
              Tải lại
            </button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export function RouteAccessGate({
  role,
  returnTo,
  children,
}: {
  role: SessionRole;
  returnTo?: string | null;
  children: ReactNode;
}) {
  const { session, status, isUnavailable, isForbidden } = useSession();
  const safeReturnTo = validateReturnTo(returnTo, role);

  useEffect(() => {
    if (status === "unauthenticated") {
      replaceLocation(buildLoginRedirect(safeReturnTo, role));
    }
  }, [role, safeReturnTo, status]);

  if (status === "loading") {
    return <PageLoadingState title="Đang xác thực phiên" description="Kiểm tra trạng thái đăng nhập trước khi hiển thị nội dung." />;
  }

  if (isUnavailable) {
    return (
      <ServiceUnavailableState
        title="Không thể tải phiên"
        description="Máy chủ xác thực tạm thời không phản hồi. Vui lòng thử lại sau."
        action={
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => reloadPage()}>
            Thử lại
          </button>
        }
      />
    );
  }

  if (isForbidden) {
    return (
      <AccessDeniedState
        title="Không có quyền truy cập"
        description="Phiên hiện tại không thể xác nhận quyền truy cập khu vực này."
        action={
          <a href={homeRoutes[role]} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Trở về khu vực của tôi
          </a>
        }
      />
    );
  }

  if (status === "unauthenticated") {
    return <PageLoadingState title="Chuyển hướng đến đăng nhập" description="Bạn sẽ được đưa tới trang đăng nhập an toàn." />;
  }

  if (!session) {
    return <PageLoadingState title="Chuyển hướng đến đăng nhập" description="Bạn sẽ được đưa tới trang đăng nhập an toàn." />;
  }

  if (session.role !== role) {
    return (
      <AccessDeniedState
        title="Không có quyền truy cập"
        description="Tài khoản hiện tại không phù hợp với khu vực này."
        action={
          <a href={homeRoutes[session.role]} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Đi đến trang của tôi
          </a>
        }
      />
    );
  }

  return <>{children}</>;
}

export function PublicAuthGate({ children, returnTo }: { children: ReactNode; returnTo?: string | null }) {
  const { session, status } = useSession();
  const safeReturnTo = session ? validateReturnTo(returnTo, session.role) : null;

  useEffect(() => {
    if (status === "authenticated" && session) {
      window.location.replace(safeReturnTo ?? homeRoutes[session.role]);
    }
  }, [safeReturnTo, session, status]);

  if (status === "unavailable") {
    return (
      <ServiceUnavailableState
        title="Không thể kiểm tra phiên"
        description="Máy chủ xác thực tạm thời không phản hồi. Vui lòng thử lại sau."
        action={
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => reloadPage()}>
            Thử lại
          </button>
        }
      />
    );
  }

  return <>{children}</>;
}

function AuthenticatedShellFrame({
  brand,
  title,
  description,
  navigation,
  userLabel,
  notifications,
  children,
}: {
  brand: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  navigation: NavigationItem[];
  userLabel?: ReactNode;
  notifications?: ReactNode;
  children: ReactNode;
}) {
  const { session, logoutAndClear } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const confirmed = await logoutAndClear();
    setIsSigningOut(false);
    assignLocation(confirmed ? "/login" : "/login?notice=logout-unconfirmed");
  };

  const identity = session ? (
    <div className="flex max-w-[14rem] flex-col items-end gap-1 text-right">
      <span className="truncate text-sm font-semibold text-foreground">{session.email}</span>
      {userLabel ? <div className="flex flex-wrap justify-end gap-2">{userLabel}</div> : <span className="text-xs text-muted-foreground">{session.role === "admin" ? "Quản trị viên" : "Người dùng"}</span>}
    </div>
  ) : null;

  return (
    <ApplicationShell
      brand={brand}
      title={title}
      description={description}
      navigation={navigation}
      userLabel={identity}
      actions={<AccountMenu busy={isSigningOut} onSignOut={handleSignOut} />}
      mobileActions={<AccountMenu busy={isSigningOut} compact onSignOut={handleSignOut} />}
      notifications={notifications}
    >
      {children}
    </ApplicationShell>
  );
}

export function PageApplicationRoot({
  role,
  brand,
  title,
  description,
  navigation,
  userLabel,
  returnTo,
  notifications,
  children,
}: {
  role: SessionRole;
  brand: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  navigation: NavigationItem[];
  userLabel?: ReactNode;
  returnTo?: string | null;
  notifications?: ReactNode;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => createPageQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary>
        <SessionProvider>
          <RouteAccessGate role={role} returnTo={returnTo}>
            <AuthenticatedShellFrame
              brand={brand}
              title={title}
              description={description}
              navigation={navigation}
              userLabel={userLabel}
              notifications={notifications}
            >
              {children}
            </AuthenticatedShellFrame>
          </RouteAccessGate>
        </SessionProvider>
      </PageErrorBoundary>
    </QueryClientProvider>
  );
}

export function PageSessionSummary({ label }: { label: string }) {
  const { session, status } = useSession();
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4 text-sm shadow-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">Trạng thái: {status}</p>
      <p className="mt-1 text-muted-foreground">Tài khoản: {session?.email ?? "chưa đăng nhập"}</p>
      <p className="mt-1 text-muted-foreground">Vai trò: {session?.role ?? "chưa xác định"}</p>
    </div>
  );
}

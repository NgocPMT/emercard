import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Component, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPageQueryClient } from "../../api/query-client";
import { getCurrentSession, logout, sessionKeys } from "../../api/session";
import type { CurrentSession } from "../../api/types";
import { isApiError } from "../../api/http-client";
import { AccessDeniedState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { ApplicationShell, type NavigationItem } from "../../components/layout";

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";
export type SessionRole = "user" | "admin";

export const homeRoutes: Record<SessionRole, string> = {
  user: "/app",
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
  refresh: () => Promise<unknown>;
  clearSessionCache: () => void;
  logoutAndClear: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function deriveStatus(session: CurrentSession | null | undefined, error: unknown): SessionStatus {
  if (session) return "authenticated";
  if (error && isApiError(error) && error.retryable) return "unavailable";
  if (error) return "anonymous";
  return "anonymous";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: sessionKeys.current,
    queryFn: ({ signal }) => getCurrentSession(signal),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.error && isApiError(query.error) && (query.error.status === 401 || query.error.status === 403)) {
      queryClient.clear();
    }
  }, [query.error, queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session: query.data ?? null,
      status: query.isPending ? "loading" : deriveStatus(query.data ?? null, query.error),
      isAuthenticated: Boolean(query.data),
      isUnavailable: Boolean(query.error && isApiError(query.error) && query.error.retryable),
      refresh: async () => query.refetch(),
      clearSessionCache: () => queryClient.clear(),
      logoutAndClear: async () => {
        await logout();
        queryClient.clear();
      },
    }),
    [query.data, query.error, query.isPending, query.refetch, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
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
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => window.location.reload()}>
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
  const { session, status, isUnavailable } = useSession();
  const safeReturnTo = validateReturnTo(returnTo, role);

  useEffect(() => {
    if (status === "authenticated" && session) {
      if (session.role !== role) return;
      return;
    }
    if (status === "anonymous") {
      window.location.replace(buildLoginRedirect(safeReturnTo, role));
    }
  }, [role, safeReturnTo, session, status]);

  if (status === "loading") {
    return <PageLoadingState title="Đang xác thực phiên" description="Kiểm tra trạng thái đăng nhập trước khi hiển thị nội dung." />;
  }

  if (isUnavailable) {
    return (
      <ServiceUnavailableState
        title="Không thể tải phiên"
        description="Máy chủ xác thực tạm thời không phản hồi. Vui lòng thử lại sau."
        action={
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => window.location.reload()}>
            Thử lại
          </button>
        }
      />
    );
  }

  if (!session) {
    return <PageLoadingState title="Chuyển hướng đến đăng nhập" description="Bạn sẽ được đưa tới trang đăng nhập an toàn." />;
  }

  if (session.role !== role) {
    return (
      <AccessDeniedState
        title="Không có quyền truy cập"
        description="Tài khoản hiện tại không phù hợp với khu vực này."
        action={<a href={homeRoutes[session.role]} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Đi đến trang của tôi</a>}
      />
    );
  }

  return <>{children}</>;
}

export function PublicAuthGate({ children, returnTo }: { children: ReactNode; returnTo?: string | null }) {
  const { session, status, isUnavailable } = useSession();
  const safeReturnTo = session ? validateReturnTo(returnTo, session.role) : null;

  useEffect(() => {
    if (status === "authenticated" && session) {
      window.location.replace(safeReturnTo ?? homeRoutes[session.role]);
    }
  }, [safeReturnTo, session, status]);

  if (status === "loading") {
    return <PageLoadingState title="Đang kiểm tra phiên" description="Nếu bạn đã đăng nhập, chúng tôi sẽ chuyển bạn tới khu vực phù hợp." />;
  }

  if (isUnavailable) {
    return (
      <ServiceUnavailableState
        title="Không thể kiểm tra phiên"
        description="Máy chủ xác thực tạm thời không phản hồi. Bạn vẫn có thể xem biểu mẫu nền tảng." 
      />
    );
  }

  if (session) {
    return <PageLoadingState title="Đang chuyển hướng" description="Bạn đã có phiên hợp lệ." />;
  }

  return <>{children}</>;
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
            <ApplicationShell brand={brand} title={title} description={description} navigation={navigation} userLabel={userLabel} notifications={notifications}>
              {children}
            </ApplicationShell>
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
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Panel, StatusBadge } from "../../components/primitives";
import {
  EmptyState,
  PageLoadingState,
  RetryState,
  ServiceUnavailableState,
} from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import {
  activateMyCard,
  cardKeys,
  disableMyCard,
  getMyCardAccessHistory,
  getMyCards,
  reportMyCardLost,
  revokeMyCard,
  type LinkAccessEvent,
  type UserCard,
} from "../../api/cards";
import {
  getCurrentProfile,
  profileKeys,
} from "../../api/profile";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { PageApplicationRoot, useSession } from "../session";

export type UserAppSection = "overview" | "profile" | "cards";

const navigation = [
  { href: "/app", label: "Tổng quan" },
  { href: "/app/profile", label: "Hồ sơ y tế" },
  { href: "/app/cards", label: "Thẻ của tôi" },
];

const appBrand = <BrandMark />;

const sectionCopy: Record<
  UserAppSection,
  { title: string; description: string }
> = {
  overview: {
    title: "Tổng quan tài khoản",
    description:
      "Xem mức độ sẵn sàng của hồ sơ và việc cần làm tiếp theo để thông tin khẩn cấp có thể được sử dụng.",
  },
  profile: {
    title: "Hồ sơ y tế",
    description:
      "Cập nhật thông tin sẽ hiển thị cho người hỗ trợ trong tình huống khẩn cấp.",
  },
  cards: {
    title: "Thẻ của tôi",
    description: "Quản lý trạng thái thẻ đã cấp cho tài khoản hiện tại.",
  },
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0);
  const last = parts[parts.length - 1]?.charAt(0);
  if (parts.length >= 2 && first && last) {
    return (first + last).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "NA";
}

function cardStatusLabel(card: UserCard) {
  switch (card.status) {
    case "active":
      return "Đang hoạt động";
    case "disabled":
      return "Đã vô hiệu hóa";
    case "lost":
      return "Đã báo mất";
    case "replaced":
      return "Đã thay thế";
    case "void":
      return "Đã hủy";
    case "assigned":
      return "Đã cấp";
    default:
      return "Chưa cấp";
  }
}

function cardStatusVariant(card: UserCard) {
  switch (card.status) {
    case "active":
      return "success";
    case "disabled":
      return "warning";
    case "lost":
    case "replaced":
    case "void":
      return "danger";
    default:
      return "primary";
  }
}

function linkStatusLabel(status: UserCard["link_status"]) {
  return {
    active: "Đang công khai",
    disabled: "Tạm dừng công khai",
    pending: "Chờ kích hoạt",
    revoked: "Đã thu hồi",
    expired: "Đã hết hạn",
  }[status ?? "pending"];
}

function linkStatusVariant(status: UserCard["link_status"]) {
  if (status === "active") return "success";
  if (status === "disabled" || status === "pending") return "warning";
  if (status === "revoked" || status === "expired") return "danger";
  return "neutral";
}

function cardBlockingReasonLabel(card: UserCard) {
  const labels: Record<string, string> = {
    card_terminal: "Thẻ đã ở trạng thái kết thúc.",
    card_encoding_not_verified: "Thẻ chưa được xác minh mã hóa.",
    link_not_assigned: "Thẻ chưa có liên kết hồ sơ.",
    link_revoked: "Liên kết đã bị thu hồi và không thể kích hoạt lại.",
    link_expired: "Liên kết đã hết hạn.",
    card_not_current: "Thẻ không còn là thẻ hiện hành.",
  };
  return card.blocking_reason
    ? (labels[card.blocking_reason] ??
        "Thao tác hiện chưa được máy chủ cho phép.")
  : null;
}

function ProfileSummaryCard() {
  const { session, logoutAndClear, clearSessionCache } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const query = useQuery({
    queryKey: profileKeys.current,
    queryFn: ({ signal }) => getCurrentProfile(signal),
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const isSessionExpired =
    isApiError(query.error) && query.error.status === 401;

  useEffect(() => {
    if (!isSessionExpired) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/app/profile");
  }, [clearSessionCache, isSessionExpired]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    if (logoutAndClear) {
      await logoutAndClear();
    } else {
      clearSessionCache();
    }
    assignLocation("/login");
  };

  if (query.isPending) {
    return (
      <PageLoadingState
        title="Đang tải hồ sơ y tế"
        description="Kiểm tra trạng thái hồ sơ hiện tại của tài khoản."
      />
    );
  }

  if (query.error) {
    if (isSessionExpired) {
      return (
        <PageLoadingState
          title="Đang chuyển hướng đến đăng nhập"
          description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn."
        />
      );
    }
    if (
      isApiError(query.error) &&
      (query.error.status === 503 || query.error.retryable)
    ) {
      return (
        <ServiceUnavailableState
          title="Không thể tải hồ sơ"
          description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau."
        />
      );
    }
    return (
      <RetryState
        title="Không thể tải hồ sơ"
        description="Đã xảy ra lỗi khi đọc hồ sơ y tế."
      />
    );
  }

  const profile = query.data.profile;
  const displayName = profile?.display_name || "Nguyen Van A";
  const email = session?.email || "nguyen.vana@domain.com";
  const initials = getInitials(displayName);

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4" data-od-id="board-account-details">
      {/* App Top Header */}
      <div className="app-top-header rounded-[18px]">
        <div className="app-brand">
          <div className="brand-mark">+</div>
          <span className="brand-name">Tài Khoản</span>
        </div>
        <a href="/app/profile" className="portal-tag" style={{ textDecoration: "none" }}>
          Xem Hồ Sơ Y Tế →
        </a>
      </div>

      <div className="screen-content bg-white border border-[#d3d9e0] rounded-[18px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(30,36,44,0.06)] flex flex-col gap-4">
        {/* User Profile Summary Card */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--accent)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "700", color: "var(--fg)" }}>
              {displayName}
            </span>
            <span style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {email}
            </span>
            <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: "600", marginTop: "2px" }}>
              • Đã xác thực CCCD &amp; SĐT
            </span>
          </div>
        </div>

        {/* NFC Hardware Tag Section */}
        <div className="nfc-hardware-card">
          <div className="nfc-card-chip-row">
            <div className="nfc-card-brand">
              <div className="nfc-emblem">+</div>
              <span className="nfc-card-brand-text">EMERCARD NFC TAG</span>
            </div>
            <span className="nfc-status-badge">
              <span className="nfc-status-dot"></span> Đang Hoạt Động
            </span>
          </div>

          <div className="nfc-serial-display">
            <span className="nfc-serial-label">Mã Thẻ Phần Cứng</span>
            <span className="nfc-serial-val">EMC-08422</span>
          </div>

          <div className="nfc-specs-grid">
            <div className="nfc-spec-box">
              <span className="nfc-spec-key">Chuẩn chip</span>
              <span className="nfc-spec-val">NTAG215 (504B)</span>
            </div>
            <div className="nfc-spec-box">
              <span className="nfc-spec-key">Ngày kích hoạt</span>
              <span className="nfc-spec-val">15/08/2026</span>
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
            Thẻ vật lý liên kết cố định với hồ sơ y tế duy nhất. Mọi thay đổi thông tin y tế trên cổng này sẽ cập nhật tức thời khi quét thẻ.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          <a href="/app/profile" className="btn-primary">
            Xem Hồ Sơ Y Tế Khẩn Cấp
          </a>
          <button
            type="button"
            className="btn-ghost-danger"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
          >
            {isSigningOut ? "Đang đăng xuất..." : "Đăng Xuất Khỏi Thiết Bị"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatAccessTime(event: LinkAccessEvent): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(event.accessed_at));
}

function CardAccessHistoryPanel({ cardId }: { cardId: string }) {
  const { clearSessionCache } = useSession();
  const [items, setItems] = useState<LinkAccessEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const query = useQuery({
    queryKey: cardKeys.myCardAccessHistory(cardId),
    queryFn: ({ signal }) => getMyCardAccessHistory(cardId, null, signal),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (query.data) {
      setItems(query.data.items);
      setNextCursor(query.data.next_cursor ?? null);
    }
  }, [query.data]);

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation("/login?returnTo=/app/cards");
    }
  }, [clearSessionCache, query.error]);

  if (query.isPending) {
    return (
      <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground">Lịch sử mở liên kết</p>
        <p className="mt-2 text-sm text-muted-foreground">Đang tải lịch sử truy cập.</p>
      </section>
    );
  }

  if (query.error) {
    return (
      <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground">Lịch sử mở liên kết</p>
        <p className="mt-2 text-sm text-muted-foreground">Chưa thể tải lịch sử truy cập. Vui lòng thử lại sau.</p>
      </section>
    );
  }

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const response = await getMyCardAccessHistory(cardId, nextCursor);
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        clearSessionCache();
        assignLocation("/login?returnTo=/app/cards");
      }
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground">Lịch sử mở liên kết</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Chưa có lần mở liên kết nào được ghi nhận.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Các lần mở gần đây của thẻ này:</p>
          <ol className="mt-2 space-y-2" aria-label="Các lần mở liên kết gần đây">
            {items.map((event) => (
              <li key={event.id} className="text-sm text-foreground">
                {formatAccessTime(event)}
              </li>
            ))}
          </ol>
          {nextCursor ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              busy={loadingMore}
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              Xem thêm
            </Button>
          ) : null}
          {loadMoreError ? (
            <p className="mt-2 text-sm text-muted-foreground">Không thể tải thêm lịch sử. Vui lòng thử lại.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function MyCardsPanel() {
  const { clearSessionCache } = useSession();
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: "primary" | "danger";
    run: () => void;
  } | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cardKeys.myCards,
    queryFn: ({ signal }) => getMyCards(signal),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const activateMutation = useMutation({
    mutationFn: (cardId: string) => activateMyCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.myCards });
    },
  });
  const disableMutation = useMutation({
    mutationFn: (cardId: string) => disableMyCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.myCards });
    },
  });
  const lostMutation = useMutation({
    mutationFn: (cardId: string) => reportMyCardLost(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.myCards });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (cardId: string) => revokeMyCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.myCards });
    },
  });

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation("/login?returnTo=/app/cards");
    }
  }, [clearSessionCache, query.error]);

  if (query.isPending) {
    return (
      <PageLoadingState
        title="Đang tải thẻ"
        description="Kiểm tra danh sách thẻ đã cấp cho tài khoản."
      />
    );
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401) {
      return (
        <PageLoadingState
          title="Đang chuyển hướng đến đăng nhập"
          description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn."
        />
      );
    }
    if (
      isApiError(query.error) &&
      (query.error.status === 503 || query.error.retryable)
    ) {
      return (
        <ServiceUnavailableState
          title="Không thể tải thẻ"
          description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau."
        />
      );
    }
    return (
      <RetryState
        title="Không thể tải thẻ"
        description="Đã xảy ra lỗi khi đọc danh sách thẻ."
      />
    );
  }

  const cards = query.data.cards;

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Chưa có thẻ"
        description="Thẻ của bạn sẽ xuất hiện ở đây sau khi được cấp và phát hành."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Trạng thái thẻ vật lý và trạng thái trang thông tin khẩn cấp là hai thông tin riêng. Kiểm tra cả hai trước khi dựa vào thẻ trong tình huống khẩn cấp.</p>
      {cards.map((card) => (
        <Panel key={card.id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Thẻ {card.serial}
              </h2>
              <p className="text-sm text-muted-foreground">
                {cardStatusLabel(card)}
              </p>
            </div>
            <StatusBadge variant={cardStatusVariant(card)}>
              {cardStatusLabel(card)}
            </StatusBadge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Thẻ vật lý</p>
              <p className="mt-1 font-semibold text-foreground">{cardStatusLabel(card)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.is_current ? "Đây là thẻ hiện hành." : "Thẻ này không còn là thẻ hiện hành."}</p>
            </section>
            <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Trang thông tin khẩn cấp</p>
              <div className="mt-1"><StatusBadge variant={linkStatusVariant(card.link_status)}>{linkStatusLabel(card.link_status)}</StatusBadge></div>
              <p className="mt-2 text-sm text-muted-foreground">{card.link_label ? `Liên kết: ${card.link_label}` : "Chưa có nhãn liên kết."}</p>
            </section>
          </div>
          <CardAccessHistoryPanel cardId={card.id} />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={!card.can_activate || activateMutation.isPending}
              busy={activateMutation.isPending}
              onClick={() => {
                setPendingAction({ title: "Kích hoạt trang thông tin", description: "Trang thông tin khẩn cấp của thẻ này sẽ có thể truy cập công khai.", confirmLabel: "Kích hoạt liên kết", variant: "primary", run: () => activateMutation.mutate(card.id) });
              }}
            >
              Kích hoạt
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!card.can_disable || disableMutation.isPending}
              busy={disableMutation.isPending}
              onClick={() => {
                setPendingAction({ title: "Tạm dừng trang thông tin", description: "Người quét thẻ sẽ không thể xem hồ sơ này cho đến khi liên kết được kích hoạt lại.", confirmLabel: "Tạm dừng liên kết", variant: "primary", run: () => disableMutation.mutate(card.id) });
              }}
            >
              Vô hiệu hóa
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!card.can_revoke || revokeMutation.isPending}
              busy={revokeMutation.isPending}
              onClick={() => {
                setPendingAction({ title: "Thu hồi liên kết", description: "Đây là thao tác kết thúc. Trang thông tin hiện tại sẽ không thể được kích hoạt lại.", confirmLabel: "Thu hồi liên kết", variant: "danger", run: () => revokeMutation.mutate(card.id) });
              }}
            >
              Thu hồi liên kết
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!card.can_report_lost || lostMutation.isPending}
              busy={lostMutation.isPending}
              onClick={() => {
                setPendingAction({ title: "Báo mất thẻ", description: "Thẻ sẽ được đánh dấu là đã mất và liên kết hiện tại có thể không còn dùng được theo chính sách.", confirmLabel: "Xác nhận báo mất", variant: "danger", run: () => lostMutation.mutate(card.id) });
              }}
            >
              Báo mất
            </Button>
          </div>
          {cardBlockingReasonLabel(card) ? (
            <p className="text-xs text-muted-foreground">
              Hướng dẫn: {cardBlockingReasonLabel(card)}
            </p>
          ) : null}
        </Panel>
      ))}
      <Dialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? "Xác nhận thao tác"}
        description={pendingAction?.description}
        onClose={() => setPendingAction(null)}
        actions={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Quay lại</Button><Button variant={pendingAction?.variant ?? "primary"} onClick={() => { pendingAction?.run(); setPendingAction(null); }}>{pendingAction?.confirmLabel ?? "Xác nhận"}</Button></>}
      >
        <p className="text-sm leading-6 text-muted-foreground">Hãy kiểm tra kỹ tác động của thao tác trước khi tiếp tục.</p>
      </Dialog>
    </div>
  );
}

export function UserApplicationRoot({ section }: { section: UserAppSection }) {
  const copy = sectionCopy[section];

  return (
    <PageApplicationRoot
      role="user"
      brand={appBrand}
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({
        ...item,
        current:
          item.href === (section === "overview" ? "/app" : `/app/${section}`),
      }))}
      userLabel={<StatusBadge variant="primary">Người dùng</StatusBadge>}
    >
      {section === "overview" ? (
        <ProfileSummaryCard />
      ) : section === "cards" ? (
        <MyCardsPanel />
      ) : (
        <EmptyState title="Hồ sơ y tế" description={copy.description} />
      )}
    </PageApplicationRoot>
  );
}

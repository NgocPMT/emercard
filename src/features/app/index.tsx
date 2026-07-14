import React, { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Panel, StatusBadge } from "../../components/primitives";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import {
  activateMyCard,
  cardKeys,
  disableMyCard,
  getMyCards,
  reportMyCardLost,
  type UserCard,
} from "../../api/cards";
import { getCurrentProfile, profileKeys, profileMissingFieldLabel, profileReadinessLabel } from "../../api/profile";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { bloodTypeLabel, genderLabel } from "../../lib/profile-labels";
import { PageApplicationRoot, useSession } from "../session";

export type UserAppSection = "overview" | "profile" | "cards";

const navigation = [
  { href: "/app", label: "Tổng quan" },
  { href: "/app/profile", label: "Hồ sơ y tế" },
  { href: "/app/cards", label: "Thẻ của tôi" },
];

const appBrand = <BrandMark />;

const sectionCopy: Record<UserAppSection, { title: string; description: string }> = {
  overview: {
    title: "Tổng quan tài khoản",
    description: "Màn hình nền tảng cho các thông tin tóm tắt và điều hướng nhanh.",
  },
  profile: {
    title: "Hồ sơ y tế",
    description: "Khung giao diện cho quản lý hồ sơ y tế sẽ được nối ở các giai đoạn sau.",
  },
  cards: {
    title: "Thẻ của tôi",
    description: "Quản lý trạng thái thẻ đã cấp cho tài khoản hiện tại.",
  },
};

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

function ProfileSummaryCard() {
  const { clearSessionCache } = useSession();
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

  const isSessionExpired = isApiError(query.error) && query.error.status === 401;

  useEffect(() => {
    if (!isSessionExpired) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/app/profile");
  }, [clearSessionCache, isSessionExpired]);

  if (query.isPending) {
    return <PageLoadingState title="Đang tải hồ sơ y tế" description="Kiểm tra trạng thái hồ sơ hiện tại của tài khoản." />;
  }

  if (query.error) {
    if (isSessionExpired) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(query.error) && (query.error.status === 503 || query.error.retryable)) {
      return <ServiceUnavailableState title="Không thể tải hồ sơ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải hồ sơ" description="Đã xảy ra lỗi khi đọc hồ sơ y tế." />;
  }

  const profile = query.data.profile;
  const readiness = query.data.readiness;

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Trạng thái hồ sơ</h2>
          <p className="text-sm text-muted-foreground">{profileReadinessLabel(readiness.status)}</p>
        </div>
        <StatusBadge variant={readiness.status === "ready" ? "success" : readiness.status === "not_started" ? "warning" : "primary"}>
          {readiness.status}
        </StatusBadge>
      </div>

      {profile ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">{profile.display_name ?? "Chưa đặt tên hiển thị"}</p>
          <p>Năm sinh: {profile.birth_year ?? "chưa cung cấp"}</p>
          <p>Giới tính: {genderLabel(profile.gender)}</p>
          <p>Nhóm máu: {bloodTypeLabel(profile.blood_type)}</p>
          <p>Người liên hệ khẩn cấp: {profile.emergency_contacts.length}</p>
        </div>
      ) : (
        <EmptyState
          title="Chưa có hồ sơ"
          description="Hồ sơ y tế sẽ xuất hiện sau lần lưu đầu tiên."
          action={
            <a href="/app/profile" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Tạo hồ sơ
            </a>
          }
        />
      )}

      {readiness.missing_fields.length > 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Cần bổ sung</p>
          <ul className="mt-2 space-y-1">
            {readiness.missing_fields.map((field) => (
              <li key={field}>• {profileMissingFieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function MyCardsPanel() {
  const { clearSessionCache } = useSession();
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

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation("/login?returnTo=/app/cards");
    }
  }, [clearSessionCache, query.error]);

  if (query.isPending) {
    return <PageLoadingState title="Đang tải thẻ" description="Kiểm tra danh sách thẻ đã cấp cho tài khoản." />;
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(query.error) && (query.error.status === 503 || query.error.retryable)) {
      return <ServiceUnavailableState title="Không thể tải thẻ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải thẻ" description="Đã xảy ra lỗi khi đọc danh sách thẻ." />;
  }

  const cards = query.data.cards;

  if (cards.length === 0) {
    return <EmptyState title="Chưa có thẻ" description="Thẻ của bạn sẽ xuất hiện ở đây sau khi được cấp và phát hành." />;
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <Panel key={card.id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Thẻ {card.serial}</h2>
              <p className="text-sm text-muted-foreground">{cardStatusLabel(card)}</p>
            </div>
            <StatusBadge variant={cardStatusVariant(card)}>{card.status}</StatusBadge>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Đang hiện diện: {card.is_current ? "Có" : "Không"}</p>
            <p>Đã cấp: {new Date(card.issued_at).toLocaleDateString("vi-VN")}</p>
            <p>Cho phép kích hoạt: {card.can_activate ? "Có" : "Không"}</p>
            <p>Cho phép vô hiệu hóa: {card.can_disable ? "Có" : "Không"}</p>
            <p>Liên kết: {card.link_status ?? "chưa có"}</p>
            <p>Loại liên kết: {card.link_purpose ?? "chưa có"}</p>
            <p>Nhãn liên kết: {card.link_label ?? "không có"}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={!card.can_activate || activateMutation.isPending}
              busy={activateMutation.isPending}
              onClick={() => {
                if (!window.confirm("Bạn có chắc muốn kích hoạt public URL của thẻ này không?")) return;
                activateMutation.mutate(card.id);
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
                if (
                  !window.confirm(
                    "Bạn có chắc muốn tạm dừng public URL của thẻ này không? Bạn có thể kích hoạt lại cùng một URL sau đó.",
                  )
                )
                  return;
                disableMutation.mutate(card.id);
              }}
            >
              Vô hiệu hóa
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!card.can_report_lost || lostMutation.isPending}
              busy={lostMutation.isPending}
              onClick={() => {
                if (!window.confirm("Bạn có chắc muốn báo mất thẻ này không?")) return;
                lostMutation.mutate(card.id);
              }}
            >
              Báo mất
            </Button>
          </div>
          {card.blocking_reason ? <p className="text-xs text-muted-foreground">Lý do chặn: {card.blocking_reason}</p> : null}
        </Panel>
      ))}
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
      navigation={navigation.map((item) => ({ ...item, current: item.href === (section === "overview" ? "/app" : `/app/${section}`) }))}
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

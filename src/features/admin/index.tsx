import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Panel, StatusBadge } from "../../components/primitives";
import {
  EmptyState,
  PageLoadingState,
  RetryState,
  ServiceUnavailableState,
} from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import {
  cardKeys,
  createBlankCard,
  getAdminCards,
  issueCard,
  reportAdminCardLost,
  replaceCard,
  type AdminCard,
  voidCard,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { PageApplicationRoot, useSession } from "../session";
import { AdminLinkManagerPanel } from "./link-manager";
import { AdminCardDetailPanel } from "./card-detail";

export type AdminAppSection = "overview" | "cards" | "links" | "detail";

const navigation = [
  { href: "/admin/cards", label: "Kho thẻ" },
  { href: "/admin/links", label: "Liên kết hồ sơ" },
];
const appBrand = <BrandMark />;
const sectionCopy: Record<
  AdminAppSection,
  { title: string; description: string }
> = {
  overview: {
    title: "Bảng điều khiển quản trị",
    description: "Khung nền tảng cho quản trị viên EmerCard.",
  },
  cards: {
    title: "Kho thẻ",
    description: "Quản lý thẻ vật lý và quy trình gắn liên kết hồ sơ.",
  },
  links: {
    title: "Liên kết hồ sơ",
    description: "Tạo liên kết thẻ chờ và theo dõi vòng đời an toàn.",
  },
  detail: {
    title: "Chi tiết thẻ",
    description: "Gắn liên kết, xác minh mã và quản lý vòng đời thẻ.",
  },
};

function cardStatusLabel(card: AdminCard) {
  return {
    active: "Đang hoạt động",
    disabled: "Đã vô hiệu hóa",
    lost: "Đã báo mất",
    replaced: "Đã thay thế",
    void: "Đã hủy",
    assigned: "Đã cấp",
    unassigned: "Chưa cấp",
  }[card.status];
}
function cardStatusVariant(card: AdminCard) {
  return card.status === "active"
    ? "success"
    : card.status === "disabled"
      ? "warning"
      : ["lost", "replaced", "void"].includes(card.status)
        ? "danger"
        : "primary";
}

function AdminCardsPanel() {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cardKeys.adminCards,
    queryFn: ({ signal }) => getAdminCards(signal),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
  });
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
  const createMutation = useMutation({
    mutationFn: () => createBlankCard(),
    onSuccess: invalidate,
  });
  const issueMutation = useMutation({
    mutationFn: (cardId: string) => issueCard(cardId),
    onSuccess: invalidate,
  });
  const lostMutation = useMutation({
    mutationFn: (cardId: string) => reportAdminCardLost(cardId),
    onSuccess: invalidate,
  });
  const voidMutation = useMutation({
    mutationFn: (cardId: string) => voidCard(cardId),
    onSuccess: invalidate,
  });
  const replaceMutation = useMutation({
    mutationFn: (cardId: string) => replaceCard(cardId),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation("/login?returnTo=/admin/cards");
    }
  }, [clearSessionCache, query.error]);

  if (query.isPending)
    return (
      <PageLoadingState
        title="Đang tải kho thẻ"
        description="Kiểm tra danh sách thẻ quản trị hiện tại."
      />
    );
  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401)
      return (
        <PageLoadingState
          title="Đang chuyển hướng đến đăng nhập"
          description="Phiên đã hết hạn."
        />
      );
    if (
      isApiError(query.error) &&
      (query.error.status === 503 || query.error.retryable)
    )
      return (
        <ServiceUnavailableState
          title="Không thể tải kho thẻ"
          description="Máy chủ tạm thời không phản hồi."
        />
      );
    return (
      <RetryState
        title="Không thể tải kho thẻ"
        description="Đã xảy ra lỗi khi đọc danh sách thẻ."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Thao tác nhanh
          </h2>
          <p className="text-sm text-muted-foreground">
            Tạo thẻ trống, sau đó mở chi tiết để gắn liên kết thẻ chờ.
          </p>
        </div>
        <Button
          type="button"
          busy={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Tạo thẻ trống
        </Button>
      </Panel>
      {query.data.items.length === 0 ? (
        <EmptyState
          title="Chưa có thẻ"
          description="Tạo một thẻ trống để bắt đầu quy trình."
        />
      ) : (
        <div className="space-y-4">
          {query.data.items.map((card) => (
            <AdminCardPanel
              key={card.id}
              card={card}
              actions={{
                issue: () => issueMutation.mutate(card.id),
                lost: () => lostMutation.mutate(card.id),
                void: () => voidMutation.mutate(card.id),
                replace: () => replaceMutation.mutate(card.id),
              }}
              busy={{
                issue: issueMutation.isPending,
                lost: lostMutation.isPending,
                void: voidMutation.isPending,
                replace: replaceMutation.isPending,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminCardPanel({
  card,
  actions,
  busy,
}: {
  card: AdminCard;
  actions: {
    issue: () => void;
    lost: () => void;
    void: () => void;
    replace: () => void;
  };
  busy: Record<string, boolean>;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Thẻ {card.serial}
          </h3>
          <p className="text-sm text-muted-foreground">
            {cardStatusLabel(card)}
          </p>
        </div>
        <StatusBadge variant={cardStatusVariant(card)}>
          {card.encoding_state}
        </StatusBadge>
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Đang hiện diện: {card.is_current ? "Có" : "Không"}</p>
        <p>Người nhận giao hàng: {card.owner?.email ?? "chưa có"}</p>
        <p>
          Phát hành:{" "}
          {card.issued_at
            ? new Date(card.issued_at).toLocaleString("vi-VN")
            : "chưa"}
        </p>
        <p>Liên kết: {card.link?.status ?? "chưa gắn"}</p>
        <p>Gắn liên kết: {card.assignment?.status ?? "chưa có"}</p>
        <p>
          Xác minh mã:{" "}
          {card.encoding_verified_at ? "Đã xác minh" : "Chưa xác minh"}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() =>
            assignLocation(
              `/admin/cards/detail?cardId=${encodeURIComponent(card.id)}`,
            )
          }
        >
          Chi tiết liên kết
        </Button>
        <Button
          type="button"
          variant="secondary"
          busy={busy.issue}
          disabled={
            !card.link ||
            card.encoding_state !== "verified" ||
            Boolean(card.issued_at)
          }
          onClick={actions.issue}
        >
          Phát hành
        </Button>
        <Button
          type="button"
          variant="ghost"
          busy={busy.lost}
          onClick={() => {
            if (window.confirm("Báo mất thẻ này?")) actions.lost();
          }}
        >
          Báo mất
        </Button>
        <Button
          type="button"
          variant="ghost"
          busy={busy.void}
          disabled={Boolean(card.issued_at)}
          onClick={() => {
            if (window.confirm("Hủy thẻ chưa phát hành?")) actions.void();
          }}
        >
          Hủy
        </Button>
        <Button
          type="button"
          variant="danger"
          busy={busy.replace}
          onClick={() => {
            if (window.confirm("Tạo quy trình thay thế thẻ này?"))
              actions.replace();
          }}
        >
          Thay thế
        </Button>
      </div>
    </Panel>
  );
}

export function AdminApplicationRoot({
  section,
  cardId,
}: {
  section: AdminAppSection;
  cardId?: string | null;
}) {
  const [locationCardId, setLocationCardId] = useState<string | null>(cardId ?? null);

  useEffect(() => {
    if (cardId || section !== "detail") return;
    setLocationCardId(new URLSearchParams(window.location.search).get("cardId"));
  }, [cardId, section]);

  const resolvedCardId = cardId ?? locationCardId;
  const copy = sectionCopy[section];
  const currentPath =
    section === "overview"
      ? "/admin"
      : section === "cards" || section === "detail"
        ? "/admin/cards"
        : "/admin/links";
  return (
    <PageApplicationRoot
      role="admin"
      brand={appBrand}
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({
        ...item,
        current: item.href === currentPath,
      }))}
      userLabel={<StatusBadge variant="danger">Quản trị viên</StatusBadge>}
    >
      {section === "cards" ? (
        <AdminCardsPanel />
      ) : section === "links" ? (
        <AdminLinkManagerPanel />
      ) : section === "detail" ? (
        resolvedCardId ? (
          <AdminCardDetailPanel cardId={resolvedCardId} />
        ) : (
          <EmptyState
            title="Thiếu cardId"
            description="Mở màn hình chi tiết từ một thẻ cụ thể."
          />
        )
      ) : (
        <Panel>
          <EmptyState
            title="Chưa có hành động quản trị ở màn hình này"
            description="Chọn kho thẻ hoặc liên kết hồ sơ để bắt đầu."
          />
        </Panel>
      )}
    </PageApplicationRoot>
  );
}

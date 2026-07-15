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
  { href: "/admin", label: "Bảng điều khiển" },
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
    description: "Ưu tiên các công việc cần hoàn tất để thẻ có thể được phát hành an toàn.",
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

function encodingStatus(card: AdminCard) {
  return {
    not_provisioned: { label: "Chưa có liên kết", variant: "neutral" as const },
    link_generated: { label: "Chờ xác minh mã hóa", variant: "warning" as const },
    verified: { label: "Mã hóa đã xác minh", variant: "success" as const },
  }[card.encoding_state];
}

function linkStatus(card: AdminCard) {
  const status = card.link?.status;
  if (status === "active") return { label: "Đang công khai", variant: "success" as const };
  if (status === "disabled") return { label: "Tạm dừng công khai", variant: "warning" as const };
  if (status === "revoked" || status === "expired") return { label: status === "revoked" ? "Đã thu hồi" : "Đã hết hạn", variant: "danger" as const };
  return { label: status === "pending" ? "Chờ gắn và phát hành" : "Chưa gắn liên kết", variant: "neutral" as const };
}

function nextCardAction(card: AdminCard) {
  if (!card.link) return "Gắn liên kết hồ sơ";
  if (card.encoding_state !== "verified") return "Xác minh URL đã mã hóa";
  if (!card.issued_at) return "Phát hành thẻ vật lý";
  if (card.link.status !== "active") return "Kích hoạt trang thông tin";
  return "Không cần thao tác thêm";
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
            Theo dõi từng bước: gắn liên kết, xác minh URL, phát hành thẻ, rồi mở trang thông tin công khai.
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
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: "primary" | "danger";
    run: () => void;
  } | null>(null);

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
          {cardStatusLabel(card)}
        </StatusBadge>
      </div>
      <div className="rounded-[var(--radius-control)] border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold text-primary">Việc cần làm tiếp theo</p>
        <p className="mt-1 font-semibold text-foreground">{nextCardAction(card)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-3"><p className="text-xs font-semibold text-muted-foreground">Liên kết hồ sơ</p><div className="mt-2"><StatusBadge variant={linkStatus(card).variant}>{linkStatus(card).label}</StatusBadge></div></section>
        <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-3"><p className="text-xs font-semibold text-muted-foreground">Mã hóa thẻ</p><div className="mt-2"><StatusBadge variant={encodingStatus(card).variant}>{encodingStatus(card).label}</StatusBadge></div></section>
        <section className="rounded-[var(--radius-control)] border border-border bg-muted/30 p-3"><p className="text-xs font-semibold text-muted-foreground">Phát hành vật lý</p><p className="mt-2 text-sm font-semibold text-foreground">{card.issued_at ? "Đã phát hành" : "Chưa phát hành"}</p></section>
      </div>
      <p className="text-sm text-muted-foreground">Chủ thẻ: {card.owner?.email ?? "Chưa gắn hồ sơ"}</p>
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
          onClick={() => setPendingAction({
            title: "Báo mất thẻ",
            description: "Thẻ sẽ bị đánh dấu là đã mất. Liên kết hiện tại có thể bị thu hồi theo chính sách.",
            confirmLabel: "Xác nhận báo mất",
            variant: "danger",
            run: actions.lost,
          })}
        >
          Báo mất
        </Button>
        <Button
          type="button"
          variant="ghost"
          busy={busy.void}
          disabled={Boolean(card.issued_at)}
          onClick={() => setPendingAction({
            title: "Hủy thẻ chưa phát hành",
            description: "Thẻ sẽ không thể được cấp hoặc sử dụng. Liên kết đang gắn, nếu có, sẽ bị thu hồi.",
            confirmLabel: "Hủy thẻ",
            variant: "danger",
            run: actions.void,
          })}
        >
          Hủy
        </Button>
        <Button
          type="button"
          variant="danger"
          busy={busy.replace}
          onClick={() => setPendingAction({
            title: "Thay thế thẻ",
            description: "Thao tác này bắt đầu quy trình thay thế và thẻ hiện tại sẽ không còn là thẻ đang sử dụng.",
            confirmLabel: "Tạo thẻ thay thế",
            variant: "danger",
            run: actions.replace,
          })}
        >
          Thay thế
        </Button>
      </div>
      <Dialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? "Xác nhận thao tác"}
        description={pendingAction?.description}
        onClose={() => setPendingAction(null)}
        actions={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Quay lại</Button><Button variant={pendingAction?.variant ?? "primary"} onClick={() => { pendingAction?.run(); setPendingAction(null); }}>{pendingAction?.confirmLabel ?? "Xác nhận"}</Button></>}
      >
        <p className="text-sm leading-6 text-muted-foreground">Kiểm tra kỹ tác động của thao tác trước khi tiếp tục.</p>
      </Dialog>
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
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Bắt đầu một quy trình mới</h2>
            <p className="text-sm leading-6 text-muted-foreground">Tạo liên kết hồ sơ trước, sau đó gắn liên kết vào thẻ trống trong kho thẻ.</p>
            <Button type="button" onClick={() => assignLocation("/admin/links")}>Tạo liên kết hồ sơ</Button>
          </Panel>
          <Panel className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Tiếp tục công việc đang dở</h2>
            <p className="text-sm leading-6 text-muted-foreground">Mở kho thẻ để xem trạng thái mã hóa, phát hành và liên kết công khai của từng thẻ.</p>
            <Button type="button" variant="secondary" onClick={() => assignLocation("/admin/cards")}>Mở kho thẻ</Button>
          </Panel>
        </div>
      )}
    </PageApplicationRoot>
  );
}

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Panel, StatusBadge, TextInput } from "../../components/primitives";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import {
  cardKeys,
  confirmCardEncoding,
  attachAdminCardLink,
  createBlankCard,
  detachAdminCardLink,
  getAdminCards,
  issueCard,
  provisionCardLink,
  reportAdminCardLost,
  revokeAdminCardLink,
  reprovisionCardLink,
  type AdminCard,
  voidCard,
  replaceCard,
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

const sectionCopy: Record<AdminAppSection, { title: string; description: string }> = {
  overview: {
    title: "Bảng điều khiển quản trị",
    description: "Khung nền tảng cho quản trị viên EmerCard.",
  },
  cards: {
    title: "Kho thẻ",
    description: "Quản lý thẻ vật lý, liên kết công khai và trạng thái phát hành.",
  },
  links: {
    title: "Liên kết hồ sơ",
    description: "Tra cứu hồ sơ và tạo liên kết an toàn cho hồ sơ công khai.",
  },
  detail: {
    title: "Chi tiết thẻ",
    description: "Khung giao diện cho chi tiết thẻ và quy trình quản trị liên quan.",
  },
};

function cardStatusLabel(card: AdminCard) {
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

function cardStatusVariant(card: AdminCard) {
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

function AdminCardsPanel() {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cardKeys.adminCards,
    queryFn: ({ signal }) => getAdminCards(signal),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });
  const [encodingUrls, setEncodingUrls] = useState<Record<string, string>>({});
  const [lastProvisioning, setLastProvisioning] = useState<{ cardId: string; publicUrl: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createBlankCard(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const provisionMutation = useMutation({
    mutationFn: (cardId: string) => provisionCardLink(cardId),
    onSuccess: (result) => {
      setLastProvisioning({ cardId: result.card.id, publicUrl: result.provisioning.public_url });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const reprovisionMutation = useMutation({
    mutationFn: (cardId: string) => reprovisionCardLink(cardId),
    onSuccess: (result) => {
      setLastProvisioning({ cardId: result.card.id, publicUrl: result.provisioning.public_url });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: ({ cardId, publicUrl }: { cardId: string; publicUrl: string }) =>
      confirmCardEncoding(cardId, publicUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const issueMutation = useMutation({
    mutationFn: (cardId: string) => issueCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const lostMutation = useMutation({
    mutationFn: (cardId: string) => reportAdminCardLost(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const voidMutation = useMutation({
    mutationFn: (cardId: string) => voidCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });
  const replaceMutation = useMutation({
    mutationFn: (cardId: string) => replaceCard(cardId),
    onSuccess: (result) => {
      setLastProvisioning({ cardId: result.card.id, publicUrl: result.provisioning.public_url });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    },
  });

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation("/login?returnTo=/admin/cards");
    }
  }, [clearSessionCache, query.error]);

  const loading = query.isPending;
  const failure = query.error;

  if (loading) {
    return <PageLoadingState title="Đang tải kho thẻ" description="Kiểm tra danh sách thẻ quản trị hiện tại." />;
  }

  if (failure) {
    if (isApiError(failure) && failure.status === 401) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(failure) && (failure.status === 503 || failure.retryable)) {
      return <ServiceUnavailableState title="Không thể tải kho thẻ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải kho thẻ" description="Đã xảy ra lỗi khi đọc danh sách thẻ." />;
  }

  const cards = query.data.items;

  return (
    <div className="space-y-6">
      {lastProvisioning ? (
        <Alert variant="success" title="Liên kết cấp phát mới">
          <div className="break-all text-sm">{lastProvisioning.publicUrl}</div>
        </Alert>
      ) : null}
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Thao tác nhanh</h2>
          <p className="text-sm text-muted-foreground">Tạo thẻ trống trước khi cấp liên kết công khai và phát hành.</p>
        </div>
        <Button type="button" busy={createMutation.isPending} onClick={() => createMutation.mutate()}>
          Tạo thẻ trống
        </Button>
      </Panel>

      {cards.length === 0 ? (
        <EmptyState title="Chưa có thẻ" description="Tạo một thẻ trống để bắt đầu quy trình cấp phát." />
      ) : null}

      <div className="space-y-4">
        {cards.map((card) => (
          <AdminCardPanel
            key={card.id}
            card={card}
            encodingUrl={encodingUrls[card.id] ?? ""}
            onEncodingUrlChange={(value) => setEncodingUrls((current) => ({ ...current, [card.id]: value }))}
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards })}
            actions={{
              provision: () => provisionMutation.mutate(card.id),
              reprovision: () => reprovisionMutation.mutate(card.id),
              confirm: () => confirmMutation.mutate({ cardId: card.id, publicUrl: encodingUrls[card.id] ?? "" }),
              issue: () => issueMutation.mutate(card.id),
              lost: () => lostMutation.mutate(card.id),
              void: () => voidMutation.mutate(card.id),
              replace: () => replaceMutation.mutate(card.id),
            }}
            busy={{
              provision: provisionMutation.isPending,
              reprovision: reprovisionMutation.isPending,
              confirm: confirmMutation.isPending,
              issue: issueMutation.isPending,
              lost: lostMutation.isPending,
              void: voidMutation.isPending,
              replace: replaceMutation.isPending,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AdminCardPanel({
  card,
  encodingUrl,
  onEncodingUrlChange,
  onRefresh,
  actions,
  busy,
}: {
  card: AdminCard;
  encodingUrl: string;
  onEncodingUrlChange: (value: string) => void;
  onRefresh: () => void;
  actions: {
    provision: () => void;
    reprovision: () => void;
    confirm: () => void;
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
          <h3 className="text-lg font-semibold text-foreground">Thẻ {card.serial}</h3>
          <p className="text-sm text-muted-foreground">{cardStatusLabel(card)}</p>
        </div>
        <StatusBadge variant={cardStatusVariant(card)}>{card.encoding_state}</StatusBadge>
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Đang hiện diện: {card.is_current ? "Có" : "Không"}</p>
        <p>Phân công: {card.owner?.email ?? "chưa có"}</p>
        <p>Cấp phát lúc: {card.issued_at ? new Date(card.issued_at).toLocaleString("vi-VN") : "chưa"}</p>
        <p>Xác minh mã: {card.encoding_verified_at ? new Date(card.encoding_verified_at).toLocaleString("vi-VN") : "chưa"}</p>
        <p>Liên kết: {card.link?.status ?? "chưa có"}</p>
        <p>Phân công liên kết: {card.assignment?.status ?? "chưa có"}</p>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" busy={busy.provision} onClick={actions.provision}>
            Cấp liên kết
          </Button>
          <Button type="button" variant="ghost" onClick={() => assignLocation(`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}`)}>
            Chi tiết
          </Button>
          <Button type="button" variant="secondary" busy={busy.reprovision} onClick={actions.reprovision}>
            Cấp lại liên kết
          </Button>
          <Button type="button" variant="secondary" busy={busy.issue} onClick={actions.issue}>
            Phát hành
          </Button>
          <Button type="button" variant="ghost" busy={busy.lost} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn báo mất thẻ này không?")) return;
            actions.lost();
          }}>
            Báo mất
          </Button>
          <Button type="button" variant="ghost" busy={busy.void} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn hủy thẻ này không?")) return;
            actions.void();
          }}>
            Hủy
          </Button>
          <Button type="button" variant="danger" busy={busy.replace} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn thay thế thẻ này không?")) return;
            actions.replace();
          }}>
            Thay thế
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={!card.link?.id} onClick={() => { if (card.link?.id) void attachAdminCardLink(card.id, card.link.id).then(onRefresh); }}>
            Gắn liên kết
          </Button>
          <Button type="button" variant="ghost" disabled={!card.link?.id} onClick={() => {
            if (!card.link?.id) return;
            if (!window.confirm("Bạn có chắc muốn gỡ liên kết khỏi thẻ này không?")) return;
            void detachAdminCardLink(card.id).then(onRefresh);
          }}>
            Gỡ liên kết
          </Button>
          <Button type="button" variant="ghost" disabled={!card.link?.id} onClick={() => {
            if (!card.link?.id) return;
            if (!window.confirm("Bạn có chắc muốn thu hồi liên kết của thẻ này không?")) return;
            void revokeAdminCardLink(card.id).then(onRefresh);
          }}>
            Thu hồi
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput label="URL xác minh liên kết" value={encodingUrl} onChange={(event) => onEncodingUrlChange(event.target.value)} placeholder="https://app.example/e/..." />
          <div className="flex items-end">
            <Button type="button" variant="secondary" busy={busy.confirm} onClick={actions.confirm}>
              Xác nhận mã
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function AdminApplicationRoot({ section, cardId }: { section: AdminAppSection; cardId?: string | null }) {
  const copy = sectionCopy[section];

  const currentPath = section === "overview" ? "/admin" : section === "cards" || section === "detail" ? "/admin/cards" : "/admin/links";

  return (
    <PageApplicationRoot
      role="admin"
      brand={appBrand}
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({ ...item, current: item.href === currentPath }))}
      userLabel={<StatusBadge variant="danger">Quản trị viên</StatusBadge>}
    >
      {section === "cards" ? (
        <AdminCardsPanel />
      ) : section === "links" ? (
        <AdminLinkManagerPanel />
      ) : section === "detail" ? (
        cardId ? (
          <AdminCardDetailPanel cardId={cardId} />
        ) : (
          <EmptyState title="Thiếu cardId" description="Mở màn hình chi tiết từ một thẻ cụ thể trong kho thẻ quản trị." />
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Panel className="space-y-4">
            <EmptyState
              title="Chưa có hành động quản trị ở màn hình này"
              description={cardId ? `CardId hiện tại: ${cardId}` : "Khu vực này giữ chỗ cho các workflow quản trị về sau."}
            />
          </Panel>
          <Panel className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Phạm vi điều hướng</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>• Chỉ hiển thị kho thẻ quản trị.</li>
              <li>• Màn hình chi tiết đọc cardId từ query string.</li>
              <li>• Không bundle UI người dùng vào khu vực này.</li>
            </ul>
          </Panel>
        </div>
      )}
    </PageApplicationRoot>
  );
}

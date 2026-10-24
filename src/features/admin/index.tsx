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
  getAdminInventoryStats,
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
import { AdminBatchProvisioningPanel } from "./batch-provisioning";

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

function getCardStatusBadge(card: AdminCard) {
  if (card.status === "active") {
    return { className: "card-status-pill status-active", label: "Hoạt Động" };
  }
  if (card.status === "unassigned" || card.status === "assigned") {
    return { className: "card-status-pill status-available", label: "Sẵn Sàng" };
  }
  if (card.status === "disabled") {
    return { className: "card-status-pill status-suspended", label: "Tạm Đình Chỉ" };
  }
  if (card.status === "lost") {
    return { className: "card-status-pill status-suspended", label: "Báo Mất" };
  }
  return { className: "card-status-pill status-retired", label: "Đã Thu Hồi" };
}

function AdminCardsPanel() {
  const { clearSessionCache } = useSession();
  const [view, setView] = useState<"list" | "batch">("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const statsQuery = useQuery({
    queryKey: cardKeys.adminStats,
    queryFn: ({ signal }) => getAdminInventoryStats(signal),
    staleTime: 10_000,
  });

  const query = useQuery({
    queryKey: cardKeys.adminCardList({ search, status: filterStatus }),
    queryFn: ({ signal }) =>
      getAdminCards({ search, status: filterStatus }, signal),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
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

  const items = query.data?.items ?? [];
  const stats = statsQuery.data ?? {
    total: items.length,
    active: items.filter((c) => c.status === "active").length,
    available: items.filter(
      (c) => c.status === "unassigned" || c.status === "assigned",
    ).length,
    suspended: items.filter(
      (c) => c.status === "disabled" || c.status === "lost",
    ).length,
    lost: items.filter((c) => c.status === "lost").length,
    void: items.filter((c) => c.status === "void").length,
  };

  if (view === "batch") {
    return (
      <AdminBatchProvisioningPanel
        onCancel={() => setView("list")}
        onSuccess={() => setView("list")}
        nextSerialSeed={12001 + (stats.total || 0)}
      />
    );
  }

  return (
    <div
      className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
      data-od-id="board-inventory-overview"
    >
      {/* Board Header Meta */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#eef6fc] border border-[#b9ddf5] text-[#0f3554]">
            UC-CARD-02
          </span>
          <span className="text-xs text-[#64748b] font-medium">
            Giám sát kho thẻ vật lý
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[17px] font-bold text-[#1e242c]">
          02 · Giám Sát Kho Thẻ &amp; KPI Vận Hành
        </h2>
        <p className="text-[13px] text-[#64748b]">
          Theo dõi tổng lượng phôi thẻ NFC trong kho, phân loại trạng thái hoạt động và tra cứu nhanh theo mã serial.
        </p>
      </div>

      <div className="phone-frame">
        {/* App Top Header */}
        <div className="app-top-header">
          <div className="app-brand">
            <div className="brand-mark">+</div>
            <span className="brand-name">Kho Thẻ NFC</span>
          </div>
          <button
            type="button"
            className="link-subtle bg-transparent border-none cursor-pointer"
            onClick={() => setView("batch")}
          >
            + Nhập Lô
          </button>
        </div>

        <div className="screen-content">
          {/* KPI Summary Grid */}
          <div className="kpi-summary-grid">
            <div className="kpi-metric-card full-width">
              <span className="kpi-label">Tổng Số Thẻ Trong Hệ Thống</span>
              <span className="kpi-num">{stats.total.toLocaleString()}</span>
              <span className="kpi-subtext">
                Chip NTAG215 (504 Bytes) · 100% Đồng bộ
              </span>
            </div>
            <div className="kpi-metric-card">
              <span className="kpi-label">Đang Hoạt Động</span>
              <span className="kpi-num">{stats.active.toLocaleString()}</span>
              <span className="kpi-subtext">Đã liên kết chủ thẻ</span>
            </div>
            <div className="kpi-metric-card">
              <span className="kpi-label">Sẵn Sàng Gán</span>
              <span className="kpi-num">{stats.available.toLocaleString()}</span>
              <span className="kpi-subtext">Kho thẻ trắng (Chưa gán)</span>
            </div>
            <div className="kpi-metric-card">
              <span className="kpi-label">Tạm Đình Chỉ</span>
              <span className="kpi-num">{stats.suspended.toLocaleString()}</span>
              <span className="kpi-subtext">Báo mất / Tạm khóa</span>
            </div>
            <div className="kpi-metric-card">
              <span className="kpi-label">Đã Thu Hồi</span>
              <span className="kpi-num">
                {(stats.void + stats.lost).toLocaleString()}
              </span>
              <span className="kpi-subtext">Hỏng chip / Hết hạn</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="search-filter-wrap">
            <div className="field-input-wrap">
              <input
                type="text"
                className="input-text input-mono"
                placeholder="Tìm theo mã EMC-..., UID, user_id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-pills-row" id="inventoryFilterPills">
              <button
                type="button"
                className={`filter-pill ${filterStatus === "all" ? "active" : ""}`}
                onClick={() => setFilterStatus("all")}
              >
                Tất cả ({stats.total})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterStatus === "active" ? "active" : ""}`}
                onClick={() => setFilterStatus("active")}
              >
                Hoạt động ({stats.active})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterStatus === "available" ? "active" : ""}`}
                onClick={() => setFilterStatus("available")}
              >
                Sẵn sàng ({stats.available})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterStatus === "suspended" ? "active" : ""}`}
                onClick={() => setFilterStatus("suspended")}
              >
                Tạm dừng ({stats.suspended})
              </button>
            </div>
          </div>

          {/* Card Inventory List */}
          {items.length === 0 ? (
            <EmptyState
              title="Không tìm thấy thẻ"
              description="Không có thẻ nào phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <div className="card-inventory-list" id="cardListContainer">
              {items.map((card) => {
                const badge = getCardStatusBadge(card);
                return (
                  <div key={card.id} className="card-item-row">
                    <div className="card-item-top">
                      <span className="card-serial">{card.serial}</span>
                      <span className={badge.className}>{badge.label}</span>
                    </div>
                    <div className="card-meta-row">
                      <span>
                        UID:{" "}
                        {card.hardware_uid
                          ? card.hardware_uid.length > 17
                            ? `${card.hardware_uid.slice(0, 14)}...`
                            : card.hardware_uid
                          : "04:A2:8B:E2..."}
                      </span>
                      <span>
                        Chủ thẻ:{" "}
                        <span className="card-user-id">
                          {card.owner?.id ? card.owner.id : "Chưa gán"}
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 mt-0.5">
                      {card.status === "active" ? (
                        <a
                          href={`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}`}
                          className="link-subtle"
                        >
                          Chi tiết thẻ →
                        </a>
                      ) : card.status === "unassigned" ||
                        card.status === "assigned" ? (
                        <a
                          href={`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}&tab=link`}
                          className="link-subtle"
                        >
                          Gán thẻ này →
                        </a>
                      ) : (
                        <a
                          href={`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}&tab=lifecycle`}
                          className="link-subtle"
                        >
                          Đổi trạng thái →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="btn-primary mt-1"
            onClick={() => setView("batch")}
          >
            + Nhập Lô Thẻ Mới Vào Kho
          </button>
        </div>
      </div>
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

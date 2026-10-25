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
import { AdminDesktopShell } from "./desktop/admin-desktop-shell";
import { CardInspectorDrawer } from "./desktop/card-inspector-drawer";

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

function AdminCardsPanel({ searchQuery = "" }: { searchQuery?: string }) {
  const { clearSessionCache } = useSession();
  const [view, setView] = useState<"list" | "batch">("list");
  const [search, setSearch] = useState(searchQuery);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<AdminCard | null>(null);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);

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
    <div className="flex flex-col gap-6" data-od-id="board-inventory-overview">
      {/* Header Row */}
      <div className="admin-page-header-row">
        <div className="admin-page-title-group">
          <h1 className="admin-page-title">Giám Sát & Quản Lý Kho Thẻ NFC</h1>
          <div className="admin-page-desc">
            Theo dõi thời gian thực {stats.total.toLocaleString()} phôi thẻ NTAG215, trạng thái hoạt động và thông số phần cứng bảo mật. Nhấp vào hàng bất kỳ để mở ngăn kéo trượt chi tiết.
          </div>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-btn-primary-action"
            onClick={() => setView("batch")}
          >
            + Nhập Lô Mới
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Row */}
      <div className="admin-metric-grid">
        <div
          className={`admin-metric-card ${filterStatus === "all" ? "active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          <div className="admin-metric-header">
            <span className="admin-metric-title">Tổng Số Thẻ Trong Hệ Thống</span>
            <span
              className="admin-metric-pill"
              style={{ background: "var(--info-bg)", color: "var(--info-text)" }}
            >
              NTAG215
            </span>
          </div>
          <div className="admin-metric-val">{stats.total.toLocaleString()}</div>
          <div className="admin-metric-subtext">Dung lượng tối đa 2,000 thẻ đợt 2026</div>
        </div>

        <div
          className={`admin-metric-card ${filterStatus === "active" ? "active" : ""}`}
          onClick={() => setFilterStatus("active")}
        >
          <div className="admin-metric-header">
            <span className="admin-metric-title">Đang Hoạt Động</span>
            <span
              className="admin-metric-pill"
              style={{ background: "var(--success-bg)", color: "var(--success-text)" }}
            >
              ACTIVE
            </span>
          </div>
          <div className="admin-metric-val" style={{ color: "var(--success)" }}>
            {stats.active.toLocaleString()}
          </div>
          <div className="admin-metric-subtext">Đã liên kết chủ thẻ y tế</div>
        </div>

        <div
          className={`admin-metric-card ${filterStatus === "available" ? "active" : ""}`}
          onClick={() => setFilterStatus("available")}
        >
          <div className="admin-metric-header">
            <span className="admin-metric-title">Sẵn Sàng Gán</span>
            <span
              className="admin-metric-pill"
              style={{ background: "var(--info-bg)", color: "var(--info-text)" }}
            >
              READY
            </span>
          </div>
          <div className="admin-metric-val" style={{ color: "var(--accent)" }}>
            {stats.available.toLocaleString()}
          </div>
          <div className="admin-metric-subtext">Kho thẻ trắng sẵn sàng xuất kho</div>
        </div>

        <div
          className={`admin-metric-card ${filterStatus === "suspended" ? "active" : ""}`}
          onClick={() => setFilterStatus("suspended")}
        >
          <div className="admin-metric-header">
            <span className="admin-metric-title">Tạm Đình Chỉ & Thu Hồi</span>
            <span
              className="admin-metric-pill"
              style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}
            >
              SUSPENDED
            </span>
          </div>
          <div className="admin-metric-val" style={{ color: "var(--warning)" }}>
            {stats.suspended.toLocaleString()}
          </div>
          <div className="admin-metric-subtext">
            {stats.suspended} tạm khóa · {stats.void + stats.lost} đã thu hồi
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filter Tabs */}
      <div className="admin-table-toolbar">
        <div className="admin-filter-tabs">
          <button
            type="button"
            className={`admin-filter-tab ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            Tất Cả Thẻ
            <span className="admin-tab-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${filterStatus === "active" ? "active" : ""}`}
            onClick={() => setFilterStatus("active")}
          >
            Đang Hoạt Động
            <span className="admin-tab-badge">{stats.active}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${filterStatus === "available" ? "active" : ""}`}
            onClick={() => setFilterStatus("available")}
          >
            Sẵn Sàng Gán
            <span className="admin-tab-badge">{stats.available}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${filterStatus === "suspended" ? "active" : ""}`}
            onClick={() => setFilterStatus("suspended")}
          >
            Tạm Đình Chỉ
            <span className="admin-tab-badge">{stats.suspended}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-tab ${filterStatus === "retired" ? "active" : ""}`}
            onClick={() => setFilterStatus("retired")}
          >
            Đã Thu Hồi
            <span className="admin-tab-badge">{stats.void + stats.lost}</span>
          </button>
        </div>

        <div className="admin-toolbar-tools">
          <select
            className="admin-tool-select"
            defaultValue="ntag215"
            aria-label="Chọn loại chip"
          >
            <option value="all">Tất cả loại chip</option>
            <option value="ntag215">NXP NTAG215 (504 Bytes)</option>
            <option value="ntag216">NXP NTAG216 (888 Bytes)</option>
          </select>
          <button
            type="button"
            className="admin-btn-secondary-action"
            onClick={() => {
              void statsQuery.refetch();
              void query.refetch();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Làm mới
          </button>
        </div>
      </div>

      {/* Rich Data Table with Click-to-Inspect */}
      <div className="admin-table-container">
        {items.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <EmptyState
              title="Không tìm thấy thẻ nào"
              description="Không có thẻ nào phù hợp với bộ lọc hiện tại."
            />
          </div>
        ) : (
          <table className="admin-data-table" id="inventory-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input type="checkbox" aria-label="Chọn tất cả thẻ" />
                </th>
                <th>Mã Thẻ NFC</th>
                <th>UID Phần Cứng (Chip)</th>
                <th>Chuẩn Kỹ Thuật</th>
                <th>Trạng Thái</th>
                <th>Chủ Thẻ (Opaque ID)</th>
                <th>Ngày Kích Hoạt</th>
                <th style={{ textAlign: "right" }}>Thao Tác Nhanh</th>
              </tr>
            </thead>
            <tbody>
              {items.map((card) => {
                const isActive = card.status === "active";
                const isAvailable = card.status === "unassigned" || card.status === "assigned";
                const isSuspended = card.status === "disabled";
                const statusClass = isActive
                  ? "success"
                  : isAvailable
                    ? "info"
                    : isSuspended
                      ? "warning"
                      : "danger";
                const statusLabel = isActive
                  ? "Đang Hoạt Động"
                  : isAvailable
                    ? "Sẵn Sàng Gán"
                    : isSuspended
                      ? "Tạm Đình Chỉ"
                      : card.status === "lost"
                        ? "Báo Mất Cắp"
                        : "Đã Thu Hồi";

                return (
                  <tr
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Chọn thẻ ${card.serial}`}
                      />
                    </td>
                    <td>
                      <span className="admin-td-serial">{card.serial}</span>
                    </td>
                    <td>
                      <span className="admin-td-uid">
                        {card.hardware_uid || "04:A2:8B:E2:19:6C:80"}
                      </span>
                    </td>
                    <td>{card.chip_type || "NTAG215"} · 504B</td>
                    <td>
                      <span className={`admin-status-pill ${statusClass}`}>
                        <span className="admin-status-pill-dot" />
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <span className="admin-td-user">
                        {card.owner ? `${card.owner.id} (${card.owner.email})` : "— Chưa liên kết —"}
                      </span>
                    </td>
                    <td>
                      <span className="admin-td-date">
                        {new Date(card.created_at).toLocaleDateString("vi-VN")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="admin-table-actions-cell"
                        style={{ justifyContent: "flex-end" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}`}
                          className="admin-btn-table-action"
                        >
                          Chi tiết thẻ →
                        </a>
                        <button
                          type="button"
                          className="admin-btn-table-action"
                          onClick={() =>
                            assignLocation(
                              `/admin/cards/detail?cardId=${encodeURIComponent(card.id)}&tab=lifecycle`,
                            )
                          }
                        >
                          Đổi trạng thái
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table Pagination */}
        <div className="admin-table-footer">
          <div>
            Hiển thị <strong>1 – {items.length}</strong> trong tổng số{" "}
            <strong>{stats.total.toLocaleString()}</strong> thẻ NFC
          </div>
          <div className="admin-pagination-controls">
            <button type="button" className="admin-btn-page">
              &laquo;
            </button>
            <button type="button" className="admin-btn-page active">
              1
            </button>
            <button type="button" className="admin-btn-page">
              &raquo;
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Inspector Drawer (440px) */}
      <CardInspectorDrawer
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
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
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    if (cardId || section !== "detail") return;
    setLocationCardId(new URLSearchParams(window.location.search).get("cardId"));
  }, [cardId, section]);

  const resolvedCardId = cardId ?? locationCardId;

  return (
    <AdminDesktopShell
      activeSection={section}
      searchValue={globalSearch}
      onSearch={setGlobalSearch}
    >
      {section === "cards" || section === "overview" ? (
        <AdminCardsPanel searchQuery={globalSearch} />
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
        <AdminCardsPanel searchQuery={globalSearch} />
      )}
    </AdminDesktopShell>
  );
}

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageLoadingState,
  RetryState,
  ServiceUnavailableState,
} from "../../components/feedback";
import {
  cardKeys,
  getAdminCard,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";
import { AdminCardLifecyclePanel } from "./card-lifecycle";
import { AdminCardLinkPanel } from "./card-link";

function maskEmail(email?: string | null): string {
  if (!email) return "Chưa có email";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const prefix = local.length > 3 ? local.slice(0, 3) : local.slice(0, 1);
  return `${prefix}***@${domain}`;
}

export function AdminCardDetailPanel({ cardId }: { cardId: string }) {
  const { clearSessionCache } = useSession();
  const [activeTab, setActiveTab] = useState<"detail" | "lifecycle" | "link">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "lifecycle" || p === "link") return p;
    }
    return "detail";
  });

  const query = useQuery({
    queryKey: cardKeys.adminCard(cardId),
    queryFn: ({ signal }) => getAdminCard(cardId, signal),
    enabled: Boolean(cardId),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
  });

  useEffect(() => {
    if (isApiError(query.error) && query.error.status === 401) {
      clearSessionCache();
      assignLocation(`/login?returnTo=/admin/cards/detail?cardId=${encodeURIComponent(cardId)}`);
    }
  }, [cardId, clearSessionCache, query.error]);

  if (query.isPending) {
    return (
      <PageLoadingState
        title="Đang tải chi tiết thẻ"
        description="Kiểm tra trạng thái thẻ quản trị hiện tại."
      />
    );
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401) {
      return (
        <PageLoadingState
          title="Đang chuyển hướng đến đăng nhập"
          description="Phiên đã hết hạn."
        />
      );
    }
    if (
      isApiError(query.error) &&
      (query.error.status === 503 || query.error.retryable)
    ) {
      return (
        <ServiceUnavailableState
          title="Không thể tải chi tiết thẻ"
          description="Máy chủ tạm thời không phản hồi."
        />
      );
    }
    return (
      <RetryState
        title="Không thể tải chi tiết thẻ"
        description="Đã xảy ra lỗi khi đọc chi tiết thẻ."
      />
    );
  }

  const card = query.data;
  if (!card) return null;

  if (activeTab === "lifecycle") {
    return (
      <AdminCardLifecyclePanel
        card={card}
        onBack={() => setActiveTab("detail")}
        onSuccess={() => setActiveTab("detail")}
      />
    );
  }

  if (activeTab === "link") {
    return (
      <AdminCardLinkPanel
        card={card}
        onBack={() => setActiveTab("detail")}
        onSuccess={() => setActiveTab("detail")}
      />
    );
  }

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
    <div className="flex flex-col gap-6" data-od-id="board-card-details-privacy">
      {/* Header Row */}
      <div className="admin-page-header-row">
        <div className="admin-page-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 className="admin-page-title">
              Chi Tiết Phần Cứng & Bảo Mật Zero-Knowledge
            </h1>
            <span
              className="portal-tag font-mono text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface)",
                border: "var(--border-width) solid var(--border)",
                color: "var(--accent)",
              }}
            >
              {card.serial}
            </span>
          </div>
          <div className="admin-page-desc">
            Thông số kỹ thuật chi tiết của phôi chip thẻ NFC vật lý và cơ chế định danh mờ hóa bảo vệ thông tin y tế cá nhân.
          </div>
        </div>
        <div className="admin-page-actions">
          <a
            href="/admin/cards"
            className="admin-btn-secondary-action"
          >
            ← Quay lại Kho Thẻ
          </a>
          <button
            type="button"
            className="admin-btn-primary-action"
            onClick={() => setActiveTab("lifecycle")}
          >
            Quản lý vòng đời thẻ này
          </button>
        </div>
      </div>

      {/* 2-Column Desktop Grid */}
      <div className="admin-two-col-grid">
        {/* Column 1: Hardware Specifications */}
        <div className="admin-col-card">
          <div className="admin-card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            Thông Số Kỹ Thuật Chip Thẻ NFC
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginLeft: "auto" }}>
              EMERCARD TAG
            </span>
          </div>

          <div className="admin-spec-grid">
            <div className="admin-spec-row">
              <span className="admin-spec-k">Mã Định Danh Thẻ</span>
              <span className="admin-spec-v mono" style={{ color: "var(--accent)", fontSize: "15px" }}>
                {card.serial}
              </span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">UID Phần Cứng (Cố định nhà máy)</span>
              <span className="admin-spec-v mono">{card.hardware_uid || "04:A2:8B:E2:19:6C:80"}</span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Chuẩn Giao Tiếp Vô Tuyến</span>
              <span className="admin-spec-v">ISO/IEC 14443 Type A</span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Loại Vi Xử Lý</span>
              <span className="admin-spec-v">
                {card.chip_type ? `NXP ${card.chip_type.toUpperCase()}` : "NXP NTAG215 (NFC Forum Type 2)"}
              </span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Bộ Nhớ Khả Dụng</span>
              <span className="admin-spec-v mono">504 Bytes (126 blocks × 4B)</span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Khóa Ghi Bảo Vệ (Lock Bits)</span>
              <span className="admin-spec-v" style={{ color: "var(--success)", fontWeight: 600 }}>
                Đã Khóa Đọc/Ghi (Read-Only)
              </span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Độ Bền Ghi / Đọc</span>
              <span className="admin-spec-v mono">100,000 chu kỳ</span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Thời Gian Lưu Trữ Dữ Liệu</span>
              <span className="admin-spec-v mono">10 năm (Chuẩn y tế)</span>
            </div>
            <div className="admin-spec-row">
              <span className="admin-spec-k">Ngày Kích Hoạt Phần Cứng</span>
              <span className="admin-spec-v mono">
                {card.issued_at
                  ? new Date(card.issued_at).toLocaleDateString("vi-VN")
                  : "Chưa kích hoạt"}
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Opaque Identity & Zero-Knowledge Guarantee */}
        <div className="admin-col-card">
          <div className="admin-card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Định Danh Mờ Hóa & Quyền Riêng Tư (Zero-Knowledge)
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "var(--radius-pill)",
                background: "var(--info-bg)",
                color: "var(--info-text)",
                marginLeft: "auto",
              }}
            >
              OPAQUE ID
            </span>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "var(--border-width) solid var(--border)",
              borderRadius: "12px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div className="admin-spec-row" style={{ background: "transparent", padding: "0 0 8px 0" }}>
              <span className="admin-spec-k">Mã Chủ Thẻ (Opaque User ID)</span>
              <span className="admin-spec-v mono" style={{ fontSize: "14px" }}>
                {card.owner?.id ? card.owner.id : "— Chưa liên kết —"}
              </span>
            </div>
            <div className="admin-spec-row" style={{ background: "transparent", padding: "0 0 8px 0" }}>
              <span className="admin-spec-k">Email Liên Hệ (Che một phần)</span>
              <span className="admin-spec-v mono">{maskEmail(card.owner?.email)}</span>
            </div>
            <div className="admin-spec-row" style={{ background: "transparent", padding: "0 0 8px 0" }}>
              <span className="admin-spec-k">Trạng Thái Tài Khoản</span>
              <span className={`admin-status-pill ${statusClass}`}>
                <span className="admin-status-pill-dot" />
                {statusLabel}
              </span>
            </div>
            <div className="admin-spec-row" style={{ background: "transparent", padding: "0" }}>
              <span className="admin-spec-k">Ngày Liên Kết Thẻ</span>
              <span className="admin-spec-v mono">
                {card.issued_at ? new Date(card.issued_at).toLocaleDateString("vi-VN") : "Chưa liên kết"}
              </span>
            </div>
          </div>

          {/* Zero-Knowledge Statement Box */}
          <div
            style={{
              background: "var(--info-bg)",
              border: "var(--border-width) solid var(--info-border)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: "2px" }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ fontSize: "13px", color: "var(--info-text)", lineHeight: 1.5 }}>
              <strong>Cam kết Zero-Knowledge: Hệ thống quản trị thẻ vật lý</strong> hoàn toàn không có quyền truy cập hoặc lưu trữ hồ sơ bệnh án cá nhân (PHI) của chủ thẻ. Toàn bộ thông tin y tế, nhóm máu, dị ứng và vị trí SOS đều được mã hóa đầu cuối và không bao giờ xuất hiện trên cổng quản trị này.
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "8px" }}>
            <button
              type="button"
              className="admin-btn-primary-action"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => setActiveTab("lifecycle")}
            >
              Quản Lý Trạng Thái Thẻ Này →
            </button>
            <button
              type="button"
              className="admin-btn-secondary-action"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => setActiveTab("link")}
            >
              Liên Kết / Hủy Liên Kết Chủ Thẻ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

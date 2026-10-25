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

  return (
    <div
      className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
      data-od-id="board-card-details-privacy"
    >
      <div className="phone-frame">
        <div className="p-4 pb-0 flex items-center justify-between">
          <a
            href="/admin/cards"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline no-underline"
          >
            ← Quay lại Kho Thẻ
          </a>
          <span className="portal-tag font-mono text-xs">{card.serial}</span>
        </div>
        <div className="screen-content">
          {/* NFC Hardware Tag Mockup */}
          <div className="nfc-hardware-card">
            <div className="nfc-card-chip-row">
              <div className="nfc-card-brand">
                <div className="nfc-emblem">NFC</div>
                <span className="nfc-card-brand-text">EMERCARD TAG</span>
              </div>
              <span
                className={`card-status-pill ${
                  card.status === "active"
                    ? "status-active"
                    : card.status === "unassigned" || card.status === "assigned"
                      ? "status-available"
                      : "status-suspended"
                }`}
              >
                {card.status === "active"
                  ? "Đang Hoạt Động"
                  : card.status === "unassigned" || card.status === "assigned"
                    ? "Sẵn Sàng"
                    : "Tạm Đình Chỉ"}
              </span>
            </div>

            <div className="nfc-serial-display">
              <span className="nfc-serial-label">Mã Serial Thẻ</span>
              <span className="nfc-serial-val">{card.serial}</span>
            </div>

            <div className="nfc-specs-grid">
              <div className="nfc-spec-box">
                <span className="nfc-spec-key">UID Phần Cứng</span>
                <span className="nfc-spec-val">
                  {card.hardware_uid || "04:A2:8B:E2:19:6C:80"}
                </span>
              </div>
              <div className="nfc-spec-box">
                <span className="nfc-spec-key">Chuẩn Chip</span>
                <span className="nfc-spec-val">
                  {card.chip_type ? card.chip_type.toUpperCase() : "NTAG215 (504 Bytes)"}
                </span>
              </div>
              <div className="nfc-spec-box">
                <span className="nfc-spec-key">Lô Sản Xuất</span>
                <span className="nfc-spec-val">
                  {card.batch_id || "BATCH-2026-Q3"}
                </span>
              </div>
              <div className="nfc-spec-box">
                <span className="nfc-spec-key">Ngày Kích Hoạt</span>
                <span className="nfc-spec-val">
                  {card.issued_at
                    ? new Date(card.issued_at).toLocaleDateString("vi-VN")
                    : "Chưa kích hoạt"}
                </span>
              </div>
            </div>
          </div>

          {/* Zero-Knowledge Privacy Visual Guard */}
          <div className="privacy-guard-box">
            <div className="guard-header">
              <span className="guard-title">Định Danh Chủ Thẻ Mờ Hóa</span>
              <span className="guard-badge">OPAQUE ID</span>
            </div>

            <div className="guard-mask-row">
              <span className="guard-mask-label">Mã Định Danh (User ID)</span>
              <span className="guard-mask-val">
                {card.owner?.id ? card.owner.id : "Chưa liên kết"}
              </span>
            </div>

            <div className="guard-mask-row">
              <span className="guard-mask-label">Email Tài Khoản</span>
              <span className="guard-mask-val">
                {maskEmail(card.owner?.email)}
              </span>
            </div>

            <div className="guard-mask-row">
              <span className="guard-mask-label">Trạng Thái Hồ Sơ</span>
              <span className="text-[13px] font-semibold text-[#1e242c]">
                1:1 Invariant Shell
              </span>
            </div>

            <div className="locked-section-card">
              <div className="locked-icon-wrap">🔒</div>
              <p>
                Cam kết Zero-Knowledge: Hệ thống quản trị thẻ vật lý hoàn toàn không có quyền truy cập hoặc lưu trữ hồ sơ bệnh án cá nhân (PHI) của chủ thẻ.
              </p>
            </div>
          </div>

          {/* Direct Switcher Actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setActiveTab("lifecycle")}
            >
              Quản Lý Trạng Thái Thẻ Này →
            </button>
            <button
              type="button"
              className="btn-secondary"
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

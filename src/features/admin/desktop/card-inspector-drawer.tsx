import React, { useEffect } from "react";
import type { AdminCard } from "../../../api/cards";
import { assignLocation } from "../../../lib/navigation";

export interface CardInspectorDrawerProps {
  card: AdminCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CardInspectorDrawer({ card, isOpen, onClose }: CardInspectorDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!card) return null;

  const isActive = card.status === "active";
  const isAvailable = card.status === "unassigned" || card.status === "assigned";
  const isSuspended = card.status === "disabled";
  const isDanger = ["lost", "replaced", "void"].includes(card.status);

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

  const chipUid = card.hardware_uid || "04:A2:8B:E2:19:6C:80";
  const chipSpec = card.chip_type ? `NXP ${card.chip_type}` : "NXP NTAG215 (504 Bytes)";
  const userDisplay = card.owner
    ? `${card.owner.id} (${card.owner.email})`
    : "— Chưa liên kết —";

  return (
    <>
      <div
        className={`admin-drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`admin-drawer-panel ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết thẻ ${card.serial}`}
      >
        <div className="admin-drawer-header">
          <div className="admin-drawer-title-wrap">
            <div className="admin-drawer-title">{card.serial}</div>
            <div className="admin-drawer-subtitle">
              Ngăn Kéo Kiểm Tra Chi Tiết Phần Cứng & Quyền Riêng Tư
            </div>
          </div>
          <button
            type="button"
            className="admin-btn-close-drawer"
            onClick={onClose}
            aria-label="Đóng ngăn kéo"
          >
            ✕
          </button>
        </div>

        <div className="admin-drawer-body">
          <div>
            <div className="admin-drawer-section-title">Trạng Thái Thẻ</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface)",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "var(--border-width) solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 600 }}>Tình trạng tra cứu:</span>
              <span className={`admin-status-pill ${statusClass}`}>
                <span className="admin-status-pill-dot" />
                {statusLabel}
              </span>
            </div>
          </div>

          <div>
            <div className="admin-drawer-section-title">Thông Số Kỹ Thuật Chip NFC</div>
            <div className="admin-spec-grid">
              <div className="admin-spec-row">
                <span className="admin-spec-k">UID Chip Vật Lý</span>
                <span className="admin-spec-v mono">{chipUid}</span>
              </div>
              <div className="admin-spec-row">
                <span className="admin-spec-k">Chuẩn Phần Cứng</span>
                <span className="admin-spec-v">{chipSpec}</span>
              </div>
              <div className="admin-spec-row">
                <span className="admin-spec-k">Chuẩn Vô Tuyến</span>
                <span className="admin-spec-v">ISO/IEC 14443-A</span>
              </div>
              <div className="admin-spec-row">
                <span className="admin-spec-k">Ngày Kích Hoạt</span>
                <span className="admin-spec-v mono">
                  {new Date(card.created_at).toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="admin-drawer-section-title">Liên Kết Tài Khoản (Opaque ID)</div>
            <div className="admin-spec-grid">
              <div className="admin-spec-row">
                <span className="admin-spec-k">Mã Chủ Thẻ</span>
                <span className="admin-spec-v mono">{userDisplay}</span>
              </div>
              <div className="admin-spec-row">
                <span className="admin-spec-k">Chế độ bảo mật</span>
                <span className="admin-spec-v" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Zero-Knowledge PHI
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--info-bg)",
              border: "var(--border-width) solid var(--info-border)",
              borderRadius: "12px",
              padding: "14px",
              fontSize: "12px",
              color: "var(--info-text)",
              lineHeight: 1.45,
            }}
          >
            Cổng quản trị không có quyền giải mã hoặc trích xuất dữ liệu bệnh án của chủ thẻ này.
          </div>
        </div>

        <div className="admin-drawer-footer">
          <button
            type="button"
            className="admin-btn-primary-action"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              onClose();
              assignLocation(`/admin/cards/detail?cardId=${encodeURIComponent(card.id)}&tab=lifecycle`);
            }}
          >
            Chuyển Trạng Thái Thẻ Này
          </button>
          <button
            type="button"
            className="admin-btn-secondary-action"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              onClose();
              assignLocation(`/admin/links?search=${encodeURIComponent(card.serial)}`);
            }}
          >
            Quản Lý Liên Kết Chủ Thẻ
          </button>
        </div>
      </aside>
    </>
  );
}

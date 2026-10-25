import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cardKeys, updateAdminCardStatus, type AdminCard } from "../../api/cards";
import { isApiError } from "../../api/http-client";

interface AdminCardLifecyclePanelProps {
  card: AdminCard;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function AdminCardLifecyclePanel({
  card,
  onBack,
  onSuccess,
}: AdminCardLifecyclePanelProps) {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<"active" | "suspended" | "lost">(
    card.status === "disabled" ? "suspended" : card.status === "lost" ? "lost" : "active",
  );
  const [reason, setReason] = useState("Yêu cầu thay đổi trạng thái từ chủ thẻ qua kênh hỗ trợ");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmRetire, setShowConfirmRetire] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (targetStatus: string) =>
      updateAdminCardStatus(card.id, {
        target_status: targetStatus,
        reason: reason.trim() || "Cập nhật qua bảng điều khiển quản trị",
      }),
    onSuccess: (updatedCard) => {
      setErrorMessage(null);
      setToastMessage(`Trạng thái thẻ ${updatedCard.serial} đã được cập nhật thành công!`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(card.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminStats });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMessage(err.message || "Không thể cập nhật trạng thái thẻ.");
      } else {
        setErrorMessage("Lỗi kết nối máy chủ.");
      }
    },
  });

  const handleSaveStatus = () => {
    statusMutation.mutate(selectedStatus);
  };

  const handleRetireCard = () => {
    statusMutation.mutate("void");
    setShowConfirmRetire(false);
  };

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
    <div className="flex flex-col gap-6" data-od-id="board-card-lifecycle">
      {/* Header Row */}
      <div className="admin-page-header-row">
        <div className="admin-page-title-group">
          <h1 className="admin-page-title">Quản Lý Vòng Đời & Trạng Thái Thẻ NFC</h1>
          <div className="admin-page-desc">
            Chuyển đổi trạng thái hoạt động tức thì bằng một cú click chuột, bảo đảm kiểm toán chặt chẽ và cơ chế thu hồi thẻ lỗi vật lý an toàn.
          </div>
        </div>
        {onBack && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="admin-btn-secondary-action"
              onClick={onBack}
            >
              ← Quay lại Chi Tiết Thẻ
            </button>
          </div>
        )}
      </div>

      {/* Target Card Header Bar */}
      <div
        style={{
          background: "var(--bg)",
          border: "var(--border-width) solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          boxShadow: "var(--shadow-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "var(--info-bg)",
              border: "var(--border-width) solid var(--info-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
          >
            NFC
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Thẻ Đang Xử Lý
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: "var(--accent)" }}>
              {card.serial}
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              UID: {card.hardware_uid || "04:A2:8B:E2:19:6C:80"} · Gán cho: {card.owner ? card.owner.id : "— Chưa liên kết —"}
            </div>
          </div>
        </div>
        <div>
          <span className={`admin-status-pill ${statusClass}`}>
            <span className="admin-status-pill-dot" />
            Trạng Thái Hiện Tại: {statusLabel}
          </span>
        </div>
      </div>

      {/* Horizontal 3-Column Radio State Card */}
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Chọn Trạng Thái Hoạt Động Mới
        </div>
        <div className="admin-card-desc">
          Nhấp chọn trạng thái mới mong muốn áp dụng cho thẻ phần cứng này. Hệ thống sẽ cập nhật máy chủ xác thực tức thời.
        </div>

        <div className="admin-status-radio-grid">
          {/* Option 1: Active */}
          <div
            className={`admin-status-radio-card ${selectedStatus === "active" ? "active status-active" : ""}`}
            onClick={() => setSelectedStatus("active")}
            role="button"
            tabIndex={0}
          >
            <div className="admin-radio-header">
              <span className="admin-radio-title" style={{ color: "var(--success)" }}>
                Đang Hoạt Động (Active)
              </span>
              <span className="admin-radio-dot" style={{ color: "var(--success)", borderColor: "var(--success)" }} />
            </div>
            <div className="admin-radio-desc">
              Cho phép quét chip NFC tra cứu hồ sơ khẩn cấp bình thường ngoài hiện trường.
            </div>
          </div>

          {/* Option 2: Suspended */}
          <div
            className={`admin-status-radio-card ${selectedStatus === "suspended" ? "active status-suspended" : ""}`}
            onClick={() => setSelectedStatus("suspended")}
            role="button"
            tabIndex={0}
          >
            <div className="admin-radio-header">
              <span className="admin-radio-title" style={{ color: "var(--warning)" }}>
                Tạm Đình Chỉ (Suspended)
              </span>
              <span className="admin-radio-dot" style={{ color: "var(--warning)", borderColor: "var(--warning)" }} />
            </div>
            <div className="admin-radio-desc">
              Tạm khóa tra cứu khi chủ thẻ báo quên thẻ hoặc có yêu cầu tạm dừng từ nhân viên y tế.
            </div>
          </div>

          {/* Option 3: Lost / Stolen */}
          <div
            className={`admin-status-radio-card ${selectedStatus === "lost" ? "active status-lost" : ""}`}
            onClick={() => setSelectedStatus("lost")}
            role="button"
            tabIndex={0}
          >
            <div className="admin-radio-header">
              <span className="admin-radio-title" style={{ color: "var(--danger)" }}>
                Báo Mất Cắp (Lost/Stolen)
              </span>
              <span className="admin-radio-dot" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} />
            </div>
            <div className="admin-radio-desc">
              Khóa tức thì mọi lượt quét ngoài hiện trường và hiển thị cảnh báo thẻ thất lạc.
            </div>
          </div>
        </div>

        {/* Reason Input */}
        <div className="admin-form-group" style={{ marginTop: "8px" }}>
          <label className="admin-form-label" htmlFor="statusChangeReason">
            Lý Do Thay Đổi Trạng Thái (Ghi chú kiểm toán bắt buộc)
          </label>
          <input
            id="statusChangeReason"
            type="text"
            className="admin-form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        {errorMessage && (
          <div
            style={{
              padding: "12px 14px",
              background: "var(--danger-bg)",
              border: "var(--border-width) solid var(--danger-border)",
              color: "var(--danger-text)",
              borderRadius: "var(--radius-control)",
              fontSize: "13px",
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          {onBack && (
            <button
              type="button"
              className="admin-btn-secondary-action"
              onClick={onBack}
            >
              Hủy Bỏ
            </button>
          )}
          <button
            type="button"
            className="admin-btn-primary-action"
            disabled={statusMutation.isPending}
            onClick={handleSaveStatus}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {statusMutation.isPending ? "Đang cập nhật..." : "Lưu Thay Đổi Trạng Thái"}
          </button>
        </div>
      </div>

      {/* Danger Zone: Permanent Retirement */}
      <div className="admin-danger-zone-card">
        <div className="admin-danger-zone-info">
          <div className="admin-danger-zone-title">Khu Vực Nguy Hiểm: Thu Hồi Thẻ</div>
          <div className="admin-danger-zone-desc">
            Thao tác này sẽ vô hiệu hóa hoàn toàn mã serial <strong>{card.serial}</strong> khỏi hệ thống kho. Phôi thẻ này sẽ bị hủy vĩnh viễn và không thể kích hoạt lại. Chỉ áp dụng cho thẻ bị nứt vỡ chip hoặc lỗi điện từ vật lý.
          </div>
        </div>
        <button
          type="button"
          className="admin-btn-secondary-action"
          style={{
            background: "var(--danger)",
            color: "#ffffff",
            borderColor: "var(--danger)",
            whiteSpace: "nowrap",
            fontWeight: 700,
          }}
          disabled={statusMutation.isPending || card.status === "void"}
          onClick={() => setShowConfirmRetire(true)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {card.status === "void" ? "Thẻ Đã Được Thu Hồi" : "Thu Hồi & Hủy Vĩnh Viễn Thẻ Này"}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmRetire && (
        <div
          style={{
            padding: "20px",
            background: "var(--bg)",
            border: "var(--border-width) solid var(--danger-border)",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 8px 32px rgba(30, 36, 44, 0.16)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--danger-text)", fontSize: "14px" }}>
            Xác nhận thu hồi vĩnh viễn thẻ {card.serial}?
          </span>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            Phôi chip vật lý sẽ bị khóa vĩnh viễn và không thể tái sử dụng. Hành động này không thể hoàn tác.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-btn-secondary-action"
              onClick={() => setShowConfirmRetire(false)}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="admin-btn-primary-action"
              style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
              onClick={handleRetireCard}
            >
              Xác nhận hủy vĩnh viễn
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "var(--fg)",
            color: "var(--bg)",
            padding: "12px 20px",
            borderRadius: "var(--radius-control)",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(30, 36, 44, 0.16)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 1000,
          }}
          role="status"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

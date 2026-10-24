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
  const [selectedStatus, setSelectedStatus] = useState<"active" | "suspended" | "lost">("active");
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

  const getStatusBadge = () => {
    switch (card.status) {
      case "active":
        return <span className="card-status-pill status-active">Đang Hoạt Động</span>;
      case "disabled":
        return <span className="card-status-pill status-suspended">Tạm Đình Chỉ</span>;
      case "lost":
        return <span className="card-status-pill status-suspended">Báo Mất Cắp</span>;
      case "void":
      case "replaced":
        return <span className="card-status-pill status-retired">Đã Thu Hồi</span>;
      default:
        return <span className="card-status-pill status-available">Sẵn Sàng</span>;
    }
  };

  return (
    <div
      className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
      data-od-id="board-card-lifecycle"
    >
      {/* Board Header Meta */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#eef6fc] border border-[#b9ddf5] text-[#0f3554]">
            UC-CARD-04 / 05
          </span>
          <span className="text-xs text-[#64748b] font-medium">
            Quản lý vòng đời thẻ
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[17px] font-bold text-[#1e242c]">
          05 · Vòng Đời Thẻ &amp; Thay Đổi Trạng Thái
        </h2>
        <p className="text-[13px] text-[#64748b]">
          Chuyển đổi trạng thái hoạt động, tạm đình chỉ, báo mất cắp khẩn cấp hoặc thu hồi vĩnh viễn phôi thẻ bị lỗi phần cứng.
        </p>
      </div>

      <div className="phone-frame">
        {/* App Top Header */}
        <div className="app-top-header">
          <div className="app-brand">
            <div className="brand-mark">+</div>
            <span className="brand-name">Vòng Đời Thẻ</span>
          </div>
          {onBack && (
            <button
              type="button"
              className="link-subtle bg-transparent border-none cursor-pointer"
              onClick={onBack}
            >
              Quay lại
            </button>
          )}
        </div>

        <div className="screen-content">
          {/* Target Card Banner */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#64748b] uppercase font-semibold">
                Thẻ Đang Xử Lý
              </span>
              <div className="font-mono text-[16px] font-bold text-[var(--accent)]">
                {card.serial}
              </div>
            </div>
            {getStatusBadge()}
          </div>

          {/* State Selection Options */}
          <div className="field-group">
            <label className="field-label">Chọn Trạng Thái Hoạt Động Mới</label>
            <div className="state-options-list" id="stateRadioList">
              {/* Option 1: Active */}
              <div
                className={`state-radio-card ${selectedStatus === "active" ? "active" : ""}`}
                onClick={() => setSelectedStatus("active")}
                role="button"
                tabIndex={0}
              >
                <div className="state-radio-indicator" />
                <div className="state-radio-info">
                  <span className="state-radio-title">Đang Hoạt Động (Active)</span>
                  <span className="state-radio-desc">
                    Cho phép quét chip NFC tra cứu thông tin y tế khẩn cấp bình thường.
                  </span>
                </div>
              </div>

              {/* Option 2: Suspended */}
              <div
                className={`state-radio-card ${selectedStatus === "suspended" ? "active" : ""}`}
                onClick={() => setSelectedStatus("suspended")}
                role="button"
                tabIndex={0}
              >
                <div className="state-radio-indicator" />
                <div className="state-radio-info">
                  <span className="state-radio-title">Tạm Đình Chỉ (Suspended)</span>
                  <span className="state-radio-desc">
                    Tạm khóa tra cứu; dùng khi người dùng tạm thời thất lạc thẻ hoặc chưa xác minh.
                  </span>
                </div>
              </div>

              {/* Option 3: Lost / Stolen */}
              <div
                className={`state-radio-card ${selectedStatus === "lost" ? "active" : ""}`}
                onClick={() => setSelectedStatus("lost")}
                role="button"
                tabIndex={0}
              >
                <div className="state-radio-indicator" />
                <div className="state-radio-info">
                  <span className="state-radio-title">Báo Mất Cắp / Thất Lạc (Lost/Stolen)</span>
                  <span className="state-radio-desc">
                    Chặn ngay lập tức mọi lượt tra cứu và thông báo thẻ bị mất nếu có ai quét.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="field-group">
            <label className="field-label" htmlFor="statusChangeReason">
              Lý Do Thay Đổi (Lưu vết kiểm toán)
            </label>
            <input
              id="statusChangeReason"
              type="text"
              className="input-text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-[#fdf2f2] border border-[#f8c8c8] text-[#991b1b] rounded-[14px] text-xs">
              {errorMessage}
            </div>
          )}

          {/* Save Status CTA */}
          <button
            type="button"
            className="btn-primary"
            disabled={statusMutation.isPending}
            onClick={handleSaveStatus}
          >
            {statusMutation.isPending ? "Đang cập nhật..." : "Lưu Thay Đổi Trạng Thái"}
          </button>

          {/* Danger Zone: Permanent Retirement */}
          <div className="danger-zone-box">
            <div className="danger-header">
              <span className="danger-title">Khu Vực Nguy Hiểm: Thu Hồi Thẻ (UC-CARD-05)</span>
              <span className="danger-pill">RETIRE</span>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Hủy vĩnh viễn phôi thẻ NFC vật lý này khỏi hệ thống do hỏng chip hoặc lỗi vật lý. Hành động này không thể hoàn tác.
            </p>
            <button
              type="button"
              className="btn-ghost-danger"
              disabled={statusMutation.isPending || card.status === "void"}
              onClick={() => setShowConfirmRetire(true)}
            >
              {card.status === "void" ? "Thẻ Đã Được Thu Hồi" : "Thu Hồi & Hủy Vĩnh Viễn Thẻ Này"}
            </button>
          </div>

          {/* Confirmation Dialog */}
          {showConfirmRetire && (
            <div className="p-4 bg-white border border-[#f8c8c8] rounded-[18px] shadow-lg flex flex-col gap-3">
              <span className="font-bold text-[#991b1b] text-sm">
                Xác nhận thu hồi vĩnh viễn thẻ {card.serial}?
              </span>
              <p className="text-xs text-[#64748b]">
                Phôi chip vật lý sẽ bị khóa vĩnh viễn và không thể tái sử dụng.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowConfirmRetire(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn-ghost-danger flex-1"
                  onClick={handleRetireCard}
                >
                  Xác nhận hủy
                </button>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {toastMessage && (
            <div className="toast-banner show" id="statusToast">
              <span>✓</span> {toastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

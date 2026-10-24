import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchProvisionCards, cardKeys } from "../../api/cards";
import { isApiError } from "../../api/http-client";

interface AdminBatchProvisioningPanelProps {
  onCancel?: () => void;
  onSuccess?: () => void;
  nextSerialSeed?: number;
}

export function AdminBatchProvisioningPanel({
  onCancel,
  onSuccess,
  nextSerialSeed = 12001,
}: AdminBatchProvisioningPanelProps) {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState("BATCH-2026-Q4-VN");
  const [chipType, setChipType] = useState("ntag215");
  const [quantity, setQuantity] = useState(100);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startSerial = nextSerialSeed;
  const endSerial = startSerial + Math.max(1, quantity) - 1;

  const mutation = useMutation({
    mutationFn: () =>
      batchProvisionCards({
        batch_id: batchId.trim(),
        chip_type: chipType,
        quantity: Number(quantity),
      }),
    onSuccess: (data) => {
      setErrorMessage(null);
      setToastMessage(
        `Đã nhập thành công ${data.quantity} thẻ từ lô ${data.batch_id}!`,
      );
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminStats });
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1200);
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMessage(err.message || "Lỗi khi nhập lô thẻ vào hệ thống.");
      } else {
        setErrorMessage("Không thể kết nối đến máy chủ.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId.trim()) {
      setErrorMessage("Vui lòng nhập mã lô sản xuất.");
      return;
    }
    if (quantity < 1 || quantity > 500) {
      setErrorMessage("Số lượng thẻ mỗi lô phải từ 1 đến 500 thẻ.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
      data-od-id="board-batch-provisioning"
    >
      <div className="phone-frame">
        <div className="p-4 pb-0 flex items-center justify-between">
          <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-sm text-[#1e242c]">
            Đăng Ký &amp; Nhập Lô Mới
          </span>
          {onCancel && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={onCancel}
            >
              ← Quay lại Kho Thẻ
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="screen-content">
          {/* Batch ID Input */}
          <div className="field-group">
            <label className="field-label" htmlFor="batchIdInput">
              Mã Lô Sản Xuất (Batch ID)
            </label>
            <input
              id="batchIdInput"
              type="text"
              className="input-text input-mono"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
          </div>

          {/* Chip Type Selection */}
          <div className="field-group">
            <label className="field-label" htmlFor="chipTypeSelect">
              Chuẩn Chip NFC Y Tế
            </label>
            <div className="select-wrap">
              <select
                id="chipTypeSelect"
                className="input-select"
                value={chipType}
                onChange={(e) => setChipType(e.target.value)}
              >
                <option value="ntag215">
                  NTAG215 (504 Bytes - Chuẩn khẩn cấp)
                </option>
                <option value="ntag213">NTAG213 (144 Bytes - Rút gọn)</option>
                <option value="ntag216">NTAG216 (888 Bytes - Mở rộng)</option>
              </select>
              <span className="select-chevron">▼</span>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="field-group">
            <div className="field-label-row">
              <label className="field-label" htmlFor="cardQuantityInput">
                Số Lượng Thẻ Cấp Phát
              </label>
              <span className="text-[11px] text-[#64748b]">
                Tối đa 500 thẻ/lô
              </span>
            </div>
            <input
              id="cardQuantityInput"
              type="number"
              className="input-text input-mono"
              value={quantity}
              min={1}
              max={500}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          {/* Dynamic Serial Range Preview */}
          <div className="field-group">
            <label className="field-label">Dải Mã Thẻ Tự Sinh (Serial Range)</label>
            <div className="nfc-serial-display">
              <span className="nfc-serial-label">Dải Số Serial</span>
              <span className="nfc-serial-val" id="serialRangeDisplay">
                EMC-{startSerial} → EMC-{endSerial}
              </span>
            </div>
            <div className="text-[12px] text-[#64748b] flex items-center gap-1 mt-0.5">
              <span className="text-[#237f52] font-bold">✓</span> Không xung đột
              với các mã thẻ đang tồn tại trong kho
            </div>
          </div>

          {/* Initial Status */}
          <div className="field-group">
            <label className="field-label">
              Trạng Thái Ban Đầu Khi Nhập Kho
            </label>
            <input
              type="text"
              className="input-text"
              value="Sẵn Sàng Cấp Phát (Available)"
              readOnly
              style={{ background: "var(--surface)" }}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-[#fdf2f2] border border-[#f8c8c8] text-[#991b1b] rounded-[14px] text-xs">
              {errorMessage}
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            className="btn-primary mt-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Đang ghi lô thẻ vào kho..."
              : `Xác Nhận Nhập ${quantity} Thẻ Vào Kho`}
          </button>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="toast-banner show">
              <span>✓</span> {toastMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

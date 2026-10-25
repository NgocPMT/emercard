import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attachAdminCardLink,
  cardKeys,
  listAdminCustodyEvents,
  listAdminUserLinks,
  listAdminUsers,
  lookupAdminUserByEmail,
  quickLinkAdminCard,
  quickUnlinkAdminCard,
  type AdminCard,
  type SafeUser,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";

interface AdminCardLinkPanelProps {
  card: AdminCard;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function AdminCardLinkPanel({
  card,
  onBack,
  onSuccess,
}: AdminCardLinkPanelProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedUser, setMatchedUser] = useState<SafeUser | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmUnlink, setShowConfirmUnlink] = useState(false);

  const isUnassigned = card.status === "unassigned" && !card.issued_at;
  const hasExistingBinding = Boolean(
    card.owner?.id || card.link || card.status === "assigned" || card.issued_at,
  );

  // Custody audit log query
  const auditLogQuery = useQuery({
    queryKey: cardKeys.adminCustodyEvents(20),
    queryFn: ({ signal }) => listAdminCustodyEvents(20, signal),
    staleTime: 10_000,
  });

  // Search user mutation
  const searchMutation = useMutation({
    mutationFn: async (queryText: string) => {
      const q = queryText.trim();
      if (!q) throw new Error("Vui lòng nhập email hoặc user_id");
      if (q.includes("@")) {
        return await lookupAdminUserByEmail(q);
      }
      const list = await listAdminUsers(q);
      const found = list.items.find((u) => u.id === q || u.email.toLowerCase() === q.toLowerCase());
      if (!found) throw new Error("Không tìm thấy người dùng phù hợp");
      return found;
    },
    onSuccess: (user) => {
      setSearchError(null);
      setMatchedUser(user);
    },
    onError: (err) => {
      setMatchedUser(null);
      if (err instanceof Error) {
        setSearchError(err.message);
      } else {
        setSearchError("Không tìm thấy người dùng.");
      }
    },
  });

  // Link card mutation
  const linkMutation = useMutation({
    mutationFn: () => {
      if (!matchedUser) throw new Error("Chưa chọn người dùng để gán thẻ");
      return quickLinkAdminCard(card.id, {
        user_id: matchedUser.id,
        reason: "Cấp phát thẻ trực tiếp từ cổng quản trị",
      });
    },
    onSuccess: (updatedCard) => {
      setActionError(null);
      setToastMessage(`Thao tác liên kết thẻ ${updatedCard.serial} thành công!`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(card.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);
    },
    onError: (err) => {
      if (isApiError(err)) {
        setActionError(err.message || "Lỗi khi liên kết thẻ.");
      } else {
        setActionError("Lỗi kết nối máy chủ.");
      }
    },
  });

  // Query pending links of the matched user if card is unassigned
  const userLinksQuery = useQuery({
    queryKey: matchedUser ? cardKeys.adminUserLinks(matchedUser.id) : ["links", "admin", "empty"],
    queryFn: ({ signal }) => listAdminUserLinks(matchedUser?.id ?? "", signal),
    enabled: Boolean(matchedUser && isUnassigned),
    staleTime: 10_000,
  });
  const pendingLinks = (userLinksQuery.data?.items ?? []).filter((l) => l.status === "pending");

  // Attach card to existing pending link
  const attachMutation = useMutation({
    mutationFn: (publicAccessLinkId: string) =>
      attachAdminCardLink(card.id, publicAccessLinkId),
    onSuccess: (updatedCard) => {
      setActionError(null);
      setToastMessage(`Đã gắn thẻ ${updatedCard.serial} vào liên kết thành công!`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(card.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      if (matchedUser) {
        void queryClient.invalidateQueries({
          queryKey: cardKeys.adminUserLinks(matchedUser.id),
        });
      }
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);
    },
    onError: (err) => {
      if (isApiError(err)) {
        setActionError(err.message || "Lỗi khi gắn liên kết vào thẻ.");
      } else {
        setActionError("Lỗi kết nối máy chủ.");
      }
    },
  });

  // Unlink card mutation
  const unlinkMutation = useMutation({
    mutationFn: () =>
      quickUnlinkAdminCard(card.id, {
        reason: "Hủy liên kết thẻ theo yêu cầu",
      }),
    onSuccess: (updatedCard) => {
      setActionError(null);
      setShowConfirmUnlink(false);
      setToastMessage(`Đã hủy liên kết thẻ ${updatedCard.serial} khỏi tài khoản thành công!`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(card.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);
    },
    onError: (err) => {
      setShowConfirmUnlink(false);
      if (isApiError(err)) {
        setActionError(err.message || "Lỗi khi hủy liên kết thẻ.");
      } else {
        setActionError("Lỗi kết nối máy chủ.");
      }
    },
  });

  return (
    <div
      className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
      data-od-id="board-link-unlink"
    >

      <div className="phone-frame">
        {onBack && (
          <div className="p-4 pb-0 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={onBack}
            >
              ← Quay lại Chi Tiết Thẻ
            </button>
            <span className="portal-tag font-mono text-xs">{card.serial}</span>
          </div>
        )}

        <div className="screen-content">
          {actionError && (
            <div className="p-3 bg-[#fdf2f2] border border-[#f8c8c8] text-[#991b1b] rounded-[14px] text-xs">
              {actionError}
            </div>
          )}

          {/* Flow 1: Link Available Blank Card to User */}
          <div className="link-workspace-card">
            <div className="link-workspace-title">
              1. Gán Thẻ Trắng Cho Tài Khoản
            </div>

            {isUnassigned ? (
              <>
                <div className="bg-white border border-[var(--border)] rounded-[var(--radius-control)] p-2.5 flex justify-between items-center text-xs">
                  <span className="text-[#64748b]">Thẻ Đang Chọn:</span>
                  <span className="font-mono text-sm font-bold text-[var(--accent)]">
                    {card.serial}
                  </span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="userSearchInput">
                    Tìm Kiếm Người Dùng (Email hoặc user_id)
                  </label>
                  <div className="search-user-box">
                    <input
                      id="userSearchInput"
                      type="text"
                      className="input-text"
                      placeholder="nhập email hoặc user_id..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchMutation.mutate(searchQuery);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary !w-auto !px-3.5"
                      disabled={searchMutation.isPending}
                      onClick={() => searchMutation.mutate(searchQuery)}
                    >
                      {searchMutation.isPending ? "..." : "Tìm"}
                    </button>
                  </div>
                  {searchError && (
                    <span className="text-xs text-[#991b1b] mt-0.5">{searchError}</span>
                  )}
                </div>

                {/* Matched User Preview */}
                {matchedUser && (
                  <div className="user-search-match">
                    <div className="user-match-meta">
                      <span className="user-match-name">{matchedUser.email}</span>
                      <span className="user-match-id">
                        user_id: {matchedUser.id} · Hồ sơ 1:1
                      </span>
                    </div>
                    <span className="card-status-pill status-available">Sẵn sàng gán</span>
                  </div>
                )}

                {/* Pending Links of matched user */}
                {matchedUser && pendingLinks.length > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] text-xs">
                    <span className="font-semibold text-[var(--fg)]">
                      Liên kết chờ sẵn có ({pendingLinks.length}):
                    </span>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                      {pendingLinks.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-[var(--border)]"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{link.label || "Liên kết thẻ"}</span>
                            <span className="font-mono text-[10px] text-[#64748b]">ID: {link.id}</span>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary !w-auto !py-1 !px-2.5 !text-xs"
                            disabled={attachMutation.isPending}
                            onClick={() => attachMutation.mutate(link.id)}
                          >
                            {attachMutation.isPending ? "Đang gắn..." : "Gán vào link này"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-[#64748b] text-center my-0.5">
                      — Hoặc tạo liên kết mới bên dưới —
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  disabled={!matchedUser || linkMutation.isPending || attachMutation.isPending}
                  onClick={() => linkMutation.mutate()}
                >
                  {linkMutation.isPending
                    ? "Đang liên kết..."
                    : "Tạo Mới & Gán Nhanh Vào Tài Khoản"}
                </button>
              </>
            ) : (
              /* Card already bound/delivered info */
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-[12px] bg-[#f8fafc] border border-[var(--border)] text-xs flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Mã Thẻ:</span>
                    <span className="font-mono font-bold text-[var(--accent)]">{card.serial}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Chủ Sở Hữu:</span>
                    <span className="font-semibold text-[var(--fg)]">
                      {card.owner ? `${card.owner.email} (${card.owner.id})` : "— Đã gán hồ sơ —"}
                    </span>
                  </div>
                  {card.link && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Mã Link ID:</span>
                      <span className="font-mono text-[var(--fg)]">{card.link.id}</span>
                    </div>
                  )}
                  {card.link?.label && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Nhãn Link:</span>
                      <span className="font-medium text-[var(--fg)]">{card.link.label}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Trạng Thái Thẻ:</span>
                    <span className="font-semibold text-[var(--accent)]">
                      {card.status === "assigned"
                        ? "Đã Gán Hồ Sơ (Chờ kích hoạt)"
                        : card.status === "active"
                          ? "Đang Hoạt Động"
                          : card.status}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-[12px] text-xs leading-relaxed">
                  ⚠️ Thẻ này đã được bàn giao cho tài khoản. Không thể gán đè trực tiếp cho người khác. Nếu muốn đổi chủ thẻ, vui lòng thực hiện <strong>Hủy liên kết thẻ</strong> ở mục 2 bên dưới.
                </div>
              </div>
            )}
          </div>

          {/* Flow 2: Unlink Card */}
          {hasExistingBinding && (
            <div className="link-workspace-card bg-white">
              <div className="link-workspace-title">
                2. Hủy Liên Kết Thẻ Cũ
              </div>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Dành cho trường hợp chủ thẻ làm mất hoặc gãy thẻ vật lý. Thẻ cũ sẽ được ngắt kết nối và chuyển về kho để tái cấp phát hoặc thu hồi.
              </p>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-control)] p-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[11px] text-[#64748b] block">Thẻ Liên Kết:</span>
                  <span className="font-mono text-[13px] font-bold text-[var(--fg)]">
                    {card.serial}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#64748b] block">Chủ Thẻ / Hồ Sơ:</span>
                  <span className="font-mono text-[13px] font-semibold text-[var(--accent)]">
                    {card.owner?.id || "Đã gán hồ sơ"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-ghost-danger"
                disabled={unlinkMutation.isPending}
                onClick={() => setShowConfirmUnlink(true)}
              >
                Hủy Liên Kết Thẻ Này Khỏi Tài Khoản
              </button>

              {showConfirmUnlink && (
                <div className="p-3 bg-white border border-[#f8c8c8] rounded-[14px] flex flex-col gap-2 mt-2">
                  <span className="font-bold text-xs text-[#991b1b]">
                    Xác nhận hủy liên kết thẻ {card.serial} khỏi tài khoản?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex-1 !text-xs !py-1.5"
                      onClick={() => setShowConfirmUnlink(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-danger flex-1 !text-xs !py-1.5"
                      onClick={() => unlinkMutation.mutate()}
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Operations Audit Log */}
          <div className="flex flex-col gap-2 mt-1">
            <div className="text-[13px] font-semibold text-[var(--fg)]">
              Nhật Ký Cấp Phát Gần Nhất
            </div>
            {auditLogQuery.isPending ? (
              <span className="text-xs text-[#64748b]">Đang tải nhật ký...</span>
            ) : auditLogQuery.data?.items && auditLogQuery.data.items.length > 0 ? (
              auditLogQuery.data.items.slice(0, 5).map((log) => (
                <div key={log.id} className="audit-log-item">
                  <div className="audit-log-top">
                    <span className="audit-log-action">
                      {log.event_type === "quick_linked"
                        ? "Liên kết thẻ thành công"
                        : log.event_type === "quick_unlinked"
                          ? "Hủy liên kết thẻ"
                          : log.event_type === "batch_provisioned"
                            ? "Nhập lô thẻ mới"
                            : `Đổi trạng thái: ${log.event_type}`}
                    </span>
                    <span className="audit-log-time">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="audit-log-detail">
                    {log.card_serial}
                    {log.new_owner_id ? ` → ${log.new_owner_id}` : ""}
                    {log.performed_by_admin_id ? ` (bởi admin)` : ""}
                    {log.reason ? ` · ${log.reason}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <span className="text-xs text-[#64748b] italic">
                Chưa có thao tác kiểm toán nào được ghi lại.
              </span>
            )}
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="toast-banner show" id="linkToast">
              <span>✓</span> {toastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

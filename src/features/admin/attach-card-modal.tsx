import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Dialog, StatusBadge, TextInput } from "../../components/primitives";
import {
  attachAdminCardLink,
  cardKeys,
  getAdminCards,
  type AdminCard,
  type PublicLinkSummary,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { copyText } from "../../lib/clipboard";

export interface AdminAttachCardModalProps {
  link: PublicLinkSummary | null;
  publicUrl?: string | null;
  userId: string;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminAttachCardModal({
  link,
  publicUrl,
  userId,
  userEmail,
  isOpen,
  onClose,
  onSuccess,
}: AdminAttachCardModalProps) {
  const queryClient = useQueryClient();
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attachedSuccessCard, setAttachedSuccessCard] = useState<AdminCard | null>(null);

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    await copyText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (!attachMutation.isPending) {
      setActionError(null);
      setSelectedCardId(null);
      setFilterQuery("");
      setAttachedSuccessCard(null);
      setCopied(false);
      onClose();
    }
  };

  // Query unassigned blank cards from inventory
  const cardsQuery = useQuery({
    queryKey: ["cards", "admin", "unassigned"],
    queryFn: ({ signal }) => getAdminCards({ status: "unassigned", limit: 50 }, signal),
    enabled: isOpen && Boolean(link),
    staleTime: 10_000,
  });

  const availableCards: AdminCard[] = useMemo(() => {
    const items = cardsQuery.data?.items ?? [];
    return items.filter((card: AdminCard) => card.status === "unassigned" && !card.issued_at);
  }, [cardsQuery.data?.items]);

  const filteredCards = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return availableCards;
    return availableCards.filter(
      (c) =>
        c.serial.toLowerCase().includes(q) ||
        (c.hardware_uid && c.hardware_uid.toLowerCase().includes(q)),
    );
  }, [availableCards, filterQuery]);

  const attachMutation = useMutation({
    mutationFn: () => {
      if (!link) throw new Error("Không tìm thấy liên kết cần gắn.");
      if (!selectedCardId) throw new Error("Vui lòng chọn một phôi thẻ vật lý.");
      return attachAdminCardLink(selectedCardId, link.id);
    },
    onSuccess: (updatedCard) => {
      setActionError(null);
      setAttachedSuccessCard(updatedCard);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(updatedCard.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminUserLinks(userId) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === "card.profile_not_ready") {
          setActionError("Hồ sơ y tế của người dùng chưa hoàn tất. Người dùng cần điền đủ 5 trường bắt buộc (Họ tên, Năm sinh, Giới tính, Nhóm máu, Người liên hệ) để kích hoạt thẻ.");
        } else {
          setActionError(err.message || "Lỗi khi gắn liên kết vào thẻ.");
        }
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Lỗi kết nối máy chủ.");
      }
    },
  });

  if (!link) return null;

  if (attachedSuccessCard) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        title="Gắn & Kích Hoạt Thẻ Thành Công"
        description={`Thẻ đã được tự động cấp phát và kích hoạt sang trạng thái Đang hoạt động.`}
        actions={
          <Button type="button" variant="primary" onClick={handleClose}>
            Hoàn tất & Đóng
          </Button>
        }
      >
        <div className="space-y-4">
          <Alert variant="success" title="Thẻ đã sẵn sàng sử dụng!">
            Thẻ <strong>{attachedSuccessCard.serial}</strong> đã được gán vào hồ sơ {userEmail} và kích hoạt thành công. Người dùng không cần bấm kích hoạt thủ công.
          </Alert>

          {publicUrl && (
            <div className="rounded-[var(--radius-control)] border border-primary/20 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  🔗 Link hồ sơ nạp vào thẻ NFC:
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-0.5 !px-2.5 !text-xs !h-auto"
                  onClick={() => void handleCopyLink()}
                >
                  {copied ? "Đã sao chép!" : "Sao chép link"}
                </Button>
              </div>
              <div className="font-mono text-xs break-all bg-white p-2 rounded border border-border select-all text-foreground">
                {publicUrl}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Hãy sao chép link trên để nạp vào chip thẻ NFC qua ứng dụng NFC Tools trên điện thoại hoặc máy nạp thẻ.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title="Gắn Liên Kết Vào Phôi Thẻ Vật Lý"
      description={`Gán liên kết của hồ sơ ${userEmail} vào phôi thẻ NFC trắng trong kho. Thẻ sẽ tự động được kích hoạt ngay lập tức.`}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={attachMutation.isPending}
            onClick={handleClose}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!selectedCardId || attachMutation.isPending}
            busy={attachMutation.isPending}
            onClick={() => attachMutation.mutate()}
          >
            {attachMutation.isPending ? "Đang gắn & kích hoạt..." : "Xác Nhận Gắn Thẻ"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

        {/* Highlighted Public URL with Copy button */}
        {publicUrl && (
          <div className="rounded-[var(--radius-control)] border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                🔗 Link hồ sơ để nạp vào thẻ NFC:
              </span>
              <Button
                type="button"
                variant="secondary"
                className="!py-0.5 !px-2.5 !text-xs !h-auto"
                onClick={() => void handleCopyLink()}
              >
                {copied ? "Đã sao chép!" : "Sao chép link"}
              </Button>
            </div>
            <div className="font-mono text-xs break-all bg-white p-2 rounded border border-border select-all text-foreground">
              {publicUrl}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Copy link này để nạp vào chip NFC vật lý. Sau khi gắn, thẻ sẽ lập tức ở trạng thái hoạt động.
            </p>
          </div>
        )}

        {/* Selected Link Context */}
        <div className="rounded-[var(--radius-control)] border border-border bg-muted/40 p-3 text-xs flex justify-between items-center">
          <div>
            <span className="text-muted-foreground block text-[11px]">Liên kết đang xử lý:</span>
            <span className="font-semibold text-foreground text-sm">
              {link.label || "Liên kết thẻ"}
            </span>
            <span className="font-mono text-muted-foreground block text-[11px]">ID: {link.id}</span>
          </div>
          <StatusBadge variant="warning">Chờ gắn thẻ</StatusBadge>
        </div>

        {/* Filter / Search unassigned cards */}
        <TextInput
          label="Lọc phôi thẻ theo serial hoặc UID"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Nhập mã thẻ EMC-..."
        />

        {/* Card selection list */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            Chọn phôi thẻ NFC trắng sẵn sàng gán:
          </label>

          {cardsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground p-3">Đang tải danh sách thẻ trống trong kho...</p>
          ) : availableCards.length === 0 ? (
            <Alert variant="warning">
              Kho thẻ hiện không có phôi thẻ trắng nào khả dụng (trạng thái Chưa cấp). Vui lòng vào{" "}
              <a href="/admin/cards" className="font-semibold underline">
                Kho Thẻ
              </a>{" "}
              để tạo hoặc nhập lô phôi mới.
            </Alert>
          ) : filteredCards.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              Không tìm thấy phôi thẻ nào khớp với &quot;{filterQuery}&quot;.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-[var(--radius-control)] border border-border p-2">
              {filteredCards.map((card) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-border hover:bg-muted/60"
                    }`}
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-bold text-foreground text-sm">
                        {card.serial}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        UID: {card.hardware_uid || "—"} · Chip: {card.chip_type?.toUpperCase() || "NTAG215"}
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="text-primary font-bold text-xs">✓ Đang chọn</span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Chọn thẻ →</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

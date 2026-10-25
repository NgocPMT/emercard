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

export interface AdminAttachCardModalProps {
  link: PublicLinkSummary | null;
  userId: string;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminAttachCardModal({
  link,
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
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(updatedCard.id) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminUserLinks(userId) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCustodyEvents() });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err) => {
      if (isApiError(err)) {
        setActionError(err.message || "Lỗi khi gắn liên kết vào thẻ.");
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Lỗi kết nối máy chủ.");
      }
    },
  });

  if (!link) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={() => {
        if (!attachMutation.isPending) {
          setActionError(null);
          setSelectedCardId(null);
          setFilterQuery("");
          onClose();
        }
      }}
      title="Gắn Liên Kết Vào Phôi Thẻ Vật Lý"
      description={`Gán liên kết đang chờ của hồ sơ ${userEmail} vào một phôi thẻ NFC trắng trong kho.`}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={attachMutation.isPending}
            onClick={onClose}
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
            {attachMutation.isPending ? "Đang gắn thẻ..." : "Xác Nhận Gắn Thẻ"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

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

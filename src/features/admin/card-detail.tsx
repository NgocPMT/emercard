import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Panel, Select, StatusBadge, TextInput } from "../../components/primitives";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import {
  assignCard,
  activateAdminCardLink,
  attachAdminCardLink,
  cardKeys,
  confirmCardEncoding,
  detachAdminCardLink,
  disableAdminCardLink,
  getAdminCard,
  issueCard,
  lookupAdminUserByEmail,
  provisionCardLink,
  reassignCard,
  reportAdminCardLost,
  replaceCard,
  revokeAdminCardLink,
  reprovisionCardLink,
  type AdminCard,
  type SafeUser,
  voidCard,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { copyText } from "../../lib/clipboard";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";

function historyEntries(card: AdminCard) {
  const unknown = card as AdminCard & {
    assignment_history?: Array<Record<string, unknown>>;
    custody_history?: Array<Record<string, unknown>>;
    history?: Array<Record<string, unknown>>;
  };
  return unknown.assignment_history ?? unknown.custody_history ?? unknown.history ?? [];
}

export function AdminCardDetailPanel({ cardId }: { cardId: string }) {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [encodingUrl, setEncodingUrl] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [assignedUser, setAssignedUser] = useState<SafeUser | null>(null);
  const [linkId, setLinkId] = useState("");
  const [detachReason, setDetachReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const query = useQuery({
    queryKey: cardKeys.adminCard(cardId),
    queryFn: ({ signal }) => getAdminCard(cardId, signal),
    enabled: Boolean(cardId),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const lookupMutation = useMutation({
    mutationFn: (nextEmail: string) => lookupAdminUserByEmail(nextEmail),
    onSuccess: (user) => {
      setAssignedUser(user);
      setMessage(`Đã chọn ${user.email}.`);
    },
  });
  const provisionMutation = useMutation({
    mutationFn: () => provisionCardLink(cardId),
    onSuccess: (result) => {
      setCopiedUrl(result.provisioning.public_url);
      setEncodingUrl(result.provisioning.public_url);
      setMessage("Đã cấp liên kết cho thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const reprovisionMutation = useMutation({
    mutationFn: () => reprovisionCardLink(cardId),
    onSuccess: (result) => {
      setCopiedUrl(result.provisioning.public_url);
      setEncodingUrl(result.provisioning.public_url);
      setMessage("Đã cấp lại liên kết cho thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: (publicUrl: string) => confirmCardEncoding(cardId, publicUrl),
    onSuccess: () => {
      setMessage("Đã xác nhận mã hóa.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (userId: string) => assignCard(cardId, userId),
    onSuccess: () => {
      setMessage("Đã phân công thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const reassignMutation = useMutation({
    mutationFn: (userId: string) => reassignCard(cardId, userId, "internal_correction"),
    onSuccess: () => {
      setMessage("Đã đổi chủ thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const issueMutation = useMutation({
    mutationFn: () => issueCard(cardId),
    onSuccess: () => {
      setMessage("Đã phát hành thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const lostMutation = useMutation({
    mutationFn: () => reportAdminCardLost(cardId),
    onSuccess: () => {
      setMessage("Đã báo mất thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const replaceMutation = useMutation({
    mutationFn: () => replaceCard(cardId),
    onSuccess: (result) => {
      setCopiedUrl(result.provisioning.public_url);
      setMessage("Đã tạo thẻ thay thế.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(result.card.id) });
    },
  });
  const voidMutation = useMutation({
    mutationFn: () => voidCard(cardId),
    onSuccess: () => {
      setMessage("Đã hủy thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const attachMutation = useMutation({
    mutationFn: (publicAccessLinkId: string) => attachAdminCardLink(cardId, publicAccessLinkId),
    onSuccess: () => {
      setMessage("Đã gắn liên kết vào thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const activateLinkMutation = useMutation({
    mutationFn: () => activateAdminCardLink(cardId),
    onSuccess: () => {
      setMessage("Đã kích hoạt liên kết của thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const disableLinkMutation = useMutation({
    mutationFn: () => disableAdminCardLink(cardId),
    onSuccess: () => {
      setMessage("Đã vô hiệu hóa liên kết của thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const detachMutation = useMutation({
    mutationFn: (reason: string | null) => detachAdminCardLink(cardId, reason),
    onSuccess: () => {
      setMessage("Đã gỡ liên kết khỏi thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (reason: string | null) => revokeAdminCardLink(cardId, reason),
    onSuccess: () => {
      setMessage("Đã thu hồi liên kết của thẻ.");
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminCard(cardId) });
    },
  });

  useEffect(() => {
    const error =
      query.error ??
      lookupMutation.error ??
      provisionMutation.error ??
      reprovisionMutation.error ??
      confirmMutation.error ??
      assignMutation.error ??
      reassignMutation.error ??
      issueMutation.error ??
      lostMutation.error ??
      replaceMutation.error ??
      voidMutation.error ??
      attachMutation.error ??
      activateLinkMutation.error ??
      disableLinkMutation.error ??
      detachMutation.error ??
      revokeMutation.error;
    if (!isApiError(error) || error.status !== 401) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/admin/cards");
  }, [
    assignMutation.error,
    attachMutation.error,
    activateLinkMutation.error,
    clearSessionCache,
    confirmMutation.error,
    detachMutation.error,
    disableLinkMutation.error,
    issueMutation.error,
    lostMutation.error,
    lookupMutation.error,
    provisionMutation.error,
    query.error,
    reassignMutation.error,
    replaceMutation.error,
    reprovisionMutation.error,
    revokeMutation.error,
    voidMutation.error,
  ]);

  if (query.isPending) {
    return <PageLoadingState title="Đang tải chi tiết thẻ" description="Kiểm tra trạng thái, liên kết và phân công của thẻ." />;
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(query.error) && (query.error.status === 503 || query.error.retryable)) {
      return <ServiceUnavailableState title="Không thể tải chi tiết thẻ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải chi tiết thẻ" description="Đã xảy ra lỗi khi đọc chi tiết thẻ." />;
  }

  const card = query.data;
  const entries = historyEntries(card);

  const copyCurrentUrl = async () => {
    if (!copiedUrl) return;
    const ok = await copyText(copiedUrl);
    setMessage(ok ? "Đã sao chép URL." : "Không thể sao chép URL.");
  };

  const handleLookup = () => {
    const value = userEmail.trim();
    if (!value) {
      setMessage("Hãy nhập email để tìm hồ sơ.");
      return;
    }
    lookupMutation.mutate(value);
  };

  return (
    <div className="space-y-6">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Thẻ {card.serial}</h2>
            <p className="text-sm text-muted-foreground">Khung chi tiết và thao tác cấp phát an toàn.</p>
          </div>
          <StatusBadge variant={card.status === "active" ? "success" : card.status === "disabled" ? "warning" : card.status === "lost" || card.status === "replaced" || card.status === "void" ? "danger" : "primary"}>
            {card.status}
          </StatusBadge>
        </div>

        {message ? <Alert variant="info">{message}</Alert> : null}

        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Đang hiện diện: {card.is_current ? "Có" : "Không"}</p>
          <p>Chủ sở hữu: {card.owner?.email ?? "chưa có"}</p>
          <p>Cấp phát lúc: {card.issued_at ? new Date(card.issued_at).toLocaleString("vi-VN") : "chưa"}</p>
          <p>Xác minh mã: {card.encoding_verified_at ? new Date(card.encoding_verified_at).toLocaleString("vi-VN") : "chưa"}</p>
          <p>Liên kết: {card.link?.status ?? "chưa có"}</p>
          <p>Phân công: {card.assignment?.status ?? "chưa có"}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput label="URL xác minh" value={encodingUrl} onChange={(event) => setEncodingUrl(event.target.value)} placeholder="https://app.example/e/..." />
          <div className="flex items-end">
            <Button type="button" variant="secondary" busy={confirmMutation.isPending} onClick={() => {
              if (!window.confirm("Bạn có chắc muốn xác nhận mã hóa thẻ này không?")) return;
              confirmMutation.mutate(encodingUrl);
            }}>
              Xác nhận mã
            </Button>
          </div>
        </div>

        {copiedUrl ? (
          <Alert variant="success" title="Liên kết cấp phát">
            <div className="break-all text-sm">{copiedUrl}</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => void copyCurrentUrl()}>
                Sao chép
              </Button>
            </div>
          </Alert>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Tra cứu và phân công hồ sơ</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput label="Email hồ sơ" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} placeholder="ten@domain.com" />
          <div className="flex items-end">
            <Button type="button" busy={lookupMutation.isPending} onClick={handleLookup}>
              Tìm hồ sơ
            </Button>
          </div>
        </div>
        {assignedUser ? (
          <div className="rounded-[var(--radius-panel)] border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Hồ sơ đã chọn</p>
            <p>{assignedUser.email}</p>
            <p>ID: {assignedUser.id}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" busy={assignMutation.isPending} disabled={!assignedUser} onClick={() => {
            if (!assignedUser) return;
            if (!window.confirm("Bạn có chắc muốn phân công thẻ này cho hồ sơ đã chọn không?")) return;
            assignMutation.mutate(assignedUser.id);
          }}>
            Phân công
          </Button>
          <Button type="button" variant="secondary" busy={reassignMutation.isPending} disabled={!assignedUser} onClick={() => {
            if (!assignedUser) return;
            if (!window.confirm("Bạn có chắc muốn đổi chủ thẻ này không?")) return;
            reassignMutation.mutate(assignedUser.id);
          }}>
            Đổi chủ
          </Button>
          <Button type="button" variant="secondary" busy={issueMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn phát hành thẻ này không?")) return;
            issueMutation.mutate();
          }}>
            Phát hành
          </Button>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Liên kết và vòng đời</h3>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" busy={provisionMutation.isPending} onClick={() => provisionMutation.mutate()}>
            Cấp liên kết
          </Button>
          <Button type="button" variant="secondary" busy={reprovisionMutation.isPending} onClick={() => reprovisionMutation.mutate()}>
            Cấp lại liên kết
          </Button>
          <Button type="button" variant="ghost" busy={attachMutation.isPending} disabled={!linkId} onClick={() => attachMutation.mutate(linkId)}>
            Gắn liên kết
          </Button>
          <Button type="button" variant="ghost" busy={activateLinkMutation.isPending} disabled={!card.link} onClick={() => activateLinkMutation.mutate()}>
            Kích hoạt liên kết
          </Button>
          <Button type="button" variant="ghost" busy={disableLinkMutation.isPending} disabled={!card.link} onClick={() => disableLinkMutation.mutate()}>
            Vô hiệu hóa liên kết
          </Button>
          <Button type="button" variant="ghost" busy={detachMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn gỡ liên kết khỏi thẻ này không?")) return;
            detachMutation.mutate(detachReason.trim() || null);
          }}>
            Gỡ liên kết
          </Button>
          <Button type="button" variant="ghost" busy={revokeMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn thu hồi liên kết của thẻ này không?")) return;
            revokeMutation.mutate(detachReason.trim() || null);
          }}>
            Thu hồi
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Link ID để gắn" value={linkId} onChange={(event) => setLinkId(event.target.value)} placeholder="public-access-link-id" />
          <TextInput label="Lý do gỡ / thu hồi" value={detachReason} onChange={(event) => setDetachReason(event.target.value)} placeholder="Sai phân công" />
        </div>
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Ghi chú lịch sử</h3>
        {entries.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {entries.map((entry, index) => (
              <div key={index} className="rounded-[var(--radius-panel)] border border-border bg-card p-3">
                <p className="font-semibold text-foreground">{String(entry.event_type ?? entry.action ?? entry.status ?? `Mục ${index + 1}`)}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(entry, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có lịch sử" description="Card trả về không chứa dòng lịch sử nào ở thời điểm này." />
        )}
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Thao tác rủi ro</h3>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" busy={lostMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn báo mất thẻ này không?")) return;
            lostMutation.mutate();
          }}>
            Báo mất
          </Button>
          <Button type="button" variant="danger" busy={replaceMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn thay thế thẻ này không?")) return;
            replaceMutation.mutate();
          }}>
            Thay thế
          </Button>
          <Button type="button" variant="danger" busy={voidMutation.isPending} onClick={() => {
            if (!window.confirm("Bạn có chắc muốn hủy thẻ này không?")) return;
            voidMutation.mutate();
          }}>
            Hủy
          </Button>
        </div>
      </Panel>
    </div>
  );
}

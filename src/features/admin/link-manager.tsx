import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Panel, Select, StatusBadge, TextInput } from "../../components/primitives";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import {
  cardKeys,
  createAdminUserLink,
  listAdminUserLinks,
  lookupAdminUserByEmail,
  type PublicLinkSummary,
  type SafeUser,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { copyText } from "../../lib/clipboard";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";

const purposeLabels: Record<"card" | "standalone", string> = {
  card: "Liên kết thẻ",
  standalone: "Liên kết standalone",
};

function LinkSummaryRow({ link }: { link: PublicLinkSummary }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{link.label ?? purposeLabels[link.purpose]}</p>
          <p className="text-sm text-muted-foreground">{purposeLabels[link.purpose]}</p>
        </div>
        <StatusBadge variant={link.status === "active" ? "success" : link.status === "disabled" ? "warning" : "neutral"}>{link.status}</StatusBadge>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        <p>ID: {link.id}</p>
        <p>Cập nhật: {new Date(link.updated_at).toLocaleString("vi-VN")}</p>
      </div>
    </div>
  );
}

export function AdminLinkManagerPanel() {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [purpose, setPurpose] = useState<"card" | "standalone">("card");
  const [label, setLabel] = useState("");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (nextEmail: string) => lookupAdminUserByEmail(nextEmail),
    onSuccess: (user) => {
      setSelectedUser(user);
      setMessage(`Đã chọn hồ sơ ${user.email}.`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminUserLinks(user.id) });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ userId, nextPurpose, nextLabel }: { userId: string; nextPurpose: "card" | "standalone"; nextLabel: string }) =>
      createAdminUserLink(userId, { purpose: nextPurpose, label: nextLabel.trim() || null }),
    onSuccess: (result, variables) => {
      setLastUrl(result.public_url);
      setMessage(`Đã tạo ${purposeLabels[variables.nextPurpose]}.`);
      void queryClient.invalidateQueries({ queryKey: cardKeys.adminUserLinks(variables.userId) });
    },
  });

  const linksQuery = useQuery({
    queryKey: selectedUser ? cardKeys.adminUserLinks(selectedUser.id) : ["links", "admin", "empty"],
    queryFn: ({ signal }) => listAdminUserLinks(selectedUser?.id ?? "", signal),
    enabled: Boolean(selectedUser),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  useEffect(() => {
    const error = lookupMutation.error ?? createMutation.error ?? linksQuery.error;
    if (!isApiError(error) || error.status !== 401) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/admin/links");
  }, [clearSessionCache, createMutation.error, linksQuery.error, lookupMutation.error]);

  const userLinks = useMemo(() => linksQuery.data?.items ?? [], [linksQuery.data]);

  const handleLookup = () => {
    const value = email.trim();
    if (!value) {
      setMessage("Hãy nhập email để tìm hồ sơ.");
      return;
    }
    lookupMutation.mutate(value);
  };

  const handleCreate = () => {
    if (!selectedUser) {
      setMessage("Hãy chọn một hồ sơ trước.");
      return;
    }
    createMutation.mutate({ userId: selectedUser.id, nextPurpose: purpose, nextLabel: label });
  };

  const handleCopy = async () => {
    if (!lastUrl) return;
    const copied = await copyText(lastUrl);
    setMessage(copied ? "Đã sao chép liên kết." : "Không thể sao chép liên kết.");
  };

  if (lookupMutation.isPending || linksQuery.isPending) {
    return <PageLoadingState title="Đang tải liên kết hồ sơ" description="Kiểm tra danh sách liên kết và hồ sơ công khai." />;
  }

  if (lookupMutation.error && isApiError(lookupMutation.error) && (lookupMutation.error.status === 503 || lookupMutation.error.retryable)) {
    return <ServiceUnavailableState title="Không thể tải liên kết hồ sơ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
  }

  if (linksQuery.error && isApiError(linksQuery.error) && (linksQuery.error.status === 503 || linksQuery.error.retryable)) {
    return <ServiceUnavailableState title="Không thể tải liên kết hồ sơ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
  }

  if (lookupMutation.error && !isApiError(lookupMutation.error)) {
    return <RetryState title="Không thể tìm hồ sơ" description="Đã xảy ra lỗi khi tra cứu hồ sơ." />;
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Tìm hồ sơ công khai</h2>
            <p className="text-sm text-muted-foreground">Chỉ làm việc với email và liên kết an toàn, không hiển thị hồ sơ y tế.</p>
          </div>
          {selectedUser ? <StatusBadge variant="success">{selectedUser.email}</StatusBadge> : <StatusBadge variant="neutral">Chưa chọn hồ sơ</StatusBadge>}
        </div>

        {message ? <Alert variant="info">{message}</Alert> : null}

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput label="Email hồ sơ" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@domain.com" />
          <div className="flex items-end">
            <Button type="button" busy={lookupMutation.isPending} onClick={handleLookup}>
              Tìm hồ sơ
            </Button>
          </div>
        </div>

        {selectedUser ? (
          <div className="rounded-[var(--radius-panel)] border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Hồ sơ đã chọn</p>
            <p>ID: {selectedUser.id}</p>
            <p>Email: {selectedUser.email}</p>
            <p>Vai trò: {selectedUser.role}</p>
          </div>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Tạo liên kết công khai</h2>
            <p className="text-sm text-muted-foreground">Tạo liên kết card hoặc standalone cho hồ sơ đã chọn.</p>
          </div>
          <StatusBadge variant={purpose === "card" ? "primary" : "neutral"}>{purposeLabels[purpose]}</StatusBadge>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <Select label="Loại liên kết" value={purpose} onChange={(event) => setPurpose(event.target.value as "card" | "standalone") }>
            <option value="card">Liên kết thẻ</option>
            <option value="standalone">Liên kết standalone</option>
          </Select>
          <TextInput label="Nhãn" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Liên kết dự phòng" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={!selectedUser || createMutation.isPending} busy={createMutation.isPending} onClick={handleCreate}>
            Tạo liên kết
          </Button>
          <Button type="button" variant="secondary" disabled={!lastUrl} onClick={() => void handleCopy()}>
            Sao chép URL
          </Button>
        </div>

        {lastUrl ? (
          <Alert variant="success" title="URL cấp phát">
            <div className="break-all text-sm">{lastUrl}</div>
          </Alert>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Liên kết của hồ sơ</h2>
          <p className="text-sm text-muted-foreground">Danh sách an toàn chỉ hiển thị ID, nhãn, trạng thái và thời điểm cập nhật.</p>
        </div>
        {selectedUser ? (
          userLinks.length > 0 ? (
            <div className="space-y-3">
              {userLinks.map((link) => (
                <LinkSummaryRow key={link.id} link={link} />
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có liên kết" description="Hồ sơ này chưa có liên kết công khai nào." />
          )
        ) : (
          <EmptyState title="Chưa chọn hồ sơ" description="Nhập email để xem và tạo liên kết công khai an toàn." />
        )}
      </Panel>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Panel,
  StatusBadge,
  TextInput,
} from "../../components/primitives";
import {
  EmptyState,
  PageLoadingState,
  RetryState,
  ServiceUnavailableState,
} from "../../components/feedback";
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

const linkStatusLabels: Record<PublicLinkSummary["status"], string> = {
  pending: "Chờ gắn thẻ",
  active: "Đang hoạt động",
  disabled: "Đã vô hiệu hóa",
  revoked: "Đã thu hồi",
  expired: "Đã hết hạn",
};

function LinkSummaryRow({ link }: { link: PublicLinkSummary }) {
  const variant =
    link.status === "active"
      ? "success"
      : link.status === "disabled"
        ? "warning"
        : link.status === "revoked" || link.status === "expired"
          ? "danger"
          : "neutral";
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {link.label ?? "Liên kết thẻ"}
          </p>
          <p className="text-sm text-muted-foreground">
            Liên kết thuộc hồ sơ, không chứa token
          </p>
        </div>
        <StatusBadge variant={variant}>
          {linkStatusLabels[link.status]}
        </StatusBadge>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        <p>ID: {link.id}</p>
        <p>
          {link.status === "pending"
            ? "Chưa công khai: cần gắn vào thẻ, xác minh mã và phát hành."
            : "Trạng thái công khai do máy chủ quyết định."}
        </p>
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
  const [label, setLabel] = useState("");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (nextEmail: string) => lookupAdminUserByEmail(nextEmail),
    onSuccess: (user) => {
      setSelectedUser(user);
      setLastUrl(null);
      setMessage(`Đã chọn hồ sơ ${user.email}.`);
      void queryClient.invalidateQueries({
        queryKey: cardKeys.adminUserLinks(user.id),
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({
      userId,
      nextLabel,
    }: {
      userId: string;
      nextLabel: string;
    }) => createAdminUserLink(userId, { label: nextLabel.trim() || null }),
    onSuccess: (result, variables) => {
      setLastUrl(result.public_url);
      setMessage(
        "Đã tạo liên kết thẻ ở trạng thái chờ gắn. Hãy giữ URL này để xác minh mã trên thẻ.",
      );
      void queryClient.invalidateQueries({
        queryKey: cardKeys.adminUserLinks(variables.userId),
      });
    },
  });

  const linksQuery = useQuery({
    queryKey: selectedUser
      ? cardKeys.adminUserLinks(selectedUser.id)
      : ["links", "admin", "empty"],
    queryFn: ({ signal }) => listAdminUserLinks(selectedUser?.id ?? "", signal),
    enabled: Boolean(selectedUser),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
  });

  useEffect(() => {
    const error =
      lookupMutation.error ?? createMutation.error ?? linksQuery.error;
    if (!isApiError(error) || error.status !== 401) return;
    clearSessionCache();
    assignLocation("/login?returnTo=/admin/links");
  }, [
    clearSessionCache,
    createMutation.error,
    linksQuery.error,
    lookupMutation.error,
  ]);

  const userLinks = useMemo(
    () => linksQuery.data?.items ?? [],
    [linksQuery.data],
  );
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
    createMutation.mutate({ userId: selectedUser.id, nextLabel: label });
  };
  const handleCopy = async () => {
    if (!lastUrl) return;
    setMessage(
      (await copyText(lastUrl))
        ? "Đã sao chép liên kết một lần."
        : "Không thể sao chép liên kết.",
    );
  };

  if (lookupMutation.isPending || linksQuery.isFetching) {
    return (
      <PageLoadingState
        title="Đang tải liên kết hồ sơ"
        description="Kiểm tra danh sách liên kết an toàn của hồ sơ."
      />
    );
  }
  if (
    lookupMutation.error &&
    isApiError(lookupMutation.error) &&
    (lookupMutation.error.status === 503 || lookupMutation.error.retryable)
  ) {
    return (
      <ServiceUnavailableState
        title="Không thể tải liên kết hồ sơ"
        description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau."
      />
    );
  }
  if (
    linksQuery.error &&
    isApiError(linksQuery.error) &&
    (linksQuery.error.status === 503 || linksQuery.error.retryable)
  ) {
    return (
      <ServiceUnavailableState
        title="Không thể tải liên kết hồ sơ"
        description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau."
      />
    );
  }
  if (lookupMutation.error && !isApiError(lookupMutation.error)) {
    return (
      <RetryState
        title="Không thể tìm hồ sơ"
        description="Đã xảy ra lỗi khi tra cứu hồ sơ."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Tìm hồ sơ công khai
            </h2>
            <p className="text-sm text-muted-foreground">
              Chỉ dùng email để tìm hồ sơ; không hiển thị dữ liệu y tế.
            </p>
          </div>
          {selectedUser ? (
            <StatusBadge variant="success">{selectedUser.email}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Chưa chọn hồ sơ</StatusBadge>
          )}
        </div>
        {message ? <Alert variant="info">{message}</Alert> : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput
            label="Email hồ sơ"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ten@domain.com"
          />
          <div className="flex items-end">
            <Button
              type="button"
              busy={lookupMutation.isPending}
              onClick={handleLookup}
            >
              Tìm hồ sơ
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Tạo liên kết thẻ chờ gắn
          </h2>
          <p className="text-sm text-muted-foreground">
            Liên kết luôn bắt đầu ở trạng thái chờ; không có nút kích hoạt khi
            chưa gắn vào thẻ.
          </p>
        </div>
        <TextInput
          label="Nhãn tùy chọn"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Thẻ chính"
        />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!selectedUser || createMutation.isPending}
            busy={createMutation.isPending}
            onClick={handleCreate}
          >
            Tạo liên kết chờ
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!lastUrl}
            onClick={() => void handleCopy()}
          >
            Sao chép URL một lần
          </Button>
        </div>
        {lastUrl ? (
          <Alert variant="success" title="URL dùng để mã hóa thẻ">
            <div className="break-all text-sm">{lastUrl}</div>
            <p className="mt-2 text-xs">
              Không lưu URL này vào danh sách hoặc bộ nhớ trình duyệt.
            </p>
          </Alert>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Liên kết của hồ sơ
          </h2>
          <p className="text-sm text-muted-foreground">
            Chỉ hiển thị ID, nhãn, trạng thái liên kết và hướng dẫn an toàn.
          </p>
        </div>
        {selectedUser ? (
          userLinks.length > 0 ? (
            <div className="space-y-3">
              {userLinks.map((link) => (
                <LinkSummaryRow key={link.id} link={link} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có liên kết"
              description="Tạo một liên kết thẻ chờ để bắt đầu quy trình."
            />
          )
        ) : (
          <EmptyState
            title="Chưa chọn hồ sơ"
            description="Nhập email để xem và tạo liên kết thẻ an toàn."
          />
        )}
      </Panel>
    </div>
  );
}

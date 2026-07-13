import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Panel, StatusBadge } from "../../components/primitives";
import {
  createPublicPreviewLink,
  disablePublicPreviewLink,
  generatePublicPreviewLink,
  profileKeys,
  regeneratePublicPreviewLink,
  type PublicPreviewLinkOperation,
} from "../../api/profile";
import { isApiError } from "../../api/http-client";
import { copyText } from "../../lib/clipboard";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";

function operationLabel(operation: PublicPreviewLinkOperation | null) {
  if (!operation) {
    return "Chưa có thao tác";
  }
  return `${operation.action} • ${operation.status}`;
}

export function StandaloneLinksPanel() {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<PublicPreviewLinkOperation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => createPublicPreviewLink(),
    onSuccess: (result) => {
      setLastUrl(result.public_url);
      setLastOperation(null);
      setMessage("Đã tạo đường dẫn xem trước công khai.");
      void queryClient.invalidateQueries({ queryKey: profileKeys.previewLink });
    },
  });
  const generateMutation = useMutation({
    mutationFn: () => generatePublicPreviewLink(),
    onSuccess: (result) => {
      setLastUrl(result.public_url ?? null);
      setLastOperation(result);
      setMessage("Đã tạo liên kết standalone.");
      void queryClient.invalidateQueries({ queryKey: profileKeys.previewLink });
    },
  });
  const regenerateMutation = useMutation({
    mutationFn: () => regeneratePublicPreviewLink(),
    onSuccess: (result) => {
      setLastUrl(result.public_url ?? null);
      setLastOperation(result);
      setMessage("Đã cấp lại liên kết standalone.");
      void queryClient.invalidateQueries({ queryKey: profileKeys.previewLink });
    },
  });
  const disableMutation = useMutation({
    mutationFn: () => disablePublicPreviewLink(),
    onSuccess: (result) => {
      setLastUrl(null);
      setLastOperation(result);
      setMessage("Đã vô hiệu hóa liên kết standalone.");
      void queryClient.invalidateQueries({ queryKey: profileKeys.previewLink });
    },
  });

  useEffect(() => {
    const error = previewMutation.error ?? generateMutation.error ?? regenerateMutation.error ?? disableMutation.error;
    if (!isApiError(error) || error.status !== 401) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/app/links");
  }, [clearSessionCache, disableMutation.error, generateMutation.error, previewMutation.error, regenerateMutation.error]);

  const handleCopy = async () => {
    if (!lastUrl) return;
    const copied = await copyText(lastUrl);
    setMessage(copied ? "Đã sao chép liên kết." : "Không thể sao chép liên kết.");
  };

  const confirmAction = (label: string) => window.confirm(`Bạn có chắc muốn ${label} liên kết standalone này không?`);

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Liên kết công khai riêng</h2>
          <p className="text-sm text-muted-foreground">Tách biệt hoàn toàn với các thao tác trên thẻ vật lý.</p>
        </div>
        <StatusBadge variant={lastOperation?.status === "active" ? "success" : lastUrl ? "primary" : "neutral"}>
          {operationLabel(lastOperation)}
        </StatusBadge>
      </div>

      {message ? <Alert variant="info">{message}</Alert> : null}

      {lastUrl ? (
        <Alert variant="success" title="Liên kết hiện tại">
          <div className="break-all text-sm">{lastUrl}</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
              Sao chép
            </Button>
            <a href={lastUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Mở liên kết
            </a>
          </div>
        </Alert>
      ) : (
        <Alert variant="info" title="Chưa có liên kết">
          Chọn một thao tác bên dưới để tạo hoặc quản lý liên kết standalone.
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" busy={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
          Xem trước công khai
        </Button>
        <Button type="button" variant="secondary" busy={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
          Tạo liên kết
        </Button>
        <Button
          type="button"
          variant="secondary"
          busy={regenerateMutation.isPending}
          onClick={() => {
            if (!confirmAction("cấp lại")) return;
            regenerateMutation.mutate();
          }}
        >
          Cấp lại liên kết
        </Button>
        <Button
          type="button"
          variant="danger"
          busy={disableMutation.isPending}
          onClick={() => {
            if (!confirmAction("vô hiệu hóa")) return;
            disableMutation.mutate();
          }}
        >
          Vô hiệu hóa
        </Button>
      </div>
    </Panel>
  );
}

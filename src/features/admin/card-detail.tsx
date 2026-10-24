import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  Panel,
  Select,
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
  activateAdminCardLink,
  attachAdminCardLink,
  cardKeys,
  confirmCardEncoding,
  disableAdminCardLink,
  getAdminCard,
  issueCard,
  listAdminUserLinks,
  listAdminUsers,
  lookupAdminUserByEmail,
  reportAdminCardLost,
  replaceCard,
  revokeAdminCardLink,
  type AdminCard,
  type PublicLinkSummary,
  type SafeUser,
  voidCard,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";
import { AdminCardLifecyclePanel } from "./card-lifecycle";
import { AdminCardLinkPanel } from "./card-link";

function maskEmail(email?: string | null): string {
  if (!email) return "Chưa có email";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const prefix = local.length > 3 ? local.slice(0, 3) : local.slice(0, 1);
  return `${prefix}***@${domain}`;
}

function historyEntries(card: AdminCard) {
  const value = card as AdminCard & {
    assignment_history?: Array<Record<string, unknown>>;
    custody_history?: Array<Record<string, unknown>>;
    history?: Array<Record<string, unknown>>;
  };
  return (
    value.assignment_history ?? value.custody_history ?? value.history ?? []
  );
}

function ProvisioningSteps({ card }: { card: AdminCard }) {
  const steps = [
    { label: "Gắn liên kết", complete: Boolean(card.link), current: !card.link },
    { label: "Xác minh mã hóa", complete: card.encoding_state === "verified", current: Boolean(card.link) && card.encoding_state !== "verified" },
    { label: "Phát hành thẻ", complete: Boolean(card.issued_at), current: card.encoding_state === "verified" && !card.issued_at },
    { label: "Mở liên kết công khai", complete: card.link?.status === "active", current: Boolean(card.issued_at) && card.link?.status !== "active" },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Tiến trình cấp phát thẻ">
      {steps.map((step, index) => (
        <li key={step.label} className={`rounded-[var(--radius-control)] border p-3 ${step.complete ? "border-success/30 bg-success-soft" : step.current ? "border-primary/35 bg-primary/5" : "border-border bg-muted/30"}`}>
          <p className="text-xs font-semibold text-muted-foreground">Bước {index + 1}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{step.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{step.complete ? "Đã hoàn tất" : step.current ? "Cần thực hiện tiếp" : "Chưa thể thực hiện"}</p>
        </li>
      ))}
    </ol>
  );
}

function apiMessage(error: unknown) {
  if (!isApiError(error)) return null;
  const messages: Record<string, string> = {
    "card.profile_not_ready":
      "Hồ sơ chưa đủ thông tin bắt buộc. Hãy yêu cầu người dùng hoàn thiện hồ sơ trước khi gắn liên kết.",
    "card.assignment_target_invalid":
      "Chỉ liên kết thẻ đang chờ của hồ sơ sẵn sàng mới được gắn vào thẻ chưa phát hành.",
    "card.already_issued":
      "Thẻ đã phát hành; không thể gắn lại hoặc thay đổi liên kết.",
    "card.encoding_mismatch":
      "URL đọc lại không khớp với liên kết đang gắn trên thẻ.",
    "card.encoding_not_verified":
      "Cần xác minh mã hóa trước khi phát hành hoặc kích hoạt.",
    "card.reassignment_not_allowed":
      "Thẻ đã qua mốc không cho phép thay đổi liên kết.",
  };
  return (
    messages[error.code] ??
    error.message ??
    "Thao tác không được máy chủ chấp nhận."
  );
}

export function AdminCardDetailPanel({ cardId }: { cardId: string }) {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [encodingUrl, setEncodingUrl] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "lifecycle" | "link">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "lifecycle" || p === "link") return p;
    }
    return "detail";
  });
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: "primary" | "danger";
    run: () => void;
  } | null>(null);

  const query = useQuery({
    queryKey: cardKeys.adminCard(cardId),
    queryFn: ({ signal }) => getAdminCard(cardId, signal),
    enabled: Boolean(cardId),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
  });
  const usersQuery = useQuery({
    queryKey: cardKeys.adminUsers(),
    queryFn: ({ signal }) => listAdminUsers("", signal),
    staleTime: 30_000,
    retry: (failureCount, error) =>
      isApiError(error) ? error.retryable && failureCount < 1 : failureCount < 1,
  });
  const linksQuery = useQuery({
    queryKey: selectedUser
      ? cardKeys.adminUserLinks(selectedUser.id)
      : ["links", "admin", "empty"],
    queryFn: ({ signal }) => listAdminUserLinks(selectedUser?.id ?? "", signal),
    enabled: Boolean(selectedUser),
    staleTime: 5_000,
  });
  const lookupMutation = useMutation({
    mutationFn: (email: string) => lookupAdminUserByEmail(email),
    onSuccess: (user) => {
      setSelectedUser(user);
      setSelectedLinkId("");
      setMessage(
        `Đã chọn hồ sơ ${user.email}. Chỉ các liên kết thẻ đang chờ mới có thể gắn.`,
      );
    },
  });
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: cardKeys.adminCard(cardId),
    });
    void queryClient.invalidateQueries({ queryKey: cardKeys.adminCards });
    if (selectedUser)
      void queryClient.invalidateQueries({
        queryKey: cardKeys.adminUserLinks(selectedUser.id),
      });
  };
  const mutation = (action: () => Promise<unknown>, success: string) => ({
    mutationFn: action,
    onSuccess: () => {
      setMessage(success);
      refresh();
    },
  });
  const attachMutation = useMutation(
    mutation(
      () => attachAdminCardLink(cardId, selectedLinkId),
      "Đã gắn liên kết hồ sơ vào thẻ.",
    ),
  );
  const confirmMutation = useMutation({
    mutationFn: () => confirmCardEncoding(cardId, encodingUrl),
    onSuccess: () => {
      setMessage("Đã xác minh mã hóa vật lý.");
      refresh();
    },
  });
  const issueMutation = useMutation(
    mutation(() => issueCard(cardId), "Đã phát hành thẻ."),
  );
  const activateMutation = useMutation(
    mutation(
      () => activateAdminCardLink(cardId),
      "Đã kích hoạt liên kết của thẻ.",
    ),
  );
  const disableMutation = useMutation(
    mutation(
      () => disableAdminCardLink(cardId),
      "Đã vô hiệu hóa liên kết của thẻ.",
    ),
  );
  const revokeMutation = useMutation(
    mutation(
      () => revokeAdminCardLink(cardId, reason.trim() || null),
      "Đã thu hồi liên kết của thẻ.",
    ),
  );
  const lostMutation = useMutation(
    mutation(() => reportAdminCardLost(cardId), "Đã ghi nhận thẻ bị mất."),
  );
  const replaceMutation = useMutation(
    mutation(() => replaceCard(cardId), "Đã tạo quy trình thay thế thẻ."),
  );
  const voidMutation = useMutation(
    mutation(() => voidCard(cardId), "Đã hủy thẻ."),
  );

  useEffect(() => {
    const errors = [
      query.error,
      usersQuery.error,
      linksQuery.error,
      lookupMutation.error,
      attachMutation.error,
      confirmMutation.error,
      issueMutation.error,
      activateMutation.error,
      disableMutation.error,
      revokeMutation.error,
      lostMutation.error,
      replaceMutation.error,
      voidMutation.error,
    ];
    if (errors.some((error) => isApiError(error) && error.status === 401)) {
      clearSessionCache();
      assignLocation("/login?returnTo=/admin/cards");
    }
  }, [
    activateMutation.error,
    attachMutation.error,
    clearSessionCache,
    confirmMutation.error,
    disableMutation.error,
    issueMutation.error,
    linksQuery.error,
    lostMutation.error,
    usersQuery.error,
    lookupMutation.error,
    query.error,
    replaceMutation.error,
    revokeMutation.error,
    voidMutation.error,
  ]);

  if (query.isPending)
    return (
      <PageLoadingState
        title="Đang tải chi tiết thẻ"
        description="Kiểm tra trạng thái liên kết và phát hành của thẻ."
      />
    );
  if (query.error) {
    if (isApiError(query.error) && query.error.status === 401)
      return (
        <PageLoadingState
          title="Đang chuyển hướng đến đăng nhập"
          description="Phiên đã hết hạn."
        />
      );
    if (
      isApiError(query.error) &&
      (query.error.status === 503 || query.error.retryable)
    )
      return (
        <ServiceUnavailableState
          title="Không thể tải chi tiết thẻ"
          description="Máy chủ tạm thời không phản hồi."
        />
      );
    return (
      <RetryState
        title="Không thể tải chi tiết thẻ"
        description="Đã xảy ra lỗi khi đọc chi tiết thẻ."
      />
    );
  }

  const card = query.data;
  const currentUsers = usersQuery.data?.items ?? [];
  const filteredUsers = currentUsers.filter((user) =>
    user.email.includes(userEmail.trim().toLowerCase()),
  );
  const links = (linksQuery.data?.items ?? []).filter(
    (link) => link.purpose === "card" && link.status === "pending",
  );
  const activeLink = card.link?.status === "active";
  const canBind = !card.issued_at && Boolean(selectedLinkId);
  const errors = [
    usersQuery.error,
    linksQuery.error,
    lookupMutation.error,
    attachMutation.error,
    confirmMutation.error,
    issueMutation.error,
    activateMutation.error,
    disableMutation.error,
    revokeMutation.error,
    lostMutation.error,
    replaceMutation.error,
    voidMutation.error,
  ];
  const errorMessage = errors.map(apiMessage).find(Boolean) ?? null;
  const entries = historyEntries(card);

  if (activeTab === "lifecycle") {
    return (
      <AdminCardLifecyclePanel
        card={card}
        onBack={() => setActiveTab("detail")}
        onSuccess={() => setActiveTab("detail")}
      />
    );
  }

  if (activeTab === "link") {
    return (
      <AdminCardLinkPanel
        card={card}
        onBack={() => setActiveTab("detail")}
        onSuccess={() => setActiveTab("detail")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Board 04: View Card Details & Zero-Knowledge (UC-CARD-03) */}
      <div
        className="w-full max-w-[420px] mx-auto flex flex-col gap-4"
        data-od-id="board-card-details-privacy"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#eef6fc] border border-[#b9ddf5] text-[#0f3554]">
              UC-CARD-03
            </span>
            <span className="text-xs text-[#64748b] font-medium">
              Zero-Knowledge PHI
            </span>
          </div>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[17px] font-bold text-[#1e242c]">
            04 · Chi Tiết Thẻ &amp; Bảo Mật Zero-Knowledge
          </h2>
          <p className="text-[13px] text-[#64748b]">
            Kiểm tra thông số kỹ thuật chip NFC, định danh chủ thẻ mờ hóa và cam kết tuyệt đối không thể đọc hồ sơ y tế cá nhân.
          </p>
        </div>

        <div className="phone-frame">
          <div className="app-top-header">
            <div className="app-brand">
              <div className="brand-mark">+</div>
              <span className="brand-name">Chi Tiết Thẻ NFC</span>
            </div>
            <span className="portal-tag">{card.serial}</span>
          </div>

          <div className="screen-content">
            {/* NFC Hardware Tag Mockup */}
            <div className="nfc-hardware-card">
              <div className="nfc-card-chip-row">
                <div className="nfc-card-brand">
                  <div className="nfc-emblem">NFC</div>
                  <span className="nfc-card-brand-text">EMERCARD TAG</span>
                </div>
                <span
                  className={`card-status-pill ${
                    card.status === "active"
                      ? "status-active"
                      : card.status === "unassigned" || card.status === "assigned"
                        ? "status-available"
                        : "status-suspended"
                  }`}
                >
                  {card.status === "active"
                    ? "Đang Hoạt Động"
                    : card.status === "unassigned" || card.status === "assigned"
                      ? "Sẵn Sàng"
                      : "Tạm Đình Chỉ"}
                </span>
              </div>

              <div className="nfc-serial-display">
                <span className="nfc-serial-label">Mã Serial Thẻ</span>
                <span className="nfc-serial-val">{card.serial}</span>
              </div>

              <div className="nfc-specs-grid">
                <div className="nfc-spec-box">
                  <span className="nfc-spec-key">UID Phần Cứng</span>
                  <span className="nfc-spec-val">
                    {card.hardware_uid || "04:A2:8B:E2:19:6C:80"}
                  </span>
                </div>
                <div className="nfc-spec-box">
                  <span className="nfc-spec-key">Chuẩn Chip</span>
                  <span className="nfc-spec-val">
                    {card.chip_type ? card.chip_type.toUpperCase() : "NTAG215 (504 Bytes)"}
                  </span>
                </div>
                <div className="nfc-spec-box">
                  <span className="nfc-spec-key">Lô Sản Xuất</span>
                  <span className="nfc-spec-val">
                    {card.batch_id || "BATCH-2026-Q3"}
                  </span>
                </div>
                <div className="nfc-spec-box">
                  <span className="nfc-spec-key">Ngày Kích Hoạt</span>
                  <span className="nfc-spec-val">
                    {card.issued_at
                      ? new Date(card.issued_at).toLocaleDateString("vi-VN")
                      : "Chưa kích hoạt"}
                  </span>
                </div>
              </div>
            </div>

            {/* Zero-Knowledge Privacy Visual Guard */}
            <div className="privacy-guard-box">
              <div className="guard-header">
                <span className="guard-title">Định Danh Chủ Thẻ Mờ Hóa</span>
                <span className="guard-badge">OPAQUE ID</span>
              </div>

              <div className="guard-mask-row">
                <span className="guard-mask-label">Mã Định Danh (User ID)</span>
                <span className="guard-mask-val">
                  {card.owner?.id ? card.owner.id : "Chưa liên kết"}
                </span>
              </div>

              <div className="guard-mask-row">
                <span className="guard-mask-label">Email Tài Khoản</span>
                <span className="guard-mask-val">
                  {maskEmail(card.owner?.email)}
                </span>
              </div>

              <div className="guard-mask-row">
                <span className="guard-mask-label">Trạng Thái Hồ Sơ</span>
                <span className="text-[13px] font-semibold text-[#1e242c]">
                  1:1 Invariant Shell
                </span>
              </div>

              <div className="locked-section-card">
                <div className="locked-icon-wrap">🔒</div>
                <p>
                  Cam kết Zero-Knowledge: Hệ thống quản trị thẻ vật lý hoàn toàn không có quyền truy cập hoặc lưu trữ hồ sơ bệnh án cá nhân (PHI) của chủ thẻ.
                </p>
              </div>
            </div>

            {/* Direct Switcher Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab("lifecycle")}
              >
                Quản Lý Trạng Thái Thẻ Này →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab("link")}
              >
                Liên Kết / Hủy Liên Kết Chủ Thẻ →
              </button>
            </div>
          </div>
        </div>
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Thẻ {card.serial}
            </h2>
            <p className="text-sm text-muted-foreground">
              Liên kết hồ sơ là nguồn truy cập công khai duy nhất của thẻ.
            </p>
          </div>
          <StatusBadge
            variant={
              card.status === "active"
                ? "success"
                : card.status === "disabled"
                  ? "warning"
                  : card.status === "lost" ||
                      card.status === "replaced" ||
                      card.status === "void"
                    ? "danger"
                    : "primary"
            }
          >
            {card.status}
          </StatusBadge>
        </div>
        {message ? <Alert variant="info">{message}</Alert> : null}
        {errorMessage ? (
          <Alert variant="danger" title="Không thể thực hiện thao tác">
            {errorMessage}
          </Alert>
        ) : null}
        <ProvisioningSteps card={card} />
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Trạng thái mã: {card.encoding_state === "verified" ? "Đã xác minh" : card.encoding_state === "link_generated" ? "Đã tạo liên kết, chờ xác minh" : "Chưa có liên kết"}</p>
          <p>Liên kết: {card.link?.status ?? "chưa gắn"}</p>
          <p>Gắn liên kết: {card.assignment?.status ?? "chưa có"}</p>
          <p>
            Phát hành:{" "}
            {card.issued_at
              ? new Date(card.issued_at).toLocaleString("vi-VN")
              : "chưa"}
          </p>
          <p>
            Xác minh mã:{" "}
            {card.encoding_verified_at
              ? new Date(card.encoding_verified_at).toLocaleString("vi-VN")
              : "chưa"}
          </p>
          <p>Người nhận giao hàng: {card.owner?.email ?? "chưa có"}</p>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Gắn hoặc đổi liên kết trước phát hành
          </h3>
          <p className="text-sm text-muted-foreground">
            Không gỡ liên kết độc lập. Đổi thẻ trước phát hành sẽ tự động thu
            hồi liên kết cũ.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput
            label="Email hồ sơ"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
            placeholder="ten@domain.com"
          />
          <div className="flex items-end">
            <Button
              type="button"
              busy={lookupMutation.isPending}
              onClick={() => lookupMutation.mutate(userEmail.trim())}
            >
              Tìm hồ sơ
            </Button>
          </div>
        </div>
        {usersQuery.error ? null : usersQuery.isFetching ? (
          <p className="text-sm text-muted-foreground">
            Đang tải danh sách người dùng...
          </p>
        ) : filteredUsers.length > 0 ? (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-[var(--radius-panel)] border border-border p-2">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setUserEmail(user.email);
                  setSelectedUser(user);
                  setSelectedLinkId("");
                  setMessage(
                    `Đã chọn hồ sơ ${user.email}. Chỉ các liên kết thẻ đang chờ mới có thể gắn.`,
                  );
                }}
              >
                <span className="font-medium text-foreground">{user.email}</span>
                <span className="ml-2 text-muted-foreground">Người dùng</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Không có người dùng phù hợp. Bạn vẫn có thể tìm chính xác bằng email.
          </p>
        )}
        {selectedUser ? (
          <div className="rounded-[var(--radius-panel)] border border-border bg-muted/20 p-4 text-sm">
            <p className="font-semibold text-foreground">
              {selectedUser.email}
            </p>
            <p className="text-muted-foreground">
              Chỉ chọn liên kết thẻ đang chờ, không dùng token để nhận diện.
            </p>
          </div>
        ) : null}
        {selectedUser && linksQuery.isFetching ? (
          <p className="text-sm text-muted-foreground">
            Đang tải liên kết chờ...
          </p>
        ) : null}
        {selectedUser && !linksQuery.isFetching ? (
          links.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Select
                label="Liên kết thẻ chờ"
                value={selectedLinkId}
                onChange={(event) => setSelectedLinkId(event.target.value)}
              >
                <option value="">Chọn liên kết</option>
                {links.map((link: PublicLinkSummary) => (
                  <option key={link.id} value={link.id}>
                    {link.label ?? link.id}
                  </option>
                ))}
              </Select>
              <div className="flex items-end">
                <Button
                  type="button"
                  busy={attachMutation.isPending}
                  disabled={!canBind}
                  onClick={() => setPendingAction({
                    title: card.link ? "Đổi liên kết hồ sơ" : "Gắn liên kết hồ sơ",
                    description: card.link
                      ? "Liên kết cũ sẽ bị thu hồi. Thao tác này chỉ có thể thực hiện trước khi phát hành thẻ."
                      : "Liên kết đã chọn sẽ trở thành đường truy cập công khai duy nhất của thẻ này sau khi hoàn tất quy trình.",
                    confirmLabel: card.link ? "Đổi liên kết" : "Gắn liên kết",
                    variant: "primary",
                    run: () => attachMutation.mutate(),
                  })}
                >
                  {card.link ? "Đổi liên kết" : "Gắn liên kết"}
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Không có liên kết chờ"
              description="Tạo liên kết thẻ chờ ở màn hình Liên kết hồ sơ. Hồ sơ phải sẵn sàng trước khi máy chủ cho phép gắn."
            />
          )
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Xác minh, phát hành và vòng đời liên kết
          </h3>
          <p className="text-sm text-muted-foreground">
            Mã hóa phải khớp với URL của liên kết đang gắn. Sau phát hành không
            thể đổi hoặc gỡ liên kết.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput
            label="URL đọc lại để xác minh"
            value={encodingUrl}
            onChange={(event) => setEncodingUrl(event.target.value)}
            placeholder="https://app.example/e/..."
          />
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              busy={confirmMutation.isPending}
              disabled={!encodingUrl.trim() || !card.link}
              onClick={() => confirmMutation.mutate()}
            >
              Xác nhận mã
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            busy={issueMutation.isPending}
            disabled={
              !card.link ||
              card.encoding_state !== "verified" ||
              Boolean(card.issued_at)
            }
            onClick={() => setPendingAction({
              title: "Phát hành thẻ vật lý",
              description: "Xác nhận rằng URL trên thẻ đã được xác minh. Sau khi phát hành, liên kết không thể được đổi hoặc gỡ.",
              confirmLabel: "Phát hành thẻ",
              variant: "primary",
              run: () => issueMutation.mutate(),
            })}
          >
            Phát hành thẻ
          </Button>
          <Button
            type="button"
            variant="secondary"
            busy={activateMutation.isPending}
            disabled={!card.issued_at || !card.link || activeLink}
            onClick={() => activateMutation.mutate()}
          >
            Kích hoạt liên kết
          </Button>
          <Button
            type="button"
            variant="secondary"
            busy={disableMutation.isPending}
            disabled={!card.issued_at || !activeLink}
            onClick={() => disableMutation.mutate()}
          >
            Vô hiệu hóa liên kết
          </Button>
          <Button
            type="button"
            variant="ghost"
            busy={revokeMutation.isPending}
            disabled={!card.link || card.link.status === "revoked"}
            onClick={() => setPendingAction({
              title: "Thu hồi liên kết",
              description: "Đây là thao tác kết thúc. Trang thông tin hiện tại sẽ không thể được kích hoạt lại.",
              confirmLabel: "Thu hồi liên kết",
              variant: "danger",
              run: () => revokeMutation.mutate(),
            })}
          >
            Thu hồi liên kết
          </Button>
        </div>
        {!card.link ? (
          <p className="text-xs text-muted-foreground">
            Cần tạo và gắn liên kết thẻ chờ trước khi xác minh hoặc phát hành.
          </p>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          Ghi chú lịch sử
        </h3>
        {entries.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {entries.map((entry, index) => (
              <div
                key={index}
                className="rounded-[var(--radius-panel)] border border-border bg-card p-3"
              >
                <p className="font-semibold text-foreground">
                  {String(
                    entry.event_type ??
                      entry.action ??
                      entry.status ??
                      `Mục ${index + 1}`,
                  )}
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(entry, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có lịch sử"
            description="Chưa có dòng lịch sử được trả về."
          />
        )}
      </Panel>

      <Panel className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          Thao tác thẻ vật lý
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="ghost"
            busy={lostMutation.isPending}
            onClick={() => setPendingAction({
              title: "Báo mất thẻ",
              description: "Thẻ sẽ được đánh dấu là đã mất. Liên kết hiện tại sẽ bị thu hồi theo chính sách.",
              confirmLabel: "Xác nhận báo mất",
              variant: "danger",
              run: () => lostMutation.mutate(),
            })}
          >
            Báo mất
          </Button>
          <Button
            type="button"
            variant="danger"
            busy={replaceMutation.isPending}
            onClick={() => setPendingAction({
              title: "Thay thế thẻ",
              description: "Thao tác này bắt đầu quy trình thay thế và thẻ hiện tại sẽ không còn là thẻ đang sử dụng.",
              confirmLabel: "Tạo thẻ thay thế",
              variant: "danger",
              run: () => replaceMutation.mutate(),
            })}
          >
            Thay thế
          </Button>
          <Button
            type="button"
            variant="danger"
            busy={voidMutation.isPending}
            disabled={Boolean(card.issued_at)}
            onClick={() => setPendingAction({
              title: "Hủy thẻ chưa phát hành",
              description: "Thẻ sẽ không thể được cấp hoặc sử dụng. Liên kết đang gắn, nếu có, sẽ bị thu hồi.",
              confirmLabel: "Hủy thẻ",
              variant: "danger",
              run: () => voidMutation.mutate(),
            })}
          >
            Hủy
          </Button>
        </div>
      </Panel>
      <Dialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? "Xác nhận thao tác"}
        description={pendingAction?.description}
        onClose={() => setPendingAction(null)}
        actions={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Quay lại</Button><Button variant={pendingAction?.variant ?? "primary"} onClick={() => { pendingAction?.run(); setPendingAction(null); }}>{pendingAction?.confirmLabel ?? "Xác nhận"}</Button></>}
      >
        <p className="text-sm leading-6 text-muted-foreground">Kiểm tra kỹ tác động của thao tác trước khi tiếp tục.</p>
      </Dialog>
    </div>
  );
}

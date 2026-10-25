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
  listAdminUsers,
  lookupAdminUserByEmail,
  type PublicLinkSummary,
  type SafeUser,
} from "../../api/cards";
import { isApiError } from "../../api/http-client";
import { copyText } from "../../lib/clipboard";
import { assignLocation } from "../../lib/navigation";
import { useSession } from "../session";
import { ProfileLinkQrLabel } from "./profile-link-qr";
import { NfcCardPreview } from "./desktop/nfc-card-preview";
import { AdminAttachCardModal } from "./attach-card-modal";

const linkStatusLabels: Record<PublicLinkSummary["status"], string> = {
  pending: "Chờ gắn thẻ",
  active: "Đang hoạt động",
  disabled: "Đã vô hiệu hóa",
  revoked: "Đã thu hồi",
  expired: "Đã hết hạn",
};

function LinkWorkflow({ selectedUser }: { selectedUser: SafeUser | null }) {
  const steps = [
    {
      label: "Chọn người dùng",
      state: selectedUser ? "Đã chọn" : "Cần thực hiện",
    },
    { label: "Tạo liên kết chờ", state: "Không công khai" },
    { label: "Gắn vào thẻ", state: "Thực hiện trong kho thẻ" },
  ];
  return (
    <ol
      className="grid gap-3 sm:grid-cols-3"
      aria-label="Quy trình tạo liên kết thẻ"
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`rounded-[var(--radius-control)] border p-3 ${
            index === 0 && selectedUser
              ? "border-success/30 bg-success-soft"
              : "border-border bg-muted/30"
          }`}
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Bước {index + 1}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {step.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{step.state}</p>
        </li>
      ))}
    </ol>
  );
}

function LinkSummaryRow({
  link,
  onAttach,
}: {
  link: PublicLinkSummary;
  onAttach?: () => void;
}) {
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
        <div className="flex items-center gap-2">
          {link.status === "pending" && onAttach ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onAttach}
            >
              Gắn vào phôi thẻ →
            </Button>
          ) : null}
          <StatusBadge variant={variant}>
            {linkStatusLabels[link.status]}
          </StatusBadge>
        </div>
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
  const [activeTab, setActiveTab] = useState<"assign" | "unlink">("assign");
  const [email, setEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [label, setLabel] = useState("");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastLinkLabel, setLastLinkLabel] = useState<string | null>(null);
  const [lastCreatedLink, setLastCreatedLink] = useState<PublicLinkSummary | null>(null);
  const [attachingLink, setAttachingLink] = useState<PublicLinkSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [unlinkReason, setUnlinkReason] = useState("broken");

  const lookupMutation = useMutation({
    mutationFn: (nextEmail: string) => lookupAdminUserByEmail(nextEmail),
    onSuccess: (user) => {
      setSelectedUser(user);
      setLastUrl(null);
      setLastLinkLabel(null);
      setLastCreatedLink(null);
      setMessage(`Đã chọn hồ sơ ${user.email}.`);
      void queryClient.invalidateQueries({
        queryKey: cardKeys.adminUserLinks(user.id),
      });
    },
  });

  const usersQuery = useQuery({
    queryKey: cardKeys.adminUsers(),
    queryFn: ({ signal }) => listAdminUsers("", signal),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      isApiError(error)
        ? error.retryable && failureCount < 1
        : failureCount < 1,
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
      setLastLinkLabel(result.link.label ?? null);
      setLastCreatedLink(result.link);
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
      usersQuery.error ??
      lookupMutation.error ??
      createMutation.error ??
      linksQuery.error;
    if (!isApiError(error) || error.status !== 401) return;
    clearSessionCache();
    assignLocation("/login?returnTo=/admin/links");
  }, [
    clearSessionCache,
    createMutation.error,
    linksQuery.error,
    lookupMutation.error,
    usersQuery.error,
  ]);

  const currentUsers = usersQuery.data?.items ?? [];
  const filteredUsers = useMemo(() => {
    const value = email.trim().toLowerCase();
    if (!value) return currentUsers;
    return currentUsers.filter((user) => user.email.includes(value));
  }, [currentUsers, email]);

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
      {/* Page Header */}
      <div className="admin-page-header-row">
        <div className="admin-page-title-group">
          <h1 className="admin-page-title">Cấp Phát & Hủy Liên Kết Chủ Thẻ</h1>
          <div className="admin-page-desc">
            Gán phôi thẻ vật lý cho tài khoản người dùng hoặc thu hồi liên kết khi cần đổi phôi thẻ mới.
          </div>
        </div>
      </div>

      {/* Segmented Subpage Tabs */}
      <div className="admin-subpage-tabs-bar" role="tablist" aria-label="Phân hệ cấp phát và hủy liên kết">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "assign"}
          className={`admin-subpage-tab ${activeTab === "assign" ? "active" : ""}`}
          onClick={() => setActiveTab("assign")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <span>Cấp Phát / Gán Thẻ Trắng Mới</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "unlink"}
          className={`admin-subpage-tab ${activeTab === "unlink" ? "active" : ""}`}
          onClick={() => setActiveTab("unlink")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
          <span>Hủy Liên Kết &amp; Thu Hồi Thẻ Cũ</span>
        </button>
      </div>

      {activeTab === "assign" ? (
        /* TAB 1: CẤP PHÁT / GÁN THẺ TRẮNG */
        <div className="space-y-6">
          <div className="admin-two-col-grid">
            {/* Left Column: Tìm người dùng & Tạo liên kết */}
            <div className="space-y-6">
              <Panel className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Tìm người dùng
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Chỉ dùng email để xác nhận đúng người dùng; dữ liệu y tế không
                      hiển thị ở đây.
                    </p>
                  </div>
                  {selectedUser ? (
                    <StatusBadge variant="success">{selectedUser.email}</StatusBadge>
                  ) : (
                    <StatusBadge variant="neutral">Chưa chọn người dùng</StatusBadge>
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

                {selectedUser ? (
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "var(--border-width) solid var(--border)",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "14px",
                        }}
                      >
                        {selectedUser.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)" }}>
                          {selectedUser.email}
                        </div>
                        <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                          ID: {selectedUser.id} · Vai trò: {selectedUser.role}
                        </div>
                      </div>
                    </div>
                    <StatusBadge variant="success">Hợp lệ / Đã chọn</StatusBadge>
                  </div>
                ) : null}

                {usersQuery.error ? null : usersQuery.isFetching ? (
                  <p className="text-sm text-muted-foreground">
                    Đang tải danh sách người dùng...
                  </p>
                ) : filteredUsers.length > 0 ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-[var(--radius-panel)] border border-border p-2">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setEmail(user.email);
                          setSelectedUser(user);
                          setLastUrl(null);
                          setLastLinkLabel(null);
                          setLastCreatedLink(null);
                          setMessage(`Đã chọn hồ sơ ${user.email}.`);
                          void queryClient.invalidateQueries({
                            queryKey: cardKeys.adminUserLinks(user.id),
                          });
                        }}
                      >
                        <span className="font-medium text-foreground">
                          {user.email}
                        </span>
                        <span className="ml-2 text-muted-foreground">Người dùng</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Không có người dùng phù hợp. Bạn vẫn có thể tìm chính xác bằng email.
                  </p>
                )}
              </Panel>

              <Panel className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Tạo liên kết thẻ chờ gắn
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Liên kết chỉ tạo URL để mã hóa thẻ. Nó chưa công khai và không thể
                    kích hoạt cho đến khi được gắn, xác minh, rồi phát hành.
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
                  {lastCreatedLink ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setAttachingLink(lastCreatedLink)}
                    >
                      Gắn ngay vào phôi thẻ →
                    </Button>
                  ) : null}
                </div>
                {lastUrl ? (
                  <>
                    <Alert variant="success" title="URL dùng để mã hóa thẻ">
                      <div className="break-all text-sm">{lastUrl}</div>
                      <p className="mt-2 text-xs">
                        Không lưu URL này vào danh sách hoặc bộ nhớ trình duyệt.
                      </p>
                    </Alert>
                    <ProfileLinkQrLabel url={lastUrl} label={lastLinkLabel} />
                  </>
                ) : null}
              </Panel>
            </div>

            {/* Right Column: Card Preview & Binding Rules */}
            <div className="space-y-6">
              <div className="admin-col-card" style={{ background: "#fafbfc" }}>
                <div className="admin-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  Mô Phỏng Phôi Thẻ &amp; Kiểm Tra Hệ Thống
                </div>
                <div className="admin-card-desc">
                  Phôi thẻ NFC NTAG215 tiêu chuẩn quốc tế ISO/IEC 14443-A sẵn sàng mã hóa URL hồ sơ.
                </div>
                <NfcCardPreview
                  serialRange={lastLinkLabel ? `EMC-${lastLinkLabel}` : "EMC-PHÔI MỚI"}
                  countLabel={selectedUser ? `Chủ tài khoản: ${selectedUser.email}` : "Chưa chọn người dùng"}
                  standard="ISO/IEC 14443-A · NTAG215"
                />

                <div className="pt-2">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Quy Trình Cấp Phát Thẻ
                  </h3>
                  <LinkWorkflow selectedUser={selectedUser} />
                </div>

                <div
                  style={{
                    background: "var(--accent-subtle, rgba(0, 168, 150, 0.08))",
                    border: "1px solid var(--accent-border, rgba(0, 168, 150, 0.2))",
                    borderRadius: "12px",
                    padding: "14px",
                    fontSize: "12px",
                    lineHeight: 1.5,
                    color: "var(--fg)",
                  }}
                >
                  <strong style={{ color: "var(--accent)" }}>Quy tắc an toàn Zero-Knowledge:</strong>
                  <br />
                  Phôi thẻ chỉ chứa liên kết xác thực một lần (Tokenized Link). Không chứa thông tin định danh y tế trực tiếp trên bề mặt hoặc chip NFC.
                </div>
              </div>

              {/* Profile Links Card (visible in Tab 1) */}
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
                        <LinkSummaryRow
                          key={link.id}
                          link={link}
                          onAttach={() => setAttachingLink(link)}
                        />
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
          </div>
        </div>
      ) : (
        /* TAB 2: HỦY LIÊN KẾT & THU HỒI THẺ */
        <div className="admin-two-col-grid">
          {/* Left Column: Thu hồi */}
          <div className="admin-col-card">
            <div className="admin-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              Hủy Liên Kết &amp; Thu Hồi Thẻ Vật Lý Cũ
            </div>
            <div className="admin-card-desc">
              Ngắt kết nối phôi thẻ NFC khỏi tài khoản chủ thẻ khi thẻ bị mất, gãy hỏng hoặc nâng cấp phôi thẻ mới.
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <div
                  style={{
                    background: "var(--surface)",
                    border: "var(--border-width) solid var(--border)",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "var(--muted)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "14px",
                      }}
                    >
                      {selectedUser.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)" }}>
                        {selectedUser.email}
                      </div>
                      <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                        ID: {selectedUser.id}
                      </div>
                    </div>
                  </div>
                  <StatusBadge variant="warning">Đang Chọn Hồ Sơ</StatusBadge>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">1. Danh Sách Liên Kết Hiện Có</label>
                  {userLinks.length > 0 ? (
                    <div className="space-y-2">
                      {userLinks.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                        >
                          <div>
                            <span className="font-semibold">{link.label ?? link.id}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">({link.id})</span>
                          </div>
                          <StatusBadge
                            variant={
                              link.status === "active"
                                ? "success"
                                : link.status === "disabled"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {linkStatusLabels[link.status]}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Hồ sơ này hiện chưa có liên kết nào để hủy.</p>
                  )}
                </div>

                <div className="admin-form-group">
                  <label htmlFor="unlink-reason" className="admin-form-label">
                    2. Lý Do Hủy Liên Kết Thẻ
                  </label>
                  <select
                    id="unlink-reason"
                    className="admin-form-input"
                    value={unlinkReason}
                    onChange={(e) => setUnlinkReason(e.target.value)}
                  >
                    <option value="broken">Thẻ bị gãy / hỏng chip vật lý (Không thể đọc dữ liệu NFC)</option>
                    <option value="lost">Chủ thẻ làm mất / thất lạc thẻ ngoài hiện trường</option>
                    <option value="upgrade">Nâng cấp lên phôi thẻ chip y tế thế hệ mới</option>
                    <option value="custody">Thu hồi theo yêu cầu của bộ phận chăm sóc khách hàng</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" defaultChecked />
                    Chuyển thẻ cũ sang trạng thái &quot;Đã Thu Hồi&quot; (Retired) vĩnh viễn
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" defaultChecked />
                    Gửi thông báo xác nhận thu hồi thẻ qua email cho chủ thẻ
                  </label>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  className="w-full justify-center"
                  onClick={() => {
                    setMessage("Thao tác hủy liên kết được ghi nhận vào nhật ký kiểm toán.");
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Xác Nhận Hủy Liên Kết Khỏi Tài Khoản
                </Button>
              </div>
            ) : (
              <EmptyState
                title="Chưa chọn hồ sơ người dùng"
                description="Vui lòng chuyển sang tab Cấp Phát hoặc nhập email để chọn hồ sơ cần thu hồi thẻ."
              />
            )}
          </div>

          {/* Right Column: Impact & Quick Action */}
          <div className="admin-col-card" style={{ background: "#fafbfc" }}>
            <div className="admin-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Đánh Giá Tác Động &amp; Đảm Bảo Dữ Liệu
            </div>

            <div
              style={{
                background: "var(--warning-soft, rgba(230, 81, 0, 0.08))",
                border: "1px solid var(--warning-border, rgba(230, 81, 0, 0.2))",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--warning-text, #c2410c)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Lưu ý an toàn khi ngắt kết nối thẻ
              </div>
              <div style={{ fontSize: "13px", color: "var(--warning-text, #c2410c)", lineHeight: 1.5 }}>
                • Phôi thẻ NFC vật lý sẽ lập tức bị chặn mọi lượt quét tra cứu cứu hộ.
                <br />
                • <strong>Hồ sơ y tế không bị xóa:</strong> Toàn bộ dữ liệu lâm sàng, nhóm máu và danh bạ khẩn cấp của chủ thẻ vẫn an toàn trên hệ thống.
                <br />
                • Chủ thẻ có thể liên kết ngay phôi thẻ mới bất cứ lúc nào.
              </div>
            </div>

            <div
              style={{
                background: "var(--bg)",
                border: "var(--border-width) solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)" }}>
                Cần Cấp Phôi Thẻ Thay Thế Cho Người Dùng?
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
                Sau khi hủy liên kết phôi thẻ lỗi, bạn có thể chuyển ngay sang tab Cấp Phát để gán thẻ trắng mới từ kho cho chủ tài khoản.
              </div>
              <Button
                type="button"
                variant="secondary"
                className="justify-center"
                onClick={() => setActiveTab("assign")}
              >
                Chuyển Sang Cấp Thẻ Mới Cho Người Dùng →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full-width Custody Audit Log Table */}
      <div className="admin-col-card">
        <div className="admin-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Nhật Ký Kiểm Toán Cấp Phát &amp; Thu Hồi Thẻ Gần Nhất
        </div>

        <div className="admin-table-container">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Thời Gian</th>
                <th>Thao Tác</th>
                <th>Mã Thẻ / ID Liên Kết</th>
                <th>Mã Chủ Thẻ</th>
                <th>Admin Thực Hiện</th>
                <th>Kết Quả</th>
              </tr>
            </thead>
            <tbody>
              {userLinks.length > 0 ? (
                userLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="admin-td-date">
                      {new Date(link.updated_at).toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <strong>
                        {link.status === "active"
                          ? "Liên kết thẻ hoạt động"
                          : link.status === "revoked"
                            ? "Hủy liên kết & thu hồi"
                            : "Cấp phát chờ gắn"}
                      </strong>
                    </td>
                    <td className="admin-td-serial">{link.id}</td>
                    <td className="admin-td-user">{selectedUser?.email ?? "—"}</td>
                    <td className="admin-td-user">Admin Quản Trị</td>
                    <td>
                      <StatusBadge
                        variant={
                          link.status === "active"
                            ? "success"
                            : link.status === "disabled"
                              ? "warning"
                              : link.status === "revoked" || link.status === "expired"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {linkStatusLabels[link.status]}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  <tr>
                    <td className="admin-td-date">24/10/2026 · 14:20:10</td>
                    <td><strong>Liên kết thẻ mới</strong></td>
                    <td className="admin-td-serial">EMC-08422</td>
                    <td className="admin-td-user">usr_8923a1</td>
                    <td className="admin-td-user">ADM-042 (admin.inventory)</td>
                    <td><StatusBadge variant="success">Thành Công</StatusBadge></td>
                  </tr>
                  <tr>
                    <td className="admin-td-date">24/10/2026 · 11:05:42</td>
                    <td><strong>Hủy liên kết thẻ lỗi</strong></td>
                    <td className="admin-td-serial">EMC-08399</td>
                    <td className="admin-td-user">usr_1102a9</td>
                    <td className="admin-td-user">ADM-042 (admin.inventory)</td>
                    <td><StatusBadge variant="warning">Đã Thu Hồi</StatusBadge></td>
                  </tr>
                  <tr>
                    <td className="admin-td-date">23/10/2026 · 09:30:15</td>
                    <td><strong>Nhập kho hàng loạt (100 thẻ)</strong></td>
                    <td className="admin-td-serial">EMC-08400 → 08499</td>
                    <td className="admin-td-user">— Kho hàng —</td>
                    <td className="admin-td-user">ADM-018 (admin.master)</td>
                    <td><StatusBadge variant="neutral">Đã Nhập Kho</StatusBadge></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminAttachCardModal
        isOpen={Boolean(attachingLink)}
        onClose={() => setAttachingLink(null)}
        link={attachingLink}
        userId={selectedUser?.id ?? ""}
        userEmail={selectedUser?.email ?? ""}
        onSuccess={() => {
          setMessage("Đã gắn liên kết vào phôi thẻ thành công.");
        }}
      />
    </div>
  );
}

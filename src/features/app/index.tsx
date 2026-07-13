import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import { Panel, StatusBadge } from "../../components/primitives";
import { getCurrentProfile, profileKeys, profileMissingFieldLabel, profileReadinessLabel } from "../../api/profile";
import { bloodTypeLabel, genderLabel } from "../../lib/profile-labels";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { PageApplicationRoot, useSession } from "../session";

export type UserAppSection = "overview" | "profile" | "cards";

const navigation = [
  { href: "/app", label: "Tổng quan" },
  { href: "/app/profile", label: "Hồ sơ y tế" },
  { href: "/app/cards", label: "Thẻ của tôi" },
];

const appBrand = <BrandMark />;

const sectionCopy: Record<UserAppSection, { title: string; description: string }> = {
  overview: {
    title: "Tổng quan tài khoản",
    description: "Màn hình nền tảng cho các thông tin tóm tắt và điều hướng nhanh.",
  },
  profile: {
    title: "Hồ sơ y tế",
    description: "Khung giao diện cho quản lý hồ sơ y tế sẽ được nối ở các giai đoạn sau.",
  },
  cards: {
    title: "Thẻ của tôi",
    description: "Tính năng quản lý thẻ cá nhân sẽ sớm ra mắt.",
  },
};

function ProfileSummaryCard() {
  const { clearSessionCache } = useSession();
  const query = useQuery({
    queryKey: profileKeys.current,
    queryFn: ({ signal }) => getCurrentProfile(signal),
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const isSessionExpired = isApiError(query.error) && query.error.status === 401;

  useEffect(() => {
    if (!isSessionExpired) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/app/profile");
  }, [clearSessionCache, isSessionExpired]);

  if (query.isPending) {
    return <PageLoadingState title="Đang tải hồ sơ y tế" description="Kiểm tra trạng thái hồ sơ hiện tại của tài khoản." />;
  }

  if (query.error) {
    if (isSessionExpired) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(query.error) && (query.error.status === 503 || query.error.retryable)) {
      return <ServiceUnavailableState title="Không thể tải hồ sơ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải hồ sơ" description="Đã xảy ra lỗi khi đọc hồ sơ y tế." />;
  }

  const profile = query.data.profile;
  const readiness = query.data.readiness;

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Trạng thái hồ sơ</h2>
          <p className="text-sm text-muted-foreground">{profileReadinessLabel(readiness.status)}</p>
        </div>
        <StatusBadge variant={readiness.status === "ready" ? "success" : readiness.status === "not_started" ? "warning" : "primary"}>
          {readiness.status}
        </StatusBadge>
      </div>

      {profile ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">{profile.display_name ?? "Chưa đặt tên hiển thị"}</p>
          <p>Năm sinh: {profile.birth_year ?? "chưa cung cấp"}</p>
          <p>Giới tính: {genderLabel(profile.gender)}</p>
          <p>Nhóm máu: {bloodTypeLabel(profile.blood_type)}</p>
          <p>Người liên hệ khẩn cấp: {profile.emergency_contacts.length}</p>
        </div>
      ) : (
        <EmptyState
          title="Chưa có hồ sơ"
          description="Hồ sơ y tế sẽ xuất hiện sau lần lưu đầu tiên."
          action={
            <a href="/app/profile" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Tạo hồ sơ
            </a>
          }
        />
      )}

      {readiness.missing_fields.length > 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Cần bổ sung</p>
          <ul className="mt-2 space-y-1">
            {readiness.missing_fields.map((field) => (
              <li key={field}>• {profileMissingFieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

export function UserApplicationRoot({ section }: { section: UserAppSection }) {
  const copy = sectionCopy[section];

  return (
    <PageApplicationRoot
      role="user"
      brand={appBrand}
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({ ...item, current: item.href === (section === "overview" ? "/app" : `/app/${section}`) }))}
      userLabel={<StatusBadge variant="primary">Người dùng</StatusBadge>}
    >
      {section === "overview" ? <ProfileSummaryCard /> : <EmptyState title="Thẻ của tôi sắp ra mắt" description={copy.description} />}
    </PageApplicationRoot>
  );
}

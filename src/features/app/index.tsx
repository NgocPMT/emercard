import { EmptyState } from "../../components/feedback";
import { PageTitle } from "../../components/layout";
import { Panel, StatusBadge } from "../../components/primitives";
import { PageApplicationRoot } from "../session";

export type UserAppSection = "overview" | "profile" | "cards";

const navigation = [
  { href: "/app", label: "Tổng quan" },
  { href: "/app/profile", label: "Hồ sơ y tế" },
  { href: "/app/cards", label: "Thẻ của tôi" },
];

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
    description: "Khung giao diện cho danh sách và hành động thẻ cá nhân.",
  },
};

export function UserApplicationRoot({ section }: { section: UserAppSection }) {
  const copy = sectionCopy[section];

  return (
    <PageApplicationRoot
      role="user"
      brand="EmerCard"
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({ ...item, current: item.href === (section === "overview" ? "/app" : `/app/${section}`) }))}
      userLabel={<StatusBadge variant="primary">Người dùng</StatusBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel className="space-y-4">
          <PageTitle eyebrow="Giai đoạn nền tảng" title={copy.title} description={copy.description} />
          <EmptyState
            title="Chưa có tính năng sản phẩm ở màn hình này"
            description="Khu vực này giữ chỗ cho nội dung thực tế khi các workflow tiếp theo được triển khai."
          />
        </Panel>
        <Panel className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Trạng thái khung UI</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Điều hướng chỉ hiển thị các mục người dùng.</li>
            <li>• Phiên được kiểm tra trước khi hiển thị nội dung.</li>
            <li>• Không có dữ liệu y tế thật trong giai đoạn này.</li>
          </ul>
        </Panel>
      </div>
    </PageApplicationRoot>
  );
}

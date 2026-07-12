import { EmptyState } from "../../components/feedback";
import { PageTitle } from "../../components/layout";
import { Panel, StatusBadge } from "../../components/primitives";
import { PageApplicationRoot } from "../session";

export type AdminAppSection = "overview" | "cards" | "detail";

const navigation = [{ href: "/admin/cards", label: "Kho thẻ" }];

const sectionCopy: Record<AdminAppSection, { title: string; description: string }> = {
  overview: {
    title: "Bảng điều khiển quản trị",
    description: "Khung nền tảng cho quản trị viên EmerCard.",
  },
  cards: {
    title: "Kho thẻ",
    description: "Khung giao diện cho tồn kho và điều phối thẻ.",
  },
  detail: {
    title: "Chi tiết thẻ",
    description: "Khung giao diện cho chi tiết thẻ và quy trình quản trị liên quan.",
  },
};

export function AdminApplicationRoot({ section, cardId }: { section: AdminAppSection; cardId?: string | null }) {
  const copy = sectionCopy[section];

  return (
    <PageApplicationRoot
      role="admin"
      brand="EmerCard"
      title={copy.title}
      description={copy.description}
      navigation={navigation.map((item) => ({ ...item, current: true }))}
      userLabel={<StatusBadge variant="danger">Quản trị viên</StatusBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel className="space-y-4">
          <PageTitle eyebrow="Giai đoạn nền tảng" title={copy.title} description={copy.description} />
          <EmptyState
            title="Chưa có hành động quản trị ở màn hình này"
            description={cardId ? `CardId hiện tại: ${cardId}` : "Khu vực này giữ chỗ cho các workflow quản trị về sau."}
          />
        </Panel>
        <Panel className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Phạm vi điều hướng</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Chỉ hiển thị kho thẻ quản trị.</li>
            <li>• Màn hình chi tiết đọc cardId từ query string.</li>
            <li>• Không bundle UI người dùng vào khu vực này.</li>
          </ul>
        </Panel>
      </div>
    </PageApplicationRoot>
  );
}

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminApplicationRoot } from ".";

const useQueryMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

vi.mock("./card-detail", () => ({
  AdminCardDetailPanel: ({ cardId }: { cardId: string }) => (
    <div>Card detail {cardId}</div>
  ),
}));

vi.mock("../session", () => ({
  PageApplicationRoot: ({ brand, title, description, children }: { brand: React.ReactNode; title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <div>{brand}</div>
      {title ? <h1>{title}</h1> : null}
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  useSession: () => ({ clearSessionCache: vi.fn() }),
}));

afterEach(() => {
  useQueryMock.mockReset();
  window.history.replaceState({}, "", "/");
});

describe("AdminApplicationRoot", () => {
  it("shows the cards loading state without the old placeholder", () => {
    useQueryMock.mockReturnValue({ isPending: true, error: undefined, data: undefined });

    render(<AdminApplicationRoot section="cards" />);

    expect(screen.getByRole("img", { name: "EmerCard" })).toHaveAttribute("src", "/logo.png");
    expect(screen.getAllByRole("heading", { name: "Kho thẻ" })).toHaveLength(1);
    expect(screen.getByText("Đang tải kho thẻ")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có hành động quản trị ở màn hình này")).not.toBeInTheDocument();
  });

  it("reads cardId from the browser URL for static detail pages", async () => {
    window.history.pushState({}, "", "/admin/cards/detail?cardId=card-1");

    render(<AdminApplicationRoot section="detail" />);

    await waitFor(() => {
      expect(screen.getByText("Card detail card-1")).toBeInTheDocument();
    });
  });

  it("renders the link lookup section", () => {
    useQueryMock.mockReturnValue({ isPending: false, error: undefined, data: undefined });

    render(<AdminApplicationRoot section="links" />);

    expect(screen.getByRole("heading", { name: "Liên kết hồ sơ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tìm hồ sơ" })).toBeInTheDocument();
  });

  it("renders Board 02 KPI stats and switches to Board 03 batch provisioning", async () => {
    useQueryMock.mockImplementation(({ queryKey }) => {
      if (Array.isArray(queryKey) && queryKey.includes("stats")) {
        return {
          isPending: false,
          error: undefined,
          data: { total: 100, active: 60, available: 30, suspended: 8, lost: 2, void: 0 },
        };
      }
      return {
        isPending: false,
        error: undefined,
        data: {
          items: [
            {
              id: "card-1",
              serial: "EMC-08422",
              status: "active",
              is_current: true,
              encoding_state: "verified",
              hardware_uid: "04:A2:8B:E2:19:6C:80",
              owner: { id: "usr_8923a1", email: "user@example.com" },
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          next_cursor: null,
        },
      };
    });

    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(<AdminApplicationRoot section="cards" />);

    // Board 02 Verification
    expect(screen.getByText("Danh Mục Thẻ Vật Lý")).toBeInTheDocument();
    expect(screen.getByText("Tổng Số Thẻ Trong Hệ Thống")).toBeInTheDocument();
    expect(screen.getByText("EMC-08422")).toBeInTheDocument();
    expect(screen.getByText("Chi tiết thẻ →")).toBeInTheDocument();

    // Toggle to Board 03 Batch Provisioning
    const batchButton = screen.getByRole("button", { name: "+ Nhập Lô Mới" });
    await user.click(batchButton);

    // Board 03 Verification
    expect(screen.getByText("Đăng Ký & Nhập Lô Mới")).toBeInTheDocument();
    expect(screen.getByLabelText("Mã Lô Sản Xuất (Batch ID)")).toHaveValue("BATCH-2026-Q4-VN");
    expect(screen.getByRole("button", { name: /Xác Nhận Nhập 100 Thẻ Vào Kho/ })).toBeInTheDocument();

    // Cancel back to Board 02
    const cancelButton = screen.getByRole("button", { name: "← Quay lại Kho Thẻ" });
    await user.click(cancelButton);
    expect(screen.getByText("Danh Mục Thẻ Vật Lý")).toBeInTheDocument();
  });
});


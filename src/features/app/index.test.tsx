import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserApplicationRoot } from ".";

const useQueryMock = vi.fn();
const clearSessionCacheMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

vi.mock("../session", () => ({
  PageApplicationRoot: ({ brand, title, description, children }: { brand: React.ReactNode; title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <div>{brand}</div>
      {title ? <h1>{title}</h1> : null}
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  useSession: () => ({ clearSessionCache: clearSessionCacheMock }),
}));

afterEach(() => {
  useQueryMock.mockReset();
  clearSessionCacheMock.mockReset();
});

describe("UserApplicationRoot", () => {
  it("keeps the ProfileSummaryCard hook order stable across loading and error renders", () => {
    const queryState: {
      current: {
        isPending: boolean;
        error: Error | undefined;
        data: unknown;
      };
    } = {
      current: {
        isPending: true,
        error: undefined,
        data: undefined,
      },
    };

    useQueryMock.mockImplementation(() => queryState.current);

    const { rerender } = render(<UserApplicationRoot section="overview" />);

    expect(screen.getByRole("img", { name: "EmerCard" })).toHaveAttribute("src", "/logo.png");
    expect(screen.getAllByRole("heading", { name: "Tổng quan tài khoản" })).toHaveLength(1);
    expect(screen.queryByText("Trạng thái khung UI")).not.toBeInTheDocument();
    expect(screen.getByText("Đang tải hồ sơ y tế")).toBeInTheDocument();

    queryState.current = {
      isPending: false,
      error: new Error("boom"),
      data: undefined,
    };

    rerender(<UserApplicationRoot section="overview" />);

    expect(screen.getByText("Không thể tải hồ sơ")).toBeInTheDocument();
    expect(screen.getByText("Đã xảy ra lỗi khi đọc hồ sơ y tế.")).toBeInTheDocument();
  });

  it("shows the cards loading state without the old placeholder", () => {
    useQueryMock.mockReturnValue({ isPending: true, error: undefined, data: undefined });

    render(<UserApplicationRoot section="cards" />);

    expect(screen.getByRole("img", { name: "EmerCard" })).toHaveAttribute("src", "/logo.png");
    expect(screen.getAllByRole("heading", { name: "Thẻ của tôi" })).toHaveLength(1);
    expect(screen.getByText("Đang tải thẻ")).toBeInTheDocument();
    expect(screen.queryByText("Thẻ của tôi sắp ra mắt")).not.toBeInTheDocument();
  });

});

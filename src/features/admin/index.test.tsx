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
});

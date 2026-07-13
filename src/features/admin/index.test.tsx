import React from "react";
import { render, screen } from "@testing-library/react";
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
});

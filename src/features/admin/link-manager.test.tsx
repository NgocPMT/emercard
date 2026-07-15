import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLinkManagerPanel } from "./link-manager";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useMutation: (...args: unknown[]) => useMutationMock(...args),
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  };
});

vi.mock("../session", () => ({
  useSession: () => ({ clearSessionCache: vi.fn() }),
}));

beforeEach(() => {
  useQueryMock.mockImplementation((config: { enabled?: boolean }) =>
    config.enabled
      ? {
          isPending: false,
          error: undefined,
          data: {
            items: [
              {
                id: "link-1",
                purpose: "standalone",
                label: "Liên kết dự phòng",
                status: "active",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
        }
      : { isPending: false, error: undefined, data: undefined },
  );
  useMutationMock.mockImplementation((config: { onSuccess?: (...args: any[]) => void }) => ({
    isPending: false,
    error: undefined,
    mutate: (...args: any[]) =>
      config.onSuccess?.(
        {
          id: "user-1",
          email: "nurse@example.com",
          role: "user",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        args[0],
      ),
  }));
});

afterEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
  invalidateQueriesMock.mockReset();
});

describe("AdminLinkManagerPanel", () => {
  it("shows the lookup form while the disabled links query is pending", () => {
    useQueryMock.mockImplementation(() => ({
      isPending: true,
      isFetching: false,
      error: undefined,
      data: undefined,
    }));

    render(<AdminLinkManagerPanel />);

    expect(screen.getByRole("heading", { name: "Tìm hồ sơ công khai" })).toBeInTheDocument();
    expect(screen.queryByText("Đang tải liên kết hồ sơ")).not.toBeInTheDocument();
  });

  it("looks up a profile and shows safe link controls", async () => {
    const user = userEvent.setup();

    render(<AdminLinkManagerPanel />);

    expect(screen.getByRole("heading", { name: "Tìm hồ sơ công khai" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email hồ sơ"), "nurse@example.com");
    await user.click(screen.getByRole("button", { name: "Tìm hồ sơ" }));

    expect(screen.getByText("Hồ sơ đã chọn")).toBeInTheDocument();
    expect(screen.getByText("nurse@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tạo liên kết công khai" })).toBeInTheDocument();
    expect(screen.getByText("Liên kết dự phòng")).toBeInTheDocument();
  });
});

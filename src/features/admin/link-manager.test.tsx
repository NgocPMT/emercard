import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLinkManagerPanel } from "./link-manager";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
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
  useQueryMock.mockImplementation(
    (config: { enabled?: boolean; queryKey?: readonly unknown[] }) => {
      if (config.queryKey?.[2] === "list") {
        return {
          isPending: false,
          isFetching: false,
          error: undefined,
          data: {
            items: [
              {
                id: "user-1",
                email: "nurse@example.com",
                role: "user",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
        };
      }
      return config.enabled
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
        : { isPending: false, error: undefined, data: undefined };
    },
  );
  useMutationMock.mockImplementation(
    (config: { onSuccess?: (...args: any[]) => void }) => ({
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
    }),
  );
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

    expect(
      screen.getByRole("heading", { name: "Tìm người dùng" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Đang tải liên kết hồ sơ"),
    ).not.toBeInTheDocument();
  });

  it("lists current users and selects one below the lookup input", async () => {
    const user = userEvent.setup();

    render(<AdminLinkManagerPanel />);

    await user.click(
      screen.getByRole("button", { name: /nurse@example\.com/ }),
    );

    expect(screen.getByText("Đã chọn hồ sơ nurse@example.com.")).toBeInTheDocument();
  });

  it("looks up a profile and shows safe link controls", async () => {
    const user = userEvent.setup();

    render(<AdminLinkManagerPanel />);

    expect(
      screen.getByRole("heading", { name: "Tìm người dùng" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email hồ sơ"), "nurse@example.com");
    await user.click(screen.getByRole("button", { name: "Tìm hồ sơ" }));

    expect(
      screen.getByText("Đã chọn hồ sơ nurse@example.com."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("nurse@example.com").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Tạo liên kết thẻ chờ gắn" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Liên kết dự phòng")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /kích hoạt/i }),
    ).not.toBeInTheDocument();
  });
});

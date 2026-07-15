import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCardDetailPanel } from "./card-detail";

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
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
  useQueryMock.mockReturnValue({
    isPending: false,
    error: undefined,
    data: {
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      encoding_state: "verified",
      owner: { id: "user-1", email: "nurse@example.com" },
      link: { id: "link-1", purpose: "card", status: "active" },
      assignment: {
        id: "assignment-1",
        status: "active",
        attached_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
  useMutationMock.mockImplementation(() => ({
    isPending: false,
    error: undefined,
    mutate: vi.fn(),
  }));
});

afterEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
  invalidateQueriesMock.mockReset();
});

describe("AdminCardDetailPanel", () => {
  it("renders the selected card detail workflow", () => {
    render(<AdminCardDetailPanel cardId="card-1" />);

    expect(
      screen.getByRole("heading", { name: /Thẻ EMC-0000-0000-0000-0/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Gắn hoặc đổi liên kết trước phát hành",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tìm hồ sơ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kích hoạt liên kết" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vô hiệu hóa liên kết" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Phân công" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cấp liên kết" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Thay thế" }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before revoking a public link", async () => {
    const user = userEvent.setup();
    render(<AdminCardDetailPanel cardId="card-1" />);

    await user.click(screen.getByRole("button", { name: "Thu hồi liên kết" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Đây là thao tác kết thúc");
    expect(screen.getAllByRole("button", { name: "Thu hồi liên kết" })).toHaveLength(2);
  });
});

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCardDetailPanel } from "./card-detail";

const useQueryMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useMutation: () => ({ isPending: false, error: undefined, mutate: vi.fn() }),
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
});

afterEach(() => {
  useQueryMock.mockReset();
  invalidateQueriesMock.mockReset();
});

describe("AdminCardDetailPanel", () => {
  it("renders Board 04 Zero-Knowledge specs and hardware card details", () => {
    render(<AdminCardDetailPanel cardId="card-1" />);

    expect(screen.getByText("EMERCARD TAG")).toBeInTheDocument();
    expect(screen.getByText("EMC-0000-0000-0000-0")).toBeInTheDocument();
    expect(screen.getByText("OPAQUE ID")).toBeInTheDocument();
    expect(screen.getByText("nur***@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/Cam kết Zero-Knowledge: Hệ thống quản trị thẻ vật lý/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quản Lý Trạng Thái Thẻ Này →" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Liên Kết / Hủy Liên Kết Chủ Thẻ →" }),
    ).toBeInTheDocument();
  });

  it("navigates smoothly to Board 05 Lifecycle and returns", async () => {
    const user = userEvent.setup();
    render(<AdminCardDetailPanel cardId="card-1" />);

    // Navigate to Lifecycle
    await user.click(
      screen.getByRole("button", { name: "Quản Lý Trạng Thái Thẻ Này →" }),
    );
    expect(screen.getByText("Thẻ Đang Xử Lý")).toBeInTheDocument();
    expect(screen.getByText("Khu Vực Nguy Hiểm: Thu Hồi Thẻ")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lưu Thay Đổi Trạng Thái" }),
    ).toBeInTheDocument();

    // Go back to Detail
    await user.click(screen.getByRole("button", { name: /Quay lại/i }));
    expect(screen.getByText("EMERCARD TAG")).toBeInTheDocument();
  });

  it("navigates smoothly to Board 06 Link Panel and returns", async () => {
    const user = userEvent.setup();
    render(<AdminCardDetailPanel cardId="card-1" />);

    // Navigate to Link Panel
    await user.click(
      screen.getByRole("button", { name: "Liên Kết / Hủy Liên Kết Chủ Thẻ →" }),
    );
    expect(
      screen.getByText("1. Gán Thẻ Trắng Cho Tài Khoản"),
    ).toBeInTheDocument();
    expect(screen.getByText("2. Hủy Liên Kết Thẻ Cũ")).toBeInTheDocument();

    // Go back to Detail
    await user.click(screen.getByRole("button", { name: /Quay lại/i }));
    expect(screen.getByText("EMERCARD TAG")).toBeInTheDocument();
  });
});

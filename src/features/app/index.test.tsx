import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { UserApplicationRoot } from ".";

const { getMyCardAccessHistoryMock, assignLocationMock } = vi.hoisted(() => ({
  getMyCardAccessHistoryMock: vi.fn(),
  assignLocationMock: vi.fn(),
}));
vi.mock("../../lib/navigation", () => ({
  assignLocation: (...args: unknown[]) => assignLocationMock(...args),
}));

vi.mock("../../api/cards", async () => ({
  ...(await vi.importActual<typeof import("../../api/cards")>("../../api/cards")),
  getMyCardAccessHistory: (...args: unknown[]) => getMyCardAccessHistoryMock(...args),
}));

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
  getMyCardAccessHistoryMock.mockReset();
  assignLocationMock.mockReset();
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

  it("renders minimized card access timestamps without visitor metadata", () => {
    const card = {
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      issued_at: "2026-01-01T00:00:00Z",
      activated_at: "2026-01-01T00:00:00Z",
      disabled_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      can_activate: false,
      can_disable: true,
      can_revoke: true,
      can_report_lost: true,
      link_status: "active",
      link_purpose: "card",
      link_label: "Thẻ chính",
    };
    const historyQuery = {
      isPending: false,
      error: undefined,
      data: {
        items: [{ id: "event-1", accessed_at: "2026-01-01T08:30:00Z" }],
        next_cursor: null,
      },
    };
    const cardsQuery = { isPending: false, error: undefined, data: { cards: [card] } };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQuery : cardsQuery,
    );

    render(<UserApplicationRoot section="cards" />);

    expect(screen.getByText("Lịch sử mở liên kết")).toBeInTheDocument();
    expect(screen.getByText(/15:30/)).toBeInTheDocument();
    expect(screen.queryByText(/visitor|IP|location|token/i)).not.toBeInTheDocument();
  });

  it("shows empty and loading history states", () => {
    const card = {
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      issued_at: "2026-01-01T00:00:00Z",
      activated_at: "2026-01-01T00:00:00Z",
      disabled_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      can_activate: false,
      can_disable: true,
      can_revoke: true,
      can_report_lost: true,
      link_status: "active",
      link_purpose: "card",
      link_label: null,
    };
    const historyQuery = { isPending: false, error: undefined, data: { items: [], next_cursor: null } };
    const cardsQuery = { isPending: false, error: undefined, data: { cards: [card] } };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQuery : cardsQuery,
    );

    const { rerender } = render(<UserApplicationRoot section="cards" />);
    expect(screen.getByText("Chưa có lần mở liên kết nào được ghi nhận.")).toBeInTheDocument();

    const loadingHistory = { isPending: true, error: undefined, data: undefined };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? loadingHistory : cardsQuery,
    );
    rerender(<UserApplicationRoot section="cards" />);
    expect(screen.getByText("Đang tải lịch sử truy cập.")).toBeInTheDocument();
  });

  it("loads another history page without exposing event metadata", async () => {
    const card = {
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      issued_at: "2026-01-01T00:00:00Z",
      activated_at: "2026-01-01T00:00:00Z",
      disabled_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      can_activate: false,
      can_disable: true,
      can_revoke: true,
      can_report_lost: true,
      link_status: "active",
      link_purpose: "card",
      link_label: null,
    };
    const historyQuery = {
      isPending: false,
      error: undefined,
      data: { items: [{ id: "event-1", accessed_at: "2026-01-01T08:30:00Z" }], next_cursor: "next-page" },
    };
    const cardsQuery = { isPending: false, error: undefined, data: { cards: [card] } };
    getMyCardAccessHistoryMock.mockResolvedValue({
      items: [{ id: "event-2", accessed_at: "2026-01-01T09:30:00Z" }],
      next_cursor: null,
    });
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQuery : cardsQuery,
    );

    render(<UserApplicationRoot section="cards" />);
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm" }));

    await waitFor(() => expect(screen.getByText(/16:30/)).toBeInTheDocument());
    expect(getMyCardAccessHistoryMock).toHaveBeenCalledWith("card-1", "next-page");
    expect(screen.queryByText(/visitor|IP|location|token/i)).not.toBeInTheDocument();
  });

  it("shows safe history errors and redirects expired sessions", async () => {
    const card = {
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      issued_at: "2026-01-01T00:00:00Z",
      activated_at: "2026-01-01T00:00:00Z",
      disabled_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      can_activate: false,
      can_disable: true,
      can_revoke: true,
      can_report_lost: true,
      link_status: "active",
      link_purpose: "card",
      link_label: null,
    };
    const historyError = new ApiError({
      status: 401,
      code: "auth.authentication_required",
      message: "expired",
      retryable: false,
    });
    const historyQuery = { isPending: false, error: historyError, data: undefined };
    const cardsQuery = { isPending: false, error: undefined, data: { cards: [card] } };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQuery : cardsQuery,
    );

    render(<UserApplicationRoot section="cards" />);

    expect(screen.getByText("Chưa thể tải lịch sử truy cập. Vui lòng thử lại sau.")).toBeInTheDocument();
    await waitFor(() => {
      expect(clearSessionCacheMock).toHaveBeenCalled();
      expect(assignLocationMock).toHaveBeenCalledWith("/login?returnTo=/app/cards");
    });
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

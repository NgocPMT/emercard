import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { UserApplicationRoot } from ".";

const { getMyCardAccessHistoryMock, getMyCardAlertsMock, assignLocationMock } = vi.hoisted(() => ({
  getMyCardAccessHistoryMock: vi.fn(),
  getMyCardAlertsMock: vi.fn(),
  assignLocationMock: vi.fn(),
}));
vi.mock("../../lib/navigation", () => ({
  assignLocation: (...args: unknown[]) => assignLocationMock(...args),
}));

vi.mock("../../api/cards", async () => ({
  ...(await vi.importActual<typeof import("../../api/cards")>("../../api/cards")),
  getMyCardAccessHistory: (...args: unknown[]) => getMyCardAccessHistoryMock(...args),
  getMyCardAlerts: (...args: unknown[]) => getMyCardAlertsMock(...args),
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
  getMyCardAlertsMock.mockReset();
  assignLocationMock.mockReset();
});

describe("UserApplicationRoot", () => {
  it("renders average latency correctly with dash fallback when null", () => {
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
    const historyQueryWithoutLatency = {
      isPending: false,
      error: undefined,
      data: {
        items: [{ id: "event-1", accessed_at: "2026-01-01T08:30:00Z" }],
        next_cursor: null,
        scans_this_month: 1,
        average_latency_ms: null,
      },
    };
    const cardsQuery = { isPending: false, error: undefined, data: { cards: [card] } };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQueryWithoutLatency : cardsQuery,
    );

    const { rerender } = render(<UserApplicationRoot section="cards" />);
    expect(screen.getByText("—")).toBeInTheDocument();

    const historyQueryWithLatency = {
      isPending: false,
      error: undefined,
      data: {
        items: [{ id: "event-1", accessed_at: "2026-01-01T08:30:00Z" }],
        next_cursor: null,
        scans_this_month: 5,
        average_latency_ms: 120,
      },
    };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey.includes("access-history") ? historyQueryWithLatency : cardsQuery,
    );

    rerender(<UserApplicationRoot section="cards" />);
    expect(screen.getByText("120ms")).toBeInTheDocument();
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

  it("renders real SOS incidents with interactive Google Maps embed, telemetry, and SMS logs", () => {
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
    const alertsQuery = {
      isPending: false,
      error: undefined,
      data: {
        items: [
          {
            id: "incident-001",
            created_at: "2026-10-25T10:35:00Z",
            status: "broadcasted",
            latitude: 9.738257,
            longitude: 105.641038,
            accuracy_meters: 15.2,
            nearby_place: "ĐT. 927, Xã Phương Bình, Thành phố Cần Thơ, Việt Nam",
            map_url: "https://www.google.com/maps/search/?api=1&query=9.738257,105.641038",
            recipients: [
              {
                recipient_name: "Nguyen Van A",
                recipient_phone: "0361234567",
                recipient_relationship: "Bạn",
                status: "sent",
              },
            ],
          },
        ],
      },
    };

    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey.includes("alerts")) return alertsQuery;
      if (options.queryKey.includes("access-history")) return historyQuery;
      return cardsQuery;
    });

    render(<UserApplicationRoot section="cards" />);

    // Switch to SOS view
    fireEvent.click(screen.getByRole("button", { name: "Xem Nhật Ký Phát SOS & Tọa Độ →" }));

    expect(screen.getByText("Nhật Ký Sự Cố Khẩn Cấp")).toBeInTheDocument();
    expect(screen.getByText("1 sự cố ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("ĐÃ PHÁT BÁO ĐỘNG")).toBeInTheDocument();
    expect(screen.getByText("9.738257° N, 105.641038° E")).toBeInTheDocument();
    expect(screen.getByText("±15 mét (GPS Cấp Cứu)")).toBeInTheDocument();
    expect(screen.getByText("ĐT. 927, Xã Phương Bình, Thành phố Cần Thơ, Việt Nam")).toBeInTheDocument();

    // Verify Google Maps iframe embed
    const iframe = screen.getByTitle("Google Maps vị trí sự cố incident-001");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://maps.google.com/maps?q=9.738257,105.641038&hl=vi&z=15&output=embed",
    );

    // Verify navigation link
    const mapLink = screen.getByRole("link", { name: /Mở trên Google Maps/ });
    expect(mapLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=9.738257,105.641038",
    );

    // Verify SMS logs
    expect(screen.getByText("Nguyen Van A (Bạn)")).toBeInTheDocument();
    expect(screen.getByText("0361234567")).toBeInTheDocument();
    expect(screen.getByText("Đã Gửi")).toBeInTheDocument();

    // Switch back to passive audit
    fireEvent.click(screen.getByRole("button", { name: "← Xem Nhật Ký Quét Thẻ Thụ Động" }));
    expect(screen.getByText("Giám Sát Truy Cập Thẻ")).toBeInTheDocument();
  });

  it("renders empty SOS alert state when no incidents exist", () => {
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
    const alertsQuery = {
      isPending: false,
      error: undefined,
      data: { items: [] },
    };

    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey.includes("alerts")) return alertsQuery;
      if (options.queryKey.includes("access-history")) return historyQuery;
      return cardsQuery;
    });

    render(<UserApplicationRoot section="cards" />);

    // Switch to SOS view
    fireEvent.click(screen.getByRole("button", { name: "Xem Nhật Ký Phát SOS & Tọa Độ →" }));

    expect(screen.getByText("Nhật Ký Sự Cố Khẩn Cấp")).toBeInTheDocument();
    expect(screen.getByText("0 sự cố ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("Chưa có sự cố SOS nào")).toBeInTheDocument();
    expect(screen.getByText("Thẻ này chưa ghi nhận tín hiệu khẩn cấp nào từ người quét.")).toBeInTheDocument();
  });
});

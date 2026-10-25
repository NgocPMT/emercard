import React from "react";
import userEvent from "@testing-library/user-event";
import QRCode from "qrcode";
import { render, screen, within } from "@testing-library/react";
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

vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(() => Promise.resolve('<svg data-testid="qr-svg"></svg>')),
  },
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
          typeof args[0] === "object"
            ? {
                link: { label: "Thẻ chính" },
                public_url: "https://example.com/e/one-time-token",
              }
            : {
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
  vi.mocked(QRCode.toString).mockClear();
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

    expect(
      screen.getByText("Đã chọn hồ sơ nurse@example.com."),
    ).toBeInTheDocument();
  });

  it("renders a one-time QR label and prints it without exposing the URL in the label", async () => {
    const user = userEvent.setup();
    const printSpy = vi
      .spyOn(window, "print")
      .mockImplementation(() => undefined);
    const publicUrl = "https://example.com/e/one-time-token";

    render(<AdminLinkManagerPanel />);

    expect(
      screen.queryByRole("button", { name: "In nhãn mã QR" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /nurse@example\.com/ }),
    );
    await user.click(screen.getByRole("button", { name: "Tạo liên kết chờ" }));

    const qrLabel = await screen.findByRole("region", {
      name: "Nhãn mã QR liên kết hồ sơ",
    });
    expect(QRCode.toString).toHaveBeenCalledWith(
      publicUrl,
      expect.objectContaining({
        type: "svg",
        errorCorrectionLevel: "H",
      }),
    );
    expect(
      within(qrLabel).getByRole("img", { name: /Mã QR tĩnh/ }),
    ).toBeInTheDocument();
    expect(
      within(qrLabel).getByText(/mã QR tĩnh chứa liên kết truy cập một lần/i),
    ).toBeInTheDocument();
    expect(qrLabel).not.toHaveTextContent(publicUrl);

    await user.click(
      within(qrLabel).getByRole("button", { name: "In nhãn mã QR" }),
    );
    expect(printSpy).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole("button", { name: /nurse@example\.com/ }),
    );
    expect(
      screen.queryByRole("button", { name: "In nhãn mã QR" }),
    ).not.toBeInTheDocument();

    printSpy.mockRestore();
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

  it("renders 'Gắn vào phôi thẻ →' button for pending links", async () => {
    const user = userEvent.setup();
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
                    id: "link-pending-1",
                    purpose: "card",
                    label: "Thẻ khẩn cấp mới",
                    status: "pending",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                ],
              },
            }
          : { isPending: false, error: undefined, data: undefined };
      },
    );

    render(<AdminLinkManagerPanel />);
    await user.click(
      screen.getByRole("button", { name: /nurse@example\.com/ }),
    );

    expect(screen.getByText("Thẻ khẩn cấp mới")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gắn vào phôi thẻ →" }),
    ).toBeInTheDocument();
  });
});


import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StandaloneLinksPanel } from "./standalone-links";

const useMutationMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const clearSessionCacheMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: (...args: unknown[]) => useMutationMock(...args),
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  };
});

vi.mock("../session", () => ({
  useSession: () => ({ clearSessionCache: clearSessionCacheMock }),
}));

beforeEach(() => {
  useMutationMock.mockImplementation((config: { onSuccess?: (value: any) => void }) => ({
    isPending: false,
    error: undefined,
    mutate: () => config.onSuccess?.({ action: "preview", status: "active", public_url: "https://app.example/e/preview" }),
  }));
});

afterEach(() => {
  useMutationMock.mockReset();
  invalidateQueriesMock.mockReset();
  clearSessionCacheMock.mockReset();
});

describe("StandaloneLinksPanel", () => {
  it("renders standalone link controls and copies the last URL", async () => {
    const user = userEvent.setup();

    render(<StandaloneLinksPanel />);

    expect(screen.getByRole("heading", { name: "Liên kết công khai riêng" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem trước công khai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cấp lại liên kết" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vô hiệu hóa" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xem trước công khai" }));
    expect(screen.getByText("https://app.example/e/preview")).toBeInTheDocument();
  });
});

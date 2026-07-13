import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePageRoot } from ".";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const assignLocationMock = vi.fn();
const clearSessionCacheMock = vi.fn();
const previewLinkMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useMutation: (...args: unknown[]) => useMutationMock(...args),
    useQueryClient: () => ({ setQueryData: vi.fn() }),
  };
});

vi.mock("../../lib/navigation", () => ({
  assignLocation: (...args: unknown[]) => assignLocationMock(...args),
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
  useSession: () => ({ clearSessionCache: clearSessionCacheMock }),
}));

afterEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
  assignLocationMock.mockReset();
  clearSessionCacheMock.mockReset();
  previewLinkMock.mockReset();
});

describe("ProfilePageRoot", () => {
  it("creates and opens a preview link", async () => {
    useQueryMock.mockReturnValue({
      isPending: false,
      error: undefined,
      data: {
        profile: {
          display_name: "Alex Example",
          birth_year: 1995,
          gender: "female",
          blood_type: "O+",
          critical_allergies: [],
          important_conditions: [],
          critical_medications: [],
          emergency_note: null,
          emergency_contacts: [],
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        readiness: {
          status: "ready",
          missing_fields: [],
          required_contact_count: 1,
          completed_required_field_count: 5,
          total_required_field_count: 5,
        },
      },
    });
    useMutationMock.mockReturnValue({ isPending: false, mutateAsync: previewLinkMock });
    previewLinkMock.mockResolvedValue({ public_url: "https://app.example/e/demo-token" });

    render(<ProfilePageRoot />);

    screen.getByRole("button", { name: "Xem trước trang khẩn cấp" }).click();

    await waitFor(() => {
      expect(previewLinkMock).toHaveBeenCalledTimes(1);
      expect(assignLocationMock).toHaveBeenCalledWith("https://app.example/e/demo-token");
    });
  });
});

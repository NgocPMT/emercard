import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePageRoot } from ".";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const assignLocationMock = vi.fn();
const clearSessionCacheMock = vi.fn();

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
});

describe("ProfilePageRoot", () => {
  it("renders the in-page emergency preview without navigation", () => {
    useQueryMock.mockReturnValue({
      isPending: false,
      error: undefined,
      data: {
        profile: {
          profile_id: "profile-test-1",
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
    useMutationMock.mockReturnValue({ isPending: false, error: undefined, mutateAsync: vi.fn() });

    render(<ProfilePageRoot />);

    expect(screen.getByRole("heading", { name: "Hồ sơ y tế" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Xem trước trang khẩn cấp" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alex Example" })).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
    expect(screen.getByText("Dị ứng quan trọng", { selector: "dt" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem trước trang khẩn cấp" })).not.toBeInTheDocument();
    expect(assignLocationMock).not.toHaveBeenCalled();
  });

  it("renders subtle placeholder for unprovided blood type without breaking layout", () => {
    useQueryMock.mockReturnValue({
      isPending: false,
      error: undefined,
      data: {
        profile: {
          profile_id: "profile-test-2",
          display_name: null,
          birth_year: null,
          gender: null,
          blood_type: null,
          critical_allergies: [],
          important_conditions: [],
          critical_medications: [],
          emergency_note: null,
          emergency_contacts: [],
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        readiness: {
          status: "draft",
          missing_fields: ["display_name", "emergency_contacts"],
          required_contact_count: 1,
          completed_required_field_count: 0,
          total_required_field_count: 5,
        },
      },
    });
    useMutationMock.mockReturnValue({ isPending: false, error: undefined, mutateAsync: vi.fn() });

    render(<ProfilePageRoot />);

    expect(screen.getByText("Chưa cung cấp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chỉnh Sửa Hồ Sơ Y Tế" })).toBeInTheDocument();
  });
});

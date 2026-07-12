import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from ".";

describe("layout account menu", () => {
  it("renders a sign-out button", async () => {
    const onSignOut = vi.fn();
    render(<AccountMenu onSignOut={onSignOut} />);

    await screen.getByRole("button", { name: "Đăng xuất" }).click();
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

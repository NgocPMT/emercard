import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, TextInput } from ".";

describe("primitives", () => {
  it("associates labels with inputs", () => {
    const { getByLabelText } = render(<TextInput label="Email" type="email" />);
    expect(getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders accessible buttons", () => {
    const { getByRole } = render(<Button>Tiếp tục</Button>);
    expect(getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  });
});

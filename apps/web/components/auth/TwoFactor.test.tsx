import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, isLocaleReady: true, i18n: { language: "en" } }),
}));

import TwoFactor from "./TwoFactor";

function LoginForm() {
  const methods = useForm<{ totpCode: string }>({ defaultValues: { totpCode: "" } });
  return (
    <FormProvider {...methods}>
      <TwoFactor />
      <output data-testid="code">{methods.watch("totpCode")}</output>
    </FormProvider>
  );
}

function digitInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="2fa"]'));
}

describe("TwoFactor", () => {
  it("renders six digit inputs and the instructions", () => {
    render(<LoginForm />);

    expect(digitInputs()).toHaveLength(6);
    expect(screen.getByText("2fa_code")).toBeInTheDocument();
    expect(screen.getByText("2fa_enabled_instructions")).toBeInTheDocument();
  });

  it("collects the typed digits into the totpCode form field and advances focus", () => {
    render(<LoginForm />);
    const inputs = digitInputs();

    inputs[0].focus();
    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(document.activeElement).toBe(inputs[1]);
    fireEvent.change(inputs[1], { target: { value: "2" } });
    fireEvent.change(inputs[2], { target: { value: "3" } });
    fireEvent.change(inputs[3], { target: { value: "4" } });
    fireEvent.change(inputs[4], { target: { value: "5" } });
    fireEvent.change(inputs[5], { target: { value: "6" } });

    expect(digitInputs().map((i) => i.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(screen.getByTestId("code")).toHaveTextContent("123456");
  });

  it("spreads a pasted code across the inputs and ignores non-digits", () => {
    render(<LoginForm />);
    const inputs = digitInputs();

    fireEvent.change(inputs[0], { target: { value: "98a76-54" } });

    expect(digitInputs().map((i) => i.value)).toEqual(["9", "8", "7", "6", "5", "4"]);
    expect(screen.getByTestId("code")).toHaveTextContent("987654");
  });

  it("removes a digit with backspace", () => {
    render(<LoginForm />);
    const inputs = digitInputs();

    fireEvent.change(inputs[0], { target: { value: "123456" } });
    fireEvent.keyDown(digitInputs()[5], { key: "Backspace" });

    expect(digitInputs().map((i) => i.value)).toEqual(["1", "2", "3", "4", "5", ""]);
  });
});

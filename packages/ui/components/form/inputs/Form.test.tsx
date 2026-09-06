import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, isLocaleReady: true, i18n: { language: "en", exists: () => false } }),
}));

import { Form } from "./Form";
import { HintsOrErrors } from "./HintOrErrors";
import { TextField } from "./TextField";

type Values = { email: string; username: string };

function ProfileForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const form = useForm<Values>({ defaultValues: { email: "", username: "" } });
  return (
    <Form form={form} handleSubmit={onSubmit} data-testid="profile-form">
      <TextField label="Email" {...form.register("email", { required: "email_required" })} />
      <TextField
        label="Username"
        hintErrors={["min_length"]}
        {...form.register("username", {
          validate: { min_length: (value) => value.length >= 3 },
        })}
      />
      <HintsOrErrors fieldName="email" t={(key) => key} />
      <button type="submit">Save</button>
    </Form>
  );
}

describe("Form", () => {
  it("submits the registered field values", async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: "alice@example.com", username: "alice" });
  });

  it("blocks submission and renders the field errors when validation fails", async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "al" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // the required message is rendered by the standalone HintsOrErrors and by the field itself
    await waitFor(() => expect(screen.getAllByText("email_required").length).toBeGreaterThan(0));
    expect(onSubmit).not.toHaveBeenCalled();
    // the username hint turns into an error after a submit attempt
    const hint = screen.getByTestId("hint-error");
    expect(hint).toHaveTextContent("username_hint_min_length");
    expect(hint).toHaveClass("text-error");
  });

  it("renders hints as satisfied once the field is valid", async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByText("username_hint_min_length")).toHaveClass("text-green-600");
  });
});

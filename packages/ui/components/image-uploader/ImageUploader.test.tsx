import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, values?: Record<string, string>) => (values?.target ? `${key}:${values.target}` : key),
    isLocaleReady: true,
    i18n: { language: "en" },
  }),
}));

import ImageUploader from "./ImageUploader";

// 1x1 transparent PNG
const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("ImageUploader", () => {
  it("shows the crop editor with the chosen image once a file is picked", async () => {
    const handleAvatarChange = vi.fn();
    render(
      <ImageUploader id="avatar-upload" buttonMsg="Change avatar" target="avatar" handleAvatarChange={handleAvatarChange} />
    );

    fireEvent.click(screen.getByTestId("open-upload-avatar-dialog"));
    expect(screen.getByText("no_target:avatar")).toBeInTheDocument();

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("no file input");
    const file = new File([PNG_BYTES], "avatar.png", { type: "image/png" });
    fireEvent.input(fileInput, { target: { files: [file] } });

    // the FileReader hands the data url to the crop container
    await waitFor(() => expect(document.querySelector(".crop-container img")).not.toBeNull());
    const cropImage = document.querySelector<HTMLImageElement>(".crop-container img");
    expect(document.querySelector('.crop-container [role="slider"]')).toHaveAttribute("aria-valuenow", "1");
    expect(cropImage?.src.startsWith("data:image/png;base64,")).toBe(true);
    expect(screen.queryByText("no_target:avatar")).not.toBeInTheDocument();
    expect(handleAvatarChange).not.toHaveBeenCalled();
  });

  it("does not open the dialog while disabled", () => {
    render(
      <ImageUploader id="avatar-upload" buttonMsg="Change avatar" target="avatar" handleAvatarChange={vi.fn()} disabled />
    );

    const trigger = screen.getByTestId("open-upload-avatar-dialog");
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByText("no_target:avatar")).not.toBeInTheDocument();
  });
});

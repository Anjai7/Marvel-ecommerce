import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ActiveToggle, EditorTable, ImageField, OrderControls, slugify } from "./ContentEditorKit";
import { apiUploadImage } from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiUploadImage: vi.fn(),
}));

const imageFile = () => new File(["pixels"], "banner.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slugify", () => {
  it("lowercases and collapses every non-alphanumeric run to one hyphen", () => {
    expect(slugify("Men's Fashion")).toBe("men-s-fashion");
    expect(slugify("Home & Kitchen")).toBe("home-kitchen");
    expect(slugify("  Smartphones  ")).toBe("smartphones");
    expect(slugify("Wi-Fi / Routers")).toBe("wi-fi-routers");
  });
});

describe("ImageField", () => {
  it("renders the current value", () => {
    render(
      <ImageField
        label="Banner image"
        value="https://cdn.example.com/banner.jpg"
        onChange={vi.fn()}
        folder="marvel_content"
      />
    );

    expect(screen.getByText("https://cdn.example.com/banner.jpg")).toBeVisible();
    expect(screen.getByText("Banner image")).toBeVisible();
  });

  it("uploads a selected file and passes the returned url to onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    apiUploadImage.mockResolvedValue({
      url: "https://cdn.example.com/uploaded.png",
      public_id: "marvel_content/uploaded",
    });

    const { container } = render(
      <ImageField label="Banner image" value={null} onChange={onChange} folder="marvel_content" />
    );

    await user.click(screen.getByRole("button", { name: "Upload Banner image" }));
    await user.upload(container.querySelector('input[type="file"]'), imageFile());

    await waitFor(() =>
      expect(apiUploadImage).toHaveBeenCalledWith(expect.any(File), "marvel_content")
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/uploaded.png")
    );
  });

  it("shows the upload error and never calls onChange when the upload fails", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    apiUploadImage.mockRejectedValue(new Error("Cloudinary rejected the upload."));

    const { container } = render(
      <ImageField label="Banner image" value={null} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "Upload Banner image" }));
    await user.upload(container.querySelector('input[type="file"]'), imageFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("Cloudinary rejected the upload.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value with onChange(null)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ImageField label="Banner image" value="https://cdn.example.com/a.jpg" onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "Clear Banner image" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("OrderControls", () => {
  it("moves up and down by one adjacent index", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();

    render(<OrderControls index={1} total={3} onMove={onMove} />);

    await user.click(screen.getByRole("button", { name: "Move up" }));
    expect(onMove).toHaveBeenCalledWith(1, 0);

    await user.click(screen.getByRole("button", { name: "Move down" }));
    expect(onMove).toHaveBeenCalledWith(1, 2);
  });

  it("disables the boundary directions", () => {
    const { rerender } = render(<OrderControls index={0} total={3} onMove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();

    rerender(<OrderControls index={2} total={3} onMove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Move up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
  });
});

describe("ActiveToggle", () => {
  it("reflects active with aria-pressed and calls back with the inverted value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ActiveToggle active={false} onChange={onChange} />);

    const toggle = screen.getByRole("button", { name: /activate/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("EditorTable", () => {
  const row = { id: "r1", name: "Electronics", slug: "electronics", is_active: true };

  it("renders headers from columns and a row per item with its actions", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onToggleActive = vi.fn();

    render(
      <EditorTable
        columns={["name", "slug"]}
        rows={[row]}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onToggleActive={onToggleActive}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Slug" })).toBeVisible();
    expect(screen.getByText("electronics")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));
    expect(onEdit).toHaveBeenCalledWith(row);

    await user.click(screen.getByRole("button", { name: "Deactivate Electronics" }));
    expect(onToggleActive).toHaveBeenCalledWith(row);
  });

  it("deletes only after the confirm dialog is confirmed", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <EditorTable
        columns={["name"]}
        rows={[row]}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onToggleActive={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete Electronics" }));
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    expect(onDelete).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(row);
  });
});

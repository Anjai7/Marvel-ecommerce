// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
});

const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn(async (buffer, folder) => ({
    url: `https://cdn.test/${folder}/image.png`,
    public_id: `${folder}/image`,
    format: "png",
    bytes: buffer.length,
  })),
}));

vi.mock("../db.js", () => ({ supabase: { from: vi.fn() } }));
vi.mock("../services/cloudinary.js", () => ({
  uploadBufferToCloudinary: mockUpload,
  isConfigured: false,
}));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

let server;
let base;

function headersFor(role) {
  const token = signUserToken({ id: `${role}-1`, email: `${role}@test.local`, role });
  return { Authorization: `Bearer ${token}` };
}

function imageForm(fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append(
    "image",
    new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    "pixel.png"
  );
  return form;
}

beforeAll(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  mockUpload.mockClear();
});

describe("POST /api/upload authorization", () => {
  it("rejects an unauthenticated upload with 401 and uploads nothing", async () => {
    const res = await fetch(`${base}/api/upload`, { method: "POST", body: imageForm() });

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBeTruthy();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects a user-role upload with 403 and uploads nothing", async () => {
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: headersFor("user"),
      body: imageForm(),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Forbidden/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it.each(["admin", "super_admin", "vendor"])("allows a %s upload", async (role) => {
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: headersFor(role),
      body: imageForm(),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/upload folder whitelist", () => {
  it("passes an allowed folder through", async () => {
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: headersFor("admin"),
      body: imageForm({ folder: "marvel_content" }),
    });

    expect(res.status).toBe(200);
    expect(mockUpload.mock.calls[0][1]).toBe("marvel_content");
  });

  it.each(["../../etc", "marvel_content/../secret", "some-random-folder", ""])(
    "falls back to the default folder for %s",
    async (folder) => {
      const res = await fetch(`${base}/api/upload`, {
        method: "POST",
        headers: headersFor("admin"),
        body: imageForm({ folder }),
      });

      expect(res.status).toBe(200);
      expect(mockUpload.mock.calls[0][1]).toBe("marvel_products");
    }
  );
});

describe("upload error handling", () => {
  it("returns a JSON 400 when multer rejects a non-image file", async () => {
    const form = new FormData();
    form.append("image", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");

    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: headersFor("admin"),
      body: form,
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "Only image files are allowed." });
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

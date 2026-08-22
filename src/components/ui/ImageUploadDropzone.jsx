import { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, CheckCircle2, Loader2, Link as LinkIcon } from "lucide-react";
import { apiUploadImage } from "../../api/backendApi";
import { Button, Input } from "./index";

export default function ImageUploadDropzone({ value, onChange, folder = "marvel_products" }) {
  const [mode, setMode] = useState("file"); // "file" | "url"
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(value || "");
  const fileInputRef = useRef(null);

  const handleFileSelect = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP, etc.).");
      return;
    }

    // Local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const res = await apiUploadImage(file, folder);
      if (res.url) {
        setPreview(res.url);
        onChange(res.url);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert(err.message || "Failed to upload to Cloudinary.");
      setPreview(value || "");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setPreview("");
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
          Product Image (Cloudinary CDN)
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setMode("file")}
            style={{
              background: mode === "file" ? "#f1f5f9" : "transparent",
              border: "none",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: mode === "file" ? 700 : 500,
              color: mode === "file" ? "#0f172a" : "#64748b",
              cursor: "pointer"
            }}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            style={{
              background: mode === "url" ? "#f1f5f9" : "transparent",
              border: "none",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: mode === "url" ? 700 : 500,
              color: mode === "url" ? "#0f172a" : "#64748b",
              cursor: "pointer"
            }}
          >
            Paste URL
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <Input
          type="url"
          placeholder="https://res.cloudinary.com/... or image link"
          value={value || ""}
          onChange={(e) => {
            setPreview(e.target.value);
            onChange(e.target.value);
          }}
          leftIcon={<LinkIcon size={16} />}
        />
      ) : (
        <div>
          {preview ? (
            <div style={{
              position: "relative",
              width: "100%",
              height: 160,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #cbd5e1",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <img
                src={preview}
                alt="Product preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />

              {uploading && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  gap: 8
                }}>
                  <Loader2 size={24} className="animate-spin" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Uploading to Cloudinary...</span>
                </div>
              )}

              {!uploading && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: dragOver ? "2px dashed #7c3aed" : "2px dashed #cbd5e1",
                background: dragOver ? "#f3e8ff" : "#f8fafc",
                borderRadius: 12,
                padding: "24px 16px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                style={{ display: "none" }}
              />
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#ede9fe",
                color: "#7c3aed",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8
              }}>
                <UploadCloud size={22} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                Click to upload or drag & drop image
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                PNG, JPG, WebP up to 10MB (Stores on Cloudinary CDN)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { apiUploadImage } from "../../api/backendApi";
import { Button, Input } from "./index";
import "./ui-primitives.css";

export default function ImageUploadDropzone({
  value,
  onChange,
  folder = "marvel_products",
  upload = apiUploadImage,
  onError,
}) {
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
      const res = await upload(file, folder);
      if (res.url) {
        setPreview(res.url);
        onChange(res.url);
      }
    } catch (err) {
      const message = err?.message || "Failed to upload to Cloudinary.";
      if (onError) {
        onError(message);
      } else {
        console.error("Upload failed:", err);
        alert(message);
      }
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
    <div className="field-stack">
      <div className="field-header">
        <label className="field-label">Product Image (Cloudinary CDN)</label>
        <div className="button-group">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={mode === "file" ? "segment-button is-active" : "segment-button"}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={mode === "url" ? "segment-button is-active" : "segment-button"}
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
            <div className="dropzone-preview">
              <img src={preview} alt="Product preview" className="dropzone-preview-image" />

              {uploading && (
                <div className="dropzone-overlay">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="dropzone-overlay-label">Uploading to Cloudinary...</span>
                </div>
              )}

              {!uploading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="dropzone-preview-clear"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={dragOver ? "dropzone is-dragging" : "dropzone"}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden-file-input"
              />
              <div className="dropzone-icon">
                <UploadCloud size={22} />
              </div>
              <div className="dropzone-title">Click to upload or drag & drop image</div>
              <div className="dropzone-hint">
                PNG, JPG, WebP up to 10MB (Stores on Cloudinary CDN)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

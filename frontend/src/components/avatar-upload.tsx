"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import PersonIcon from "@mui/icons-material/Person";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { toastError } from "./ui";
import { uploadDirect } from "@/lib/uploads";

const MAX_IMAGE_SIZE = 1_500_000;

export function AvatarUpload({
  value,
  onChange,
  disabled,
  size = 72,
  shape = "circular",
  placeholderIcon,
  folder = "avatars",
}: {
  /** Final image URL (e.g. Cloudflare Images), null when none is set. */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  size?: number;
  shape?: "circular" | "rounded" | "square";
  placeholderIcon?: ReactNode;
  /** Upload folder used when requesting a direct upload URL. */
  folder?: string;
}) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toastError(t("selectImageFile"));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toastError(t("imageTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const url = await uploadDirect(file, folder);
      onChange(url);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const radius = shape === "circular" ? "50%" : shape === "rounded" ? 8 : 0;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label={t("uploadImage")}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (!disabled && !uploading && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openPicker();
          }
        }}
        sx={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          cursor: disabled || uploading ? "default" : "pointer",
          ...(disabled || uploading
            ? {}
            : {
                "&:hover .avatar-upload-overlay": { opacity: 1 },
                "&:focus-visible": { outline: "2px solid #6366f1", outlineOffset: 2 },
              }),
        }}
      >
        <Avatar
          variant={shape}
          src={value ?? undefined}
          sx={{ width: size, height: size, bgcolor: "#eef2ff", color: "#4f46e5" }}
        >
          {!value && (placeholderIcon ?? <PersonIcon sx={{ fontSize: size * 0.5 }} />)}
        </Avatar>
        {uploading ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(15,23,42,0.55)",
              borderRadius: "inherit",
            }}
          >
            <CircularProgress size={size * 0.35} sx={{ color: "#fff" }} />
          </Box>
        ) : (
          !disabled && (
            <Box
              className="avatar-upload-overlay"
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(15,23,42,0.55)",
                borderRadius: "inherit",
                opacity: 0,
                transition: "opacity 0.15s ease",
                pointerEvents: "none",
              }}
            >
              <PhotoCameraIcon sx={{ color: "#fff", fontSize: size * 0.32 }} />
            </Box>
          )
        )}
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => void handleFile(event)}
      />
    </Stack>
  );
}
"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import PersonIcon from "@mui/icons-material/Person";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { toastError } from "./ui";

const MAX_IMAGE_SIZE = 1_500_000;

export function AvatarUpload({
  value,
  onChange,
  disabled,
  size = 72,
  shape = "circular",
  placeholderIcon,
}: {
  /** Data URL while unsaved, uploaded URL after save. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  size?: number;
  shape?: "circular" | "rounded" | "square";
  placeholderIcon?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPending = value?.startsWith("data:") ?? false;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toastError("Please select an image file (png, jpeg, webp)");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toastError("Image must be smaller than 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const radius = shape === "circular" ? "50%" : shape === "rounded" ? 8 : 0;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload image"
        onClick={openPicker}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
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
          cursor: disabled ? "default" : "pointer",
          ...(disabled
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
        {!disabled && (
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
        )}
      </Box>
      {!disabled && isPending && (
        <Button size="small" variant="text" color="error" onClick={() => onChange(null)}>
          Remove
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
    </Stack>
  );
}
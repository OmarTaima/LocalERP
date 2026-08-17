"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import PersonIcon from "@mui/icons-material/Person";
import UploadIcon from "@mui/icons-material/Upload";
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

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar
        variant={shape}
        src={value ?? undefined}
        sx={{ width: size, height: size, bgcolor: "#eef2ff", color: "#4f46e5", flexShrink: 0 }}
      >
        {!value && (placeholderIcon ?? <PersonIcon sx={{ fontSize: size * 0.5 }} />)}
      </Avatar>
      {!disabled && (
        <>
          <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => inputRef.current?.click()}>
            Upload
          </Button>
          {isPending && (
            <Button size="small" variant="text" color="error" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        </>
      )}
    </Stack>
  );
}
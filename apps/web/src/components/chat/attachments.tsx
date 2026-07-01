import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, FileText, Loader2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import type { FileAttachment } from "@mosaic-dock/shared";
import { Button } from "../ui/button";

export interface ComposerAttachment {
  id: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  uploaded?: FileAttachment;
  error?: string;
  previewUrl?: string;
}

interface MessageAttachmentsProps {
  files?: FileAttachment[];
  align?: "left" | "right";
}

interface ComposerAttachmentsProps {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}

export function MessageAttachments({ files = [], align = "left" }: MessageAttachmentsProps) {
  if (files.length === 0) return null;

  return (
    <div className={align === "right" ? "mt-2 flex flex-wrap justify-end gap-2" : "mt-2 flex flex-wrap gap-2"}>
      {files.map((file, index) => (
        <AttachmentPreview key={getAttachmentKey(file, index)} file={file} />
      ))}
    </div>
  );
}

export function ComposerAttachments({ attachments, onRemove }: ComposerAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="-mx-1 mb-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const file = toFileAttachment(attachment);
        return (
          <div key={attachment.id} className="relative">
            <AttachmentPreview file={file} />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute -right-2 -top-2 h-5 w-5 rounded-full border bg-white p-0 shadow-sm"
              aria-label={`移除 ${getAttachmentName(file)}`}
              onClick={() => onRemove(attachment.id)}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
            {attachment.status === "uploading" ? (
              <span className="absolute inset-0 grid place-items-center rounded-lg bg-white/70">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-label={`${getAttachmentName(file)} 上传中`} />
              </span>
            ) : null}
            {attachment.status === "error" ? (
              <span className="absolute inset-0 grid place-items-center rounded-lg bg-red-50/90 text-red-500">
                <AlertCircle className="h-4 w-4" aria-label={`${getAttachmentName(file)} 上传失败`} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AttachmentPreview({ file }: { file: FileAttachment }) {
  const name = getAttachmentName(file);
  const size = getAttachmentSize(file);
  const imageUrl = getImageUrl(file);
  const fullImageUrl = getFullImageUrl(file);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (imageUrl) {
    return (
      <>
        <button
          type="button"
          aria-label={`预览图片 ${name}`}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-opacity hover:opacity-90"
          onClick={() => setPreviewOpen(true)}
        >
          <img src={imageUrl} alt={name} className="h-16 w-16 object-cover" />
        </button>
        {previewOpen ? (
          <ImagePreviewDialog
            imageUrl={fullImageUrl ?? imageUrl}
            name={name}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="inline-flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-600 shadow-sm">
      <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-700">{name}</span>
        {size ? <span className="block text-slate-400">{formatFileSize(size)}</span> : null}
      </span>
    </div>
  );
}

function toFileAttachment(attachment: ComposerAttachment): FileAttachment {
  return {
    id: attachment.uploaded?.id ?? attachment.id,
    name: attachment.file.name,
    displayName: attachment.uploaded?.displayName ?? attachment.file.name,
    fileName: attachment.uploaded?.fileName ?? attachment.file.name,
    fileType: attachment.uploaded?.fileType ?? (attachment.file.type.startsWith("image/") ? "image" : "text"),
    fileExtension: attachment.uploaded?.fileExtension,
    fileSize: attachment.uploaded?.fileSize ?? attachment.file.size,
    size: attachment.uploaded?.size ?? attachment.file.size,
    url: attachment.uploaded?.url,
    previewUrl: attachment.uploaded?.previewUrl ?? attachment.previewUrl,
    type: attachment.uploaded?.type ?? attachment.file.type,
  };
}

function getAttachmentKey(file: FileAttachment, index: number): string {
  return file.id ?? file.url ?? file.previewUrl ?? `${getAttachmentName(file)}-${index}`;
}

function getAttachmentName(file: FileAttachment): string {
  return file.displayName ?? file.name ?? file.fileName ?? "附件";
}

function getAttachmentSize(file: FileAttachment): number | undefined {
  return file.fileSize ?? file.size;
}

function getImageUrl(file: FileAttachment): string | null {
  const type = file.fileType ?? file.type ?? "";
  if (type !== "image" && !type.startsWith("image/")) return null;
  return file.previewUrl || file.url || null;
}

function getFullImageUrl(file: FileAttachment): string | null {
  const type = file.fileType ?? file.type ?? "";
  if (type !== "image" && !type.startsWith("image/")) return null;
  return file.url || file.previewUrl || null;
}

function ImagePreviewDialog({
  imageUrl,
  name,
  onClose,
}: {
  imageUrl: string;
  name: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-label="图片预览"
      className="fixed inset-0 z-1000 flex items-center justify-center bg-black/70 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="关闭图片预览"
        className="absolute right-6 top-6 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        onClick={onClose}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img
        src={imageUrl}
        alt={`${name} 预览`}
        className="max-h-[88vh] max-w-[88vw] object-contain transition-transform duration-150"
        style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
        onClick={(event) => event.stopPropagation()}
      />
      <div
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-3 py-2 text-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <PreviewToolButton
          label="缩小图片"
          onClick={() => setScale((current) => Math.max(0.25, Number((current - 0.25).toFixed(2))))}
        >
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </PreviewToolButton>
        <span className="min-w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <PreviewToolButton
          label="放大图片"
          onClick={() => setScale((current) => Math.min(4, Number((current + 0.25).toFixed(2))))}
        >
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </PreviewToolButton>
        <span className="mx-1 h-4 w-px bg-white/25" aria-hidden="true" />
        <PreviewToolButton label="顺时针旋转" onClick={() => setRotation((current) => current + 90)}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </PreviewToolButton>
      </div>
    </div>,
    document.body,
  );
}

function PreviewToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-white/15"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

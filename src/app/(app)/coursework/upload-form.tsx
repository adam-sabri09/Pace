"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadCourseworkAction, type CourseworkItem } from "@/server/actions/coursework";
import { DriveImportButton } from "@/components/coursework/drive-import-button";

export function CourseworkUploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
    setError(null);
  }

  function handleDriveImport(item: CourseworkItem) {
    router.push(`/coursework/${item.id}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    const fd = new FormData();
    fd.append("coursework", file);
    setError(null);

    startTransition(async () => {
      const result = await uploadCourseworkAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/coursework/${result.item.id}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest flex flex-col gap-stack-sm"
    >
      <h2 className="font-headline-md text-headline-md text-on-surface">Upload study material</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        PDF, JPEG, PNG, or plain text · max 5 MB
      </p>

      {/* File picker */}
      <label className="flex items-center gap-3 cursor-pointer">
        <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
          attach_file
        </span>
        <span className="font-body-md text-body-md text-on-surface-variant flex-1 truncate">
          {fileName ?? "Choose a file…"}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
          onChange={handleFileChange}
          className="sr-only"
        />
        <span className="font-label-md text-label-md border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface hover:bg-surface-container-low transition-colors">
          Browse
        </span>
      </label>

      {error && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !fileName}
        className="self-start bg-primary text-on-primary font-label-lg text-label-lg px-6 py-2.5 rounded-full disabled:opacity-50 transition-opacity"
      >
        {isPending ? "Extracting content…" : "Upload and analyse"}
      </button>

      <div className="flex items-center gap-3 pt-2">
        <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
        <span className="font-label-sm text-label-sm text-outline">or</span>
        <span className="flex-1 h-px bg-outline-variant" aria-hidden="true" />
      </div>

      <DriveImportButton onImported={handleDriveImport} />
    </form>
  );
}

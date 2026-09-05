"use client";

import { useRef, useState } from "react";
import { importFromDriveAction } from "@/server/actions/drive";
import type { CourseworkItem } from "@/server/actions/coursework";

// Injected by the Google API loader (gapi) and Google Identity Services (GIS).
declare global {
  interface Window {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
      client?: { init: (opts: object) => Promise<void> };
    };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new () => GoogleDocsView;
        Action: { PICKED: string; CANCEL: string };
        ViewId: { DOCS: string };
      };
    };
  }
  interface GooglePickerBuilder {
    addView(view: GoogleDocsView): GooglePickerBuilder;
    setOAuthToken(token: string): GooglePickerBuilder;
    setDeveloperKey(key: string): GooglePickerBuilder;
    setCallback(cb: (data: GooglePickerResult) => void): GooglePickerBuilder;
    setTitle(title: string): GooglePickerBuilder;
    build(): { setVisible: (v: boolean) => void };
  }
  interface GoogleDocsView {
    setMimeTypes(types: string): GoogleDocsView;
  }
  interface GooglePickerResult {
    action: string;
    docs?: Array<{ id: string; name: string; mimeType: string }>;
  }
}

interface Props {
  onImported: (item: CourseworkItem) => void;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/vnd.google-apps.document",
].join(",");

/**
 * "Import from Google Drive" button.
 *
 * Loads the Google API (gapi) and Google Identity Services (GIS) scripts on
 * first click, then opens the Google Picker for file selection.
 * The access token is short-lived and used only for the download — it is never
 * stored or logged.
 *
 * Requires: NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY
 * See docs/google-oauth-setup.md for setup instructions.
 */
export function DriveImportButton({ onImported }: Props) {
  const [status, setStatus] = useState<
    "idle" | "loading-scripts" | "picking" | "downloading" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const gapiLoaded = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  // Check config — button is hidden when env vars are missing.
  if (!clientId || !apiKey) return null;

  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });

  const openPicker = (accessToken: string) => {
    if (!window.google?.picker || !window.gapi) {
      setErrorMsg("Google Drive is not ready. Please try again.");
      setStatus("error");
      return;
    }
    const view = new window.google.picker.DocsView().setMimeTypes(ALLOWED_MIME_TYPES);
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setTitle("Select a study file")
      .setCallback(async (data) => {
        if (data.action === window.google!.picker.Action.CANCEL) {
          setStatus("idle");
          return;
        }
        if (data.action === window.google!.picker.Action.PICKED && data.docs?.[0]) {
          const doc = data.docs[0];
          setStatus("downloading");
          const result = await importFromDriveAction({
            fileId: doc.id,
            accessToken,
            fileName: doc.name,
            mimeType: doc.mimeType,
          });
          if (result.ok) {
            onImported(result.item);
            setStatus("idle");
          } else {
            setErrorMsg(result.error);
            setStatus("error");
          }
        }
      })
      .build();
    picker.setVisible(true);
    setStatus("picking");
  };

  const handleClick = async () => {
    setStatus("loading-scripts");
    setErrorMsg(null);
    try {
      await Promise.all([
        loadScript("https://apis.google.com/js/api.js"),
        loadScript("https://accounts.google.com/gsi/client"),
      ]);

      if (!gapiLoaded.current) {
        await new Promise<void>((resolve) =>
          window.gapi!.load("picker", () => {
            gapiLoaded.current = true;
            resolve();
          }),
        );
      }

      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (response) => {
          if (response.error || !response.access_token) {
            setErrorMsg("Google authorisation cancelled or failed.");
            setStatus("error");
            return;
          }
          openPicker(response.access_token);
        },
      });

      tokenClient.requestAccessToken();
    } catch {
      setErrorMsg("Could not load Google Drive. Check your connection and try again.");
      setStatus("error");
    }
  };

  const isLoading = status === "loading-scripts" || status === "downloading";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || status === "picking"}
        aria-busy={isLoading}
        className="inline-flex items-center gap-2 font-label-md text-label-md text-on-surface-variant border border-outline-variant px-4 py-2.5 rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <DriveIcon />
        {status === "loading-scripts"
          ? "Loading…"
          : status === "downloading"
            ? "Importing…"
            : status === "picking"
              ? "Waiting for selection…"
              : "Import from Google Drive"}
      </button>
      {status === "error" && errorMsg && (
        <p role="alert" className="font-label-sm text-label-sm text-error">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function DriveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true" focusable="false">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H.01c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 00-1.2 4.5h27.5z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#EA4335"/>
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.85 0H34.45c-1.65 0-3.2.45-4.55 1.2z" fill="#00832D"/>
      <path d="M59.8 53H32.5L18.75 76.8c1.35.8 2.9 1.2 4.55 1.2h46.7c1.65 0 3.2-.45 4.55-1.2z" fill="#2684FC"/>
      <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00"/>
    </svg>
  );
}

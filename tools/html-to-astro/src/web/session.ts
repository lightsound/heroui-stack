import crypto from "node:crypto";
import fs from "node:fs";

import type { ExtractionManifest } from "../types.ts";

export type ConvertSession = {
  id: string;
  zipPath: string;
  tempDir: string;
  extractThreshold: number;
  manifest: ExtractionManifest;
  createdAt: number;
};

const SESSION_TTL_MS = 60 * 60 * 1000;
const sessions = new Map<string, ConvertSession>();

export function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
      sessions.delete(id);
    }
  }
}

export function createSession(options: {
  zipPath: string;
  tempDir: string;
  extractThreshold: number;
  manifest: ExtractionManifest;
}): ConvertSession {
  cleanupSessions();
  const session: ConvertSession = {
    id: crypto.randomUUID(),
    zipPath: options.zipPath,
    tempDir: options.tempDir,
    extractThreshold: options.extractThreshold,
    manifest: options.manifest,
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): ConvertSession | undefined {
  cleanupSessions();
  return sessions.get(id);
}

export function deleteSession(id: string): void {
  const session = sessions.get(id);
  if (session) {
    fs.rmSync(session.tempDir, { recursive: true, force: true });
    sessions.delete(id);
  }
}

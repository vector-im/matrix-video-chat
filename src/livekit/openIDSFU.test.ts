/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { expect, type MockInstance, test, vi } from "vitest";
import { type IOpenIDToken } from "matrix-js-sdk/src/client";
import { type LivekitFocus } from "matrix-js-sdk/src/matrixrtc";

import { getSFUConfigWithOpenID, type OpenIDClientParts } from "./openIDSFU";
import {
  AuthConnectionFailedError,
  AuthConnectionRejectedError,
} from "../RichError";

async function withFetchSpy(
  continuation: (fetchSpy: MockInstance<typeof fetch>) => Promise<void>,
): Promise<void> {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  try {
    await continuation(fetchSpy);
  } finally {
    fetchSpy.mockRestore();
  }
}

const mockClient: OpenIDClientParts = {
  getOpenIdToken: async () => Promise.resolve({} as IOpenIDToken),
  getDeviceId: () => "Device ID",
};
const mockFocus: LivekitFocus = {
  type: "livekit",
  livekit_alias: "LiveKit alias",
  livekit_service_url: "LiveKit service URL",
};

test("getSFUConfigWithOpenID gets the JWT token", async () => {
  await withFetchSpy(async (fetch) => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () =>
        Promise.resolve({ jwt: "JWT token", url: "LiveKit URL" }),
    } as Response);
    expect(await getSFUConfigWithOpenID(mockClient, mockFocus)).toEqual({
      jwt: "JWT token",
      url: "LiveKit URL",
    });
  });
});

test("getSFUConfigWithOpenID throws if connection fails", async () => {
  await withFetchSpy(async (fetch) => {
    fetch.mockRejectedValue(new Error("Connection failed"));
    await expect(async () =>
      getSFUConfigWithOpenID(mockClient, mockFocus),
    ).rejects.toThrowError(expect.any(AuthConnectionFailedError));
  });
});

test("getSFUConfigWithOpenID throws if endpoint is not found", async () => {
  await withFetchSpy(async (fetch) => {
    fetch.mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(async () =>
      getSFUConfigWithOpenID(mockClient, mockFocus),
    ).rejects.toThrowError(expect.any(AuthConnectionFailedError));
  });
});

test("getSFUConfigWithOpenID throws if endpoint returns error", async () => {
  await withFetchSpy(async (fetch) => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => Promise.resolve("Internal server error"),
    } as Response);
    await expect(async () =>
      getSFUConfigWithOpenID(mockClient, mockFocus),
    ).rejects.toThrowError(expect.any(AuthConnectionRejectedError));
  });
});

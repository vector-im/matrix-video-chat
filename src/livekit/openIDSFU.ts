/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type IOpenIDToken, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { useEffect, useState } from "react";
import { type LivekitFocus } from "matrix-js-sdk/src/matrixrtc/LivekitFocus";

import { useActiveLivekitFocus } from "../room/useActiveFocus";
import {
  FetchError,
  InvalidServerResponseError,
  ResourceNotFoundConfigurationError,
  UnexpectedResponseCodeError,
  URLBuildingConfigurationError,
} from "../RichError";

export interface SFUConfig {
  url: string;
  jwt: string;
}

export function sfuConfigEquals(a?: SFUConfig, b?: SFUConfig): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;

  return a.jwt === b.jwt && a.url === b.url;
}

// The bits we need from MatrixClient
export type OpenIDClientParts = Pick<
  MatrixClient,
  "getOpenIdToken" | "getDeviceId"
>;

export function useOpenIDSFU(
  client: OpenIDClientParts,
  rtcSession: MatrixRTCSession,
): SFUConfig | undefined {
  const [sfuConfig, setSFUConfig] = useState<SFUConfig | Error | undefined>(
    undefined,
  );

  const activeFocus = useActiveLivekitFocus(rtcSession);

  useEffect(() => {
    if (activeFocus) {
      getSFUConfigWithOpenID(client, activeFocus).then(
        (sfuConfig) => setSFUConfig(sfuConfig),
        (e) => setSFUConfig(e),
      );
    } else {
      setSFUConfig(undefined);
    }
  }, [client, activeFocus]);

  if (sfuConfig instanceof Error) throw sfuConfig;
  return sfuConfig;
}

export async function getSFUConfigWithOpenID(
  client: OpenIDClientParts,
  activeFocus: LivekitFocus,
): Promise<SFUConfig | undefined> {
  const openIdToken = await client.getOpenIdToken();
  logger.debug("Got openID token", openIdToken);

  logger.info(
    `Trying to get JWT from call's active focus URL of ${activeFocus.livekit_service_url}...`,
  );
  const sfuConfig = await getLiveKitJWT(
    client,
    activeFocus.livekit_service_url,
    activeFocus.livekit_alias,
    openIdToken,
  );
  logger.info(`Got JWT from call's active focus URL.`);

  return sfuConfig;
}

async function getLiveKitJWT(
  client: OpenIDClientParts,
  livekitServiceURL: string,
  roomName: string,
  openIDToken: IOpenIDToken,
): Promise<SFUConfig> {
  let url: URL;

  try {
    // TODO: check that relative URLs are handled as expected by this
    url = new URL("sfu/get", livekitServiceURL);
  } catch (e) {
    throw new URLBuildingConfigurationError(livekitServiceURL, e);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: roomName,
        openid_token: openIDToken,
        device_id: client.getDeviceId(),
      }),
    });
  } catch (e) {
    throw new FetchError(url, e);
  }
  if (!res.ok) {
    throw res.status === 404
      ? new ResourceNotFoundConfigurationError(url)
      : new UnexpectedResponseCodeError(url, res.status, await res.text());
  }

  try {
    const json = await res.json();
    if (typeof json.jwt !== "string") {
      // We don't need to check that the JWT is valid, because we pass it through to
      // the SFU opaquely.
      throw new Error("Invalid jwt field in server response: not string");
    }
    if (typeof json.url !== "string") {
      throw new Error("Invalid url field in server response: not string");
    }
    if (!json.url.startsWith("wss://")) {
      throw new Error("Invalid url field in server response: not a wss:// URL");
    }

    return {
      jwt: json.jwt,
      url: json.url,
    };
  } catch (e) {
    throw new InvalidServerResponseError(url, e);
  }
}

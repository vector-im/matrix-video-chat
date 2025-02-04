/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { expect, test, vi } from "vitest";
import { AutoDiscovery } from "matrix-js-sdk/src/autodiscovery";

import { enterRTCSession } from "../src/rtcSessionHelpers";
import { mockConfig } from "./utils/test";

test("It joins the correct Session", async () => {
  const focusFromOlderMembership = {
    type: "livekit",
    livekit_service_url: "http://my-oldest-member-service-url.com",
    livekit_alias: "my-oldest-member-service-alias",
  };

  const focusConfigFromWellKnown = {
    type: "livekit",
    livekit_service_url: "http://my-well-known-service-url.com",
  };
  const focusConfigFromWellKnown2 = {
    type: "livekit",
    livekit_service_url: "http://my-well-known-service-url2.com",
  };
  const clientWellKnown = {
    "org.matrix.msc4143.rtc_foci": [
      focusConfigFromWellKnown,
      focusConfigFromWellKnown2,
    ],
  };

  mockConfig({
    livekit: { livekit_service_url: "http://my-default-service-url.com" },
  });

  vi.spyOn(AutoDiscovery, "getRawClientConfig").mockImplementation(
    async (domain) => {
      if (domain === "example.org") {
        return Promise.resolve(clientWellKnown);
      }
      return Promise.resolve({});
    },
  );

  const mockedSession = vi.mocked({
    room: {
      roomId: "roomId",
      client: {
        getDomain: vi.fn().mockReturnValue("example.org"),
      },
    },
    memberships: [],
    getFocusInUse: vi.fn().mockReturnValue(focusFromOlderMembership),
    getOldestMembership: vi.fn().mockReturnValue({
      getPreferredFoci: vi.fn().mockReturnValue([focusFromOlderMembership]),
    }),
    joinRoomSession: vi.fn(),
  }) as unknown as MatrixRTCSession;
  await enterRTCSession(mockedSession, false);

  expect(mockedSession.joinRoomSession).toHaveBeenLastCalledWith(
    [
      {
        livekit_alias: "my-oldest-member-service-alias",
        livekit_service_url: "http://my-oldest-member-service-url.com",
        type: "livekit",
      },
      {
        livekit_alias: "roomId",
        livekit_service_url: "http://my-well-known-service-url.com",
        type: "livekit",
      },
      {
        livekit_alias: "roomId",
        livekit_service_url: "http://my-well-known-service-url2.com",
        type: "livekit",
      },
      {
        livekit_alias: "roomId",
        livekit_service_url: "http://my-default-service-url.com",
        type: "livekit",
      },
    ],
    {
      focus_selection: "oldest_membership",
      type: "livekit",
    },
    {
      manageMediaKeys: false,
      useLegacyMemberEvents: false,
    },
  );
});

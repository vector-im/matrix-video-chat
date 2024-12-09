/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
  getRoomIdentifierFromUrl,
  getUrlParams,
  UserIntent,
} from "../src/UrlParams";

const ROOM_NAME = "roomNameHere";
const ROOM_ID = "!d45f138fsd";
const ORIGIN = "https://call.element.io";
const HOMESERVER = "localhost";

describe("UrlParams", () => {
  describe("handles URL with /room/", () => {
    it("and nothing else", () => {
      expect(
        getRoomIdentifierFromUrl(`/room/${ROOM_NAME}`, "", "").roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });

    it("and #", () => {
      expect(
        getRoomIdentifierFromUrl("", `${ORIGIN}/room/`, `#${ROOM_NAME}`)
          .roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });

    it("and # and server part", () => {
      expect(
        getRoomIdentifierFromUrl("", `/room/`, `#${ROOM_NAME}:${HOMESERVER}`)
          .roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });

    it("and server part", () => {
      expect(
        getRoomIdentifierFromUrl(`/room/${ROOM_NAME}:${HOMESERVER}`, "", "")
          .roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });
  });

  describe("handles URL without /room/", () => {
    it("and nothing else", () => {
      expect(getRoomIdentifierFromUrl(`/${ROOM_NAME}`, "", "").roomAlias).toBe(
        `#${ROOM_NAME}:${HOMESERVER}`,
      );
    });

    it("and with #", () => {
      expect(getRoomIdentifierFromUrl("", "", `#${ROOM_NAME}`).roomAlias).toBe(
        `#${ROOM_NAME}:${HOMESERVER}`,
      );
    });

    it("and with # and server part", () => {
      expect(
        getRoomIdentifierFromUrl("", "", `#${ROOM_NAME}:${HOMESERVER}`)
          .roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });

    it("and with server part", () => {
      expect(
        getRoomIdentifierFromUrl(`/${ROOM_NAME}:${HOMESERVER}`, "", "")
          .roomAlias,
      ).toBe(`#${ROOM_NAME}:${HOMESERVER}`);
    });
  });

  describe("handles search params", () => {
    it("(roomId)", () => {
      expect(
        getRoomIdentifierFromUrl("", `?roomId=${ROOM_ID}`, "").roomId,
      ).toBe(ROOM_ID);
    });
  });

  it("ignores room alias", () => {
    expect(
      getRoomIdentifierFromUrl("", `/room/${ROOM_NAME}:${HOMESERVER}`, "")
        .roomAlias,
    ).toBeFalsy();
  });

  describe("preload", () => {
    it("defaults to false", () => {
      expect(getUrlParams().preload).toBe(false);
    });

    it("ignored in SPA mode", () => {
      expect(getUrlParams("?preload=true").preload).toBe(false);
    });

    it("respected in widget mode", () => {
      expect(getUrlParams("?preload=true&widgetId=12345").preload).toBe(true);
    });
  });

  describe("intent", () => {
    it("defaults to start_call", () => {
      expect(getUrlParams().intent).toBe(UserIntent.StartNewCall);
    });

    it("ignores intent if it is not a valid value", () => {
      expect(getUrlParams("?intent=foo").intent).toBe(UserIntent.StartNewCall);
    });

    it("accepts join_existing", () => {
      expect(getUrlParams("?intent=join_existing").intent).toBe(
        UserIntent.JoinExistingCall,
      );
    });
  });

  describe("skipLobby", () => {
    it("defaults to false", () => {
      expect(getUrlParams().skipLobby).toBe(false);
    });

    it("defaults to false if intent is start_call in SPA mode", () => {
      expect(getUrlParams("?intent=start_call").skipLobby).toBe(false);
    });

    it("defaults to true if intent is start_call in widget mode", () => {
      expect(getUrlParams("?intent=start_call&widgetId=12345").skipLobby).toBe(
        true,
      );
    });

    it("default to false if intent is join_existing", () => {
      expect(getUrlParams("?intent=join_existing").skipLobby).toBe(false);
    });
  });
});

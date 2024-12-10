/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { beforeEach, expect, MockedFunction, test, vitest } from "vitest";
import { render } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";
import { of } from "rxjs";
import { JoinRule, RoomState } from "matrix-js-sdk/src/matrix";
import { Router } from "react-router-dom";
import { createBrowserHistory } from "history";
import userEvent from "@testing-library/user-event";

import { MuteStates } from "./MuteStates";
import { prefetchSounds } from "../soundUtils";
import { useAudioContext } from "../useAudioContext";
import { ActiveCall } from "./InCallView";
import {
  mockMatrixRoom,
  mockMatrixRoomMember,
  mockRtcMembership,
  MockRTCSession,
} from "../utils/test";
import { GroupCallView } from "./GroupCallView";

vitest.mock("../soundUtils");
vitest.mock("../useAudioContext");
vitest.mock("./InCallView");

let playSound: MockedFunction<
  NonNullable<ReturnType<typeof useAudioContext>>["playSound"]
>;

const localRtcMember = mockRtcMembership("@carol:example.org", "CCCC");
const aliceRtcMember = mockRtcMembership("@alice:example.org", "AAAA");
const bobRtcMember = mockRtcMembership("@bob:example.org", "BBBB");
const daveRtcMember = mockRtcMembership("@dave:example.org", "DDDD");

const alice = mockMatrixRoomMember(aliceRtcMember);
const bob = mockMatrixRoomMember(bobRtcMember);
const carol = mockMatrixRoomMember(localRtcMember);
const dave = mockMatrixRoomMember(daveRtcMember);

const roomId = "!foo:bar";

const roomMembers = new Map(
  [alice, bob, carol, dave].map((p) => [p.userId, p]),
);

beforeEach(() => {
  (prefetchSounds as MockedFunction<typeof prefetchSounds>).mockResolvedValue({
    sound: new ArrayBuffer(0),
  });
  playSound = vitest.fn().mockResolvedValue(undefined);
  (useAudioContext as MockedFunction<typeof useAudioContext>).mockReturnValue({
    playSound,
  });
  // A trivial implementation of Active call to ensure we are testing GroupCallView exclusively here.
  (ActiveCall as MockedFunction<typeof ActiveCall>).mockImplementation(
    ({ onLeave }) => {
      return (
        <div>
          <button onClick={() => onLeave()}>Leave</button>
        </div>
      );
    },
  );
});

test("a leave sound should be played when the user leaves the call", async () => {
  const user = userEvent.setup();
  const history = createBrowserHistory();
  const client = {
    getUser: () => null,
    getUserId: () => localRtcMember.sender,
    getDeviceId: () => localRtcMember.deviceId,
    getRoom: (rId) => (rId === roomId ? room : null),
  } as Partial<MatrixClient> as MatrixClient;
  const room = mockMatrixRoom({
    client,
    roomId,
    getMember: (userId) => roomMembers.get(userId) ?? null,
    getMxcAvatarUrl: () => null,
    getCanonicalAlias: () => null,
    currentState: {
      getJoinRule: () => JoinRule.Invite,
    } as Partial<RoomState> as RoomState,
  });
  const rtcSession = new MockRTCSession(
    room,
    localRtcMember,
    [],
  ).withMemberships(of([aliceRtcMember, bobRtcMember]));
  const muteState = {
    audio: { enabled: false },
    video: { enabled: false },
  } as MuteStates;
  const { getByText } = render(
    <Router history={history}>
      <GroupCallView
        client={client}
        isPasswordlessUser={false}
        confineToRoom={false}
        preload={false}
        skipLobby={false}
        hideHeader={true}
        rtcSession={rtcSession as unknown as MatrixRTCSession}
        muteStates={muteState}
      />
    </Router>,
  );
  const leaveButton = getByText("Leave");
  await user.click(leaveButton);
  expect(playSound).toHaveBeenCalledWith("left");
});

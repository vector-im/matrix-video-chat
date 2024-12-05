/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { render } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  expect,
  Mock,
  MockedFunction,
  test,
  vitest,
} from "vitest";
import { ConnectionState, RemoteParticipant, Room } from "livekit-client";
import { of } from "rxjs";
import { act, ReactNode } from "react";

import {
  EmittableMockLivekitRoom,
  mockLocalParticipant,
  mockMatrixRoomMember,
  mockRemoteParticipant,
} from "../utils/test";
import { E2eeType } from "../e2ee/e2eeType";
import { CallViewModel } from "../state/CallViewModel";
import {
  CallEventAudioRenderer,
  MAX_PARTICIPANT_COUNT_FOR_SOUND,
} from "./CallEventAudioRenderer";
import { prefetchSounds, useAudioContext } from "../useAudioContext";
import {
  MockRoom,
  MockRTCSession,
  TestReactionsWrapper,
} from "../utils/testReactions";

const alice = mockMatrixRoomMember({ userId: "@alice:example.org" });
const bob = mockMatrixRoomMember({ userId: "@bob:example.org" });
const aliceId = `${alice.userId}:AAAA`;
const bobId = `${bob.userId}:BBBB`;
const localParticipant = mockLocalParticipant({ identity: "" });
const aliceParticipant = mockRemoteParticipant({ identity: aliceId });
const bobParticipant = mockRemoteParticipant({ identity: bobId });

vitest.mock("../useAudioContext");

afterEach(() => {
  vitest.resetAllMocks();
});

afterAll(() => {
  vitest.restoreAllMocks();
});

let playSound: Mock<
  NonNullable<ReturnType<typeof useAudioContext>>["playSound"]
>;

beforeEach(() => {
  (prefetchSounds as MockedFunction<typeof prefetchSounds>).mockResolvedValue({
    sound: new ArrayBuffer(0),
  });
  playSound = vitest.fn();
  (useAudioContext as MockedFunction<typeof useAudioContext>).mockReturnValue({
    playSound,
  });
});

function TestComponent({
  room,
  vm,
}: {
  room: MockRoom;
  vm: CallViewModel;
}): ReactNode {
  return (
    <TestReactionsWrapper rtcSession={new MockRTCSession(room, {})}>
      <CallEventAudioRenderer vm={vm} />
    </TestReactionsWrapper>
  );
}

/**
 * We don't want to play a sound when loading the call state
 * because typically this occurs in two stages. We first join
 * the call as a local participant and *then* the remote
 * participants join from our perspective. We don't want to make
 * a noise every time.
 */
test("plays one sound when entering a call", () => {
  const liveKitRoom = new EmittableMockLivekitRoom({
    localParticipant,
    remoteParticipants: new Map(),
  });

  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room.testGetAsMatrixRoom(),
    liveKitRoom.getAsLivekitRoom(),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );

  // Joining a call usually means remote participants are added later.
  act(() => {
    liveKitRoom.addParticipant(bobParticipant);
  });

  render(<TestComponent room={room} vm={vm} />);
  expect(playSound).toBeCalled();
});

test("plays a sound when a user joins", () => {
  const remoteParticipants = new Map(
    [aliceParticipant].map((p) => [p.identity, p]),
  );
  const liveKitRoom = new EmittableMockLivekitRoom({
    localParticipant,
    remoteParticipants,
  });

  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room.testGetAsMatrixRoom(),
    liveKitRoom as unknown as Room,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<TestComponent room={room} vm={vm} />);

  act(() => {
    liveKitRoom.addParticipant(bobParticipant);
  });
  // Play a sound when joining a call.
  expect(playSound).toBeCalledWith("join");
});

test("plays a sound when a user leaves", () => {
  const remoteParticipants = new Map(
    [aliceParticipant].map((p) => [p.identity, p]),
  );
  const liveKitRoom = new EmittableMockLivekitRoom({
    localParticipant,
    remoteParticipants,
  });
  const room = new MockRoom(alice.userId);

  const vm = new CallViewModel(
    room.testGetAsMatrixRoom(),
    liveKitRoom.getAsLivekitRoom(),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<TestComponent room={room} vm={vm} />);

  act(() => {
    liveKitRoom.removeParticipant(aliceParticipant);
  });
  expect(playSound).toBeCalledWith("left");
});

test("plays no sound when the participant list is more than the maximum size", () => {
  expect(playSound).not.toBeCalled();
  const remoteParticipants = new Map<string, RemoteParticipant>([
    [aliceParticipant.identity, aliceParticipant],
    // You + other participants to hit the max.
    ...Array.from({ length: MAX_PARTICIPANT_COUNT_FOR_SOUND - 1 }).map<
      [string, RemoteParticipant]
    >((_, index) => {
      const p = mockRemoteParticipant({
        identity: `@user${index}:example.com:DEV${index}`,
      });
      return [p.identity, p];
    }),
  ]);

  // Preload the call with the maximum members, assume that
  // we're already in the call by this point rather than
  // joining.
  const liveKitRoom = new EmittableMockLivekitRoom({
    localParticipant,
    remoteParticipants,
  });
  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room.testGetAsMatrixRoom(),
    liveKitRoom.getAsLivekitRoom(),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<TestComponent room={room} vm={vm} />);
  // When the count drops, play a leave sound.
  act(() => {
    liveKitRoom.removeParticipant(aliceParticipant);
  });
  expect(playSound).toBeCalledWith("left");
});

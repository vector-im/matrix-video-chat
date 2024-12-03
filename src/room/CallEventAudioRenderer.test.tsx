/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { render } from "@testing-library/react";
import { beforeEach, expect, test, vitest } from "vitest";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { ConnectionState, RemoteParticipant, Room } from "livekit-client";
import { of } from "rxjs";
import { act, ReactNode } from "react";

import { soundEffectVolumeSetting } from "../settings/settings";
import {
  EmittableMockLivekitRoom,
  mockLivekitRoom,
  mockLocalParticipant,
  mockMatrixRoom,
  mockMatrixRoomMember,
  mockRemoteParticipant,
} from "../utils/test";
import { E2eeType } from "../e2ee/e2eeType";
import { CallViewModel } from "../state/CallViewModel";
import {
  CallEventAudioRenderer,
  MAX_PARTICIPANT_COUNT_FOR_SOUND,
} from "./CallEventAudioRenderer";
import {
  prefetchSounds,
  // We're using this from our mock, but it doesn't exist in the actual module.
  //@ts-ignore
  playSound,
} from "../useAudioContext";
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
const leaveSound = "http://localhost:3000/src/sound/left_call.ogg";

beforeEach(() => {
  soundEffectVolumeSetting.setValue(soundEffectVolumeSetting.defaultValue);
});

vitest.mock("../useAudioContext", async () => {
  const playSound = vitest.fn();
  return {
    prefetchSounds: vitest.fn().mockReturnValueOnce({
      sound: new ArrayBuffer(0),
    }),
    playSound,
    useAudioContext: () => ({
      playSound,
    }),
  };
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
test("does NOT play a sound when entering a call", () => {
  const members = new Map([alice, bob].map((p) => [p.userId, p]));
  const remoteParticipants = of([aliceParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants },
  );
  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room as any,
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );

  render(<TestComponent room={room} vm={vm} />);
  expect(playSound).not.toBeCalled();
});

test("plays no sound when muted", () => {
  soundEffectVolumeSetting.setValue(0);
  const members = new Map([alice, bob].map((p) => [p.userId, p]));
  const remoteParticipants = of([aliceParticipant, bobParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants },
  );

  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room as any,
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );

  render(<TestComponent room={room} vm={vm} />);
  // Play a sound when joining a call.
  expect(playSound).not.toBeCalled();
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
    room as any,
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
    room as any,
    liveKitRoom as unknown as Room,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<TestComponent room={room} vm={vm} />);

  act(() => {
    liveKitRoom.removeParticipant(aliceParticipant);
  });
  expect(playSound).toBeCalledWith("leave");
});

test("plays no sound when the participant list is more than the maximum size", () => {
  const remoteParticipants = new Map<string, RemoteParticipant>([
    [aliceParticipant.identity, aliceParticipant],
    ...Array.from({ length: MAX_PARTICIPANT_COUNT_FOR_SOUND - 1 }).map<
      [string, RemoteParticipant]
    >((_, index) => {
      const p = mockRemoteParticipant({ identity: `user${index}` });
      return [p.identity, p];
    }),
  ]);
  const liveKitRoom = new EmittableMockLivekitRoom({
    localParticipant,
    remoteParticipants,
  });
  const room = new MockRoom(alice.userId);
  const vm = new CallViewModel(
    room as any,
    liveKitRoom as unknown as Room,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<TestComponent room={room} vm={vm} />);
  // When the count drops
  act(() => {
    liveKitRoom.removeParticipant(aliceParticipant);
  });
  expect(playSound).not.toBeCalled();
});

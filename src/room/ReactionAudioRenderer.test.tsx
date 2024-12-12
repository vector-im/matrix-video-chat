/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { render } from "@testing-library/react";
import {
  afterAll,
  beforeEach,
  expect,
  test,
  vitest,
  type MockedFunction,
  type Mock,
} from "vitest";
import { TooltipProvider } from "@vector-im/compound-web";
import { act, type ReactNode } from "react";
import { afterEach } from "node:test";

import { ReactionsAudioRenderer } from "./ReactionAudioRenderer";
import {
  playReactionsSound,
  soundEffectVolumeSetting,
} from "../settings/settings";
import { useAudioContext } from "../useAudioContext";
import { GenericReaction, ReactionSet } from "../reactions";
import { prefetchSounds } from "../soundUtils";
import { ConnectionState } from "livekit-client";
import { CallMembership, MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";
import { BehaviorSubject, of } from "rxjs";
import { E2eeType } from "../e2ee/e2eeType";
import { CallViewModel } from "../state/CallViewModel";
import {
  mockLivekitRoom,
  mockLocalParticipant,
  mockMatrixRoom,
  mockMatrixRoomMember,
  mockRemoteParticipant,
  mockRtcMembership,
  MockRTCSession,
} from "../utils/test";
import { MatrixClient } from "matrix-js-sdk/src/client";

const localRtcMember = mockRtcMembership("@carol:example.org", "CCCC");
const local = mockMatrixRoomMember(localRtcMember);
const aliceRtcMember = mockRtcMembership("@alice:example.org", "AAAA");
const alice = mockMatrixRoomMember(aliceRtcMember);
const localParticipant = mockLocalParticipant({ identity: "" });
const aliceId = `${alice.userId}:${aliceRtcMember.deviceId}`;
const aliceParticipant = mockRemoteParticipant({ identity: aliceId });

function TestComponent({ vm }: { vm: CallViewModel }): ReactNode {
  return (
    <TooltipProvider>
      <ReactionsAudioRenderer vm={vm} />
    </TooltipProvider>
  );
}
function testEnv(): CallViewModel {
  const matrixRoomMembers = new Map([local, alice].map((p) => [p.userId, p]));
  const remoteParticipants = of([aliceParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants },
  );
  const matrixRoom = mockMatrixRoom({
    client: {
      getUserId: () => localRtcMember.sender,
      getDeviceId: () => localRtcMember.deviceId,
      on: vitest.fn(),
      off: vitest.fn(),
    } as Partial<MatrixClient> as MatrixClient,
    getMember: (userId) => matrixRoomMembers.get(userId) ?? null,
  });

  const remoteRtcMemberships = new BehaviorSubject<CallMembership[]>([
    aliceRtcMember,
  ]);

  const session = new MockRTCSession(
    matrixRoom,
    localRtcMember,
  ).withMemberships(remoteRtcMemberships);

  const vm = new CallViewModel(
    session as unknown as MatrixRTCSession,
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  return vm;
}

vitest.mock("../useAudioContext");
vitest.mock("../soundUtils");

afterEach(() => {
  vitest.resetAllMocks();
  playReactionsSound.setValue(playReactionsSound.defaultValue);
  soundEffectVolumeSetting.setValue(soundEffectVolumeSetting.defaultValue);
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

test("preloads all audio elements", () => {
  const vm = testEnv();
  playReactionsSound.setValue(true);
  render(<TestComponent vm={vm} />);
  expect(prefetchSounds).toHaveBeenCalledOnce();
});

test("will play an audio sound when there is a reaction", () => {
  const vm = testEnv();
  playReactionsSound.setValue(true);
  render(<TestComponent vm={vm} />);

  // Find the first reaction with a sound effect
  const chosenReaction = ReactionSet.find((r) => !!r.sound);
  if (!chosenReaction) {
    throw Error(
      "No reactions have sounds configured, this test cannot succeed",
    );
  }
  act(() => {
    vm.updateReactions({
      raisedHands: {},
      reactions: {
        memberEventAlice: chosenReaction,
      },
    });
  });
  expect(playSound).toHaveBeenCalledWith(chosenReaction.name);
});

test("will play the generic audio sound when there is soundless reaction", () => {
  const vm = testEnv();
  playReactionsSound.setValue(true);
  render(<TestComponent vm={vm} />);

  // Find the first reaction with a sound effect
  const chosenReaction = ReactionSet.find((r) => !r.sound);
  if (!chosenReaction) {
    throw Error(
      "No reactions have sounds configured, this test cannot succeed",
    );
  }
  act(() => {
    vm.updateReactions({
      raisedHands: {},
      reactions: {
        memberEventAlice: chosenReaction,
      },
    });
  });
  expect(playSound).toHaveBeenCalledWith(GenericReaction.name);
});

test("will play multiple audio sounds when there are multiple different reactions", () => {
  const vm = testEnv();
  playReactionsSound.setValue(true);
  render(<TestComponent vm={vm} />);

  // Find the first reaction with a sound effect
  const [reaction1, reaction2] = ReactionSet.filter((r) => !!r.sound);
  if (!reaction1 || !reaction2) {
    throw Error(
      "No reactions have sounds configured, this test cannot succeed",
    );
  }
  act(() => {
    vm.updateReactions({
      raisedHands: {},
      reactions: {
        memberEventAlice: reaction1,
        memberEventBob: reaction2,
        memberEventCharlie: reaction1,
      },
    });
  });
  expect(playSound).toHaveBeenCalledWith(reaction1.name);
  expect(playSound).toHaveBeenCalledWith(reaction2.name);
});

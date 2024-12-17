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
import { type CallViewModel } from "../state/CallViewModel";
import { getBasicCallViewModelEnvironment } from "../utils/test-viewmodel";
import {
  alice,
  aliceRtcMember,
  bobRtcMember,
  local,
  localRtcMember,
} from "../utils/test-fixtures";

function TestComponent({ vm }: { vm: CallViewModel }): ReactNode {
  return (
    <TooltipProvider>
      <ReactionsAudioRenderer vm={vm} />
    </TooltipProvider>
  );
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
  const { vm } = getBasicCallViewModelEnvironment([local, alice]);
  playReactionsSound.setValue(true);
  render(<TestComponent vm={vm} />);
  expect(prefetchSounds).toHaveBeenCalledOnce();
});

test("will play an audio sound when there is a reaction", () => {
  const { vm, reactionsSubject$: reactionsSubject } =
    getBasicCallViewModelEnvironment([local, alice]);
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
    reactionsSubject.next({
      [aliceRtcMember.deviceId]: { reactionOption: chosenReaction, ttl: 0 },
    });
  });
  expect(playSound).toHaveBeenCalledWith(chosenReaction.name);
});

test("will play the generic audio sound when there is soundless reaction", () => {
  const { vm, reactionsSubject$: reactionsSubject } =
    getBasicCallViewModelEnvironment([local, alice]);
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
    reactionsSubject.next({
      [aliceRtcMember.deviceId]: { reactionOption: chosenReaction, ttl: 0 },
    });
  });
  expect(playSound).toHaveBeenCalledWith(GenericReaction.name);
});

test("will play multiple audio sounds when there are multiple different reactions", () => {
  const { vm, reactionsSubject$: reactionsSubject } =
    getBasicCallViewModelEnvironment([local, alice]);
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
    reactionsSubject.next({
      [aliceRtcMember.deviceId]: { reactionOption: reaction1, ttl: 0 },
      [bobRtcMember.deviceId]: { reactionOption: reaction2, ttl: 0 },
      [localRtcMember.deviceId]: { reactionOption: reaction1, ttl: 0 },
    });
  });
  expect(playSound).toHaveBeenCalledWith(reaction1.name);
  expect(playSound).toHaveBeenCalledWith(reaction2.name);
});

/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { render } from "@testing-library/react";
import { afterAll, beforeEach, expect, test } from "vitest";


import {
  playReactionsSound,
  soundEffectVolumeSetting,
} from "../settings/settings";
import { MockLivekitRoom, mockLivekitRoom, mockLocalParticipant, mockMatrixRoom, mockMatrixRoomMember, mockMediaPlay, mockRemoteParticipant } from "../utils/test";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { E2eeType } from "../e2ee/e2eeType";
import { CallViewModel } from "../state/CallViewModel";
import { ConnectionState, Room } from "livekit-client";
import { of } from "rxjs";
import { CallEventAudioRenderer } from "./CallEventAudioRenderer";

import enterCallSoundOgg from "../sound/join_call.ogg";
import leftCallSoundOgg from "../sound/left_call.ogg";
import { afterEach } from "node:test";
import { act } from "react";
import { LazyEventEmitter } from "../LazyEventEmitter";
import EventEmitter from "events";

const alice = mockMatrixRoomMember({ userId: "@alice:example.org" });
const bob = mockMatrixRoomMember({ userId: "@bob:example.org" });
const aliceId = `${alice.userId}:AAAA`;
const bobId = `${bob.userId}:BBBB`;
const localParticipant = mockLocalParticipant({ identity: "" });
const aliceParticipant = mockRemoteParticipant({ identity: aliceId });
const bobParticipant = mockRemoteParticipant({ identity: bobId });

const originalPlayFn = window.HTMLMediaElement.prototype.play;

beforeEach(() => {
  soundEffectVolumeSetting.setValue(soundEffectVolumeSetting.defaultValue);
});

afterEach(() => {
  window.HTMLMediaElement.prototype.play = originalPlayFn;
});

test("plays a sound when entering a call", () => {
  const audioIsPlaying: string[] = mockMediaPlay();
  const members = new Map([alice, bob].map((p) => [p.userId, p]));
  const remoteParticipants = of([aliceParticipant, bobParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants },
  );

  const vm = new CallViewModel(
    mockMatrixRoom({
      client: {
        getUserId: () => "@carol:example.org",
      } as Partial<MatrixClient> as MatrixClient,
      getMember: (userId) => members.get(userId) ?? null,
    }),
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );

  render(<CallEventAudioRenderer vm={vm} />);
  // Play a sound when joining a call.
  expect(audioIsPlaying.includes(enterCallSoundOgg));
});

test("plays no sound when muted", () => {
  soundEffectVolumeSetting.setValue(0);
  const audioIsPlaying: string[] = mockMediaPlay();
  const members = new Map([alice, bob].map((p) => [p.userId, p]));
  const remoteParticipants = of([aliceParticipant, bobParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants },
  );

  const vm = new CallViewModel(
    mockMatrixRoom({
      client: {
        getUserId: () => "@carol:example.org",
      } as Partial<MatrixClient> as MatrixClient,
      getMember: (userId) => members.get(userId) ?? null,
    }),
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );

  render(<CallEventAudioRenderer vm={vm} />);
  // Play a sound when joining a call.
  expect(audioIsPlaying).toHaveLength(0);
});

test("plays a sound when a user joins", () => {
  const audioIsPlaying: string[] = mockMediaPlay();
  const members = new Map([alice].map((p) => [p.userId, p]));
  const remoteParticipants = new Map([aliceParticipant].map((p) => [p.identity, p]));
  const liveKitRoom = new MockLivekitRoom({localParticipant, remoteParticipants});

  const vm = new CallViewModel(
    mockMatrixRoom({
      client: {
        getUserId: () => "@carol:example.org",
      } as Partial<MatrixClient> as MatrixClient,
      getMember: (userId) => members.get(userId) ?? null,
    }),
    liveKitRoom as unknown as Room,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<CallEventAudioRenderer vm={vm} />);

  act(() => {
    liveKitRoom.addParticipant(bobParticipant);
  });
  // Play a sound when joining a call.
  expect(audioIsPlaying).toHaveLength(2);
});



test("plays a sound when a user leaves", () => {
  const audioIsPlaying: string[] = mockMediaPlay();
  const members = new Map([alice].map((p) => [p.userId, p]));
  const remoteParticipants = new Map([aliceParticipant].map((p) => [p.identity, p]));
  const liveKitRoom = new MockLivekitRoom({localParticipant, remoteParticipants});

  const vm = new CallViewModel(
    mockMatrixRoom({
      client: {
        getUserId: () => "@carol:example.org",
      } as Partial<MatrixClient> as MatrixClient,
      getMember: (userId) => members.get(userId) ?? null,
    }),
    liveKitRoom as unknown as Room,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
  );
  render(<CallEventAudioRenderer vm={vm} />);

  act(() => {
    liveKitRoom.removeParticipant(aliceParticipant);
  });
  // Play a join sound and a leave sound.
  expect(audioIsPlaying).toEqual([
    'http://localhost:3000/src/sound/join_call.ogg',
    'http://localhost:3000/src/sound/left_call.ogg'
  ]);
});

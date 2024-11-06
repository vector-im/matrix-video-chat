/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/
import { map, Observable, of } from "rxjs";
import { RunHelpers, TestScheduler } from "rxjs/testing";
import { expect, vi } from "vitest";
import {
  RoomMember,
  Room as MatrixRoom,
  MatrixEvent,
} from "matrix-js-sdk/src/matrix";
import {
  CallMembership,
  Focus,
  SessionMembershipData,
} from "matrix-js-sdk/src/matrixrtc";
import {
  LocalParticipant,
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrackPublication,
  Room as LivekitRoom,
} from "livekit-client";

import {
  LocalUserMediaViewModel,
  RemoteUserMediaViewModel,
} from "../state/MediaViewModel";
import { E2eeType } from "../e2ee/e2eeType";

export function withFakeTimers(continuation: () => void): void {
  vi.useFakeTimers();
  try {
    continuation();
  } finally {
    vi.useRealTimers();
  }
}

export interface OurRunHelpers extends RunHelpers {
  /**
   * Schedules a sequence of actions to happen, as described by a marble
   * diagram.
   */
  schedule: (marbles: string, actions: Record<string, () => void>) => void;
}

/**
 * Run Observables with a scheduler that virtualizes time, for testing purposes.
 */
export function withTestScheduler(
  continuation: (helpers: OurRunHelpers) => void,
): void {
  new TestScheduler((actual, expected) => {
    expect(actual).deep.equals(expected);
  }).run((helpers) =>
    continuation({
      ...helpers,
      schedule(marbles, actions) {
        const actionsObservable = helpers
          .cold(marbles)
          .pipe(map((value) => actions[value]()));
        const results = Object.fromEntries(
          Object.keys(actions).map((value) => [value, undefined] as const),
        );
        // Run the actions and verify that none of them error
        helpers.expectObservable(actionsObservable).toBe(marbles, results);
      },
    }),
  );
}

interface EmitterMock<T> {
  on: () => T;
  off: () => T;
  addListener: () => T;
  removeListener: () => T;
}

function mockEmitter<T>(): EmitterMock<T> {
  return {
    on(): T {
      return this as T;
    },
    off(): T {
      return this as T;
    },
    addListener(): T {
      return this as T;
    },
    removeListener(): T {
      return this as T;
    },
  };
}

export function mockMembership(
  user: string | RoomMember,
  deviceId: string,
  callId = "",
  fociPreferred: Focus[] = [],
  focusActive: Focus = { type: "oldest_membership" },
  membership: Partial<SessionMembershipData> = {},
): CallMembership {
  const data: SessionMembershipData = {
    application: "m.call",
    call_id: callId,
    device_id: deviceId,
    foci_preferred: fociPreferred,
    focus_active: focusActive,
    ...membership,
  };
  const event = new MatrixEvent({
    sender: typeof user === "string" ? user : user.userId,
  });
  return new CallMembership(event, data);
}

// Maybe it'd be good to move this to matrix-js-sdk? Our testing needs are
// rather simple, but if one util to mock a member is good enough for us, maybe
// it's useful for matrix-js-sdk consumers in general.
export function mockRoomMember(member: Partial<RoomMember>): RoomMember {
  return { ...mockEmitter(), ...member } as RoomMember;
}

export function mockMatrixRoom(room: Partial<MatrixRoom>): MatrixRoom {
  return { ...mockEmitter(), ...room } as Partial<MatrixRoom> as MatrixRoom;
}

export function mockLivekitRoom(
  room: Partial<LivekitRoom>,
  {
    remoteParticipants,
  }: { remoteParticipants?: Observable<RemoteParticipant[]> } = {},
): LivekitRoom {
  const livekitRoom = {
    ...mockEmitter(),
    ...room,
  } as Partial<LivekitRoom> as LivekitRoom;
  if (remoteParticipants) {
    livekitRoom.remoteParticipants = new Map();
    remoteParticipants.subscribe((newRemoteParticipants) => {
      livekitRoom.remoteParticipants.clear();
      newRemoteParticipants.forEach((p) => {
        livekitRoom.remoteParticipants.set(p.identity, p);
      });
    });
  }

  return livekitRoom;
}

export function mockLocalParticipant(
  participant: Partial<LocalParticipant>,
): LocalParticipant {
  return {
    isLocal: true,
    getTrackPublication: () =>
      ({}) as Partial<LocalTrackPublication> as LocalTrackPublication,
    ...mockEmitter(),
    ...participant,
  } as Partial<LocalParticipant> as LocalParticipant;
}

export async function withLocalMedia(
  member: Partial<RoomMember>,
  continuation: (vm: LocalUserMediaViewModel) => void | Promise<void>,
): Promise<void> {
  const localParticipant = mockLocalParticipant({});
  const vm = new LocalUserMediaViewModel(
    "local",
    mockRoomMember(member),
    of(localParticipant),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    mockLivekitRoom({ localParticipant }),
  );
  try {
    await continuation(vm);
  } finally {
    vm.destroy();
  }
}

export function mockRemoteParticipant(
  participant: Partial<RemoteParticipant>,
): RemoteParticipant {
  return {
    isLocal: false,
    setVolume() {},
    getTrackPublication: () =>
      ({}) as Partial<RemoteTrackPublication> as RemoteTrackPublication,
    ...mockEmitter(),
    ...participant,
  } as RemoteParticipant;
}

export async function withRemoteMedia(
  member: Partial<RoomMember>,
  participant: Partial<RemoteParticipant>,
  continuation: (vm: RemoteUserMediaViewModel) => void | Promise<void>,
): Promise<void> {
  const remoteParticipant = mockRemoteParticipant(participant);
  const vm = new RemoteUserMediaViewModel(
    "remote",
    mockRoomMember(member),
    of(remoteParticipant),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    mockLivekitRoom({}, { remoteParticipants: of([remoteParticipant]) }),
  );
  try {
    await continuation(vm);
  } finally {
    vm.destroy();
  }
}

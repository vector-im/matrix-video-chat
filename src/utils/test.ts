/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/
import { map, type Observable, of, type SchedulerLike } from "rxjs";
import { type RunHelpers, TestScheduler } from "rxjs/testing";
import { expect, vi, vitest } from "vitest";
import {
  type RoomMember,
  type Room as MatrixRoom,
  MatrixEvent,
  type Room,
  TypedEventEmitter,
} from "matrix-js-sdk/src/matrix";
import {
  CallMembership,
  type Focus,
  MatrixRTCSessionEvent,
  type MatrixRTCSessionEventHandlerMap,
  type SessionMembershipData,
} from "matrix-js-sdk/src/matrixrtc";
import {
  type LocalParticipant,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room as LivekitRoom,
} from "livekit-client";

import {
  LocalUserMediaViewModel,
  RemoteUserMediaViewModel,
} from "../state/MediaViewModel";
import { E2eeType } from "../e2ee/e2eeType";
import {
  DEFAULT_CONFIG,
  type ResolvedConfigOptions,
} from "../config/ConfigOptions";
import { Config } from "../config/Config";
import { randomUUID } from "crypto";

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

interface TestRunnerGlobal {
  rxjsTestScheduler?: SchedulerLike;
}

/**
 * Run Observables with a scheduler that virtualizes time, for testing purposes.
 */
export function withTestScheduler(
  continuation: (helpers: OurRunHelpers) => void,
): void {
  const scheduler = new TestScheduler((actual, expected) => {
    expect(actual).deep.equals(expected);
  });
  // we set the test scheduler as a global so that you can watch it in a debugger
  // and get the frame number. e.g. `rxjsTestScheduler?.now()`
  (global as unknown as TestRunnerGlobal).rxjsTestScheduler = scheduler;
  scheduler.run((helpers) =>
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

export function mockRtcMembership(
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
    event_id: `$-ev-${randomUUID()}:example.org`,
  });
  return new CallMembership(event, data);
}

// Maybe it'd be good to move this to matrix-js-sdk? Our testing needs are
// rather simple, but if one util to mock a member is good enough for us, maybe
// it's useful for matrix-js-sdk consumers in general.
export function mockMatrixRoomMember(
  rtcMembership: CallMembership,
  member: Partial<RoomMember> = {},
): RoomMember {
  return {
    ...mockEmitter(),
    userId: rtcMembership.sender,
    ...member,
  } as RoomMember;
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
  localRtcMember: CallMembership,
  roomMember: Partial<RoomMember>,
  continuation: (vm: LocalUserMediaViewModel) => void | Promise<void>,
): Promise<void> {
  const localParticipant = mockLocalParticipant({});
  const vm = new LocalUserMediaViewModel(
    "local",
    mockMatrixRoomMember(localRtcMember, roomMember),
    of(localParticipant),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    mockLivekitRoom({ localParticipant }),
    of(undefined),
    of(undefined),
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
  localRtcMember: CallMembership,
  roomMember: Partial<RoomMember>,
  participant: Partial<RemoteParticipant>,
  continuation: (vm: RemoteUserMediaViewModel) => void | Promise<void>,
): Promise<void> {
  const remoteParticipant = mockRemoteParticipant(participant);
  const vm = new RemoteUserMediaViewModel(
    "remote",
    mockMatrixRoomMember(localRtcMember, roomMember),
    of(remoteParticipant),
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    mockLivekitRoom({}, { remoteParticipants: of([remoteParticipant]) }),
    of(undefined),
    of(undefined),
  );
  try {
    await continuation(vm);
  } finally {
    vm.destroy();
  }
}

export function mockConfig(config: Partial<ResolvedConfigOptions> = {}): void {
  vi.spyOn(Config, "get").mockReturnValue({
    ...DEFAULT_CONFIG,
    ...config,
  });
}

export class MockRTCSession extends TypedEventEmitter<
  MatrixRTCSessionEvent,
  MatrixRTCSessionEventHandlerMap
> {
  public readonly statistics = {
    counters: {},
  };

  public leaveRoomSession = vitest.fn().mockResolvedValue(undefined);

  public constructor(
    public readonly room: Room,
    private localMembership: CallMembership,
    public memberships: CallMembership[] = [],
  ) {
    super();
  }

  public isJoined(): true {
    return true;
  }

  public withMemberships(
    rtcMembers: Observable<Partial<CallMembership>[]>,
  ): MockRTCSession {
    rtcMembers.subscribe((m) => {
      const old = this.memberships;
      // always prepend the local participant
      const updated = [this.localMembership, ...(m as CallMembership[])];
      this.memberships = updated;
      this.emit(MatrixRTCSessionEvent.MembershipsChanged, old, updated);
    });

    return this;
  }
}

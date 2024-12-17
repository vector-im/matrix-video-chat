/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ConnectionState } from "livekit-client";
import { type MatrixClient } from "matrix-js-sdk/src/client";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import {
  type CallMembership,
  type MatrixRTCSession,
} from "matrix-js-sdk/src/matrixrtc";
import { BehaviorSubject, of } from "rxjs";
import { vitest } from "vitest";
import { type RelationsContainer } from "matrix-js-sdk/src/models/relations-container";

import { E2eeType } from "../e2ee/e2eeType";
import { CallViewModel } from "../state/CallViewModel";
import { mockLivekitRoom, mockMatrixRoom, MockRTCSession } from "./test";
import {
  aliceRtcMember,
  aliceParticipant,
  localParticipant,
  localRtcMember,
} from "./test-fixtures";
import { type RaisedHandInfo, type ReactionInfo } from "../reactions";

/**
 * Construct a basic CallViewModel to test components that make use of it.
 * @param members
 * @param initialRemoteRtcMemberships
 * @returns
 */
export function getBasicCallViewModelEnvironment(
  members: RoomMember[],
  initialRemoteRtcMemberships: CallMembership[] = [aliceRtcMember],
): {
  vm: CallViewModel;
  remoteRtcMemberships$: BehaviorSubject<CallMembership[]>;
  rtcSession: MockRTCSession;
  handRaisedSubject$: BehaviorSubject<Record<string, RaisedHandInfo>>;
  reactionsSubject$: BehaviorSubject<Record<string, ReactionInfo>>;
} {
  const matrixRoomId = "!myRoomId:example.com";
  const matrixRoomMembers = new Map(members.map((p) => [p.userId, p]));
  const remoteParticipants$ = of([aliceParticipant]);
  const liveKitRoom = mockLivekitRoom(
    { localParticipant },
    { remoteParticipants$ },
  );
  const matrixRoom = mockMatrixRoom({
    relations: {
      getChildEventsForEvent: vitest.fn(),
    } as Partial<RelationsContainer> as RelationsContainer,
    client: {
      getUserId: () => localRtcMember.sender,
      getDeviceId: () => localRtcMember.deviceId,
      sendEvent: vitest.fn().mockResolvedValue({ event_id: "$fake:event" }),
      redactEvent: vitest.fn().mockResolvedValue({ event_id: "$fake:event" }),
      on: vitest.fn(),
      off: vitest.fn(),
    } as Partial<MatrixClient> as MatrixClient,
    getMember: (userId) => matrixRoomMembers.get(userId) ?? null,
    roomId: matrixRoomId,
  });

  const remoteRtcMemberships$ = new BehaviorSubject<CallMembership[]>(
    initialRemoteRtcMemberships,
  );

  const handRaisedSubject$ = new BehaviorSubject({});
  const reactionsSubject$ = new BehaviorSubject({});

  const rtcSession = new MockRTCSession(
    matrixRoom,
    localRtcMember,
  ).withMemberships(remoteRtcMemberships$);

  const vm = new CallViewModel(
    rtcSession as unknown as MatrixRTCSession,
    liveKitRoom,
    {
      kind: E2eeType.PER_PARTICIPANT,
    },
    of(ConnectionState.Connected),
    handRaisedSubject$,
    reactionsSubject$,
  );
  return {
    vm,
    remoteRtcMemberships$: remoteRtcMemberships$,
    rtcSession,
    handRaisedSubject$: handRaisedSubject$,
    reactionsSubject$: reactionsSubject$,
  };
}

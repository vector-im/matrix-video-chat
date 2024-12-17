/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";
import { useCallback, useEffect, useRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { type ReactionEventContent } from "matrix-js-sdk/src/types";
import {
  RelationType,
  EventType,
  RoomEvent as MatrixRoomEvent,
} from "matrix-js-sdk/src/matrix";
import { BehaviorSubject, delay, type Observable } from "rxjs";

import {
  ElementCallReactionEventType,
  type ECallReactionEventContent,
  GenericReaction,
  ReactionSet,
  type RaisedHandInfo,
  type ReactionInfo,
} from ".";
import { useLatest } from "../useLatest";
import { useMatrixRTCSessionMemberships } from "../useMatrixRTCSessionMemberships";

export const REACTION_ACTIVE_TIME_MS = 3000;

/**
 * Listens for reactions from a RTCSession and populates subjects
 * for consumption by the CallViewModel.
 * @param rtcSession
 */
export default function useReactionsReader(rtcSession: MatrixRTCSession): {
  raisedHands$: Observable<Record<string, RaisedHandInfo>>;
  reactions$: Observable<Record<string, ReactionInfo>>;
} {
  const raisedHandsSubject$ = useRef(
    new BehaviorSubject<Record<string, RaisedHandInfo>>({}),
  );
  const reactionsSubject$ = useRef(
    new BehaviorSubject<Record<string, ReactionInfo>>({}),
  );

  reactionsSubject$.current
    .pipe(delay(REACTION_ACTIVE_TIME_MS + 50))
    .subscribe((reactions) => {
      const date = new Date();
      const nextEntries = Object.fromEntries(
        Object.entries(reactions).filter(([_, hr]) => hr.expireAfter < date),
      );
      console.log("Filtering", nextEntries);
      if (Object.keys(reactions).length === Object.keys(nextEntries).length) {
        return;
      }
      reactionsSubject$.current.next(nextEntries);
    });

  const memberships = useMatrixRTCSessionMemberships(rtcSession);
  const latestMemberships = useLatest(memberships);
  const latestRaisedHands = useLatest(raisedHandsSubject$.current);
  const room = rtcSession.room;

  const addRaisedHand = useCallback((userId: string, info: RaisedHandInfo) => {
    raisedHandsSubject$.current.next({
      ...raisedHandsSubject$.current.value,
      [userId]: info,
    });
  }, []);

  const removeRaisedHand = useCallback((userId: string) => {
    raisedHandsSubject$.current.next(
      Object.fromEntries(
        Object.entries(raisedHandsSubject$.current.value).filter(
          ([uId]) => uId !== userId,
        ),
      ),
    );
  }, []);

  // This effect will check the state whenever the membership of the session changes.
  useEffect(() => {
    // Fetches the first reaction for a given event.
    const getLastReactionEvent = (
      eventId: string,
      expectedSender: string,
    ): MatrixEvent | undefined => {
      const relations = room.relations.getChildEventsForEvent(
        eventId,
        RelationType.Annotation,
        EventType.Reaction,
      );
      const allEvents = relations?.getRelations() ?? [];
      return allEvents.find(
        (reaction) =>
          reaction.event.sender === expectedSender &&
          reaction.getType() === EventType.Reaction &&
          reaction.getContent()?.["m.relates_to"]?.key === "🖐️",
      );
    };

    // Remove any raised hands for users no longer joined to the call.
    for (const identifier of Object.keys(raisedHandsSubject$).filter(
      (rhId) => !memberships.find((u) => u.sender == rhId),
    )) {
      removeRaisedHand(identifier);
    }

    // For each member in the call, check to see if a reaction has
    // been raised and adjust.
    for (const m of memberships) {
      if (!m.sender || !m.eventId) {
        continue;
      }
      const identifier = `${m.sender}:${m.deviceId}`;
      if (
        raisedHandsSubject$.current.value[identifier] &&
        raisedHandsSubject$.current.value[identifier].membershipEventId !==
          m.eventId
      ) {
        // Membership event for sender has changed since the hand
        // was raised, reset.
        removeRaisedHand(identifier);
      }
      const reaction = getLastReactionEvent(m.eventId, m.sender);
      if (reaction) {
        const eventId = reaction?.getId();
        if (!eventId) {
          continue;
        }
        addRaisedHand(`${m.sender}:${m.deviceId}`, {
          membershipEventId: m.eventId,
          reactionEventId: eventId,
          time: new Date(reaction.localTimestamp),
        });
      }
    }
    // Ignoring raisedHands here because we don't want to trigger each time the raised
    // hands set is updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, memberships, addRaisedHand, removeRaisedHand]);

  // This effect handles any *live* reaction/redactions in the room.
  useEffect(() => {
    const handleReactionEvent = (event: MatrixEvent): void => {
      // Decrypted events might come from a different room
      if (event.getRoomId() !== room.roomId) return;
      // Skip any events that are still sending.
      if (event.isSending()) return;

      const sender = event.getSender();
      const reactionEventId = event.getId();
      // Skip any event without a sender or event ID.
      if (!sender || !reactionEventId) return;

      room.client
        .decryptEventIfNeeded(event)
        .catch((e) => logger.warn(`Failed to decrypt ${event.getId()}`, e));
      if (event.isBeingDecrypted() || event.isDecryptionFailure()) return;

      if (event.getType() === ElementCallReactionEventType) {
        const content: ECallReactionEventContent = event.getContent();

        const membershipEventId = content?.["m.relates_to"]?.event_id;
        const membershipEvent = latestMemberships.current.find(
          (e) => e.eventId === membershipEventId && e.sender === sender,
        );
        // Check to see if this reaction was made to a membership event (and the
        // sender of the reaction matches the membership)
        if (!membershipEvent) {
          logger.warn(
            `Reaction target was not a membership event for ${sender}, ignoring`,
          );
          return;
        }
        const identifier = `${membershipEvent.sender}:${membershipEvent.deviceId}`;

        if (!content.emoji) {
          logger.warn(`Reaction had no emoji from ${reactionEventId}`);
          return;
        }

        const segment = new Intl.Segmenter(undefined, {
          granularity: "grapheme",
        })
          .segment(content.emoji)
          [Symbol.iterator]();
        const emoji = segment.next().value?.segment;

        if (!emoji?.trim()) {
          logger.warn(
            `Reaction had no emoji from ${reactionEventId} after splitting`,
          );
          return;
        }

        // One of our custom reactions
        const reaction = {
          ...GenericReaction,
          emoji,
          // If we don't find a reaction, we can fallback to the generic sound.
          ...ReactionSet.find((r) => r.name === content.name),
        };

        const currentReactions = reactionsSubject$.current.value;
        if (currentReactions[identifier]) {
          // We've still got a reaction from this user, ignore it to prevent spamming
          return;
        }
        reactionsSubject$.current.next({
          ...currentReactions,
          [identifier]: {
            reactionOption: reaction,
            expireAfter: new Date(Date.now() + REACTION_ACTIVE_TIME_MS),
          },
        });
      } else if (event.getType() === EventType.Reaction) {
        const content = event.getContent() as ReactionEventContent;
        const membershipEventId = content["m.relates_to"].event_id;

        // Check to see if this reaction was made to a membership event (and the
        // sender of the reaction matches the membership)
        const membershipEvent = latestMemberships.current.find(
          (e) => e.eventId === membershipEventId && e.sender === sender,
        );
        if (!membershipEvent) {
          logger.warn(
            `Reaction target was not a membership event for ${sender}, ignoring`,
          );
          return;
        }

        if (content?.["m.relates_to"].key === "🖐️") {
          addRaisedHand(
            `${membershipEvent.sender}:${membershipEvent.deviceId}`,
            {
              reactionEventId,
              membershipEventId,
              time: new Date(event.localTimestamp),
            },
          );
        }
      } else if (event.getType() === EventType.RoomRedaction) {
        const targetEvent = event.event.redacts;
        const targetUser = Object.entries(latestRaisedHands.current.value).find(
          ([_u, r]) => r.reactionEventId === targetEvent,
        )?.[0];
        if (!targetUser) {
          // Reaction target was not for us, ignoring
          return;
        }
        removeRaisedHand(targetUser);
      }
    };

    room.on(MatrixRoomEvent.Timeline, handleReactionEvent);
    room.on(MatrixRoomEvent.Redaction, handleReactionEvent);
    room.client.on(MatrixEventEvent.Decrypted, handleReactionEvent);

    // We listen for a local echo to get the real event ID, as timeline events
    // may still be sending.
    room.on(MatrixRoomEvent.LocalEchoUpdated, handleReactionEvent);

    return (): void => {
      room.off(MatrixRoomEvent.Timeline, handleReactionEvent);
      room.off(MatrixRoomEvent.Redaction, handleReactionEvent);
      room.client.off(MatrixEventEvent.Decrypted, handleReactionEvent);
      room.off(MatrixRoomEvent.LocalEchoUpdated, handleReactionEvent);
    };
  }, [
    room,
    addRaisedHand,
    removeRaisedHand,
    latestMemberships,
    latestRaisedHands,
  ]);

  return {
    reactions$: reactionsSubject$.current.asObservable(),
    raisedHands$: raisedHandsSubject$.current.asObservable(),
  };
}

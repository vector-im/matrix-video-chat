/*
Copyright 2024 Milton Moura <miltonmoura@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  EventType,
  MatrixEvent,
  RelationType,
  RoomEvent as MatrixRoomEvent,
  MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import { ReactionEventContent } from "matrix-js-sdk/src/types";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixRTCSessionMemberships } from "./useMatrixRTCSessionMemberships";
import { useClientState } from "./ClientContext";
import {
  ECallReactionEventContent,
  ElementCallReactionEventType,
  GenericReaction,
  ReactionOption,
  ReactionSet,
} from "./reactions";
import { useLatest } from "./useLatest";

interface ReactionsContextType {
  /**
   * identifier (userId:deviceId => Date)
   */
  raisedHands: Record<string, Date>;
  supportsReactions: boolean;
  /**
   * reactions (userId:deviceId => Date)
   */
  reactions: Record<string, ReactionOption>;
  toggleRaisedHand: () => Promise<void>;
  sendReaction: (reaction: ReactionOption) => Promise<void>;
}

const ReactionsContext = createContext<ReactionsContextType | undefined>(
  undefined,
);

interface RaisedHandInfo {
  /**
   * Call membership event that was reacted to.
   */
  membershipEventId: string;
  /**
   * Event ID of the reaction itself.
   */
  reactionEventId: string;
  /**
   * The time when the reaction was raised.
   */
  time: Date;
}

const REACTION_ACTIVE_TIME_MS = 3000;

export const useReactions = (): ReactionsContextType => {
  const context = useContext(ReactionsContext);
  if (!context) {
    throw new Error("useReactions must be used within a ReactionsProvider");
  }
  return context;
};

/**
 * Provider that handles raised hand reactions for a given `rtcSession`.
 */
export const ReactionsProvider = ({
  children,
  rtcSession,
}: {
  children: ReactNode;
  rtcSession: MatrixRTCSession;
}): JSX.Element => {
  const [raisedHands, setRaisedHands] = useState<
    Record<string, RaisedHandInfo>
  >({});
  const memberships = useMatrixRTCSessionMemberships(rtcSession);
  const clientState = useClientState();
  const supportsReactions =
    clientState?.state === "valid" && clientState.supportedFeatures.reactions;
  const room = rtcSession.room;
  const myUserId = room.client.getUserId();
  const myDeviceId = room.client.getDeviceId();

  const latestMemberships = useLatest(memberships);
  const latestRaisedHands = useLatest(raisedHands);

  const myMembershipEvent = useMemo(
    () =>
      memberships.find(
        (m) => m.sender === myUserId && m.deviceId === myDeviceId,
      )?.eventId,
    [memberships, myUserId, myDeviceId],
  );
  const myMembershipIdentifier = useMemo(() => {
    const membership = memberships.find((m) => m.sender === myUserId);
    return membership
      ? `${membership.sender}:${membership.deviceId}`
      : undefined;
  }, [memberships, myUserId]);

  const [reactions, setReactions] = useState<Record<string, ReactionOption>>(
    {},
  );

  // Reduce the data down for the consumers.
  const resultRaisedHands = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(raisedHands).map(([uid, data]) => [uid, data.time]),
      ),
    [raisedHands],
  );
  const addRaisedHand = useCallback((userId: string, info: RaisedHandInfo) => {
    setRaisedHands((prevRaisedHands) => ({
      ...prevRaisedHands,
      [userId]: info,
    }));
  }, []);

  const removeRaisedHand = useCallback((userId: string) => {
    setRaisedHands(
      ({ [userId]: _removed, ...remainingRaisedHands }) => remainingRaisedHands,
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
    for (const identifier of Object.keys(raisedHands).filter(
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
        raisedHands[identifier] &&
        raisedHands[identifier].membershipEventId !== m.eventId
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
    const reactionTimeouts = new Set<number>();
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

        if (!emoji) {
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

        setReactions((reactions) => {
          if (reactions[identifier]) {
            // We've still got a reaction from this user, ignore it to prevent spamming
            return reactions;
          }
          const timeout = window.setTimeout(() => {
            // Clear the reaction after some time.
            setReactions(
              ({ [identifier]: _unused, ...remaining }) => remaining,
            );
            reactionTimeouts.delete(timeout);
          }, REACTION_ACTIVE_TIME_MS);
          reactionTimeouts.add(timeout);
          return {
            ...reactions,
            [identifier]: reaction,
          };
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
        const targetUser = Object.entries(latestRaisedHands.current).find(
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
      reactionTimeouts.forEach((t) => clearTimeout(t));
      // If we're clearing timeouts, we also clear all reactions.
      setReactions({});
    };
  }, [
    room,
    addRaisedHand,
    removeRaisedHand,
    latestMemberships,
    latestRaisedHands,
  ]);

  const toggleRaisedHand = useCallback(async () => {
    console.log("toggleRaisedHand", myMembershipIdentifier);
    if (!myMembershipIdentifier) {
      return;
    }
    const myReactionId = raisedHands[myMembershipIdentifier]?.reactionEventId;

    if (!myReactionId) {
      try {
        if (!myMembershipEvent) {
          throw new Error("Cannot find own membership event");
        }
        const reaction = await room.client.sendEvent(
          rtcSession.room.roomId,
          EventType.Reaction,
          {
            "m.relates_to": {
              rel_type: RelationType.Annotation,
              event_id: myMembershipEvent,
              key: "🖐️",
            },
          },
        );
        logger.debug("Sent raise hand event", reaction.event_id);
      } catch (ex) {
        logger.error("Failed to send raised hand", ex);
      }
    } else {
      try {
        await room.client.redactEvent(rtcSession.room.roomId, myReactionId);
        logger.debug("Redacted raise hand event");
      } catch (ex) {
        logger.error("Failed to redact reaction event", myReactionId, ex);
        throw ex;
      }
    }
  }, [
    myMembershipEvent,
    myMembershipIdentifier,
    raisedHands,
    rtcSession,
    room,
  ]);

  const sendReaction = useCallback(
    async (reaction: ReactionOption) => {
      if (!myMembershipIdentifier || !reactions[myMembershipIdentifier]) {
        // We're still reacting
        return;
      }
      if (!myMembershipEvent) {
        throw new Error("Cannot find own membership event");
      }
      await room.client.sendEvent(
        rtcSession.room.roomId,
        ElementCallReactionEventType,
        {
          "m.relates_to": {
            rel_type: RelationType.Reference,
            event_id: myMembershipEvent,
          },
          emoji: reaction.emoji,
          name: reaction.name,
        },
      );
    },
    [myMembershipEvent, reactions, room, myMembershipIdentifier, rtcSession],
  );

  return (
    <ReactionsContext.Provider
      value={{
        raisedHands: resultRaisedHands,
        supportsReactions,
        reactions,
        toggleRaisedHand,
        sendReaction,
      }}
    >
      {children}
    </ReactionsContext.Provider>
  );
};

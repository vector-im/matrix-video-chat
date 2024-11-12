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
  raisedHands: Record<string, Date>;
  supportsReactions: boolean;
  reactions: Record<string, ReactionOption>;
  lowerHand: () => Promise<void>;
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
    logger.info(`Adding raised hand for ${userId}`);
    setRaisedHands((prevRaisedHands) => ({
      ...prevRaisedHands,
      [userId]: info,
    }));
  }, []);

  const removeRaisedHand = useCallback((userId: string) => {
    logger.info(`Removing raised hand for ${userId}`);
    setRaisedHands(
      ({ [userId]: _removed, ...remainingRaisedHands }) => remainingRaisedHands,
    );
  }, []);

  // This effect will check the state whenever the membership of the session changes.
  useEffect(() => {
    // Fetches the first reaction for a given event.
    const getLastReactionEvent = async (
      eventId: string,
      expectedSender: string,
    ): Promise<MatrixEvent | undefined> => {
      const relations = room.relations.getChildEventsForEvent(
        eventId,
        RelationType.Annotation,
        EventType.Reaction,
      );
      let allEvents = relations?.getRelations() ?? [];
      // If we found no relations for this event, fetch via fetchRelations.
      if (allEvents.length === 0) {
        const res = await room.client.fetchRelations(
          room.roomId,
          eventId,
          RelationType.Annotation,
          EventType.Reaction,
        );
        allEvents = res.chunk.map((e) => new MatrixEvent(e));
      }
      return allEvents.find(
        (reaction) =>
          reaction.event.sender === expectedSender &&
          reaction.getType() === EventType.Reaction &&
          reaction.getContent()?.["m.relates_to"]?.key === "🖐️",
      );
    };

    // Remove any raised hands for users no longer joined to the call.
    for (const userId of Object.keys(raisedHands).filter(
      (rhId) => !memberships.find((u) => u.sender == rhId),
    )) {
      removeRaisedHand(userId);
    }

    // For each member in the call, check to see if a reaction has
    // been raised and adjust.
    for (const m of memberships) {
      if (!m.sender || !m.eventId) {
        continue;
      }
      if (
        raisedHands[m.sender] &&
        raisedHands[m.sender].membershipEventId !== m.eventId
      ) {
        // Membership event for sender has changed since the hand
        // was raised, reset.
        removeRaisedHand(m.sender);
      }
      getLastReactionEvent(m.eventId, m.sender)
        .then((reaction) => {
          if (reaction) {
            const eventId = reaction.getId();
            if (!eventId) {
              return;
            }
            addRaisedHand(m.sender!, {
              membershipEventId: m.eventId!,
              reactionEventId: eventId,
              time: new Date(reaction.localTimestamp),
            });
          }
        })
        .catch((ex) => {
          logger.warn(
            `Failed to fetch reaction for member ${m.sender} (${m.eventId})`,
            ex,
          );
        });
    }
    // Ignoring raisedHands here because we don't want to trigger each time the raised
    // hands set is updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, memberships, myUserId, addRaisedHand, removeRaisedHand]);

  const latestMemberships = useLatest(memberships);
  const latestRaisedHands = useLatest(raisedHands);

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

      if (event.getType() === ElementCallReactionEventType) {
        room.client
          .decryptEventIfNeeded(event)
          .catch((e) => logger.warn(`Failed to decrypt ${event.getId()}`, e));
        if (event.isBeingDecrypted() || event.isDecryptionFailure()) return;
        const content: ECallReactionEventContent = event.getContent();

        const membershipEventId = content?.["m.relates_to"]?.event_id;
        // Check to see if this reaction was made to a membership event (and the
        // sender of the reaction matches the membership)
        if (
          !latestMemberships.current.some(
            (e) => e.eventId === membershipEventId && e.sender === sender,
          )
        ) {
          logger.warn(
            `Reaction target was not a membership event for ${sender}, ignoring`,
          );
          return;
        }

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
          if (reactions[sender]) {
            // We've still got a reaction from this user, ignore it to prevent spamming
            return reactions;
          }
          const timeout = window.setTimeout(() => {
            // Clear the reaction after some time.
            setReactions(({ [sender]: _unused, ...remaining }) => remaining);
            reactionTimeouts.delete(timeout);
          }, REACTION_ACTIVE_TIME_MS);
          reactionTimeouts.add(timeout);
          return {
            ...reactions,
            [sender]: reaction,
          };
        });
      } else if (event.getType() === EventType.Reaction) {
        const content = event.getContent() as ReactionEventContent;
        const membershipEventId = content["m.relates_to"].event_id;

        // Check to see if this reaction was made to a membership event (and the
        // sender of the reaction matches the membership)
        if (
          !latestMemberships.current.some(
            (e) => e.eventId === membershipEventId && e.sender === sender,
          )
        ) {
          logger.warn(
            `Reaction target was not a membership event for ${sender}, ignoring`,
          );
          return;
        }

        if (content?.["m.relates_to"].key === "🖐️") {
          addRaisedHand(sender, {
            reactionEventId,
            membershipEventId,
            time: new Date(event.localTimestamp),
          });
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
      room.off(MatrixRoomEvent.LocalEchoUpdated, handleReactionEvent);
      room.client.off(MatrixEventEvent.Decrypted, handleReactionEvent);
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

  const lowerHand = useCallback(async () => {
    if (!myUserId || !raisedHands[myUserId]) {
      return;
    }
    const myReactionId = raisedHands[myUserId].reactionEventId;
    if (!myReactionId) {
      logger.warn(`Hand raised but no reaction event to redact!`);
      return;
    }
    try {
      await room.client.redactEvent(rtcSession.room.roomId, myReactionId);
      logger.debug("Redacted raise hand event");
    } catch (ex) {
      logger.error("Failed to redact reaction event", myReactionId, ex);
    }
  }, [myUserId, raisedHands, rtcSession, room]);

  return (
    <ReactionsContext.Provider
      value={{
        raisedHands: resultRaisedHands,
        supportsReactions,
        reactions,
        lowerHand,
      }}
    >
      {children}
    </ReactionsContext.Provider>
  );
};

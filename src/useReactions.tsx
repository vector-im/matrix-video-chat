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
   * The sender who sent the raised hand.
   */
  sender: string;
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

type MembershipEventId = string;

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
    Record<MembershipEventId, RaisedHandInfo>
  >({});
  const memberships = useMatrixRTCSessionMemberships(rtcSession);
  const clientState = useClientState();
  const supportsReactions =
    clientState?.state === "valid" && clientState.supportedFeatures.reactions;
  const room = rtcSession.room;
  const myUserId = room.client.getUserId();

  const [reactions, setReactions] = useState<
    Record<MembershipEventId, ReactionOption>
  >({});

  // Reduce the data down for the consumers.
  const resultRaisedHands = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(raisedHands).map(([membershipEventId, data]) => [
          membershipEventId,
          data.time,
        ]),
      ),
    [raisedHands],
  );

  const addRaisedHand = useCallback(
    (membershipEventId: string, info: RaisedHandInfo) => {
      setRaisedHands((prevRaisedHands) => ({
        ...prevRaisedHands,
        [membershipEventId]: info,
      }));
    },
    [],
  );

  const removeRaisedHand = useCallback((membershipEventId: string) => {
    setRaisedHands(
      ({ [membershipEventId]: _removed, ...remainingRaisedHands }) =>
        remainingRaisedHands,
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

    for (const previousMemberEventId of Object.keys(raisedHands).filter(
      (eventId) => !memberships.some((m) => m.eventId === eventId),
    )) {
      removeRaisedHand(previousMemberEventId);
    }

    // For each member in the call, check to see if a reaction has
    // been raised and adjust.
    for (const m of memberships) {
      if (!m.sender || !m.eventId) {
        continue;
      }
      const reaction = getLastReactionEvent(m.eventId, m.sender);
      if (reaction) {
        const eventId = reaction?.getId();
        if (!eventId) {
          continue;
        }
        addRaisedHand(m.eventId, {
          sender: m.sender,
          reactionEventId: eventId,
          time: new Date(reaction.localTimestamp),
        });
      }
    }
    // Ignoring raisedHands here because we don't want to trigger each time the raised
    // hands set is updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, memberships, myUserId, addRaisedHand, removeRaisedHand]);

  const latestMemberships = useLatest(memberships);
  const latestRaisedHands = useLatest(raisedHands);

  // This effect handles any *live* reaction/redactions in the room.
  useEffect(() => {
    const reactionTimeouts = new Set<NodeJS.Timeout>();
    const handleReactionEvent = (event: MatrixEvent): void => {
      if (event.isSending()) {
        // Skip any events that are still sending.
        return;
      }

      const sender = event.getSender();
      const reactionEventId = event.getId();
      if (!sender || !reactionEventId) {
        // Skip any event without a sender or event ID.
        return;
      }

      if (event.getType() === ElementCallReactionEventType) {
        const content: ECallReactionEventContent = event.getContent();

        console.log(latestMemberships, content);

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
          if (reactions[membershipEventId]) {
            // We've still got a reaction from this user, ignore it to prevent spamming
            return reactions;
          }
          const timeout = setTimeout(() => {
            // Clear the reaction after some time.
            setReactions(
              ({ [membershipEventId]: _unused, ...remaining }) => remaining,
            );
            reactionTimeouts.delete(timeout);
          }, REACTION_ACTIVE_TIME_MS);
          reactionTimeouts.add(timeout);
          return {
            ...reactions,
            [membershipEventId]: reaction,
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
          addRaisedHand(membershipEventId, {
            reactionEventId,
            sender,
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

    // We listen for a local echo to get the real event ID, as timeline events
    // may still be sending.
    room.on(MatrixRoomEvent.LocalEchoUpdated, handleReactionEvent);

    return (): void => {
      room.off(MatrixRoomEvent.Timeline, handleReactionEvent);
      room.off(MatrixRoomEvent.Redaction, handleReactionEvent);
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

  const myMembershipEventId = useMemo(() => {
    console.log(
      room.client.getUserId(),
      room.client.getDeviceId(),
      memberships,
    );
    return memberships.find(
      (m) =>
        m.sender === room.client.getUserId() &&
        m.deviceId === room.client.getDeviceId(),
    );
  }, [memberships, room])?.eventId;

  const lowerHand = useCallback(async () => {
    if (!myMembershipEventId || !raisedHands[myMembershipEventId]) {
      logger.warn(`No membership event for us!`, myMembershipEventId);
      return;
    }
    const myReactionId = raisedHands[myMembershipEventId].reactionEventId;
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
  }, [myMembershipEventId, raisedHands, rtcSession, room]);

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

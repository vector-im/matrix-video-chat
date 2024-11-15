/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { Button as CpdButton, Tooltip, Alert } from "@vector-im/compound-web";
import {
  RaisedHandSolidIcon,
  ReactionIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  ComponentPropsWithoutRef,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { logger } from "matrix-js-sdk/src/logger";
import classNames from "classnames";

import { useReactions } from "../useReactions";
import styles from "./ReactionToggleButton.module.css";
import { ReactionOption, ReactionSet, ReactionsRowSize } from "../reactions";
import { Modal } from "../Modal";

interface InnerButtonProps extends ComponentPropsWithoutRef<"button"> {
  raised: boolean;
  open: boolean;
}

const InnerButton: FC<InnerButtonProps> = ({ raised, open, ...props }) => {
  const { t } = useTranslation();

  return (
    <Tooltip label={t("action.raise_hand_or_send_reaction")}>
      <CpdButton
        className={classNames(raised && styles.raisedButton)}
        aria-expanded={open}
        aria-haspopup
        aria-label={t("action.raise_hand_or_send_reaction")}
        kind={raised || open ? "primary" : "secondary"}
        iconOnly
        Icon={raised ? RaisedHandSolidIcon : ReactionIcon}
        {...props}
      />
    </Tooltip>
  );
};

export function ReactionPopupMenu({
  sendReaction,
  toggleRaisedHand,
  isHandRaised,
  canReact,
  errorText,
}: {
  sendReaction: (reaction: ReactionOption) => void;
  toggleRaisedHand: () => void;
  errorText?: string;
  isHandRaised: boolean;
  canReact: boolean;
}): ReactNode {
  const { t } = useTranslation();
  const [isFullyExpanded, setExpanded] = useState(false);

  const filteredReactionSet = useMemo(
    () => (isFullyExpanded ? ReactionSet : ReactionSet.slice(0, 5)),
    [isFullyExpanded],
  );
  const label = isHandRaised
    ? t("action.lower_hand", { keyboardShortcut: "H" })
    : t("action.raise_hand", { keyboardShortcut: "H" });
  return (
    <>
      {errorText && (
        <Alert
          className={styles.alert}
          type="critical"
          title={t("common.something_went_wrong")}
        >
          {errorText}
        </Alert>
      )}
      <div className={styles.reactionPopupMenu}>
        <section className={styles.handRaiseSection}>
          <Tooltip label={label}>
            <CpdButton
              kind={isHandRaised ? "primary" : "secondary"}
              aria-keyshortcuts="H"
              aria-pressed={isHandRaised}
              aria-label={label}
              onClick={() => toggleRaisedHand()}
              iconOnly
              Icon={RaisedHandSolidIcon}
            />
          </Tooltip>
        </section>
        <div className={styles.verticalSeperator} />
        <section className={styles.reactionsMenuSection}>
          <menu
            className={classNames(
              isFullyExpanded && styles.reactionsMenuExpanded,
              styles.reactionsMenu,
            )}
          >
            {filteredReactionSet.map((reaction, index) => (
              <li key={reaction.name}>
                <Tooltip
                  label={
                    index >= ReactionsRowSize
                      ? reaction.name
                      : `${reaction.name} (${index + 1})`
                  }
                >
                  <CpdButton
                    kind="secondary"
                    className={styles.reactionButton}
                    disabled={!canReact}
                    onClick={() => sendReaction(reaction)}
                    aria-keyshortcuts={
                      index < ReactionsRowSize
                        ? (index + 1).toString()
                        : undefined
                    }
                  >
                    {reaction.emoji}
                  </CpdButton>
                </Tooltip>
              </li>
            ))}
          </menu>
        </section>
        <section style={{ marginLeft: "var(--cpd-separator-spacing)" }}>
          <Tooltip
            label={
              isFullyExpanded ? t("action.show_less") : t("action.show_more")
            }
          >
            <CpdButton
              iconOnly
              aria-label={
                isFullyExpanded ? t("action.show_less") : t("action.show_more")
              }
              Icon={isFullyExpanded ? ChevronUpIcon : ChevronDownIcon}
              kind="tertiary"
              onClick={() => setExpanded(!isFullyExpanded)}
            />
          </Tooltip>
        </section>
      </div>
    </>
  );
}

interface ReactionToggleButtonProps extends ComponentPropsWithoutRef<"button"> {
  userId: string;
}

export function ReactionToggleButton({
  userId,
  ...props
}: ReactionToggleButtonProps): ReactNode {
  const { t } = useTranslation();
  const { raisedHands, toggleRaisedHand, sendReaction, reactions } =
    useReactions();
  const [busy, setBusy] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [errorText, setErrorText] = useState<string>();

  const isHandRaised = !!raisedHands[userId];
  const canReact = !reactions[userId];

  useEffect(() => {
    // Clear whenever the reactions menu state changes.
    setErrorText(undefined);
  }, [showReactionsMenu]);

  const sendRelation = useCallback(
    async (reaction: ReactionOption) => {
      try {
        setBusy(true);
        await sendReaction(reaction);
        setErrorText(undefined);
        setShowReactionsMenu(false);
      } catch (ex) {
        setErrorText(ex instanceof Error ? ex.message : "Unknown error");
        logger.error("Failed to send reaction", ex);
      } finally {
        setBusy(false);
      }
    },
    [sendReaction],
  );

  const wrappedToggleRaisedHand = useCallback(() => {
    const toggleHand = async (): Promise<void> => {
      try {
        setBusy(true);
        await toggleRaisedHand();
        setShowReactionsMenu(false);
      } catch (ex) {
        setErrorText(ex instanceof Error ? ex.message : "Unknown error");
        logger.error("Failed to raise/lower hand", ex);
      } finally {
        setBusy(false);
      }
    };

    void toggleHand();
  }, [toggleRaisedHand]);

  return (
    <>
      <InnerButton
        disabled={busy}
        onClick={() => setShowReactionsMenu((show) => !show)}
        raised={isHandRaised}
        open={showReactionsMenu}
        {...props}
      />
      <Modal
        open={showReactionsMenu}
        title={t("action.pick_reaction")}
        hideHeader
        classNameModal={styles.reactionPopupMenuModal}
        className={styles.reactionPopupMenuRoot}
        onDismiss={() => setShowReactionsMenu(false)}
      >
        <ReactionPopupMenu
          errorText={errorText}
          isHandRaised={isHandRaised}
          canReact={!busy && canReact}
          sendReaction={(reaction) => void sendRelation(reaction)}
          toggleRaisedHand={wrappedToggleRaisedHand}
        />
      </Modal>
    </>
  );
}

/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { FC, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Close as DialogClose,
} from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";
import { Heading, Glass } from "@vector-im/compound-web";

import styles from "./Modal.module.css";
import overlayStyles from "./Overlay.module.css";
import { useMediaQuery } from "./useMediaQuery";

export interface Props {
  title: string;
  /**
   * Hide the modal header. Used for smaller popups where the context is readily apparent.
   * A title should still be specified for users using assistive technology.
   */
  hideHeader?: boolean;
  children: ReactNode;
  className?: string;
  /**
   * The controlled open state of the modal.
   */
  // An option to leave the open state uncontrolled is intentionally not
  // provided, since modals are always opened due to external triggers, and it
  // is the author's belief that controlled components lead to more obvious code.
  open: boolean;
  /**
   * Callback for when the user dismisses the modal. If undefined, the modal
   * will be non-dismissable.
   */
  onDismiss?: () => void;
  /**
   * Whether the modal content has tabs.
   */
  // TODO: Better tabs support
  tabbed?: boolean;
}

/**
 * A modal, taking the form of a drawer / bottom sheet on touchscreen devices,
 * and a dialog box on desktop.
 */
export const Modal: FC<Props> = ({
  title,
  hideHeader,
  children,
  className,
  open,
  onDismiss,
  tabbed,
  ...rest
}) => {
  const { t } = useTranslation();
  // Empirically, Chrome on Android can end up not matching (hover: none), but
  // still matching (pointer: coarse) :/
  const touchscreen = useMediaQuery("(hover: none) or (pointer: coarse)");
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onDismiss?.();
    },
    [onDismiss],
  );

  if (touchscreen) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        dismissible={onDismiss !== undefined}
      >
        <Drawer.Portal>
          <Drawer.Overlay className={classNames(overlayStyles.bg)} />
          <Drawer.Content
            className={classNames(
              className,
              overlayStyles.overlay,
              styles.modal,
              styles.drawer,
              { [styles.tabbed]: tabbed },
            )}
            // Suppress the warning about there being no description; the modal
            // has an accessible title
            aria-describedby={undefined}
            {...rest}
          >
            <div className={styles.content}>
              <div className={styles.header}>
                <div className={styles.handle} />
                <VisuallyHidden asChild>
                  <Drawer.Title>{title}</Drawer.Title>
                </VisuallyHidden>
              </div>
              <div className={styles.body}>{children}</div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  } else {
    const titleNode = (
      <DialogTitle asChild>
        <Heading as="h2" weight="semibold" size="md">
          {title}
        </Heading>
      </DialogTitle>
    );
    const header = (
      <div className={styles.header}>
        {titleNode}
        {onDismiss !== undefined && (
          <DialogClose
            className={styles.close}
            data-testid="modal_close"
            aria-label={t("action.close")}
          >
            <CloseIcon width={20} height={20} />
          </DialogClose>
        )}
      </div>
    );

    return (
      <DialogRoot open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay
            className={classNames(overlayStyles.bg, overlayStyles.animate)}
          />
          {/* Suppress the warning about there being no description; the modal
          has an accessible title */}
          <DialogContent asChild aria-describedby={undefined} {...rest}>
            <Glass
              className={classNames(
                overlayStyles.overlay,
                overlayStyles.animate,
                styles.modal,
                styles.dialog,
                { [styles.tabbed]: tabbed },
                className,
              )}
            >
              <div className={styles.content}>
                {!hideHeader ? header : null}
                {hideHeader ? (
                  <VisuallyHidden asChild>{titleNode}</VisuallyHidden>
                ) : null}
                <div className={styles.body}>{children}</div>
              </div>
            </Glass>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    );
  }
};

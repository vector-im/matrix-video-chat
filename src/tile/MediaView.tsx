/*
Copyright 2024 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { animated } from "@react-spring/web";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import { ComponentProps, ReactNode, forwardRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import { VideoTrack } from "@livekit/components-react";
import { Text, Tooltip } from "@vector-im/compound-web";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./MediaView.module.css";
import { Avatar } from "../Avatar";

interface Props extends ComponentProps<typeof animated.div> {
  className?: string;
  style?: ComponentProps<typeof animated.div>["style"];
  targetWidth: number;
  targetHeight: number;
  video?: TrackReferenceOrPlaceholder;
  videoFit: "cover" | "contain";
  mirror: boolean;
  member: RoomMember | undefined;
  videoEnabled: boolean;
  unencryptedWarning: boolean;
  nameTagLeadingIcon?: ReactNode;
  displayName: string;
  primaryButton?: ReactNode;
  lastEncryptionError?: Error;
}

export const MediaView = forwardRef<HTMLDivElement, Props>(
  (
    {
      className,
      style,
      targetWidth,
      targetHeight,
      video,
      videoFit,
      mirror,
      member,
      videoEnabled,
      unencryptedWarning,
      nameTagLeadingIcon,
      displayName,
      primaryButton,
      lastEncryptionError,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();

    const statusText = useMemo<string | undefined>(
      () => lastEncryptionError?.message,
      [lastEncryptionError],
    );

    return (
      <animated.div
        className={classNames(styles.media, className, {
          [styles.mirror]: mirror,
          [styles.videoMuted]: !videoEnabled,
        })}
        style={style}
        ref={ref}
        data-testid="videoTile"
        data-video-fit={videoFit}
        {...props}
      >
        <div className={styles.bg}>
          <Avatar
            id={member?.userId ?? displayName}
            name={displayName}
            size={Math.round(Math.min(targetWidth, targetHeight) / 2)}
            src={member?.getMxcAvatarUrl()}
            className={styles.avatar}
          />
          {video?.publication ? (
            <VideoTrack
              trackRef={video}
              // There's no reason for this to be focusable
              tabIndex={-1}
              disablePictureInPicture
            />
          ) : null}
        </div>
        <div className={styles.fg}>
          {statusText ? (
            <div className={styles.status}>
              <span>{statusText}</span>
            </div>
          ) : null}
          {!video ? (
            <div className={styles.status}>
              <span>{t("no_media_available")}</span>
            </div>
          ) : null}
          {!member ? (
            <div className={styles.status}>
              <span>{t("room_member_not_found")}</span>
            </div>
          ) : null}
          <div className={styles.nameTag}>
            {nameTagLeadingIcon}
            <Tooltip label={member?.userId ?? t("room_member_not_found")}>
              <Text as="span" size="sm" weight="medium" className={styles.name}>
                {displayName}
              </Text>
            </Tooltip>
            {unencryptedWarning && (
              <Tooltip
                label={t("common.unencrypted")}
                placement="bottom"
                isTriggerInteractive={false}
              >
                <ErrorIcon
                  width={20}
                  height={20}
                  className={styles.errorIcon}
                  aria-hidden
                />
              </Tooltip>
            )}
          </div>
          {primaryButton}
        </div>
      </animated.div>
    );
  },
);

MediaView.displayName = "MediaView";

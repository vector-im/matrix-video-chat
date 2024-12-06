/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { useEffect, useRef, FC, ReactNode, useMemo } from "react";
import useMeasure from "react-use-measure";
import { facingModeFromLocalTrack, LocalVideoTrack } from "livekit-client";
import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { Avatar } from "../Avatar";
import styles from "./VideoPreview.module.css";
import { MuteStates } from "./MuteStates";
import { EncryptionSystem } from "../e2ee/sharedKeyManagement";

export type MatrixInfo = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  roomId: string;
  roomName: string;
  roomAlias: string | null;
  roomAvatar: string | null;
  e2eeSystem: EncryptionSystem;
};

interface Props {
  matrixInfo: MatrixInfo;
  muteStates: MuteStates;
  videoTrack: LocalVideoTrack | null;
  children: ReactNode;
}

export const VideoPreview: FC<Props> = ({
  matrixInfo,
  muteStates,
  videoTrack,
  children,
}) => {
  const { t } = useTranslation();
  const [previewRef, previewBounds] = useMeasure();

  const videoEl = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Effect to connect the videoTrack with the video element.
    if (videoEl.current) {
      videoTrack?.attach(videoEl.current);
    }
    return (): void => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  const cameraIsStarting = useMemo(
    () => muteStates.video.enabled && (!videoTrack || !videoEl.current),
    [muteStates.video.enabled, videoTrack, videoEl],
  );

  return (
    <div className={classNames(styles.preview)} ref={previewRef}>
      <video
        className={
          videoTrack &&
          facingModeFromLocalTrack(videoTrack).facingMode === "user"
            ? styles.mirror
            : undefined
        }
        ref={videoEl}
        muted
        playsInline
        // There's no reason for this to be focusable
        tabIndex={-1}
        disablePictureInPicture
      />
      {(!muteStates.video.enabled || cameraIsStarting) && (
        <>
          <div className={styles.avatarContainer}>
            {cameraIsStarting && (
              <div className={styles.cameraStarting}>
                {t("video_tile.camera_starting")}
              </div>
            )}
            <Avatar
              id={matrixInfo.userId}
              name={matrixInfo.displayName}
              size={Math.min(previewBounds.width, previewBounds.height) / 2}
              src={matrixInfo.avatarUrl}
              loading={cameraIsStarting}
            />
          </div>
        </>
      )}
      <div className={styles.buttonBar}>{children}</div>
    </div>
  );
};

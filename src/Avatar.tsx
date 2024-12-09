/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { useMemo, FC, CSSProperties, useState, useEffect } from "react";
import {
  Avatar as CompoundAvatar,
  InlineSpinner,
} from "@vector-im/compound-web";
import { MatrixClient } from "matrix-js-sdk/src/client";

import styles from "./Avatar.module.css";
import { useClientState } from "./ClientContext";

export enum Size {
  XS = "xs",
  SM = "sm",
  MD = "md",
  LG = "lg",
  XL = "xl",
}

export const sizes = new Map([
  [Size.XS, 22],
  [Size.SM, 32],
  [Size.MD, 36],
  [Size.LG, 42],
  [Size.XL, 90],
]);

interface Props {
  id: string;
  name: string;
  className?: string;
  src?: string;
  size?: Size | number;
  style?: CSSProperties;
  loading?: boolean;
}

export function getAvatarUrl(
  client: MatrixClient,
  mxcUrl: string | null,
  avatarSize = 96,
): string | null {
  const width = Math.floor(avatarSize * window.devicePixelRatio);
  const height = Math.floor(avatarSize * window.devicePixelRatio);
  // scale is more suitable for larger sizes
  const resizeMethod = avatarSize <= 96 ? "crop" : "scale";
  return mxcUrl
    ? client.mxcUrlToHttp(
        mxcUrl,
        width,
        height,
        resizeMethod,
        false,
        true,
        true,
      )
    : null;
}

export const Avatar: FC<Props> = ({
  className,
  id,
  name,
  src,
  size = Size.MD,
  style,
  loading,
  ...props
}) => {
  const clientState = useClientState();

  const sizePx = useMemo(
    () =>
      Object.values(Size).includes(size as Size)
        ? sizes.get(size as Size)
        : (size as number),
    [size],
  );

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (clientState?.state !== "valid") {
      return;
    }
    const { authenticated, supportedFeatures } = clientState;
    const client = authenticated?.client;

    if (!client || !src || !sizePx || !supportedFeatures.thumbnails) {
      return;
    }

    const token = client.getAccessToken();
    if (!token) {
      return;
    }
    const resolveSrc = getAvatarUrl(client, src, sizePx);
    if (!resolveSrc) {
      setAvatarUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    fetch(resolveSrc, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (req) => req.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      })
      .catch((ex) => {
        setAvatarUrl(undefined);
      });

    return (): void => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [clientState, src, sizePx]);

  return (
    <div>
      {loading && (
        <div className={styles.loading}>
          <InlineSpinner
            size={typeof sizePx === "number" ? sizePx / 3 : undefined}
          />
        </div>
      )}
      <CompoundAvatar
        className={className}
        id={id}
        name={name}
        size={`${sizePx}px`}
        src={avatarUrl}
        style={style}
        {...props}
      />
    </div>
  );
};

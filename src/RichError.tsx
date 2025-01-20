/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  type ReactElement,
  useCallback,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  OfflineIcon,
  PopOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Link } from "@vector-im/compound-web";

import { ErrorView } from "./ErrorView";

/**
 * An error consisting of a terse message to be logged to the console and a
 * richer message to be shown to the user, as a full-screen page.
 */
export class RichError extends Error {
  public constructor(
    message: string,
    /**
     * The pretty, more helpful message to be shown on the error screen.
     */
    public readonly richMessage: ReactNode,
    cause?: unknown,
  ) {
    super(message, { cause });
  }
}

const OpenElsewhere: FC = () => {
  const { t } = useTranslation();

  return (
    <ErrorView Icon={PopOutIcon} title={t("error.open_elsewhere")}>
      <p>
        {t("error.open_elsewhere_description", {
          brand: import.meta.env.VITE_PRODUCT_NAME || "Element Call",
        })}
      </p>
    </ErrorView>
  );
};

export class OpenElsewhereError extends RichError {
  public constructor() {
    super("App opened in another tab", <OpenElsewhere />);
  }
}

interface AuthConnectionFailedProps {
  livekitServiceUrl: string;
}

const AuthConnectionFailed: FC<AuthConnectionFailedProps> = ({
  livekitServiceUrl,
}) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const onShowDetailsClick = useCallback(() => setShowDetails(true), []);

  return (
    <ErrorView Icon={OfflineIcon} title={t("error.connection_failed")}>
      <p>{t("error.connection_failed_description")}</p>
      {showDetails ? (
        <Trans
          i18nKey="error.auth_connection_failed_details"
          url={livekitServiceUrl}
        >
          <p>
            The application could not reach the call authentication service at{" "}
            <Link href={livekitServiceUrl} target="_blank">
              {{ url: livekitServiceUrl } as unknown as ReactElement}
            </Link>
            . If you are the server admin, check the network logs and make sure{" "}
            <Link
              href="https://github.com/element-hq/lk-jwt-service/"
              target="_blank"
            >
              lk-jwt-service
            </Link>{" "}
            is listening at that address.
          </p>
        </Trans>
      ) : (
        <Button kind="tertiary" onClick={onShowDetailsClick}>
          {t("error.show_details")}
        </Button>
      )}
    </ErrorView>
  );
};

export class AuthConnectionFailedError extends RichError {
  public constructor(livekitServiceUrl: string, cause?: unknown) {
    super(
      `Failed to connect to ${livekitServiceUrl}`,
      <AuthConnectionFailed livekitServiceUrl={livekitServiceUrl} />,
      cause,
    );
  }
}

interface AuthConnectionRejectedProps {
  livekitServiceUrl: string;
  status: number;
  response: string;
}

const AuthConnectionRejected: FC<AuthConnectionRejectedProps> = ({
  livekitServiceUrl,
  status,
  response,
}) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const onShowDetailsClick = useCallback(() => setShowDetails(true), []);

  return (
    <ErrorView Icon={OfflineIcon} title={t("error.connection_failed")}>
      <p>{t("error.connection_rejected_description")}</p>
      {showDetails ? (
        <Trans
          i18nKey="error.auth_connection_rejected_details"
          url={livekitServiceUrl}
          status={status}
          response={response}
        >
          <p>
            The application connected to the call authentication service at{" "}
            <Link href={livekitServiceUrl} target="_blank">
              {{ url: livekitServiceUrl } as unknown as ReactElement}
            </Link>
            , but it responded with status code{" "}
            {{ status } as unknown as ReactElement} (
            {{ response } as unknown as ReactElement}). If you are the server
            admin, make sure{" "}
            <Link
              href="https://github.com/element-hq/lk-jwt-service/"
              target="_blank"
            >
              lk-jwt-service
            </Link>{" "}
            is listening at that address and check the logs for more
            information.
          </p>
        </Trans>
      ) : (
        <Button kind="tertiary" onClick={onShowDetailsClick}>
          {t("error.show_details")}
        </Button>
      )}
    </ErrorView>
  );
};

export class AuthConnectionRejectedError extends RichError {
  public constructor(
    livekitServiceUrl: string,
    status: number,
    response: string,
  ) {
    super(
      `Failed to connect to ${livekitServiceUrl} (status ${status})`,
      <AuthConnectionRejected
        livekitServiceUrl={livekitServiceUrl}
        status={status}
        response={response}
      />,
    );
  }
}

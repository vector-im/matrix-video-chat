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
  ErrorIcon,
  OfflineIcon,
  PopOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button } from "@vector-im/compound-web";

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

interface ConfigurationErrorViewProps {
  children?: ReactNode;
}

const ConfigurationErrorView: FC<ConfigurationErrorViewProps> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const onShowDetailsClick = useCallback(() => setShowDetails(true), []);

  return (
    <ErrorView Icon={ErrorIcon} title={t("error.configuration_error")}>
      <p>{t("error.configuration_error_description")}</p>
      {showDetails ? (
        children
      ) : (
        <Button kind="tertiary" onClick={onShowDetailsClick}>
          {t("error.show_details")}
        </Button>
      )}
    </ErrorView>
  );
};

interface NetworkErrorViewProps {
  children?: ReactNode;
}

const NetworkErrorView: FC<NetworkErrorViewProps> = ({ children }) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const onShowDetailsClick = useCallback(() => setShowDetails(true), []);

  return (
    <ErrorView Icon={OfflineIcon} title={t("error.network_error")}>
      <p>{t("error.network_error_description")}</p>
      {showDetails ? (
        children
      ) : (
        <Button kind="tertiary" onClick={onShowDetailsClick}>
          {t("error.show_details")}
        </Button>
      )}
    </ErrorView>
  );
};

interface ServerErrorViewProps {
  children?: ReactNode;
}

const ServerErrorView: FC<ServerErrorViewProps> = ({ children }) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const onShowDetailsClick = useCallback(() => setShowDetails(true), []);

  return (
    <ErrorView Icon={ErrorIcon} title={t("error.server_error")}>
      <p>{t("error.server_error_description")}</p>
      {showDetails ? (
        children
      ) : (
        <Button kind="tertiary" onClick={onShowDetailsClick}>
          {t("error.show_details")}
        </Button>
      )}
    </ErrorView>
  );
};

export class ConfigurationError extends RichError {
  public constructor(message: string, richMessage: ReactNode, cause?: unknown) {
    super(
      message,
      <ConfigurationErrorView>{richMessage}</ConfigurationErrorView>,
      cause,
    );
  }
}

export class NetworkError extends RichError {
  public constructor(message: string, richMessage: ReactNode, cause?: unknown) {
    super(message, <NetworkErrorView>{richMessage}</NetworkErrorView>, cause);
  }
}

export class ServerError extends RichError {
  public constructor(message: string, richMessage: ReactNode, cause?: unknown) {
    super(message, <ServerErrorView>{richMessage}</ServerErrorView>, cause);
  }
}

export class URLBuildingConfigurationError extends ConfigurationError {
  public constructor(baseUrl: string, cause?: unknown) {
    let message: string;
    if (cause instanceof Error) {
      message = cause.message;
    } else {
      message = "Unknown error";
    }
    super(
      `Unable to build URL based on: ${baseUrl}`,
      <Trans
        i18nKey="error.invalid_url_details"
        baseUrl={baseUrl}
        message={message}
      >
        <p>
          The URL derived from{" "}
          <code>{{ baseUrl } as unknown as ReactElement}</code> is not valid:{" "}
          <pre>{{ message } as unknown as ReactElement}</pre>
        </p>
      </Trans>,
      cause,
    );
  }
}

export class ResourceNotFoundConfigurationError extends ConfigurationError {
  public constructor(url: URL) {
    super(
      `The server returned a 404 response for: ${url.href}`,
      <Trans i18nKey="error.resource_not_found_details" url={url.href}>
        <p>
          The request to{" "}
          <code>{{ url: url.href } as unknown as ReactElement}</code> returned a{" "}
          <code>404</code> response.
        </p>
      </Trans>,
    );
  }
}

export class UnexpectedResponseCodeError extends ServerError {
  public constructor(url: URL, status: number, response: string) {
    super(
      `Received unexpected response code from ${url.href}: ${status}`,
      <Trans
        i18nKey="error.unexpected_response_code_details"
        url={url.href}
        status={status}
        response={response}
      >
        <p>
          The application received an unexpected response from{" "}
          <code>{{ url } as unknown as ReactElement}</code>. It received status
          code <code>{{ status } as unknown as ReactElement}</code>:{" "}
          <pre>{{ response } as unknown as ReactElement}</pre>.
        </p>
      </Trans>,
    );
  }
}

export class FetchError extends ServerError {
  public constructor(url: URL, cause: unknown) {
    let message: string;
    if (cause instanceof Error) {
      message = cause.message;
    } else {
      message = "Unknown error";
    }

    super(
      `Failed to connect to ${url.href}: ${message}`,
      <Trans
        i18nKey="error.fetch_error_details"
        url={url.href}
        message={message}
      >
        <p>
          The application received an unexpected response from{" "}
          <code>{{ url: url.href } as unknown as ReactElement}</code>. It
          received status code{" "}
          <code>{{ message } as unknown as ReactElement}</code>.
        </p>
      </Trans>,
    );
  }
}

export class InvalidServerResponseError extends ServerError {
  public constructor(url: URL, cause: unknown) {
    let message: string;
    if (cause instanceof Error) {
      message = cause.message;
    } else {
      message = "Unknown error";
    }

    super(
      `Invalid response received from ${url.href}: ${message}`,
      <Trans
        i18nKey="error.invalid_server_response_error_details"
        url={url.href}
        message={message}
      >
        <p>
          The server at{" "}
          <code>{{ url: url.href } as unknown as ReactElement}</code> returned
          an invalid response:{" "}
          <pre>{{ message } as unknown as ReactElement}</pre>
        </p>
      </Trans>,
    );
  }
}

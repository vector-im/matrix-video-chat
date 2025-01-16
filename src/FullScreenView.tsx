/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type FC, type ReactElement, type ReactNode, useEffect } from "react";
import classNames from "classnames";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { logger } from "matrix-js-sdk/src/logger";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { Header, HeaderLogo, LeftNav, RightNav } from "./Header";
import styles from "./FullScreenView.module.css";
import { useUrlParams } from "./UrlParams";
import { RichError } from "./RichError";
import { ErrorView } from "./ErrorView";

interface FullScreenViewProps {
  className?: string;
  children: ReactNode;
}

export const FullScreenView: FC<FullScreenViewProps> = ({
  className,
  children,
}) => {
  const { hideHeader } = useUrlParams();
  return (
    <div className={classNames(styles.page, className)}>
      <Header>
        <LeftNav>{!hideHeader && <HeaderLogo />}</LeftNav>
        <RightNav />
      </Header>
      <div className={styles.container}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

interface ErrorPageProps {
  error: Error | unknown;
}

// Due to this component being used as the crash fallback for Sentry, which has
// weird type requirements, we can't just give this a type of FC<ErrorPageProps>
export const ErrorPage = ({ error }: ErrorPageProps): ReactElement => {
  const { t } = useTranslation();
  useEffect(() => {
    logger.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <FullScreenView>
      {error instanceof RichError ? (
        error.richMessage
      ) : (
        <ErrorView Icon={ErrorIcon} title={t("error.generic")} rageshake fatal>
          <p>{t("error.generic_description")}</p>
        </ErrorView>
      )}
    </FullScreenView>
  );
};

export const LoadingPage: FC = () => {
  const { t } = useTranslation();

  return (
    <FullScreenView>
      <h1>{t("common.loading")}</h1>
    </FullScreenView>
  );
};

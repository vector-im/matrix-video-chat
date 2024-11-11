/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ChangeEvent, FC } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@vector-im/compound-web";

import { FieldRow, InputField } from "../input/Input";
import {
  showHandRaisedTimer as showHandRaisedTimerSetting,
  showReactions as showReactionsSetting,
  playReactionsSound as playReactionsSoundSetting,
  useSetting,
} from "./settings";

export const PreferencesSettingsTab: FC = () => {
  const { t } = useTranslation();
  const [showHandRaisedTimer, setShowHandRaisedTimer] = useSetting(
    showHandRaisedTimerSetting,
  );

  const [showReactions, setShowReactions] = useSetting(showReactionsSetting);

  const [playReactionsSound, setPlayReactionSound] = useSetting(
    playReactionsSoundSetting,
  );

  const onChangeSetting = (
    e: ChangeEvent<HTMLInputElement>,
    fn: (value: boolean) => void,
  ): void => {
    fn(e.target.checked);
  };

  return (
    <div>
      <h4>{t("settings.preferences_tab_h4")}</h4>
      <Text>{t("settings.preferences_tab_body")}</Text>
      <FieldRow>
        <InputField
          id="showHandRaisedTimer"
          label={t("settings.preferences_tab_show_hand_raised_timer_label")}
          description={t(
            "settings.preferences_tab_show_hand_raised_timer_description",
          )}
          type="checkbox"
          checked={showHandRaisedTimer}
          onChange={(e) => onChangeSetting(e, setShowHandRaisedTimer)}
        />
      </FieldRow>
      <h5>{t("settings.preferences_tab.reactions_title")}</h5>
      <FieldRow>
        <InputField
          id="showReactions"
          label={t("settings.preferences_tab.reactions_show_label")}
          description={t("settings.preferences_tab.reactions_show_description")}
          type="checkbox"
          checked={showReactions}
          onChange={(e) => onChangeSetting(e, setShowReactions)}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          id="playReactionSound"
          label={t("settings.preferences_tab.reactions_play_sound_label")}
          description={t(
            "settings.preferences_tab.reactions_play_sound_description",
          )}
          type="checkbox"
          checked={playReactionsSound}
          onChange={(e) => onChangeSetting(e, setPlayReactionSound)}
        />
      </FieldRow>
    </div>
  );
};

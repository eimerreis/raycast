import { getPreferenceValues } from "@raycast/api";

type Preferences = {
  azCliPath: string;
  showResourceDetailsInList?: boolean;
};

export const GetPreferences = () => {
  return getPreferenceValues<Preferences>();
};

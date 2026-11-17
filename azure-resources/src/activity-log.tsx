import { ActivityLogList } from "./components/views/activity-log-list";
import { SwitchSubscriptionAction } from "./subscription-list";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";

const ActivityLogCommand = ({ fetchArgs, reloadFetchArgs }: PropsWithFetchArgs) => (
  <ActivityLogList fetchArgs={fetchArgs} extraActions={<SwitchSubscriptionAction onSwitched={reloadFetchArgs} />} />
);

export default withFetchArgs(ActivityLogCommand);

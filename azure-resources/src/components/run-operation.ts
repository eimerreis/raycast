import { Alert, confirmAlert, showToast, Toast } from "@raycast/api";

type Operation<T> = {
  /** Shown while running, e.g. "Restarting my-app". */
  title: string;
  successTitle: string | ((result: T) => string);
  /** Asks for confirmation first; use for anything that interrupts a running service. */
  confirm?: { title: string; message?: string; action: string };
  run: () => Promise<T>;
  onDone?: () => void;
};

export const RunOperation = async <T>({ title, successTitle, confirm, run, onDone }: Operation<T>) => {
  if (
    confirm &&
    !(await confirmAlert({
      title: confirm.title,
      message: confirm.message,
      primaryAction: { title: confirm.action, style: Alert.ActionStyle.Destructive },
    }))
  ) {
    return;
  }

  const toast = await showToast({ style: Toast.Style.Animated, title: `${title}...` });
  try {
    const result = await run();
    toast.style = Toast.Style.Success;
    toast.title = typeof successTitle === "function" ? successTitle(result) : successTitle;
    onDone?.();
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = `Failed: ${title}`;
    toast.message = error instanceof Error ? error.message : String(error);
  }
};

/** Runs an async lookup (e.g. fetching an IP) with a failure toast. */
export const WithFailureToast = async <T>(title: string, run: () => Promise<T>) => {
  try {
    return await run();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

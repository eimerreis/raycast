import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { GetPlaylists } from "./spotify/get-playlists";

export const usePlaylists = () => {
  const { isLoading, data } = useCachedPromise(GetPlaylists, []);
  const { data: playlists, visitItem, resetRanking } = useFrecencySorting(data, { namespace: "playlists" });
  return { playlists, isLoading, visitItem, resetRanking };
};

import { useCachedPromise } from "@raycast/utils";
import { GetPlaylists } from "./spotify/get-playlists";

export const usePlaylists = () => {
  const { isLoading, data: playlists = [] } = useCachedPromise(GetPlaylists, []);
  return { playlists, isLoading };
};

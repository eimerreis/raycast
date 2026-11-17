import {
  ActionPanel,
  Action,
  Icon,
  List,
  showToast,
  Toast,
  Image,
  closeMainWindow,
  showHUD,
  popToRoot,
} from "@raycast/api";
import { usePlaylists } from "./usePlaylists";
import { AddTrackToList } from "./spotify/add-track-to-playlist";
import { useCurrentTrack } from "./useCurrentTrack";
import { withSpotifyClient } from "./spotify/api";

function Command() {
  const { playlists, isLoading: playlistsLoading, visitItem, resetRanking } = usePlaylists();
  const { track, isLoading: trackLoading } = useCurrentTrack();

  return (
    <List isLoading={playlistsLoading || trackLoading} searchBarPlaceholder="Search playlists...">
      <List.Section title="Playlists" subtitle={`Current Track is: "${track?.item && track.item.name}"`}>
        {track &&
          playlists.map((item) => (
            <SearchListItem
              key={item.id}
              searchResult={item}
              currentTrack={track}
              onAdded={() => visitItem(item)}
              onResetRanking={() => resetRanking(item)}
            />
          ))}
      </List.Section>
    </List>
  );
}

export default withSpotifyClient(Command);

function SearchListItem({
  searchResult,
  currentTrack,
  onAdded,
  onResetRanking,
}: {
  searchResult: SpotifyApi.PlaylistObjectSimplified;
  currentTrack: SpotifyApi.CurrentlyPlayingResponse;
  onAdded: () => Promise<void>;
  onResetRanking: () => Promise<void>;
}) {
  const { length, [length - 1]: lastImage } = searchResult.images;

  const onAdd = async () => {
    if (currentTrack.item) {
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: `Adding track...`,
        message: `${currentTrack.item.name} to ${searchResult.name}...`,
      });
      await AddTrackToList(searchResult.id, currentTrack.item.uri);
      await onAdded();
      (toast.title = `Successfully added`), (toast.message = `${currentTrack.item.name} to ${searchResult.name}`);
      await showHUD(`✅ Successfully added ${currentTrack.item.name} to ${searchResult.name}`);
      popToRoot({ clearSearchBar: true });
      await closeMainWindow({ clearRootSearch: true });
    }
  };

  return (
    <List.Item
      icon={{
        source: lastImage.url,
        mask: Image.Mask.Circle,
      }}
      title={searchResult.name}
      subtitle={searchResult.description!}
      accessoryTitle={searchResult.owner.display_name}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action title="Add to Playlist" icon={Icon.Plus} onAction={onAdd} />
            <Action title="Reset Ranking" icon={Icon.ArrowCounterClockwise} onAction={onResetRanking} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

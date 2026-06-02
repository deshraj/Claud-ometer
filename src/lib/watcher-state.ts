type WatcherState = {
  claude: boolean;
  obsidian: boolean;
};

let state: WatcherState = {
  claude: true,
  obsidian: true,
};

export function getWatcherState(): WatcherState {
  return { ...state };
}

export function setWatcherState(partial: Partial<WatcherState>): WatcherState {
  state = { ...state, ...partial };
  return { ...state };
}

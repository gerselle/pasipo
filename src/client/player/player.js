// Variables for manipulating service player, and refreshing tokens
let musicEvent;
let player_interval;
let service_player;
let player_active = false;

// Keeps track of the album/tracklist that's loaded into the player
let p_album;
let p_track_list = {};

// Variables to keep progress bar in sync with service player
let progress_interval;
let progress = {time_pos: 0, time_end: 0};

document.addEventListener("player", async (event) => {
  switch(event.detail.action){
    case "start":
      player.addEventListener("click", playerUpdate);
      p_vol_bar.addEventListener("pointerdown", trackVolume);
      window.addEventListener('pointerup', sendVolume);
      sendEvent(musicEvent, {action: "start"});
    break;
    case "loadAlbum": loadAlbum(event.detail.data); break;
    case "setTrack": if(playerLoaded()){ setTrack(event.detail.data); } break;
    case "disconnect": if(musicEvent){ sendEvent(musicEvent, {action: "disconnect"}) } break;
  }
});

window.onbeforeunload = function(){
  if(service_player){ sendEvent(musicEvent, {action: "disconnect"}); }
  clearInterval(progress_interval);
};

function playerLoaded(){
  let player_loaded = false;
  if(!sessionGet("player_id")){
    sendEvent(musicEvent, {action: "start"});
  }else if(!player_active){
    sendEvent(musicEvent, {action: "connect"});
  }else{
    player_loaded = true;
  }
  return player_loaded;
}

function playerUpdate(event){
  if(!CURRENT_USER || !CURRENT_USER.active_token){ return; }
  const target = event.target.closest('[id]');

  if(playerLoaded()){
    switch(target){
      case p_play: playTrack(); break;
      case p_next: nextSong(); break;
      case p_prev: prevSong(); break;
      case p_scr_bar: setTime(event); break;
      case p_title: setTime(event); break;
      case p_volume: toggleVolume(); break;
      }
  }
}

function updatePlayer(state){
  if(!state){ return; }

  // State will always update time, but the progress bar only updates if a track
  // is playing to keep sync with the actual music service web player
  progress = {time_pos: state.time_pos, time_end: state.time_end };
  updateProgress();
  clearInterval(progress_interval);
  if(state.track_playing){
    progress_interval = setInterval(updateProgress, 1000);
  }
  
  // Update the player's title based on if the user is looking at the album that the 
  // playing track is from. Also update the content's DOM if needed.
  const p_track = p_track_list[state.track_id];
  let p_title_update;
  if(p_track){
    p_title_update = `Disc ${p_track.disc} | Track ${p_track.number} | ${p_track.name} | ${state.album_name}`;
    sendEvent(updateJS, {script: "player", track_id: state.track_id});
  }else{
    p_title_update = `Remotely playing: ${state.track_name} by ${state.artist_name} | ${state.album_name}`;
  }

  p_title.innerHTML = p_title_update;
  p_title.title = p_title_update;

  // Play button image update
  const play_img = p_play.children[0];
  play_img.alt = state.track_playing ? "pause" : "play";
  play_img.src = `/player/${play_img.alt}.svg`;

  updateVolume();
}

function updateProgress(){
  const current = progress.time_pos; 
  const end = progress.time_end;

  p_progress.style.width = (current < end) ?  `${100 * current/end}%` : "100%";
  progress.time_pos = (current + 1000 < end) ? current + 1000 : end;

  p_start.innerHTML = dayjs(current).format("mm:ss");
  p_end.innerHTML = dayjs(end).format("mm:ss");
}

const playTrack = throttle(()=>{ sendEvent(musicEvent, {action: "play"}); }, 500);
const nextSong = throttle(()=>{ sendEvent(musicEvent, {action: "next"}); }, 500);
const prevSong = throttle(()=>{ sendEvent(musicEvent, {action: "prev"}); }, 500);

function setTime(event){
  const click_pos_ratio = event.offsetX / p_scr_bar.offsetWidth;
  const seek_time = Math.floor(progress.time_end * click_pos_ratio);
  sendEvent(musicEvent, {action: "seek", seek: seek_time});
  sendEvent(musicEvent, {action: "resume"});
}

function setTrack(track_num){
  sendEvent(musicEvent, {action: "load", album_id: p_album.id, track_pos: track_num});
}

let current_volume;

function setVolume(event){
  const vol_bar = p_vol_bar.getBoundingClientRect();
  p_vol_dot.style.display = "flex";
  p_vol_level.style.backgroundColor = "var(--primary-200)";

  switch(true){
    case (event.clientX < vol_bar.left): current_volume = 0; break;
    case (event.clientX > vol_bar.right): current_volume = 1; break;
    default: current_volume = (event.clientX - vol_bar.left) / vol_bar.width;
  }
  
  localSet("volume", current_volume);
  updateVolume();
}

function toggleVolume(){
  current_volume = current_volume == 0 ? parseFloat(localGet("volume")) : 0;
  updateVolume();
}

function trackVolume(event){
  setVolume(event);
  window.addEventListener('pointermove', setVolume);
}

function sendVolume(){
  p_vol_dot.style.display = "none";
  p_vol_level.style.backgroundColor = "var(--bg-300)";
  window.removeEventListener('pointermove', setVolume);
  sendEvent(musicEvent, {action: "volume", volume: current_volume});
}

function updateVolume(){
  const volume_img = p_volume.children[0];
  let vol_num = "vol0";

  switch (true){
    case (current_volume > 0.66): vol_num = "vol3"; break;
    case (current_volume > 0.33): vol_num = "vol2"; break;
    case (current_volume > 0): vol_num = "vol1"; break;
  }

  volume_img.src = `/player/${vol_num}.svg`;
  p_vol_dot.style.left = `${Math.floor(100 * current_volume)}%`;
  p_vol_level.style.width = `${Math.floor(100 * current_volume)}%`;
}

async function loadAlbum(load_album){
  current_volume = parseFloat(localGet("volume")) || 0.33;
  updateVolume();

  if(!p_album || (p_album.id != load_album.id)){
    p_album = load_album;
    p_track_list = {};
    p_album.track_list.forEach(track => {
      p_track_list[track.id] = track;
    });
    if(service_player){ sendEvent(musicEvent, {action: "update"}); }
  }
}

// Spotify functions
window.onSpotifyWebPlaybackSDKReady = async () =>{

  const loadSpotifyPlayer = async () => {
    if(service_player){ await service_player.disconnect(); }
    const response = await fetch(`${window.env.SERVER_ADDRESS}/token/spotify`)
      .catch((error) => console.log(error));
    const token = await response.json();
    const player_name = 'Paispo Web Player';
    let player_number = 1;
    token.devices.forEach(device => {
      const device_name = device.name.replaceAll(/ [0-9]+/gi, "");
      if((device_name === player_name)){ player_number++; }
     });

    service_player = new Spotify.Player({
      name: `${player_name} ${player_number}`,
      getOAuthToken: cb => { cb(token.access_token); },
      volume: parseFloat(localGet("volume")) || 0.33
    });

    service_player.addListener('ready', ({ device_id }) => {
      sessionSet("player_id", device_id);
    });

    service_player.addListener('player_state_changed', (state) => updateSpotifyPlayer(state));

    service_player.on('initialization_error', ({ message }) => {
      console.error('Failed to initialize', message);
    });
  
    service_player.on('authentication_error', () => {
      console.error('Failed to authenticate', message);
      loadSpotifyPlayer();
    });
  
    service_player.on('account_error', ({ message }) => {
      console.error('Failed to validate Spotify account', message);
    });
  
    service_player.on('playback_error', ({ message }) => {
      console.error('Failed to perform playback', message);
      loadSpotifyPlayer();
    });

    service_player.connect();
  }

  function updateSpotifyPlayer(state){
    if(!state){ return; }
    const current_track = state.track_window.current_track;
    const player_state = {
      music_service: "spotify",
      track_playing: !state.paused,
      time_pos : state.position,
      time_end : state.duration,
      track_name : current_track.name,
      track_id: current_track.id,
      artist_name: current_track.artists[0].name,
      album_id: current_track.album.uri.split(":")[2],
      album_name: current_track.album.name,
      album_image: current_track.album.images[0]
    }
    updatePlayer(player_state);
  }

  function loadSpotifyTrack(album_id, track_pos){
     fetch(`${window.env.SERVER_ADDRESS}/loadtrack/spotify/${album_id}/${track_pos}`)
     .catch((error) => console.log(error));
  };

  musicEvent = new CustomEvent("spotify", {detail: {}});

  document.addEventListener("spotify", async (event) => {
      if(event.detail.action != "start" && !service_player){ return; }

      switch(event.detail.action){
        case "start": 
          await loadSpotifyPlayer();
          clearInterval(player_interval)
          player_interval = setInterval(loadSpotifyPlayer, 1000 * 60 * 59); // Reload player every 59 mins
          break;
        case "connect" :
          await fetch(`${window.env.SERVER_ADDRESS}/loadplayer/spotify/${sessionGet("player_id")}`)
                .then(()=>{
                  player_active = true;
                  displayMessage(player, "Player loading...", { offsetY: 75, delay: 1, duration: 0 });
                 });          
          break;
        case "load":
          fetch(`${window.env.SERVER_ADDRESS}/loadtrack/spotify/
                 ${event.detail.album_id}/
                 ${event.detail.track_pos}`)
          .catch((error) => console.log(error));
          break;
        case "play": service_player.togglePlay(); break;
        case "next": service_player.nextTrack(); break;
        case "prev": service_player.previousTrack(); break;
        case "pause": service_player.pause(); break;
        case "resume": service_player.resume(); break;
        case "seek": service_player.seek(event.detail.seek); break;
        case "volume": service_player.setVolume(event.detail.volume); break;
        case "update": service_player.getCurrentState().then((state) => updateSpotifyPlayer(state)); break;
        case "disconnect": await service_player.disconnect(); player_active = false; break;
      }
    });
}
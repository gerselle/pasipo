const dotenv = require('dotenv');
dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.SERVER_ADDRESS}/callback`;
let CLIENT;

authorize(null)
.then((token) => {CLIENT = token; console.log("Spotify api interface loaded correctly.")})
.catch((error) => {console.log(`Spotify api interface failed to load due to the following error:\n${error}.`)});

async function getDevices(token){
  const devices_request = await fetch(`https://api.spotify.com/v1/me/player/devices`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  }).catch((error) => {console.log(error)})
  
  const device_response = await devices_request.json();

  return device_response.error ? null : device_response.devices;
}

async function loadPlayer(device_id, user_token){
  if(!device_id){return {error: "No device id to transfer playback to."} }
  if(!user_token){ return {error: "No user token to load Spotify player."}; }

  try{
    const transfer_request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user_token.access_token}`
      },  
      body: JSON.stringify({device_ids: [ device_id ], play: false})
    }

    fetch(`https://api.spotify.com/v1/me/player`, transfer_request);

    const simple_request = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user_token.access_token}` }
    }
    
    fetch(`https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${device_id}`, simple_request);
    fetch(`https://api.spotify.com/v1/me/player/repeat?state=off&device_id=${device_id}`, simple_request);
    
    return {success: "Spotify player loaded properly."}
  }catch(error){
    return {error: "Failed to load Spotify player."};
  }
  
}

async function loadTrack(album_id, track_pos, user_token){
  if(album_id && user_token){
    const track_request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user_token.access_token}`
      },  
      body: JSON.stringify({
        context_uri: `spotify:album:${album_id}`,
        offset: { position : track_pos },
        position_ms: 0
      })
    }

    try {
      await fetch(`https://api.spotify.com/v1/me/player/play`, track_request);
    } catch (error) {
      console.log(error);
    }
  }
}

async function getArtists(album_artists){
  let artists = [];
  for(const album_artist of album_artists){
    const artist_response = await fetch(album_artist.href, { 
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLIENT.access_token}`}
    });

    spotify_artist = await artist_response.json();

    artist_info = {
      'id': spotify_artist.id,
      'name': spotify_artist.name,
      'image': spotify_artist.images[0]?.url,
      'url': spotify_artist.external_urls['spotify'],
      'genres': spotify_artist.genres
    };
    artists.push(artist_info);
  };

  return artists;
}

async function getTracklist(album_tracks){
  let spotify_track_list = album_tracks.items;

  // Grabbing other tracks with "next" urls if tracklist has more than 50 tracks
  if(album_tracks.next){
    while(album_tracks.next){
      const response = await fetch(album_tracks.next, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLIENT.access_token}`}
        });
      album_tracks = await response.json();
      spotify_track_list = spotify_track_list.concat(album_tracks.items);
    }
  }

  let track_list = [];
  spotify_track_list.forEach((track) => {
    track_info = {
      'id': track.id,
      'name': track.name,
      'url': track.external_urls['spotify'],
      'length': track.duration_ms, 
      'disc': track.disc_number, 
      'number': track.track_number,
      'preview' : track.preview_url,
      'explicit' : track.explicit
    };
    track_list.push(track_info);
  });

  return track_list;
}

async function albumSearch(album_query){
  if(CLIENT == null || CLIENT.expiry_time < Math.floor(Date.now() / 1000 )){
    CLIENT = await authorize(null);
  }
  
  // First assume query is an spotify id
  let spotify_album = 
    await fetch(`https://api.spotify.com/v1/albums/${album_query}`, 
      { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLIENT.access_token}`}
      });
  
  let album = null; // Default to no album found
  const album_response = await spotify_album.json();
  
  // If it wasn't an id, we get the first result of a spotify album search instead
  if(album_response.error){ 
    let search_response = 
      await fetch(`https://api.spotify.com/v1/search?query=${album_query}&type=album`, 
        { 
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLIENT.access_token}`}
        });

    let search_results = await search_response.json();

    if(!search_results.error){ 
      const spotify_albums = search_results.albums;
      let album_id = null;

      // Take id of first album with 6 or more tracks
      for(let i = 0; i < spotify_albums.items.length; i++){
        if(spotify_albums.items[i].total_tracks > 5){
          album_id = spotify_albums.items[i].id;
          break;
        }
      }

      if(album_id){
        // Spotify's search api gives basic info for a specific album
        // we need to do an additional api request for the full album info
        spotify_album = 
        await fetch(`https://api.spotify.com/v1/albums/${album_id}`, 
          { 
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CLIENT.access_token}`}
          });
        
        let response = await spotify_album.json();
        if(!response.error){ album = response; }
      }
    }
  }else{
    album = album_response;
  }

  if(!album){ return null; } // No album was found with query, return null

  const artists = await getArtists(album.artists);
  const track_list = await getTracklist(album.tracks);
  let genres = ["Unknown Genre"]; 

  if(album.genres.length){
    genres = album.genres;
  }else if(artists[0]?.genres?.length){
    genres = artists[0].genres;
  }
  
  search_result = { 
      'id': album.id,
      'name': album.name,
      'image': album.images[0]?.url,
      'url': album.external_urls['spotify'],
      'artists': artists,
      'genres': genres,
      'track_list': track_list,
      'aliases': [album_query],
      'release_date' : album.release_date
  };
  return search_result;
}

async function getAlbums(album_ids){
  let albums = [];
  
  await Promise.all(album_ids.map(async(album_set) => {
    let response = 
    await fetch(`https://api.spotify.com/v1/albums?ids=${album_set.toString()}`, 
      { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLIENT.access_token}`}
      });

    const result = await response.json();

    await Promise.all(result.albums.map(async(album) => {
      const artists = await getArtists(album.artists);
      const track_list = await getTracklist(album.tracks);
      let genres = ["Unknown Genre"]; 

      if(album.genres.length){
        genres = album.genres;
      }else if(artists[0]?.genres?.length){
        genres = artists[0].genres;
      }
    
      album_info = { 
          'id': album.id,
          'name': album.name,
          'image': album.images[0].url,
          'url': album.external_urls['spotify'],
          'artists': artists,
          'genres': genres,
          'track_list': track_list,
          'aliases': [],
          'release_date' : album.release_date
        };

      albums.push(album_info);
    }));
  }));

  return albums;
}

// Uses the Spotify api to obtain a new OAuth token
// A non null auth_code returns an 'authorization code' token (user)
// A null auth_code returns a 'client credential' token (pasipo)
async function authorize(auth_code){
  request = { 
      method: 'POST',        
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
      }
    }

  if(auth_code){
    request.body = `grant_type=authorization_code&code=${auth_code}&redirect_uri=${REDIRECT_URI}`;
  }else{
    request.body = `grant_type=client_credentials`;
  }
  
  const response = await fetch('https://accounts.spotify.com/api/token', request);
  token = await response.json();
  token.expiry_time = Math.floor(Date.now() / 1000) + token.expires_in;
  return token;
}

async function userInfo(code){

  const token = await authorize(code);

  if(!token){ return {error: "Failed to obtain token."}; }

  const response =  await fetch(`https://api.spotify.com/v1/me`, { 
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token.access_token}`}
  });

  const info = await response.json();

  if(info.error){ return {error: info.error}; }

    const user_info ={
    service_email: info.email,
    service_profile_name: info.display_name,
    service_url: info.external_urls["spotify"],
    service_id: info.id,
    service_image: info.images.at(-1)?.url,
    service_token: token
  }

  return user_info;
}

async function tokenUrl(user_id, token_type, current_path){
  const parameters = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: `user-read-email 
            user-read-private
            playlist-read-private 
            playlist-read-collaborative
            playlist-modify-private
            playlist-modify-public
            streaming
            app-remote-control
            user-read-playback-state
            `,
    state: `spotify:${user_id}:${token_type}:${current_path}`
  });

  return {url: `https://accounts.spotify.com/authorize?` + parameters.toString()};
}

async function refreshToken(token){
  if(!token || (token.expiry_time > Math.floor(Date.now() / 1000))){ return token; }

  const request = {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
    },
    body: new URLSearchParams({
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    }).toString()
  };

  const response = await fetch('https://accounts.spotify.com/api/token', request);
  let refreshed_token = await response.json();
  
  if(refreshed_token.error){ return refreshed_token; }

  if(!refreshed_token.refresh_token){refreshed_token.refresh_token = token.refresh_token};
  refreshed_token.expiry_time = Math.floor(Date.now() / 1000) + refreshed_token.expires_in;

  return refreshed_token;
}

module.exports = {
  albumSearch, getAlbums,
  getDevices, loadPlayer, loadTrack,
  userInfo, tokenUrl, refreshToken
};
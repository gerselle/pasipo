// Modules for node express requests/responses
const express = require("express");
const path = require("path");
const cors = require("cors");

// Module for .env variables
const dotenv = require("dotenv");
dotenv.config();
const fs = require('fs');

// Custom modules for API calls
const spotify = require("./spotify.js");
const postgres = require("./postgres.js");
const typesense = require("./typesense.js");

// Custom modules for user authentication/sessions
const session = require("express-session");
const sessionStore = require("connect-pg-simple")(session);

const CLIENT_DIR = path.join(__dirname, "../client");

const app = express();
app.use(express.static(CLIENT_DIR, { index: false }));
app.use(cors());
app.use(express.json());

app.use(session({
  store: new sessionStore({
    pool : postgres.pool,
    createTableIfMissing: true
  }),
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  secure: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

app.get("/album/:id", async function(req, res){
  res.send(await postgres.getAlbum(req.params.id));
});

app.get("/check", async function(req, res){
  res.json(await sessionUser(req.session));
});

async function sessionUser(session){
  let response = {user_id: null, user_name: "local"};
  const user = await refreshUser(session);
  if(session && session.user && user){
    response = {
      user_id : user.user_id,
      profile_image: user.profile_image,
      user_name: user.user_name,
      profile_name: user.profile_name,
      viewer_mode: user.viewer_mode,
      active_token: user.tokens[`${user.current_service}`] ? user.current_service : null
    }
  }
  return response;
}

async function refreshUser(session){
  if(!session?.user){ return null };
  const refreshed_user = await postgres.refreshUser(session.user.user_id);
  session.user = refreshed_user.error ? null : refreshed_user;
  return session.user;
}

app.get("/token/:service", async function(req, res){
  if(!req.session?.user){
    res.send({error: "No user to check for token."}); return;
  }

  const user = req.session.user;
  let token = await refreshToken(user, req.params.service);
  token.devices = await spotify.getDevices(token);

  if(!token.error){
    res.send({access_token: token.access_token, expiry_time: token.expiry_time, devices: token.devices});
  }else{
    res.send({error: `No token found for user.`});
  }
});

async function refreshToken(user, set_service = null){
  if(!user?.tokens){ return { error: `No user tokens found for token refresh.` }; }

  const service = set_service || user.current_service;

  let token = user.tokens[`${service}`];
  if(!token){ return { error: `No token for ${service} found for token refresh.`}; };
  
  if(token.expiry_time > Math.floor(Date.now()/1000)){ return token; }

  switch(service){
    case "spotify": token = await spotify.refreshToken(token); break;
    default : token = {error: "No service defined for token refresh." };
  }

  if(!token.error){
    await postgres.setToken(user.user_id, token, user.current_service);
  }

  return token;
}

app.get("/viewing/:viewed_user", async function(req, res){
  const current_user = req.session.user ? req.session.user.user_name : "local";
  res.send(await postgres.getViewedUser(req.params.viewed_user, current_user));
});

app.post("/action", async function(req, res){
  if(!req.session.user){ res.send({error: "User doesn't exist"}); return; }
  const user = await refreshUser(req.session);
  const field = req.body.field;
  const action = req.body.action;
  const data = req.body.data;

  switch(field){
    case "album":
      switch(action){
        case "pull":
          res.send(await postgres.pullUserAlbums(user));
          break;
        case "push":
          res.send(await postgres.pushUserAlbums(user, data));
          break;
        case "add":
          res.send(await postgres.addUserAlbum(user, data));
          break;
        case "update":
          res.send(await postgres.updateUserAlbum(user, data));
          break;
        case "delete":
          res.send(await postgres.deleteUserAlbum(user, data));
          break;
        default:
          res.send({error: "No valid album action provided."});
      }
      break;

    case "rating":
      switch(action){
        case "pull":
          res.send(await postgres.pullUserRatings(user));
          break;
        case "push":
          res.send(await postgres.pushUserRatings(user, data));
          break;
        case "update":
          res.send(await postgres.updateUserRating(user, data));
          break;
        default:
          res.send({error: "No valid rating action provided."});
      }
      break;

    case "setting":
        switch(action){
          case "user_name":
            res.send(await postgres.updateUserName(user, data));
            break;
          case "pass_word": 
            res.send(await postgres.updatePassWord(user, data));
            break;
          case "profile_name":
            res.send(await postgres.updateProfileName(user, data));  
            break;
          case "profile_image": 
            res.send(await postgres.updateProfileImage(user, data));
            break;
          case "visibility":
            res.send(await postgres.updateUserName(user, data));
            break;
          case "add_service": break;
          case "remove_service": break;
          case "deactivate": break;
          case "sync": break;
          default:
            res.send({error: "No valid setting action provided."});
        }
        break;
    
    default:
      res.send({error: "No update field provided."});      
  }

});

app.post("/oauth", async function(req, res){
  const service = req.body.service;
  const action = req.body.action;
  const current_path = req.body.current_path;

  if(!["login", "signup", "acquire"].includes(action)){
    res.send({error: "OAuth action is invalid."});
    return;
  }

  let user_id = req.session.user ? req.session.user.user_id : null;

  // When doing login/signup, user_id is irrelevant, this check only matters for acquire 
  if(action === "acquire" && !user_id){
    res.send({error: "No user to acquire token for."});
    return;
  }

  // Token url will redirect to /callback
  switch(service){
    case "spotify": res.send(await spotify.tokenUrl(user_id, action, current_path)); break;
    default: res.send({error: "Unknown music service."});
  }
});

app.get("/callback", async function(req, res){
  if(!req.query.code || !req.query.state){
    res.send({error: "Invalid callback parameters."});
    return;
  }

  const split = req.query.state.split(":");
  const service = split[0];
  const user_id = split[1];
  const token_type = split[2];
  const current_path = split[3];
  
  const code = req.query.code;
  let user_info;

  switch(service){
    case "spotify": user_info = await spotify.userInfo(code); break;
  }

  if(!user_info.error){
    user_info.service = service;
    user_info.user_id = user_id;

    switch(token_type){
      case "acquire": await postgres.setToken(user_info); break;
      case "login": 
        const login = await postgres.loginToken(user_info);
        if(login && !login.error){ req.session.user = login; }
        break;
      case "signup":
        await postgres.signupToken(user_info);
        break;
    }
  }else{
    console.log(`Error acquiring token for ${service}: ${user_info.error}`);
  }

  res.redirect(current_path);
});

app.get("/loadplayer/:service/:device_id", async function(req, res){
  const user = req.session.user;
  let response = {error: "No player loaded."};
  if(user){
    const user_token = await refreshToken(user, req.params.service);
    switch(req.params.service){
      case "spotify": response = await spotify.loadPlayer(req.params.device_id, user_token); break;
    }
  }
  res.send(response);
});

app.get("/loadtrack/:service/:album_id/:track_pos", async function(req, res){
  const user = req.session.user;
  if(user){
    const user_token = await refreshToken(user, req.params.service);
    switch(req.params.service){
      case "spotify": spotify.loadTrack(req.params.album_id, req.params.track_pos, user_token); break;
    }
  }
  res.end();
});

app.post("/access", async function(req, res) {
  let response = {error: "Issue with login/signup."};

  if(req.body.value === "login"){
    response = await postgres.login(req.body.user_name, req.body.pass_word);
  }else if(req.body.value === "signup"){
    response = await postgres.signup(req.body.user_name, req.body.pass_word, req.body.pass_confirm);
  }

  if(response.error){
    res.send(response);
  }else{
    req.session.user = response;
    res.send(await sessionUser(req.session));
  }
});

app.get("/logout", async function(req, res){
  if(req.session.user){
    req.session.destroy(async function(err){
      res.clearCookie("connect.sid", {path: "/"})
         .send(await sessionUser(req.session));
    });
  }else{
    res.redirect("/");
  }
});

app.get("/search/:query/:field", async function(req, res){
  const query = req.params.query;
  const field = req.params.field;
  const check_ts = await typesense.query(query, field);
  if(check_ts){
    res.send(check_ts);
  }else{
    const search_response = await spotify.albumSearch(query);
    if(search_response){
      res.send([search_response]);
      typesense.addAlbum(search_response, query);
      postgres.addAlbum(search_response);
    }else{
      res.send({error: "Query couldn't be found."});
    }
  }
});

app.get("/refresh_albums", async function(req, res){
  //res.redirect("/"); return; // Simple lock for now, make admin accounts and reenable this endpoint
  const album_ids = await postgres.getAlbumIds();
  const refreshed_albums = await spotify.getAlbums(album_ids);
  typesense.refreshAlbums(refreshed_albums);
  postgres.refreshAlbums(refreshed_albums);
  res.redirect("/");
});

app.get("/*", (req, res) => {
  const parts = req.url.split("/");
  switch(parts[1]){
    case "templates":
      res.sendFile(path.join(CLIENT_DIR, "templates/404.html"));
      break;
    case "js":
      res.sendFile(path.join(CLIENT_DIR, "js/404.js"));
      break;
    case "css":
      res.sendFile(path.join(CLIENT_DIR, "css/404.css"));
      break;
    default:
      let index = fs.readFileSync(path.join(CLIENT_DIR, "index.html"), 'utf8');
      index = index.replace('{{SERVER_ADDRESS}}', process.env.SERVER_ADDRESS);
      index = index.replace('{{TS_KEY}}', typesense.getClientKey());
      index = index.replace('{{TS_URL}}', process.env.TYPESENSE_PUBLIC_URL);
      res.send(index);
  }
});

app.listen(process.env.SERVER_PORT, () => console.log(`Listening at ${process.env.SERVER_ADDRESS}.`));
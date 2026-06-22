let DATABASE_STORAGE;
let CURRENT_USER;
const WEBSITE_AUDIO = new Audio();
const ERROR_LENGTH = 3000;
const PRESEARCH = {};

document.addEventListener("DOMContentLoaded", async () => {
  toggleDarkMode(localStorage.getItem("color_mode"));
  await updateCurrentUser();
  await dbStart();
  await updateLayout();
  await locationHandler();
});
// Current user will always either be the session's user or a local user.
async function updateCurrentUser(){
  await fetch(`${window.env.SERVER_ADDRESS}/check`)
        .then( async (response) => { 
          CURRENT_USER = await response.json();
          if(CURRENT_USER.user_id){
            await pushUser();
            await pullUser();
           }
        })
        .catch(() => { CURRENT_USER = {user_id: null, user_name: "local"}; });
}

// Website graphic update functions
async function updateLayout(){
  sendEvent(updateJS, {script: docId("content").value});
  
  let icon = docId("icon");

  if(CURRENT_USER.profile_image){
    icon.innerHTML = `<img src="${CURRENT_USER.profile_image}" alt="icon">`;
  }else if(CURRENT_USER.profile_name){
    icon.innerHTML = CURRENT_USER.profile_name[0].toUpperCase();
  }else{
    icon.innerHTML = "Local";
  }

  if(CURRENT_USER.active_token){ sendEvent(playerEvent, {action: "start"}); }
  player.style.display = CURRENT_USER.active_token ? "flex" : "none";
}

async function refresh(){
  window.location.pathname = window.location.pathname;
}

function setFocus(show_focus, focus_child){
  const focus = docId("focus");
  const layout = docId("layout");
  if(focus_child) { focus.innerHTML = focus_child; }
  focus.style.display = show_focus ? "flex" : "none";
  layout.style.filter = show_focus ? "blur(10px)" : "none";
}

function toggleDarkMode(load_mode = null){
  const old_mode = localStorage.getItem("color_mode");
  let new_mode;
  if(load_mode){
    new_mode = load_mode;
  }else{
    new_mode = old_mode === "dark" ? "light" : "dark";
  }
  document.body.className = new_mode;
  localStorage.setItem("color_mode", new_mode);
  
  docId("mode").innerHTML = new_mode === "dark" ? "Light Mode" : "Dark Mode";
}

function iconClick(){
  docId("authorize").innerHTML = userLoggedIn() ? "Log Out" : "Log In";
  docId("profile").style.display = docId("profile").style.display === "none" ? "flex" : "none";
}

async function toggleAccess(){
  setFocus(!isFocused());
  if(isFocused()){
    fetch(`/templates/login.html`)
    .then(async(response) => {
      const login_html = await response.text();
      setFocus(true, login_html);
    });
  }
}

// General helper functions
function printDebug(message){ console.log(message); }
function docId(id){ return id ? document.getElementById(id) : null; }
function sessionGet(key){return sessionStorage.getItem(key)};
function sessionSet(key, value){return sessionStorage.setItem(key, value)};
function localGet(key){return localStorage.getItem(key)};
function localSet(key, value){return localStorage.setItem(key, value)};
function userLoggedIn(){ return CURRENT_USER.user_id ? true : false; }
function isFocused(){ return docId("focus").style.display == "flex"; }

// Capitalizes the first letter of each word in the string
// e.g. "this is a string" => "This Is A String"
function capitalize(str){ 
  if(!str){ return ""; }
  let result = "";
  str.split(" ").forEach(word => {
    result += `${word[0].toUpperCase()}${word.slice(1)} `;
  });
  return result.slice(0, result.length - 1);
}

function debounce(func, timeout){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

function throttle(func, timeout) {
  let throttling = false;
  return (...args) => {
    if (!throttling) {
      throttling = true;
      func.apply(this, args);
      setTimeout(() => {
        throttling = false;
      }, timeout);
    }
  };
}

function holdElement(element, func, options = {}){
  if(!element || !func ){ return; } 

  // Keep a copy of the original element for reset
  const old_element = element.cloneNode(true);

  const hold_time = options.hold_time || 1000;
  const reset_event = options.reset_event || "pointerup";
  const background_color = options.background_color|| "red";
  const progress_color = options.progress_color || "darkred";
  element.style.color = options.text_color || "black";

  let hold_interval;
  let progress = 0;

  document.addEventListener(reset_event, () => {
    clearInterval(hold_interval);
    element.replaceWith(old_element);
  }, { once: true });

  hold_interval = setInterval(() => {
    progress++;
    if(progress < 100){
      element.style.background = 
      `linear-gradient(
        to right,
        ${progress_color} 0%,
        ${progress_color} ${progress}%,
        ${background_color} ${progress}%,
        ${background_color} 100%
      )`;
    }else{
      clearInterval(hold_interval);
      element.replaceWith(old_element);
      func();
    }
  }, hold_time / 100);
}

function tapElement(element, ){
  if(!element){ return; }
  
  element.classList.add("tap");

  element.addEventListener("animationend", () => {
    element.classList.remove("tap");
  }, { once: true });
}

document.addEventListener("pointerover", (event) => {
  const target = event.target;
  if(!target.classList.contains("marquee")){ return;}

  if(target.clientWidth < target.scrollWidth){  
    let marquee_interval;
    const old_text = target.innerHTML;
    let current_text = old_text;

    marquee_interval = setInterval(() => {
      if(target.clientWidth < target.scrollWidth){
        current_text = current_text.substring(1);
      }else{
        clearInterval(marquee_interval);
        current_text = old_text;
      }
      target.innerHTML = current_text;
    }, 50);

    target.addEventListener("pointerleave", () => {
      clearInterval(marquee_interval);
      target.innerHTML = old_text;
    }, { once: true });
  }
});

// Displays an message box on top of the element, with positional and animation options
function displayMessage(target, message, options = {}){
  if(!docId(message)){
    const element = target || document.body;
    element_pos = element.getBoundingClientRect();
    const message_box = document.createElement("div");

    const offsetX = options.offsetX || 0;
    const offsetY = options.offsetY || 0;
    const delay = options.delay || 3000;
    const duration = options.duration || 2000;

    Object.assign(message_box.style, {
      left: `${element_pos.x + element_pos.width/2 - offsetX}px`,
      top: `${element_pos.y + element_pos.height/2 - offsetY}px`,
    });

    message_box.style.animationDelay = `${delay}ms`;
    message_box.style.animationDuration = `${duration}ms`;
    message_box.className = "no-select message";
    message_box.innerHTML = message;
    message_box.id = message;

    document.body.append(message_box);

    setTimeout(() => {
      docId(message).remove();
    }, (delay + duration));
  }
}

// IndexedDB functions
function dbStart(){
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("database", 1);

    request.onerror = (event) => {
      console.error(`Database error: ${event.target.errorCode}`);
    };
  
    request.onsuccess = (event) => {
      DATABASE_STORAGE = event.target.result;
      resolve();
    };
  
    request.onupgradeneeded = async (event) => {
      const db = event.target.result;
      db.createObjectStore("albums", {keyPath: "id"});
      db.createObjectStore("user_albums", {keyPath: "date"});
      db.createObjectStore("user_ratings", {keyPath: "id"});
    }
  });
}

async function dbAccess(store, data, operation){
  if(!data && !["clear", "getAll"].includes(operation)){ return; }
  if(!DATABASE_STORAGE) { await dbStart(); }

  return new Promise( (resolve, reject) => { 
    if(!operation){ resolve({error: `ObjectStore "${store}" access with no operation.`}); }

    const transaction = DATABASE_STORAGE.transaction([store], "readwrite");
    transaction.onerror = (event) => {
      resolve({error: `ObjectStore "${store}" ${operation} error:\n ${event.target.error}`});
    };
    
    const objectStore = transaction.objectStore(store);
    let request;

    switch(operation){
      case "get":
        request = objectStore.get(data);
        break;
      case "add":
        request = objectStore.add(data);
        break;
      case "update":
        request = objectStore.put(data);
        break;
      case "delete":
        request = objectStore.delete(data);
        break;
      case "clear":
        request = objectStore.clear();
        break;
      case "getAll":
        request = objectStore.getAll();
        break;
      default:
        resolve({error: `ObjectStore "${store}" access with invalid operation.`});
    }

    request.onsuccess = (event) =>{ resolve(event.target.result); }

    request.onerror = (event) => { resolve(null); }
  });
}

// User login/logout functions
async function requestAccess(access_value){
  const username_element = docId("user_name");
  const password_element = docId("pass_word");
  
  access_request = {
    "value": access_value,
    "user_name": username_element.value,
    "pass_word": password_element.value
  }

  if(access_value === "signup"){
    access_request["pass_confirm"] = docId("pass_confirm").value;
  } 
  
  fetch(`${window.env.SERVER_ADDRESS}/access`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify(access_request)
  }).then(async(response) => {
    const access_response = await response.json();

    if(access_response.error){
      let target_element = docId("access");
      let offsetY = 0;
      
      if(access_response.error_type == "user"){
        target_element = username_element;
        offsetY = username_element.offsetHeight;
      }else if (access_response.error_type == "password"){
        target_element = password_element;
        offsetY = password_element.offsetHeight;
      }
      
      displayMessage(target_element, access_response.error, {delay: 1, duration: 0.5, offsetY : -offsetY});
    }else{
      setFocus(false);
      if(!userLoggedIn()){ pushUser(); }
      CURRENT_USER = access_response;
      pullUser();
      updateLayout();
    }
  });
}

async function authorize(){
  docId("profile").style.display = "none";
  if(userLoggedIn()){ // Logout if logged in
    pushUser();
    fetch(`${window.env.SERVER_ADDRESS}/logout`)
      .then(async (response) => {   
        const local = await response.json();
        sendEvent(playerEvent, {action: "disconnect"});
        CURRENT_USER = local;
        clearUser();
        refresh();
      });
  }else{ // Open login/signup panel
    toggleAccess();
  }
}

async function oAuth(service, action){
  fetch(`${window.env.SERVER_ADDRESS}/oauth`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      service: service,
      action: action,
      current_path: window.location.pathname
      })
   }).then(async (response) => {
      const redirect = await response.json();
      if(redirect.error){
        displayMessage(docId("focus"), redirect.error);
      }else{
        window.location.href = redirect.url;
      }
    });
}

// User information functions
function clearUser(){
  dbAccess('user_ratings', null, 'clear');
  dbAccess('user_albums', null, 'clear');
}

async function pullUser(){
  fetch(`${window.env.SERVER_ADDRESS}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "pull"
      })
    }).then(async (response) => {
      const user_ratings = await response.json();
      if(user_ratings.error == null){
        await dbAccess("user_ratings", null, "clear");
        user_ratings.forEach(user_rating => {
          dbAccess("user_ratings", {id: user_rating.album_id, rating: user_rating.rating}, "add");          
        });
      }
    });  

  await fetch(`${window.env.SERVER_ADDRESS}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "pull",
      })
    }).then(async (response) => {
      const user_albums = await response.json();
      if(user_albums.error == null){
        await dbAccess("user_albums", null, "clear");
        user_albums.forEach(user_album => {
        dbAccess("user_albums", {date: dayjs(user_album.date).format("MMM DD, YYYY"), id: user_album.album_id}, "add");
      });
      }
    });

    updateLayout();
}

async function pushUser(){
  if(userLoggedIn()){
    const user_albums = await dbAccess("user_albums", null, "getAll");

    fetch(`${window.env.SERVER_ADDRESS}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "push",
      data: {
        user_albums: user_albums
        }
      })
    });

    const user_ratings =  await dbAccess("user_ratings", null, "getAll");

    fetch(`${window.env.SERVER_ADDRESS}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "push",
      data: {
        user_ratings: user_ratings
        }
      })
    });
  }
}
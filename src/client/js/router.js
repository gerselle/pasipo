document.addEventListener("click", (e) => {
  const target = e.target;
  if(!target.matches("a .internal")){ return }
  e.preventDefault();
  route(e);
});

const TS_CLIENT = new Typesense.Client({
  'nodes': [{
    url: window.env.TS_URL
  }],
  'apiKey': window.env.TS_KEY,
  'connectionTimeoutSeconds': 2
});

async function route(event){
  event.preventDefault();
  url = event.target.getAttribute("href");
  locationHandler(url);
}

function parseLocation(location){
  const segments = location.split("/").filter(segment => segment.trim() !== '');

  // Path should be within 4 segments ex: /admin/2000/03/21)
  switch(segments.length){
    case 0: return "day";
    case 1: break;
    case 2: return "year";
    case 3: return "month";
    case 4: return "day";
    default: return 404;
  }

  // A specific section other than the homepage or a date (ex: pasipo.app/login)
  const sections = [
    "login",
    "signup"
  ];

  return sections.includes(segments[0]) ? segments[0] : "user";
}

const updateJS = new CustomEvent("update", {detail: {script: "", start: false}});
const playerEvent = new CustomEvent("player", {detail: {action: null, data: null}});
function sendEvent(event, new_detail = null){
  if(!event){ return; }
  for(let key in new_detail){ event.detail[key] = new_detail[key]; }
  document.dispatchEvent(event);
}

async function locationHandler(location){
  const template = parseLocation(location || window.location.pathname);
  
  await fetch(`/templates/${template}.html`).then(async(response) =>{
      let target_element = docId("content");
      
      if(["login", "signup"].includes(template)){
        target_element = docId("focus");
        window.history.pushState({}, "", "/");
        setFocus(true);
      }

      const new_html = await response.text();

      if(new_html){
        target_element.innerHTML = new_html;
        const file_element =  "content";
        const script = docId(`${file_element}_js`);
        const link = docId(`${file_element}_css`);

        link.href = `/css/${template}.css`;
        script.src = `/js/${template}.js`;
        script.onload = function(){sendEvent(updateJS, {script: template, start: true})};
      }

      target_element.value = template;
    }
  );
}

window.addEventListener("popstate", () => { locationHandler(); })
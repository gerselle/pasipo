function swapAccess(to_login){
  if(!isFocused()){ return; }
  const template = to_login ? "login" : "signup";

  fetch(`/templates/${template}.html`)
  .then(async(response) =>{
    const html = await response.text();
    docId("focus").innerHTML = html; 
  });
}

function focusNote(){
  fetch(`/templates/note.html`)
  .then(async(response) =>{
    const html = await response.text();
    docId("focus").innerHTML = html; 
  });
}
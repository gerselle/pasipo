if(window.location.pathname == "/404"){
  displayError(null, "Redirecting to homepage...");
  setTimeout(()=>{ window.location.pathname = ""; }, 3000);
}

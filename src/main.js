function getMessage() {
  this.cnt = this.cnt || 0;
  return this.cnt++;
}

function eventHandler(msg, callback) {
  function onComplete() {
    var error = Math.random() > 0.85;
    callback(error, msg);
  }

// processing takes time...
  setTimeout(onComplete, Math.floor(Math.random() * 1000));
}

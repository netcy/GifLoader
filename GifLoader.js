class GifLoader {
  
  constructor() {
    this.load_callback = function (stream, userCallback) {
        userCallback = userCallback || function () {}
        let gifParser = new GifParser(stream);
        gifParser.parse(function (e, gif) {
          userCallback(gif);
        });
      }
  }
  loadGif(url, callback,onLoadError) {
     let self = this;
     let req = new XMLHttpRequest();
     callback = callback || function (){};
     onLoadError = onLoadError || function () {};
     req.open('GET',url,true);

     if ('overrideMimeType' in req) {
       req.overrideMimeType('text/plain; charset=x-user-defined');
     }
     else if ('responseType' in req) {
       req.responseType = 'arraybuffer';
     } else {
       req.setRequestHeader('Accept-Charset', 'x-user-defined');
     }

     req.onload = function (e) {
        if (this.status != 200) {
          onLoadError('xhr - response');
        }
        if (!('response' in this)) {
          this.response = new VBArray(this.responseText).toArray().map(String.fromCharCode).join('');
        }
        var data = this.response;
        if (data.toString().indexOf("ArrayBuffer") > 0) {
          data = new Uint8Array(data);
        }

        let stream = new Stream(data);
        self.load_callback(stream, callback)
     }
     req.onerror = function (e) {
       onLoadError(e);
     };

     req.onloadstart = function () {
       
     };
     req.onprogress = function (e) {
       
     };
     req.send();
  }
}
# GifLoader

GifLoader，GifParser，把Gif分割成帧数据。  
参考了libgif（ https://github.com/buzzfeed/libgif-js ）的代码 。 整理了代码，把相应的类整理出来，并提供接口。

example:
-------------------------


 
    var gifLoader = new GifLoader();
 
    gifLoader.loadGif('./flow.gif',function (gif) {
      console.log(gif);
      var can = document.getElementById('test');
      can.width = gif.header.width;
      can.height = gif.header.height;
      var ctx = can.getContext('2d');
      
      var index = 0, lastTime = new Date().getTime();
      function loop() {
        var delay = gif.gce[0].delayTime || 5;
        var now = new Date().getTime();
        if(now - lastTime >= delay * 10){
           ctx.putImageData(gif.frames[index].data,0,0);
           index ++;
           if(index >= gif.frames.length){
           index = 0;
           }
           lastTime = now;
        }
       
        requestAnimationFrame(loop);
      }
      loop(); 
    });
-------------------------


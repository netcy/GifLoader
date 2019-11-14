  class Stream {
    constructor(data){
      this.data = data;
      this.len = this.data.length;
      this.pos = 0;
    }
    readByte () {
       if (this.pos >= this.data.length) {
         throw new Error('Attempted to read past end of stream.');
       }
       if (this.data instanceof Uint8Array)
         return this.data[this.pos++];
       else
         return this.data.charCodeAt(this.pos++) & 0xFF;
    }
    readBytes (n) {
      var bytes = [];
      for (var i = 0; i < n; i++) {
        bytes.push(this.readByte());
      }
      return bytes;
    }
    readString (n) {
      var s = '';
      for (var i = 0; i < n; i++) {
        s += String.fromCharCode(this.readByte());
      }
      return s;
    }
    read (n){
      return this.readString(n);
    }
    readUnsigned = function (littleEndian) { // .
      var a = this.readBytes(2);
      return (a[1] << 8) + a[0];
    }
    // read a single byte and return an array of bit booleans
    readBitArray = function () {
      var arr = [];
      var bite = this.readByte();
      for (var i = 7; i >= 0; i--) {
        arr.push(!!(bite & (1 << i)));
      }
      return arr;
    }
    // look at the next byte in the stream without updating the stream position
    peekByte () {
      return this.data[this.pos];
    };
    // peek at an array of bytes without updating the stream position
    peekBytes (n) {
      var bytes = new Array(n);
      for (var i = 0; i < n; i++) {
        bytes[i] = this.data[this.pos + i];
      }
      return bytes;
    };
  }
  

class GifParser {
  constructor(stream){
    this.stream = stream;
     
  }
  _initHandler(){
    let gif = this.gif,frame = null,
    frames = gif.frames, frameOffsets = [],
    header, disposalMethod = null, disposalRestoreFromIdx = null,
    lastDisposalMethod = null, transparency = null, delay = null,
    self = this, lastImg = null,
    tmpCanvas = document.createElement('canvas');


    let pushFrame = function () {
      if (!frame) return;
      frames.push({
        data: frame.getImageData(0, 0, header.width, header.height),
        delay: delay
      });
      frameOffsets.push({
        x: 0,
        y: 0
      });
    };

    let clear = function () {
      transparency = null;
      delay = null;
      lastDisposalMethod = disposalMethod;
      disposalMethod = null;
      frame = null;
    };
    let get_canvas_scale = function () {
      return 1;
    }
    let setCanvasSize = function (w, h) {
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      tmpCanvas.style.width = w + 'px';
      tmpCanvas.style.height = h + 'px';
      tmpCanvas.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
    };

    this.handler = {};
    
    this.handler.eof = (e) => {
      pushFrame();
      this._parseCallback(e, this.gif);
    }
    this.handler.header = (_header) => {
      // console.log("header", _header);
      header = _header;
      gif.header = header;
      setCanvasSize(header.width,header.height);
    }

    this.handler.gce = function (gce) { // Graphics Control Extension
      // console.log("gce", gce);
      pushFrame();
      clear();
      transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
      delay = gce.delayTime;
      disposalMethod = gce.disposalMethod;
      gif.gce.push(gce);
    }

    this.handler.pte = function (pte) { // Plain Text Extension
      // console.log("pte", pte);
    }

    this.handler.com = function (com) { // comment extension
      // console.log("com", com);
    }

    this.handler.app = function (app) { // Application extension
      // console.log("app", app);
    }

    this.handler.img = function (img) { // 图形数据
      // console.log("img", img)
      gif.img.push(img);
      if (!frame) frame = tmpCanvas.getContext('2d');

      var currIdx = frames.length;

      //ct = color table, gct = global color table
      var ct = img.lctFlag ? img.lct : header.gct; // TODO: What if neither exists?

      /*
      Disposal method indicates the way in which the graphic is to
      be treated after being displayed.

      Values :    0 - No disposal specified. The decoder is
                      not required to take any action.
                  1 - Do not dispose. The graphic is to be left
                      in place.
                  2 - Restore to background color. The area used by the
                      graphic must be restored to the background color.
                  3 - Restore to previous. The decoder is required to
                      restore the area overwritten by the graphic with
                      what was there prior to rendering the graphic.

                      Importantly, "previous" means the frame state
                      after the last disposal of method 0, 1, or 2.
      */
      if (currIdx > 0) {
        if (lastDisposalMethod === 3) {
          // Restore to previous
          // If we disposed every frame including first frame up to this point, then we have
          // no composited frame to restore to. In this case, restore to background instead.
          if (disposalRestoreFromIdx !== null) {
            frame.putImageData(frames[disposalRestoreFromIdx].data, 0, 0);
          } else {
            frame.clearRect(lastImg.leftPos, lastImg.topPos, lastImg.width, lastImg.height);
          }
        } else {
          disposalRestoreFromIdx = currIdx - 1;
        }

        if (lastDisposalMethod === 2) {
          // Restore to background color
          // Browser implementations historically restore to transparent; we do the same.
          // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
          frame.clearRect(lastImg.leftPos, lastImg.topPos, lastImg.width, lastImg.height);
        }
      }
      // else, Undefined/Do not dispose.
      // frame contains final pixel data from the last frame; do nothing

      //Get existing pixels for img region after applying disposal method
      var imgData = frame.getImageData(img.leftPos, img.topPos, img.width, img.height);

      //apply color table colors
      img.pixels.forEach(function (pixel, i) {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== transparency) {
          imgData.data[i * 4 + 0] = ct[pixel][0];
          imgData.data[i * 4 + 1] = ct[pixel][1];
          imgData.data[i * 4 + 2] = ct[pixel][2];
          imgData.data[i * 4 + 3] = 255; // Opaque.
        }
      });

      frame.putImageData(imgData, img.leftPos, img.topPos);

      // if (!ctx_scaled) {
      //   ctx.scale(get_canvas_scale(), get_canvas_scale());
      //   ctx_scaled = true;
      // }

      lastImg = img;
    }
  }
  parse(callback){
    let self = this;
    this.gif = new Gif();
    this._initHandler();
    this._parseCallback = callback;
    self.parseHeader();
    setTimeout(function(){
      self.parseBlock();
    }, 0);
  }

  parseCT (entries) { // Each entry is 3 bytes, for RGB.
    let st = this.stream,
      handler = this.handler;
     let ct = [];
     for (let i = 0; i < entries; i++) {
       ct.push(st.readBytes(3));
     }
     return ct;
  }
 bitsToNum = function (ba) {
    return ba.reduce(function (s, n) {
      return s * 2 + n;
    }, 0);
 };
  parseHeader() {
    let st = this.stream,
      handler = this.handler,
      bitsToNum = this.bitsToNum;
    let hdr = {};
    hdr.sig = st.read(3);
    hdr.ver = st.read(3);
    if (hdr.sig !== 'GIF') throw new Error('Not a GIF file.'); // XXX: This should probably be handled more nicely.
    hdr.width = st.readUnsigned();
    hdr.height = st.readUnsigned();

    let bits = st.readBitArray();
    hdr.gctFlag = bits.shift();
    hdr.colorRes = bitsToNum(bits.splice(0, 3));
    hdr.sorted = bits.shift();
    hdr.gctSize = bitsToNum(bits.splice(0, 3));

    hdr.bgColor = st.readByte();
    hdr.pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    if (hdr.gctFlag) {
      hdr.gct = this.parseCT(1 << (hdr.gctSize + 1));
    }
    handler.header && handler.header(hdr);
  }

  parseBlock () {
    let st = this.stream,
      handler = this.handler;
    let block = {};
    block.sentinel = st.readByte();

    switch (String.fromCharCode(block.sentinel)) { // For ease of matching
      case '!':
        block.type = 'ext';
        this.parseExt(block);
        break;
      case ',':
        block.type = 'img';
        this.parseImg(block);
        break;
      case ';':
        block.type = 'eof';
        handler.eof && handler.eof(block);
        break;
      default:
        throw new Error('Unknown block: 0x' + block.sentinel.toString(16)); // TODO: Pad this with a 0.
    }
    let self = this;
    let parseNextBlock = function () {
      self.parseBlock();
    }
    if (block.type !== 'eof') setTimeout(parseNextBlock, 0);
  };

  parseExt (block) {
    let st = this.stream,
      handler = this.handler,
      self = this, bitsToNum = this.bitsToNum;
    let parseGCExt = function (block) {
      let blockSize = st.readByte(); // Always 4
      let bits = st.readBitArray();
      block.reserved = bits.splice(0, 3); // Reserved; should be 000.
      block.disposalMethod = bitsToNum(bits.splice(0, 3));
      block.userInput = bits.shift();
      block.transparencyGiven = bits.shift();

      block.delayTime = st.readUnsigned();

      block.transparencyIndex = st.readByte();

      block.terminator = st.readByte();

      handler.gce && handler.gce(block);
    };

    let parseComExt = function (block) {
      block.comment = self.readSubBlocks();
      handler.com && handler.com(block);
    };

    let parsePTExt = function (block) {
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      let blockSize = st.readByte(); // Always 12
      block.ptHeader = st.readBytes(12);
      block.ptData = self.readSubBlocks();
      handler.pte && handler.pte(block);
    };

    let parseAppExt = function (block) {
      let parseNetscapeExt = function (block) {
        let blockSize = st.readByte(); // Always 3
        block.unknown = st.readByte(); // ??? Always 1? What is this?
        block.iterations = st.readUnsigned();
        block.terminator = st.readByte();
        handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(block);
      };

      let parseUnknownAppExt = function (block) {
        block.appData = self.readSubBlocks();
        // FIXME: This won't work if a handler wants to match on any identifier.
        handler.app && handler.app[block.identifier] && handler.app[block.identifier](block);
      };

      let blockSize = st.readByte(); // Always 11
      block.identifier = st.read(8);
      block.authCode = st.read(3);
      switch (block.identifier) {
        case 'NETSCAPE':
          parseNetscapeExt(block);
          break;
        default:
          parseUnknownAppExt(block);
          break;
      }
    };

    let parseUnknownExt = function (block) {
      block.data = self.readSubBlocks();
      handler.unknown && handler.unknown(block);
    };

    block.label = st.readByte();
    switch (block.label) {
      case 0xF9:
        block.extType = 'gce';
        parseGCExt(block);
        break;
      case 0xFE:
        block.extType = 'com';
        parseComExt(block);
        break;
      case 0x01:
        block.extType = 'pte';
        parsePTExt(block);
        break;
      case 0xFF:
        block.extType = 'app';
        parseAppExt(block);
        break;
      default:
        block.extType = 'unknown';
        parseUnknownExt(block);
        break;
    }
  };

  parseImg (img) {
    let self = this,st = this.stream,handler = this.handler,
    bitsToNum = this.bitsToNum;
    let deinterlace = function (pixels, width) {
      // Of course this defeats the purpose of interlacing. And it's *probably*
      // the least efficient way it's ever been implemented. But nevertheless...
      let newPixels = new Array(pixels.length);
      let rows = pixels.length / width;
      let cpRow = function (toRow, fromRow) {
        let fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width);
        newPixels.splice.apply(newPixels, [toRow * width, width].concat(fromPixels));
      };

      // See appendix E.
      let offsets = [0, 4, 2, 1];
      let steps = [8, 8, 4, 2];

      let fromRow = 0;
      for (let pass = 0; pass < 4; pass++) {
        for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
          cpRow(toRow, fromRow)
          fromRow++;
        }
      }

      return newPixels;
    };

    img.leftPos = st.readUnsigned();
    img.topPos = st.readUnsigned();
    img.width = st.readUnsigned();
    img.height = st.readUnsigned();

    let bits = st.readBitArray();
    img.lctFlag = bits.shift();
    img.interlaced = bits.shift();
    img.sorted = bits.shift();
    img.reserved = bits.splice(0, 2);
    img.lctSize = bitsToNum(bits.splice(0, 3));

    if (img.lctFlag) {
      img.lct = parseCT(1 << (img.lctSize + 1));
    }

    img.lzwMinCodeSize = st.readByte();

    let lzwData = self.readSubBlocks();

    img.pixels = this.lzwDecode(img.lzwMinCodeSize, lzwData);

    if (img.interlaced) { // Move
      img.pixels = deinterlace(img.pixels, img.width);
    }

    handler.img && handler.img(img);
  };

  readSubBlocks () {
    let st = this.stream,
      handler = this.handler;
    let size, data;
    data = '';
    do {
      size = st.readByte();
      data += st.read(size);
    } while (size !== 0);
    return data;
  }

  lzwDecode (minCodeSize, data) {
      // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
      let pos = 0; // Maybe this streaming thing should be merged with the Stream?
      let readCode = function (size) {
        let code = 0;
        for (let i = 0; i < size; i++) {
          if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
            code |= 1 << i;
          }
          pos++;
        }
        return code;
      };

      let output = [];

      let clearCode = 1 << minCodeSize;
      let eoiCode = clearCode + 1;

      let codeSize = minCodeSize + 1;

      let dict = [];

      let clear = function () {
        dict = [];
        codeSize = minCodeSize + 1;
        for (let i = 0; i < clearCode; i++) {
          dict[i] = [i];
        }
        dict[clearCode] = [];
        dict[eoiCode] = null;

      };

      let code;
      let last;

      while (true) {
        last = code;
        code = readCode(codeSize);

        if (code === clearCode) {
          clear();
          continue;
        }
        if (code === eoiCode) break;

        if (code < dict.length) {
          if (last !== clearCode) {
            dict.push(dict[last].concat(dict[code][0]));
          }
        } else {
          if (code !== dict.length) throw new Error('Invalid LZW code.');
          dict.push(dict[last].concat(dict[last][0]));
        }
        output.push.apply(output, dict[code]);

        if (dict.length === (1 << codeSize) && codeSize < 12) {
          // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
          codeSize++;
        }
      }

      // I don't know if this is technically an error, but some GIFs do it.
      //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
      return output;
  }
}

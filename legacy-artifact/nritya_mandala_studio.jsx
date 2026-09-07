import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Calendar, Users, Layers, Settings as SettingsIcon, Plus, X, Trash2, Edit2, Phone, QrCode, ChevronLeft, ChevronRight, Check, AlertCircle, Star } from "lucide-react";

// ---------- Design tokens ----------
// Maroon (sari red) primary, warm gold accent, ivory ground, sage for level progress.
const T = {
  maroon: "#9E2B22",
  maroonDark: "#6E1D17",
  gold: "#C58D2E",
  goldLight: "#E6C079",
  ivory: "#F7E6D8",
  paper: "#F1DFCB",
  ink: "#241B15",
  inkSoft: "#7A6A5C",
  sage: "#7A8B6F",
  terracotta: "#B8562F",
  line: "#E6D3BE",
};

// Studio emblem — embedded so the app is self-contained (no external image hosting needed)
const LOGO_DATA_URI = "data:image/jpeg;base64,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";

const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap";

// ---------- QR code generation (fully offline, no network calls) ----------
// Embedded verbatim (only the top-level variable renamed) from the 'qrcode-generator'
// npm package by Kazuhiko Arase (MIT licensed). Artifacts run in a sandboxed frame that
// blocks loading images from external QR-generator APIs, so QR codes are generated and
// rendered locally instead — this also means QR codes work with no internet connection.
const QRCodeLib = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();


function useGoogleFonts() {
  useEffect(() => {
    if (document.getElementById("nm-fonts")) return;
    const link = document.createElement("link");
    link.id = "nm-fonts";
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Short, easy-to-type code so parents can look up their kid without relying on a URL
// fragment — confirmed that claude.ai's published-artifact wrapper doesn't forward
// #hash fragments into the sandboxed iframe, so hash-based deep links don't survive it.
// Excludes visually ambiguous characters (0/O, 1/I/L).
function genKidCode(existingCodes = []) {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existingCodes.includes(code));
  return code;
}

// Empty on purpose — the studio defines its own levels and ordering from scratch.
const DEFAULT_LEVELS = [];

const DEFAULT_DATA = {
  kids: [],
  classes: [],
  enrollments: [],
  attendance: [],
  levels: DEFAULT_LEVELS,
  levelHistory: [],
  packages: [],
  settings: { pin: null, studioName: "Nritya Mandala", publicUrl: "" },
};

// ---------- Package / payment helpers ----------
// A package = N classes paid for up front (e.g. "5-class pass"). We don't track
// amounts/discounts here — that goes in the notes field. What we DO track is how
// many of the paid classes have been used, so admin can see who still needs to pay.
function pkgUsed(pkg, data) {
  return data.attendance.filter((a) => a.packageId === pkg.id && a.status === "attended").length;
}
function pkgRemaining(pkg, data) {
  return pkg.classesTotal - pkgUsed(pkg, data);
}
function kidPackages(kidId, data) {
  return data.packages.filter((p) => p.kidId === kidId).sort((a, b) => a.date.localeCompare(b.date));
}
function kidRemainingCredits(kidId, data) {
  return kidPackages(kidId, data).reduce((sum, p) => sum + pkgRemaining(p, data), 0);
}
// Oldest package with room left — used to auto-assign a credit when attendance is marked.
function nextAvailablePackage(kidId, data) {
  return kidPackages(kidId, data).find((p) => pkgRemaining(p, data) > 0) || null;
}

// Shared by the admin Calendar tab and the parent-facing QR check-in — one place
// that knows how to record attendance and auto-consume a package credit.
function applyAttendance(setData, kidId, classId, dateStr, status) {
  setData((d) => {
    const exists = d.attendance.find((a) => a.kidId === kidId && a.classId === classId && a.date === dateStr);
    const pkg = status === "attended" ? nextAvailablePackage(kidId, d) : null;
    if (exists) return { ...d, attendance: d.attendance.map((a) => (a === exists ? { ...a, status, packageId: pkg?.id ?? (status === "attended" ? null : a.packageId) } : a)) };
    return { ...d, attendance: [...d.attendance, { id: uid(), kidId, classId, date: dateStr, status, packageId: pkg?.id ?? null }] };
  });
}
function removeAttendance(setData, kidId, classId, dateStr) {
  setData((d) => ({ ...d, attendance: d.attendance.filter((a) => !(a.kidId === kidId && a.classId === classId && a.date === dateStr)) }));
}

// ---------- Storage helpers ----------
async function loadData() {
  try {
    const res = await window.storage.get("app-data", true);
    if (res && res.value) {
      const loaded = JSON.parse(res.value);
      // Backfill any fields added to the schema after this data was first saved
      // (e.g. older saves won't have "packages") so nothing downstream reads undefined.
      let merged = { ...DEFAULT_DATA, ...loaded, settings: { ...DEFAULT_DATA.settings, ...(loaded.settings || {}) } };
      // Backfill parent-lookup codes for kids added before this feature existed.
      const existingCodes = merged.kids.filter((k) => k.code).map((k) => k.code);
      let codesChanged = false;
      merged = {
        ...merged,
        kids: merged.kids.map((k) => {
          if (k.code) return k;
          codesChanged = true;
          const code = genKidCode(existingCodes);
          existingCodes.push(code);
          return { ...k, code };
        }),
      };
      if (codesChanged) await saveData(merged);
      return merged;
    }
  } catch (e) {
    // key not found yet
  }
  return null;
}
async function saveData(data) {
  try {
    await window.storage.set("app-data", JSON.stringify(data), true);
  } catch (e) {
    console.error("Save failed", e);
  }
}

// ---------- Small UI atoms ----------
function Btn({ children, onClick, variant = "primary", size = "md", icon: Icon, type = "button", disabled }) {
  const base = "inline-flex items-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm rounded-md", md: "px-4 py-2 text-sm rounded-md", lg: "px-5 py-2.5 text-base rounded-md" };
  const variants = {
    primary: { backgroundColor: T.maroon, color: T.ivory },
    gold: { backgroundColor: T.gold, color: T.maroonDark },
    ghost: { backgroundColor: "transparent", color: T.maroon, border: `1px solid ${T.line}` },
    danger: { backgroundColor: "transparent", color: T.terracotta, border: `1px solid ${T.terracotta}55` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]}`} style={variants[variant]}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${T.line}`,
  background: "#fff",
  color: T.ink,
  fontSize: 14,
  fontFamily: "Inter, sans-serif",
};

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,33,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.ivory, borderRadius: 10, padding: 24, width: wide ? 560 : 420, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${T.line}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.maroonDark }}>{title}</h3>
          <button onClick={onClose} style={{ color: T.inkSoft }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LevelBadge({ level }) {
  if (!level) return <span style={{ fontSize: 12, color: T.inkSoft }}>Unassigned</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>
      <Star size={11} fill={T.sage} /> {level.name}
    </span>
  );
}

// In-app confirm dialog — the browser's native window.confirm() is blocked inside
// the sandboxed artifact frame, so delete/reset actions must use this instead or
// they silently do nothing when clicked.
function ConfirmModal({ title = "Are you sure?", message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: T.ink, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// ---------- PIN gate ----------
function PinGate({ data, onUnlock, onSetPin, onParentLookup }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("pin"); // 'pin' | 'lookup'
  const [code, setCode] = useState("");
  const [lookupError, setLookupError] = useState("");
  const needsSetup = !data.settings.pin;

  const submit = () => {
    if (needsSetup) {
      if (pin.length < 4) return setError("Choose at least 4 digits.");
      if (pin !== confirmPin) return setError("PINs don't match.");
      onSetPin(pin);
    } else {
      if (pin === data.settings.pin) onUnlock();
      else setError("Incorrect PIN.");
    }
  };

  const submitLookup = () => {
    const kid = data.kids.find((k) => k.code === code.trim().toUpperCase());
    if (!kid) { setLookupError("Code not found — check with the studio."); return; }
    onParentLookup(kid);
  };

  if (mode === "lookup") {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
          <img src={LOGO_DATA_URI} alt="Nritya Mandala" style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
          <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>Enter your child's code to see their bookings</p>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setLookupError(""); }}
            placeholder="Code"
            style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase", marginBottom: 16 }}
            onKeyDown={(e) => e.key === "Enter" && submitLookup()}
            autoFocus
          />
          {lookupError && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{lookupError}</p>}
          <Btn onClick={submitLookup} size="lg">View</Btn>
          <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 18 }}>
            <button onClick={() => { setMode("pin"); setLookupError(""); }} style={{ color: T.inkSoft, textDecoration: "underline" }}>Studio sign-in instead</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <img src={LOGO_DATA_URI} alt="Nritya Mandala" style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>{needsSetup ? "Set a studio PIN to get started" : "Enter the studio PIN"}</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, marginBottom: needsSetup ? 10 : 16 }}
          onKeyDown={(e) => e.key === "Enter" && !needsSetup && submit()}
        />
        {needsSetup && (
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Confirm PIN"
            style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, marginBottom: 16 }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        )}
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Btn onClick={submit} size="lg">{needsSetup ? "Set PIN & continue" : "Unlock"}</Btn>
        {!needsSetup && (
          <p style={{ fontSize: 12, marginTop: 16 }}>
            <button onClick={() => setMode("lookup")} style={{ color: T.gold, textDecoration: "underline" }}>Looking for your child's bookings?</button>
          </p>
        )}
        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 18 }}>Shared link + PIN only — don't share this link publicly.</p>
      </div>
    </div>
  );
}

// ---------- Kids ----------
function KidModal({ initial, onSave, onClose, data, setData }) {
  const [name, setName] = useState(initial?.name || "");
  const [age, setAge] = useState(initial?.age || "");
  const [levelId, setLevelId] = useState(initial?.levelId || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [guardians, setGuardians] = useState(initial?.guardians?.length ? initial.guardians : [{ id: uid(), name: "", phone: "", relation: "Parent", emergency: true }]);
  const levels = data.levels;

  const updateG = (id, field, val) => setGuardians((gs) => gs.map((g) => (g.id === id ? { ...g, [field]: val } : g)));
  const addG = () => setGuardians((gs) => [...gs, { id: uid(), name: "", phone: "", relation: "Parent", emergency: false }]);
  const removeG = (id) => setGuardians((gs) => gs.filter((g) => g.id !== id));

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || uid(),
      code: initial?.code || genKidCode(data.kids.map((k) => k.code).filter(Boolean)),
      name: name.trim(),
      age: age ? Number(age) : null,
      levelId: levelId || null,
      notes: notes.trim(),
      guardians: guardians.filter((g) => g.name.trim() || g.phone.trim()),
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
  };

  // Weekly bookings + packages only make sense once the kid actually exists in the
  // system (they need an id other records can point to) — so these sections only
  // show up while editing, not on first add.
  const kidId = initial?.id;
  const myEnrollments = kidId ? data.enrollments.filter((e) => e.kidId === kidId) : [];
  const toggleClass = (classId) => {
    setData((d) => {
      const exists = d.enrollments.find((e) => e.kidId === kidId && e.classId === classId);
      if (exists) return { ...d, enrollments: d.enrollments.filter((e) => e !== exists) };
      return { ...d, enrollments: [...d.enrollments, { id: uid(), kidId, classId }] };
    });
  };

  const myPackages = kidId ? kidPackages(kidId, data) : [];
  const [pkgClasses, setPkgClasses] = useState(5);
  const [pkgNotes, setPkgNotes] = useState("");
  const addPackage = () => {
    if (!pkgClasses || pkgClasses < 1) return;
    setData((d) => ({ ...d, packages: [...d.packages, { id: uid(), kidId, classesTotal: Number(pkgClasses), notes: pkgNotes.trim(), date: new Date().toISOString().slice(0, 10) }] }));
    setPkgClasses(5);
    setPkgNotes("");
  };
  const [confirmRemovePkg, setConfirmRemovePkg] = useState(null);
  const doRemovePackage = (id) => {
    setData((d) => ({ ...d, packages: d.packages.filter((p) => p.id !== id) }));
    setConfirmRemovePkg(null);
  };

  return (
    <>
    <Modal title={initial ? "Edit kid" : "Add a kid"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kid's name" /></Field>
        <Field label="Age"><input style={inputStyle} type="number" min={4} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 7" /></Field>
      </div>
      <Field label="Level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Unassigned</option>
          {[...levels].sort((a, b) => a.order - b.order).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (allergies, needs, etc.)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      <div className="mt-2 mb-1 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Parent / emergency contacts</span>
        <button onClick={addG} style={{ color: T.maroon, fontSize: 12 }} className="flex items-center gap-1"><Plus size={13} /> Add contact</button>
      </div>
      {guardians.map((g) => (
        <div key={g.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input style={inputStyle} placeholder="Name" value={g.name} onChange={(e) => updateG(g.id, "name", e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={g.phone} onChange={(e) => updateG(g.id, "phone", e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <select style={{ ...inputStyle, width: 140 }} value={g.relation} onChange={(e) => updateG(g.id, "relation", e.target.value)}>
              {["Parent", "Guardian", "Grandparent", "Relative", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: T.inkSoft }}>
              <input type="checkbox" checked={g.emergency} onChange={(e) => updateG(g.id, "emergency", e.target.checked)} /> Emergency contact
            </label>
            <button onClick={() => removeG(g.id)} style={{ color: T.terracotta, marginLeft: "auto" }}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-2 mt-4 mb-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>{initial ? "Save changes" : "Save kid"}</Btn>
      </div>

      {kidId && (
        <>
          <div style={{ borderTop: `1px solid ${T.line}`, margin: "16px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: T.inkSoft }}>Parent lookup code</span>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 20, letterSpacing: 3, fontWeight: 700, color: T.maroonDark }}>{initial.code}</span>
          </div>
          <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Weekly classes booked</span>
          {data.classes.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>No classes set up yet — add one in the Classes tab first.</p>}
          <div className="grid gap-1.5 mb-4">
            {data.classes.map((c) => {
              const booked = myEnrollments.some((e) => e.classId === c.id);
              return (
                <label key={c.id} className="flex items-center gap-2" style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, background: booked ? `${T.sage}18` : "transparent" }}>
                  <input type="checkbox" checked={booked} onChange={() => toggleClass(c.id)} />
                  <span style={{ fontWeight: booked ? 600 : 400 }}>{c.day} {c.time} — {c.label}</span>
                </label>
              );
            })}
          </div>
          {myEnrollments.length > 1 && (
            <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -8, marginBottom: 12 }}>Booked into {myEnrollments.length} recurring weekly classes.</p>
          )}

          <div style={{ borderTop: `1px solid ${T.line}`, margin: "16px 0" }} />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Class packages / payment</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: kidRemainingCredits(kidId, data) > 0 ? T.sage : T.terracotta }}>
              {kidRemainingCredits(kidId, data)} class{kidRemainingCredits(kidId, data) === 1 ? "" : "es"} remaining
            </span>
          </div>
          {myPackages.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{pkgUsed(p, data)}/{p.classesTotal} used</span>
                <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>{p.date}{p.notes ? ` · ${p.notes}` : ""}</span>
              </div>
              <button onClick={() => setConfirmRemovePkg(p.id)} style={{ color: T.terracotta }}><Trash2 size={13} /></button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
            <div style={{ width: 90 }}>
              <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>Classes paid</span>
              <input style={inputStyle} type="number" min={1} value={pkgClasses} onChange={(e) => setPkgClasses(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>Notes (amount, discount, how paid…)</span>
              <input style={inputStyle} value={pkgNotes} onChange={(e) => setPkgNotes(e.target.value)} placeholder="e.g. $135 for 5, paid cash 3 Sept" />
            </div>
            <Btn onClick={addPackage} icon={Plus} size="sm">Add</Btn>
          </div>
          <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>Marking a kid "attended" in the Calendar tab automatically uses one class from their oldest package with room left.</p>
        </>
      )}
    </Modal>
    {confirmRemovePkg && (
      <ConfirmModal message="Remove this package record? This can't be undone." onConfirm={() => doRemovePackage(confirmRemovePkg)} onCancel={() => setConfirmRemovePkg(null)} />
    )}
    </>
  );
}

// Renders a QR code to a <canvas> entirely offline, using the embedded QRCodeLib —
// no network request, so it works even without internet and isn't blocked by the
// artifact's sandbox restrictions on loading external images.
function QrCanvas({ text, size = 240, onReady }) {
  const canvasRef = useRef(null);
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeLib(0, "M");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const rows = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
        rows.push(row);
      }
      return rows;
    } catch (e) {
      console.error("QR generation failed", e);
      return null;
    }
  }, [text]);

  useEffect(() => {
    if (!matrix || !canvasRef.current) return;
    const n = matrix.length;
    const quiet = 2;
    const total = n + quiet * 2;
    const cell = Math.max(1, Math.floor(size / total));
    const px = cell * total;
    const canvas = canvasRef.current;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = T.maroonDark;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
    if (onReady) onReady(canvas.toDataURL("image/png"));
  }, [matrix, size]);

  if (!matrix) return <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.terracotta, textAlign: "center", padding: 12 }}>Couldn't generate a QR code for this link.</div>;
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />;
}

function QrModal({ kid, publicUrl, onClose }) {
  // The QR takes them to the studio app; the code is what actually gets them to this
  // kid's page. We don't rely on a #hash link here — confirmed that Claude's published-
  // artifact wrapper doesn't forward URL fragments into the sandboxed app, so a hash-only
  // deep link silently fails for anyone scanning it. The code always works.
  const base = publicUrl ? publicUrl.replace(/\/$/, "") : `${window.location.origin}${window.location.pathname}`;
  const [pngDataUrl, setPngDataUrl] = useState(null);
  return (
    <Modal title={`${kid.name}'s QR code`} onClose={onClose}>
      {!publicUrl && (
        <div style={{ background: `${T.terracotta}18`, border: `1px solid ${T.terracotta}55`, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: T.terracotta, lineHeight: 1.5 }}>
          No public link set yet — this QR points to your current browser tab and won't work for anyone else. Publish the artifact, then paste the claude.ai link into Settings → Public link first.
        </div>
      )}
      <div className="flex flex-col items-center text-center">
        <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff" }}>
          <QrCanvas text={base} size={220} onReady={setPngDataUrl} />
        </div>
        <div style={{ marginTop: 14, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{kid.code}</div>
        </div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
          Scanning opens the studio page — {kid.name}'s parent then enters this code to see bookings, level, history, and check in for today's class. No PIN needed. Print both onto their card.
        </p>
        <div className="flex gap-2 mt-4">
          {pngDataUrl && (
            <a href={pngDataUrl} download={`${kid.name.replace(/\s+/g, "-")}-qr.png`}>
              <Btn variant="ghost">Download PNG</Btn>
            </a>
          )}
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PaymentBadge({ kidId, data }) {
  const remaining = kidRemainingCredits(kidId, data);
  const hasAnyPackage = kidPackages(kidId, data).length > 0;
  if (!hasAnyPackage) {
    return <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: `${T.terracotta}18`, color: T.terracotta, fontWeight: 600 }}>No package on file</span>;
  }
  const ok = remaining > 0;
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: ok ? `${T.sage}20` : `${T.terracotta}18`, color: ok ? T.sage : T.terracotta, fontWeight: 600 }}>
      {remaining} class{remaining === 1 ? "" : "es"} left
    </span>
  );
}

function KidsView({ data, setData }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [qrKid, setQrKid] = useState(null);
  const [query, setQuery] = useState("");

  const levelById = useMemo(() => Object.fromEntries(data.levels.map((l) => [l.id, l])), [data.levels]);

  const saveKid = (kid) => {
    setData((d) => {
      const exists = d.kids.some((k) => k.id === kid.id);
      return { ...d, kids: exists ? d.kids.map((k) => (k.id === kid.id ? kid : k)) : [...d.kids, kid] };
    });
    setEditing(null);
    setAdding(false);
  };

  const [confirmRemoveKid, setConfirmRemoveKid] = useState(null);
  const doRemoveKid = (id) => {
    setData((d) => ({
      ...d,
      kids: d.kids.filter((k) => k.id !== id),
      enrollments: d.enrollments.filter((e) => e.kidId !== id),
      attendance: d.attendance.filter((a) => a.kidId !== id),
      levelHistory: d.levelHistory.filter((h) => h.kidId !== id),
      packages: d.packages.filter((p) => p.kidId !== id),
    }));
    setConfirmRemoveKid(null);
  };

  const filtered = data.kids.filter((k) => k.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input style={{ ...inputStyle, width: 240 }} placeholder="Search kids…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Btn icon={Plus} onClick={() => setAdding(true)}>Add kid</Btn>
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
          <p>No kids yet. Add the first one to get started.</p>
        </div>
      )}
      <div className="grid gap-3">
        {filtered.map((k) => (
          <div key={k.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 8, padding: 14 }} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>{k.name}</span>
                {k.age && <span style={{ fontSize: 12, color: T.inkSoft }}>· {k.age}y</span>}
                {k.code && <span style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 1 }}>· {k.code}</span>}
              </div>
              <div className="flex items-center gap-2 mb-1"><LevelBadge level={levelById[k.levelId]} /><PaymentBadge kidId={k.id} data={data} /></div>
              {k.guardians?.[0] && (
                <div style={{ fontSize: 12, color: T.inkSoft }} className="flex items-center gap-1">
                  <Phone size={11} /> {k.guardians[0].name} · {k.guardians[0].phone}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setQrKid(k)} title="QR code" style={{ color: T.maroon }}><QrCode size={17} /></button>
              <button onClick={() => setEditing(k)} title="Edit" style={{ color: T.maroon }}><Edit2 size={15} /></button>
              <button onClick={() => setConfirmRemoveKid(k.id)} title="Remove" style={{ color: T.terracotta }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {(adding || editing) && <KidModal initial={editing} data={data} setData={setData} onClose={() => { setAdding(false); setEditing(null); }} onSave={saveKid} />}
      {qrKid && <QrModal kid={qrKid} publicUrl={data.settings.publicUrl} onClose={() => setQrKid(null)} />}
      {confirmRemoveKid && (
        <ConfirmModal message="Remove this kid and all their records — bookings, attendance, packages and level history?" onConfirm={() => doRemoveKid(confirmRemoveKid)} onCancel={() => setConfirmRemoveKid(null)} />
      )}
    </div>
  );
}

// ---------- Classes ----------
function ClassModal({ initial, onSave, onClose, levels }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [day, setDay] = useState(initial?.day || "Saturday");
  const [time, setTime] = useState(initial?.time || "10:00");
  const [levelId, setLevelId] = useState(initial?.levelId || "");
  const [capacity, setCapacity] = useState(initial?.capacity || 12);

  const save = () => {
    if (!label.trim()) return;
    onSave({ id: initial?.id || uid(), label: label.trim(), day, time, levelId: levelId || null, capacity: Number(capacity) || 12 });
  };

  return (
    <Modal title={initial ? "Edit class" : "Add a class"} onClose={onClose}>
      <Field label="Class name"><input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Beginners Saturday" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day">
          <select style={inputStyle} value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Time"><input style={inputStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Level focus">
          <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <option value="">Any level</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Capacity"><input style={inputStyle} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save class</Btn>
      </div>
    </Modal>
  );
}

function ClassesView({ data, setData }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const levelById = useMemo(() => Object.fromEntries(data.levels.map((l) => [l.id, l])), [data.levels]);

  const save = (cls) => {
    setData((d) => {
      const exists = d.classes.some((c) => c.id === cls.id);
      return { ...d, classes: exists ? d.classes.map((c) => (c.id === cls.id ? cls : c)) : [...d.classes, cls] };
    });
    setEditing(null); setAdding(false);
  };
  const [confirmRemoveClass, setConfirmRemoveClass] = useState(null);
  const doRemoveClass = (id) => {
    setData((d) => ({ ...d, classes: d.classes.filter((c) => c.id !== id), enrollments: d.enrollments.filter((e) => e.classId !== id) }));
    setConfirmRemoveClass(null);
  };

  const byDay = DAYS.map((day) => ({ day, items: data.classes.filter((c) => c.day === day).sort((a, b) => a.time.localeCompare(b.time)) }));

  return (
    <div>
      <div className="flex justify-end mb-4"><Btn icon={Plus} onClick={() => setAdding(true)}>Add class</Btn></div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {byDay.filter((d) => d.items.length).map(({ day, items }) => (
          <div key={day}>
            <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 15, marginBottom: 6 }}>{day}</h4>
            {items.map((c) => {
              const enrolled = data.enrollments.filter((e) => e.classId === c.id).length;
              return (
                <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: T.ink }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{c.time} · {enrolled}/{c.capacity} enrolled</div>
                      {levelById[c.levelId] && <div style={{ marginTop: 4 }}><LevelBadge level={levelById[c.levelId]} /></div>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(c)} style={{ color: T.maroon }}><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmRemoveClass(c.id)} style={{ color: T.terracotta }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {data.classes.length === 0 && <p style={{ color: T.inkSoft }}>No classes set up yet.</p>}
      </div>
      {(adding || editing) && <ClassModal initial={editing} levels={data.levels} onClose={() => { setAdding(false); setEditing(null); }} onSave={save} />}
      {confirmRemoveClass && (
        <ConfirmModal message="Remove this class? Bookings and attendance for it will also be removed." onConfirm={() => doRemoveClass(confirmRemoveClass)} onCancel={() => setConfirmRemoveClass(null)} />
      )}
    </div>
  );
}

// ---------- Calendar (weekly, with bookings) ----------
function CalendarView({ data, setData }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookingClass, setBookingClass] = useState(null);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const weekDates = DAYS.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  const levelById = useMemo(() => Object.fromEntries(data.levels.map((l) => [l.id, l])), [data.levels]);
  const kidById = useMemo(() => Object.fromEntries(data.kids.map((k) => [k.id, k])), [data.kids]);

  const markAttendance = (kidId, classId, dateStr, status) => applyAttendance(setData, kidId, classId, dateStr, status);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} style={{ color: T.maroon }}><ChevronLeft size={18} /></button>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>
            {monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {weekDates[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button onClick={() => setWeekOffset((w) => w + 1)} style={{ color: T.maroon }}><ChevronRight size={18} /></button>
        </div>
        {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ fontSize: 12, color: T.inkSoft }}>Back to this week</button>}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().slice(0, 10);
          const isToday = dateStr === today.toISOString().slice(0, 10);
          const dayClasses = data.classes.filter((c) => c.day === DAYS[i]);
          return (
            <div key={i} style={{ background: isToday ? `${T.gold}18` : "#fff", border: `1px solid ${isToday ? T.gold : T.line}`, borderRadius: 8, padding: 10, minHeight: 90 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? T.maroon : T.inkSoft, marginBottom: 6 }}>{DAYS[i].slice(0, 3)} {date.getDate()}</div>
              {dayClasses.length === 0 && <div style={{ fontSize: 11, color: `${T.inkSoft}99` }}>—</div>}
              {dayClasses.map((c) => {
                const roster = data.enrollments.filter((e) => e.classId === c.id).map((e) => kidById[e.kidId]).filter(Boolean);
                return (
                  <button key={c.id} onClick={() => setBookingClass({ ...c, dateStr })} style={{ display: "block", width: "100%", textAlign: "left", background: T.paper, borderRadius: 6, padding: "5px 8px", marginBottom: 5, border: "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.maroonDark }}>{c.time} {c.label}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{roster.length} booked</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {bookingClass && (
        <Modal title={`${bookingClass.label} — ${bookingClass.dateStr}`} onClose={() => setBookingClass(null)} wide>
          <RosterEditor data={data} setData={setData} cls={bookingClass} kidById={kidById} markAttendance={markAttendance} />
        </Modal>
      )}
    </div>
  );
}

function RosterEditor({ data, setData, cls, kidById, markAttendance }) {
  const roster = data.enrollments.filter((e) => e.classId === cls.id);
  const availableKids = data.kids.filter((k) => !roster.some((r) => r.kidId === k.id));
  const [addingKid, setAddingKid] = useState("");

  const enroll = () => {
    if (!addingKid) return;
    setData((d) => ({ ...d, enrollments: [...d.enrollments, { id: uid(), kidId: addingKid, classId: cls.id }] }));
    setAddingKid("");
  };
  const unenroll = (id) => setData((d) => ({ ...d, enrollments: d.enrollments.filter((e) => e.id !== id) }));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select style={inputStyle} value={addingKid} onChange={(e) => setAddingKid(e.target.value)}>
          <option value="">Book a kid into this class…</option>
          {availableKids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <Btn onClick={enroll} icon={Plus}>Book</Btn>
      </div>
      {roster.length === 0 && <p style={{ color: T.inkSoft, fontSize: 13 }}>No one booked into this class yet.</p>}
      <div className="grid gap-2">
        {roster.map((r) => {
          const kid = kidById[r.kidId];
          if (!kid) return null;
          const att = data.attendance.find((a) => a.kidId === kid.id && a.classId === cls.id && a.date === cls.dateStr);
          const remaining = kidRemainingCredits(kid.id, data);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, color: T.ink }}>{kid.name}</span>
                <PaymentBadge kidId={kid.id} data={data} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => markAttendance(kid.id, cls.id, cls.dateStr, "attended")} title={remaining > 0 || att?.packageId ? "Mark attended (uses 1 credit)" : "Mark attended (no credit available)"} style={{ color: att?.status === "attended" ? T.sage : T.inkSoft }}><Check size={15} /></button>
                <button onClick={() => markAttendance(kid.id, cls.id, cls.dateStr, "missed")} title="Mark missed" style={{ color: att?.status === "missed" ? T.terracotta : T.inkSoft }}><AlertCircle size={15} /></button>
                <button onClick={() => unenroll(r.id)} title="Remove booking" style={{ color: T.terracotta }}><X size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Levels ----------
// Small modal for adding a level — asks for name + what it means, rather than
// dropping a "New level" placeholder straight into the list.
function AddLevelModal({ nextOrder, onSave, onClose }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: uid(), name: name.trim(), desc: desc.trim(), order: nextOrder });
  };
  return (
    <Modal title="Add a level" onClose={onClose}>
      <Field label="Level name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paila" autoFocus /></Field>
      <Field label="What this level means"><textarea style={{ ...inputStyle, minHeight: 70 }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Basic sequences and hand gestures (mudras)" /></Field>
      <p style={{ fontSize: 11, color: T.inkSoft, marginBottom: 16 }}>It'll be added to the end of the order — reorder with the up/down arrows afterwards if needed.</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Add level</Btn>
      </div>
    </Modal>
  );
}

function LevelsView({ data, setData }) {
  const [addingLevel, setAddingLevel] = useState(false);
  const addLevel = (level) => {
    setData((d) => ({ ...d, levels: [...d.levels, level] }));
    setAddingLevel(false);
  };
  const updateLevel = (id, field, val) => setData((d) => ({ ...d, levels: d.levels.map((l) => (l.id === id ? { ...l, [field]: val } : l)) }));

  // Levels are deliberately not individually deletable — deleting one out from under
  // kids who've already progressed through it would erase their history. "Reset" below
  // is the one deliberate way to clear the whole list and start over.
  const moveLevel = (id, dir) => {
    setData((d) => {
      const sorted = [...d.levels].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return d;
      const a = sorted[idx], b = sorted[swapIdx];
      return { ...d, levels: d.levels.map((l) => (l.id === a.id ? { ...l, order: b.order } : l.id === b.id ? { ...l, order: a.order } : l)) };
    });
  };

  const [confirmReset, setConfirmReset] = useState(false);
  const doResetLevels = () => {
    setData((d) => ({ ...d, levels: [], levelHistory: [], kids: d.kids.map((k) => ({ ...k, levelId: null })) }));
    setConfirmReset(false);
  };

  const promote = (kidId, levelId) => {
    setData((d) => ({
      ...d,
      kids: d.kids.map((k) => (k.id === kidId ? { ...k, levelId } : k)),
      levelHistory: [...d.levelHistory, { id: uid(), kidId, levelId, date: new Date().toISOString().slice(0, 10) }],
    }));
  };

  const sorted = [...data.levels].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Btn variant="danger" onClick={() => setConfirmReset(true)}>Reset levels</Btn>
        <Btn icon={Plus} onClick={() => setAddingLevel(true)}>Add level</Btn>
      </div>
      {sorted.length === 0 && <p style={{ color: T.inkSoft, marginBottom: 16 }}>No levels defined yet. Add your first one — use the up/down arrows to set the order kids progress through.</p>}
      <div className="grid gap-3 mb-8">
        {sorted.map((l, i) => (
          <div key={l.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.sage}`, borderRadius: 8, padding: 12 }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex flex-col" style={{ gap: 1 }}>
                <button onClick={() => moveLevel(l.id, -1)} disabled={i === 0} style={{ color: i === 0 ? `${T.inkSoft}55` : T.maroon, lineHeight: 0.6 }} title="Move up">▲</button>
                <button onClick={() => moveLevel(l.id, 1)} disabled={i === sorted.length - 1} style={{ color: i === sorted.length - 1 ? `${T.inkSoft}55` : T.maroon, lineHeight: 0.6 }} title="Move down">▼</button>
              </div>
              <span style={{ fontSize: 12, color: T.inkSoft, width: 18 }}>{i + 1}.</span>
              <input style={{ ...inputStyle, fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, border: "none", padding: "2px 0", width: "auto", flex: 1 }} value={l.name} onChange={(e) => updateLevel(l.id, "name", e.target.value)} />
            </div>
            <input style={{ ...inputStyle, fontSize: 12, border: "none", padding: "2px 0", color: T.inkSoft, marginLeft: 26 }} value={l.desc} onChange={(e) => updateLevel(l.id, "desc", e.target.value)} placeholder="What this level means…" />
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4, marginLeft: 26 }}>{data.kids.filter((k) => k.levelId === l.id).length} kids at this level</div>
          </div>
        ))}
      </div>

      {sorted.length > 0 && (
        <>
          <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 16, marginBottom: 10 }}>Update a kid's level</h4>
          <div className="grid gap-2">
            {data.kids.map((k) => {
              const current = sorted.find((l) => l.id === k.levelId);
              return (
                <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "8px 10px", background: "#fff" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{k.name}</span>
                    <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>{current ? current.name : "Unassigned"}</span>
                  </div>
                  <select style={{ ...inputStyle, width: 180 }} value={k.levelId || ""} onChange={(e) => promote(k.id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {sorted.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}

      {addingLevel && <AddLevelModal nextOrder={sorted.length + 1} onSave={addLevel} onClose={() => setAddingLevel(false)} />}
      {confirmReset && (
        <ConfirmModal
          title="Reset all levels?"
          message="This clears every level and unassigns every kid's level. Their attendance and packages are kept."
          confirmLabel="Reset levels"
          onConfirm={doResetLevels}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

// ---------- Settings ----------
function SettingsView({ data, setData }) {
  const [newPin, setNewPin] = useState("");
  const [studioName, setStudioName] = useState(data.settings.studioName);
  const [publicUrl, setPublicUrl] = useState(data.settings.publicUrl || "");
  const [pinMsg, setPinMsg] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [urlMsg, setUrlMsg] = useState("");

  const changePin = () => {
    if (newPin.length < 4) { setPinMsg("PIN must be at least 4 digits."); return; }
    setData((d) => ({ ...d, settings: { ...d.settings, pin: newPin } }));
    setNewPin("");
    setPinMsg("PIN updated.");
  };
  const saveName = () => {
    setData((d) => ({ ...d, settings: { ...d.settings, studioName } }));
    setNameMsg("Saved.");
  };
  const savePublicUrl = () => {
    const cleaned = publicUrl.trim();
    if (cleaned && !/^https?:\/\//.test(cleaned)) { setUrlMsg("Should start with https://"); return; }
    setData((d) => ({ ...d, settings: { ...d.settings, publicUrl: cleaned } }));
    setUrlMsg("Saved — QR codes will use this link from now on.");
  };

  return (
    <div style={{ maxWidth: 360 }}>
      <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 16, marginBottom: 10 }}>Studio</h4>
      <Field label="Studio name">
        <div className="flex gap-2">
          <input style={inputStyle} value={studioName} onChange={(e) => { setStudioName(e.target.value); setNameMsg(""); }} />
          <Btn variant="ghost" size="sm" onClick={saveName}>Save</Btn>
        </div>
        {nameMsg && <span style={{ fontSize: 12, color: T.sage }}>{nameMsg}</span>}
      </Field>

      <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 16, margin: "20px 0 10px" }}>Public link</h4>
      <Field label="Published artifact URL">
        <div className="flex gap-2">
          <input style={inputStyle} value={publicUrl} onChange={(e) => { setPublicUrl(e.target.value); setUrlMsg(""); }} placeholder="https://claude.site/artifacts/..." />
          <Btn variant="ghost" size="sm" onClick={savePublicUrl}>Save</Btn>
        </div>
        {urlMsg && <span style={{ fontSize: 12, color: urlMsg.startsWith("Saved") ? T.sage : T.terracotta }}>{urlMsg}</span>}
      </Field>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -8, marginBottom: 12 }}>
        After you Publish this artifact, paste the claude.site link Claude gives you here. QR codes use this exact link rather than guessing it from the browser — published artifacts often run inside a sandboxed frame, so guessing gets it wrong. Re-download each kid's QR code after saving this.
      </p>

      <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 16, margin: "20px 0 10px" }}>Access PIN</h4>
      <Field label="New PIN">
        <div className="flex gap-2">
          <input style={inputStyle} type="password" inputMode="numeric" value={newPin} onChange={(e) => { setNewPin(e.target.value); setPinMsg(""); }} />
          <Btn variant="ghost" size="sm" onClick={changePin}>Update</Btn>
        </div>
        {pinMsg && <span style={{ fontSize: 12, color: pinMsg.includes("updated") ? T.sage : T.terracotta }}>{pinMsg}</span>}
      </Field>
      <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 16 }}>
        Reminder: this app has no real login system — anyone with the link and PIN can view and edit everything, including kids' contact details. Keep the link private.
      </p>
    </div>
  );
}

// ---------- Parent-facing view (via QR / #kid=) ----------
function ParentView({ kidId, data, setData }) {
  useGoogleFonts();
  const kid = data?.kids?.find((k) => k.id === kidId);
  const level = data?.levels?.find((l) => l.id === kid?.levelId);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayDayName = DAYS[(today.getDay() + 6) % 7];
  const upcoming = useMemo(() => {
    if (!kid || !data) return [];
    const enrolledClassIds = data.enrollments.filter((e) => e.kidId === kid.id).map((e) => e.classId);
    return data.classes.filter((c) => enrolledClassIds.includes(c.id));
  }, [data, kid]);
  const todaysClasses = useMemo(() => upcoming.filter((c) => c.day === todayDayName), [upcoming, todayDayName]);
  const history = data?.attendance?.filter((a) => a.kidId === kidId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) || [];
  const levelHistory = data?.levelHistory?.filter((h) => h.kidId === kidId).sort((a, b) => b.date.localeCompare(a.date)) || [];

  if (!data) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;
  if (!kid) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Kid not found.</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 8 }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>{data.settings.studioName}</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, color: T.maroonDark, marginBottom: 4 }}>{kid.name}</h1>
        <div style={{ marginBottom: 20 }}><LevelBadge level={level} /></div>

        {kidPackages(kidId, data).length > 0 && (
          <div style={{ background: kidRemainingCredits(kidId, data) > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${kidRemainingCredits(kidId, data) > 0 ? T.sage : T.terracotta}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: kidRemainingCredits(kidId, data) > 0 ? T.sage : T.terracotta }}>
            {kidRemainingCredits(kidId, data)} class{kidRemainingCredits(kidId, data) === 1 ? "" : "es"} remaining on your package
          </div>
        )}

        {todaysClasses.length > 0 && (
          <div style={{ background: "#fff", border: `2px solid ${T.gold}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Today — {todayDayName}</h3>
            {todaysClasses.map((c) => {
              const att = data.attendance.find((a) => a.kidId === kid.id && a.classId === c.id && a.date === todayStr);
              const checkedIn = att?.status === "attended";
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.time}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{c.label}</div>
                  </div>
                  {checkedIn ? (
                    <button onClick={() => removeAttendance(setData, kid.id, c.id, todayStr)} style={{ fontSize: 12, fontWeight: 600, color: T.sage, display: "flex", alignItems: "center", gap: 4 }} title="Tap to undo">
                      <Check size={14} /> Checked in
                    </button>
                  ) : (
                    <Btn size="sm" onClick={() => applyAttendance(setData, kid.id, c.id, todayStr, "attended")}>Check in</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Next classes</h3>
          {upcoming.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No classes booked yet — check with the studio.</p>}
          {upcoming.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.day} · {c.time}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Recent attendance</h3>
          {history.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No history yet.</p>}
          {history.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
              <span>{h.date}</span>
              <span style={{ color: h.status === "attended" ? T.sage : T.terracotta, fontWeight: 600 }}>{h.status === "attended" ? "Attended" : "Absent"}</span>
            </div>
          ))}
        </div>

        {levelHistory.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Level journey</h3>
            {levelHistory.map((h) => {
              const lvl = data.levels.find((l) => l.id === h.levelId);
              return (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>{lvl?.name || "—"}</span>
                  <span style={{ color: T.inkSoft }}>{h.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Root ----------
export default function App() {
  useGoogleFonts();
  const [data, setDataRaw] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("calendar");
  const [hashKid, setHashKid] = useState(null);
  const [parentLookupKidId, setParentLookupKidId] = useState(null);

  useEffect(() => {
    const readHash = () => {
      const m = window.location.hash.match(/kid=([\w-]+)/);
      setHashKid(m ? m[1] : null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    loadData().then((d) => setDataRaw(d || DEFAULT_DATA));
  }, []);

  const setData = useCallback((updater) => {
    setDataRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveData(next);
      return next;
    });
  }, []);

  if (!data) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading studio…</div>;

  // Parent QR view bypasses the PIN entirely — read-only, no admin data exposed beyond one kid.
  // hashKid is a best-effort path (works if the app is ever opened somewhere that preserves
  // URL fragments); parentLookupKidId is the reliable path via the code-entry screen below,
  // since Claude's published-artifact wrapper doesn't forward #hash fragments into the app.
  if (hashKid) return <ParentView kidId={hashKid} data={data} setData={setData} />;
  if (parentLookupKidId) return <ParentView kidId={parentLookupKidId} data={data} setData={setData} />;

  if (!unlocked) {
    return (
      <PinGate
        data={data}
        onUnlock={() => setUnlocked(true)}
        onSetPin={(pin) => { setData((d) => ({ ...d, settings: { ...d.settings, pin } })); setUnlocked(true); }}
        onParentLookup={(kid) => setParentLookupKidId(kid.id)}
      />
    );
  }

  const NAV = [
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "kids", label: "Kids", icon: Users },
    { id: "classes", label: "Classes", icon: Layers },
    { id: "levels", label: "Levels", icon: Star },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "Inter, sans-serif", display: "flex" }}>
      <aside style={{ width: 190, background: T.maroon, padding: "24px 14px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-8 px-2">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.ivory, lineHeight: 1.15 }}>{data.settings.studioName}</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 6, fontSize: 13.5,
                background: tab === n.id ? T.goldLight : "transparent",
                color: tab === n.id ? T.maroonDark : T.ivory,
                fontWeight: tab === n.id ? 600 : 400, textAlign: "left",
              }}
            >
              <n.icon size={15} /> {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "28px 32px", overflowX: "auto" }}>
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 20 }}>
          {NAV.find((n) => n.id === tab)?.label}
        </h2>
        {tab === "calendar" && <CalendarView data={data} setData={setData} />}
        {tab === "kids" && <KidsView data={data} setData={setData} />}
        {tab === "classes" && <ClassesView data={data} setData={setData} />}
        {tab === "levels" && <LevelsView data={data} setData={setData} />}
        {tab === "settings" && <SettingsView data={data} setData={setData} />}
      </main>
    </div>
  );
}

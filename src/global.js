
function createSymbol(key) {
  return key + Math.random().toString(36).substring(2);
}

export default function() {

    const obj = Object.create(null);
    try {
        obj.Object = Object;
    }
    catch (err) { }
    try {
        obj.Function = Function;
    }
    catch (err) { }
    try {
        obj.Array = Array;
    }
    catch (err) { }
    try {
        obj.Number = Number;
    }
    catch (err) { }
    try {
        obj.parseFloat = parseFloat;
    }
    catch (err) { }
    try {
        obj.parseInt = parseInt;
    }
    catch (err) { }
    try {
        obj.Infinity = Infinity;
    }
    catch (err) { }
    try {
        obj.NaN = NaN;
    }
    catch (err) { }
    try {
        obj.undefined = undefined;
    }
    catch (err) { }
    try {
        obj.Boolean = Boolean;
    }
    catch (err) { }
    try {
        obj.String = String;
    }
    catch (err) { }
    try {
        obj.Symbol = Symbol;
    }
    catch (err) { }
    try {
        obj.Date = Date;
    }
    catch (err) { }
    try {
        obj.Promise = Promise;
    }
    catch (err) { }
    try {
        obj.RegExp = RegExp;
    }
    catch (err) { }
    try {
        obj.Error = Error;
    }
    catch (err) { }
    try {
        obj.EvalError = EvalError;
    }
    catch (err) { }
    try {
        obj.RangeError = RangeError;
    }
    catch (err) { }
    try {
        obj.ReferenceError = ReferenceError;
    }
    catch (err) { }
    try {
      obj.RegExp = RegExp;
    }
    catch (err) { }
    try {
        obj.SyntaxError = SyntaxError;
    }
    catch (err) { }
    try {
        obj.TypeError = TypeError;
    }
    catch (err) { }
    try {
        obj.URIError = URIError;
    }
    catch (err) { }
    try {
        obj.JSON = JSON;
    }
    catch (err) { }
    try {
        obj.Math = Math;
    }
    catch (err) { }
    try {
        obj.console = console;
    }
    catch (err) { }
    try {
        obj.Intl = Intl;
    }
    catch (err) { }
    try {
        obj.ArrayBuffer = ArrayBuffer;
    }
    catch (err) { }
    try {
        obj.Uint8Array = Uint8Array;
    }
    catch (err) { }
    try {
        obj.Int8Array = Int8Array;
    }
    catch (err) { }
    try {
        obj.Uint16Array = Uint16Array;
    }
    catch (err) { }
    try {
        obj.Int16Array = Int16Array;
    }
    catch (err) { }
    try {
        obj.Uint32Array = Uint32Array;
    }
    catch (err) { }
    try {
        obj.Int32Array = Int32Array;
    }
    catch (err) { }
    try {
        obj.Float32Array = Float32Array;
    }
    catch (err) { }
    try {
        obj.Float64Array = Float64Array;
    }
    catch (err) { }
    try {
        obj.Uint8ClampedArray = Uint8ClampedArray;
    }
    catch (err) { }
    try {
        obj.DataView = DataView;
    }
    catch (err) { }
    try {
        obj.Map = Map;
    }
    catch (err) { }
    try {
        obj.Set = Set;
    }
    catch (err) { }
    try {
        obj.WeakMap = WeakMap;
    }
    catch (err) { }
    try {
        obj.WeakSet = WeakSet;
    }
    catch (err) { }
    try {
        obj.Proxy = Proxy;
    }
    catch (err) { }
    try {
        obj.Reflect = Reflect;
    }
    catch (err) { }
    try {
        obj.BigInt = BigInt;
    }
    catch (err) { }
    try {
        obj.decodeURI = decodeURI;
    }
    catch (err) { }
    try {
        obj.decodeURIComponent = decodeURIComponent;
    }
    catch (err) { }
    try {
        obj.encodeURI = encodeURI;
    }
    catch (err) { }
    try {
        obj.encodeURIComponent = encodeURIComponent;
    }
    catch (err) { }
    try {
        obj.escape = escape;
    }
    catch (err) { }
    try {
        obj.unescape = unescape;
    }
    catch (err) { }
    try {
        obj.eval = eval;
    }
    catch (err) { }
    try {
        obj.isFinite = isFinite;
    }
    catch (err) { }
    try {
        obj.isNaN = isNaN;
    }
    catch (err) { }
    try {
        obj.SharedArrayBuffer = SharedArrayBuffer;
    }
    catch (err) { }
    try {
        obj.Atomics = Atomics;
    }
    catch (err) { }
    try {
        obj.WebAssembly = WebAssembly;
    }
    catch (err) { }
    try {
        obj.clearInterval = clearInterval;
    }
    catch (err) { }
    try {
        obj.clearTimeout = clearTimeout;
    }
    catch (err) { }
    try {
        obj.setInterval = setInterval;
    }
    catch (err) { }
    try {
        obj.setTimeout = setTimeout;
    }
    catch (err) { }
    try {
        obj.crypto = crypto;
    }
    catch (err) { }
    try {
        obj.URL = URL;
    }
    catch (err) { }


    if (obj.Symbol) {
        !obj.Symbol.iterator && (obj.Symbol.iterator = createSymbol('iterator'));
        !obj.Symbol.asyncIterator && (obj.Symbol.asyncIterator = createSymbol('asynciterator'));
    }

    return obj;
}
  
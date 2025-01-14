
function createSymbol(key) {
  return key + Math.random().toString(36).substring(2);
}

export default function() {

    try {
        this.Object = Object;
    }
    catch (err) { }
    try {
        this.Function = Function;
    }
    catch (err) { }
    try {
        this.Array = Array;
    }
    catch (err) { }
    try {
        this.Number = Number;
    }
    catch (err) { }
    try {
        this.parseFloat = parseFloat;
    }
    catch (err) { }
    try {
        this.parseInt = parseInt;
    }
    catch (err) { }
    try {
        this.Infinity = Infinity;
    }
    catch (err) { }
    try {
        this.NaN = NaN;
    }
    catch (err) { }
    try {
        this.undefined = undefined;
    }
    catch (err) { }
    try {
        this.Boolean = Boolean;
    }
    catch (err) { }
    try {
        this.String = String;
    }
    catch (err) { }
    try {
        this.Symbol = Symbol;
    }
    catch (err) { }
    try {
        this.Date = Date;
    }
    catch (err) { }
    try {
        this.Promise = Promise;
    }
    catch (err) { }
    try {
        this.RegExp = RegExp;
    }
    catch (err) { }
    try {
        this.Error = Error;
    }
    catch (err) { }
    try {
        this.EvalError = EvalError;
    }
    catch (err) { }
    try {
        this.RangeError = RangeError;
    }
    catch (err) { }
    try {
        this.ReferenceError = ReferenceError;
    }
    catch (err) { }
    try {
        this.SyntaxError = SyntaxError;
    }
    catch (err) { }
    try {
        this.TypeError = TypeError;
    }
    catch (err) { }
    try {
        this.URIError = URIError;
    }
    catch (err) { }
    try {
        this.JSON = JSON;
    }
    catch (err) { }
    try {
        this.Math = Math;
    }
    catch (err) { }
    try {
        this.console = console;
    }
    catch (err) { }
    try {
        this.Intl = Intl;
    }
    catch (err) { }
    try {
        this.ArrayBuffer = ArrayBuffer;
    }
    catch (err) { }
    try {
        this.Uint8Array = Uint8Array;
    }
    catch (err) { }
    try {
        this.Int8Array = Int8Array;
    }
    catch (err) { }
    try {
        this.Uint16Array = Uint16Array;
    }
    catch (err) { }
    try {
        this.Int16Array = Int16Array;
    }
    catch (err) { }
    try {
        this.Uint32Array = Uint32Array;
    }
    catch (err) { }
    try {
        this.Int32Array = Int32Array;
    }
    catch (err) { }
    try {
        this.Float32Array = Float32Array;
    }
    catch (err) { }
    try {
        this.Float64Array = Float64Array;
    }
    catch (err) { }
    try {
        this.Uint8ClampedArray = Uint8ClampedArray;
    }
    catch (err) { }
    try {
        this.DataView = DataView;
    }
    catch (err) { }
    try {
        this.Map = Map;
    }
    catch (err) { }
    try {
        this.Set = Set;
    }
    catch (err) { }
    try {
        this.WeakMap = WeakMap;
    }
    catch (err) { }
    try {
        this.WeakSet = WeakSet;
    }
    catch (err) { }
    try {
        this.Proxy = Proxy;
    }
    catch (err) { }
    try {
        this.Reflect = Reflect;
    }
    catch (err) { }
    try {
        this.BigInt = BigInt;
    }
    catch (err) { }
    try {
        this.decodeURI = decodeURI;
    }
    catch (err) { }
    try {
        this.decodeURIComponent = decodeURIComponent;
    }
    catch (err) { }
    try {
        this.encodeURI = encodeURI;
    }
    catch (err) { }
    try {
        this.encodeURIComponent = encodeURIComponent;
    }
    catch (err) { }
    try {
        this.escape = escape;
    }
    catch (err) { }
    try {
        this.unescape = unescape;
    }
    catch (err) { }
    try {
        this.eval = eval;
    }
    catch (err) { }
    try {
        this.isFinite = isFinite;
    }
    catch (err) { }
    try {
        this.isNaN = isNaN;
    }
    catch (err) { }
    try {
        this.SharedArrayBuffer = SharedArrayBuffer;
    }
    catch (err) { }
    try {
        this.Atomics = Atomics;
    }
    catch (err) { }
    try {
        this.WebAssembly = WebAssembly;
    }
    catch (err) { }
    try {
        this.clearInterval = clearInterval;
    }
    catch (err) { }
    try {
        this.clearTimeout = clearTimeout;
    }
    catch (err) { }
    try {
        this.setInterval = setInterval;
    }
    catch (err) { }
    try {
        this.setTimeout = setTimeout;
    }
    catch (err) { }
    try {
        this.crypto = crypto;
    }
    catch (err) { }
    try {
        this.URL = URL;
    }
    catch (err) { }


    if (this.Symbol) {
        !this.Symbol.iterator && (this.Symbol.iterator = createSymbol('iterator'));
        !this.Symbol.asyncIterator && (this.Symbol.asyncIterator = createSymbol('asynciterator'));
    }

    return this;
}
  
#!/usr/bin/env node
const FQRState = require("./src/state.js");
const path = require("path");
const fs = require("fs");

const fqr = {};

const vectorizeUnary = (fn, arg) =>
    Array.isArray(arg)
        ? arg.map(e => vectorizeUnary(fn, e))
        : fn(arg);

const vectorizeBinary = (fn, x, y) =>
    Array.isArray(x)
        ? Array.isArray(y)
            ? x.slice(0, Math.min(x.length, y.length))
               .map((e, i) => vectorizeBinary(fn, e, y[i]))
            : x.map(e => vectorizeBinary(fn, e, y))
        : Array.isArray(y)
            ? y.map(e => vectorizeBinary(fn, x, e))
            : fn(x, y);

// TODO: different types, probably
fqr.fns = {
    add2: (x, y) => x + y,
    sum: (a) => a.reduce(fqr.fns.add2, 0),
    add2vec: (x, y) => vectorizeBinary(fqr.fns.add2, x, y),
    sub2: (x, y) => x - y,
    negate: (a) => -a,
    sub2vec: (x, y) => vectorizeBinary(fqr.fns.sub2, x, y),
    negatevec: (a) => vectorizeUnary(fqr.fns.negate, a),
    div2: (x, y) => x / y,
    div2vec: (x, y) => vectorizeBinary(fqr.fns.div2, x, y),
    mul2: (x, y) => x * y,
    mul2vec: (x, y) => vectorizeBinary(fqr.fns.mul2, x, y),
    pow2: (x, y) => x ** y,
    pow2vec: (x, y) => vectorizeBinary(fqr.fns.pow2, x, y),
    update: function (name, value) {
        return this.define(name.raw, value);
    },
    get: (x, y) => {
        let res = x[y];
        if(typeof res === "function") {
            res = res.bind(x);
        }
        return res;
    },
    compose: (f, g) => (...args) => f(g(...args)),
    formFunction: function (string) {
        let [ match, args, body ] = string.match(/(\w+(?:,\s*\w+)*)?\s*:\s*(.+)/);
        let params = args.split(/\s*,\s*/);
        return (...args) => {
            let local = this.newLocalState();
            for(let name of params) {
                local.define(name, this.parseValue(args.shift()));
            }
            let value = local.inject(body);
            return value;
        }
    },
    propda: (key) => (obj) =>
        !obj
            ? (obj, ...args) => obj[key.raw](...args)
            : obj[key.raw],
    pipe: (n, f) => f(n),
    has: (a, e) =>
        Array.isArray(a) || typeof a === "string"
            ? a.indexOf(e) !== -1
            : e in a,
    without: (a, b) => {
        if(Array.isArray(a)) {
            return a.filter(e => !fqr.fns.has(b, e));
        }
        else if(typeof a === "string") {
            return a.replaceAll(b, "");
        }
        else {
            let res = {};
            for(let [key, value] of Object.entries(a)) {
                if(!fqr.fns.has(b, key)) {
                    res[key] = value;
                }
            }
            return res;
        }
    },
    map: (f, a) => {
        if(Array.isArray(a)) {
            return a.map(e => f(e));
        }

        let res = {};
        for(let [key, value] of Object.entries(a)) {
            res[key] = f(value);
        }
        return res;
    },
    bond: (a, b) => {
        let res = typeof a === "function"
            ? (...rest) => a(...rest, b)
            : (...rest) => b(a, ...rest);
        return res;
    },
    range: (a, b) => {
        let res = [];
        while(b >= a) {
            res[b - a] = b--;
        }
        return res;
    },
    range1: (a) => fqr.fns.range(0, a),
    exrange: (a, b) => {
        let res = [];
        while(b --> a) {
            res[b - a] = b;
        }
        return res;
    },
    exrange1: (a) => fqr.fns.exrange(0, a),
    size: (a) => a.length,
    filter: (a, f) => {
        if(Array.isArray(f)) {
            let arr = f;
            f = (e) => fqr.fns.has(arr, e);
        }
        if(Array.isArray(a)) {
            return a.filter(e => f(e));
        }
        // object case
        let res = {};
        for(let [key, value] of Object.entries(a)) {
            if(f(value)) {
                res[key] = value;
            }
        }
        return res;
    },
    eye: (db, path, needle) => {
        for(let [key, value] of Object.entries(db)) {
            if(value[path] === needle) {
                return key;
            }
        }
        return null;
    },
    equal: (a, b) => {
        return a === b;
    },
    nequal: (a, b) => {
        return !fqr.fns.equal(a, b);
    },
    and: (a, b) => {
        return a && b;
    },
    or: (a, b) => {
        return a || b;
    },
    greater: (a, b) => {
        return a > b;
    },
    greaterequal: (a, b) => {
        return a >= b;
    },
    less: (a, b) => {
        return a < b;
    },
    lessequal: (a, b) => {
        return a <= b;
    },
    count: (a, needle) => {
        if(typeof needle !== "function") {
            let oldNeedle = needle;
            needle = (e) => fqr.fns.equal(e, oldNeedle);
        }
        return fqr.fns.filter(a, needle).length;
    },
    find: (a, fn) => {
        return a.find(e => fn(e));
    },
};

fqr.opFunction = (...fns) => function (...args) {
    let fn = fns[args.length - 1] || fns[fns.length - 1];
    fn = fn.bind(this);
    return fn(...args);
};

fqr.operators = {
    "+":   fqr.opFunction(fqr.fns.sum, fqr.fns.add2),
    "-":   fqr.opFunction(fqr.fns.negate, fqr.fns.sub2),
    "/":   fqr.opFunction(null, fqr.fns.div2),
    "*":   fqr.opFunction(null, fqr.fns.mul2),
    "^":   fqr.opFunction(null, fqr.fns.pow2),
    ".+":  fqr.opFunction(null, fqr.fns.add2vec),
    ".-":  fqr.opFunction(fqr.fns.negatevec, fqr.fns.sub2vec),
    "./":  fqr.opFunction(null, fqr.fns.div2vec),
    ".*":  fqr.opFunction(null, fqr.fns.mul2vec),
    ".^":  fqr.opFunction(null, fqr.fns.pow2vec),
    "=":   fqr.opFunction(null, fqr.fns.update),
    ".":   fqr.opFunction(fqr.fns.propda, fqr.fns.get),
    "@":   fqr.opFunction(fqr.fns.formFunction, fqr.fns.compose),
    "|":   fqr.opFunction(null, fqr.fns.pipe),
    "~":   fqr.opFunction(null, fqr.fns.without),
    "&":   fqr.opFunction(null, fqr.fns.bond),
    "=>":  fqr.opFunction(null, fqr.fns.map),
    "//":  fqr.opFunction(null, fqr.fns.filter),
    ":":   fqr.opFunction(fqr.fns.range1, fqr.fns.range),
    "..":  fqr.opFunction(fqr.fns.exrange1, fqr.fns.exrange),
    "#":   fqr.opFunction(fqr.fns.size, null),
    "==":  fqr.opFunction(null, fqr.fns.equal),
    "!=":  fqr.opFunction(null, fqr.fns.nequal),
    "and": fqr.opFunction(null, fqr.fns.and),
    "or":  fqr.opFunction(null, fqr.fns.or),
    ">":   fqr.opFunction(null, fqr.fns.greater),
    ">=":  fqr.opFunction(null, fqr.fns.greaterequal),
    "<":   fqr.opFunction(null, fqr.fns.less),
    "<=":  fqr.opFunction(null, fqr.fns.lessequal),
};

fqr.loadFile = function loadFile (pathToFile) {
    let { name, ext } = path.parse(pathToFile);
    ext = ext.toLowerCase();
    let file = fs.readFileSync(pathToFile);
    switch(ext) {
        case ".json":
            file = JSON.parse(file);
            break;

        default:
            file = file.toString();
            break;
    }
    return file;
};

fqr.DefaultVariables = {
    print: console.log,
    lf: "\n",
    cr: "\r",
    sp: " ",
    tb: "\t",
    ws: /\s+/,
    le: /\r?\n/,
    alpha: "abcdefghijklmnopqrstuvwxyz",
    ALPHA: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    undefined: undefined,
    lines: (s) => s.trim().split(fqr.DefaultVariables.le),
    eye: fqr.fns.eye,
    load: fqr.loadFile,
    keys: Object.keys,
    values: Object.values,
    entries: Object.entries,
    json: JSON.parse,
    true: true,
    false: false,
};

fqr.importDefaults = function (names) {
    for(let name of names) {
        fqr.DefaultVariables[name] = fqr.fns[name];
    }
}

fqr.importDefaults([ "count", "find" ]);

fqr.run = function runScript (script, params) {
    let state = new FQRState(fqr);
    let headVariables = "abcd";
    params.slice(0, 4).forEach((param, i) => {
        let name = headVariables[i];
        let value;
        try {
            value = fqr.loadFile(param);
        }
        catch(e) {
            value = eval(param);
        }
        state.define(name, value);
    });

    state.define("args", params);
    return state.inject(script);
};

module.exports = fqr;

if(require.main === module) {
    let args = process.argv.slice(2);
    if(args.length === 0) {
        console.error("No arguments given.");
        console.warn("Usage:");
        console.warn("  fqr script [flags] [args]");
        console.warn("flags:");
        console.warn("  -f file   Reads code from file instead of argument");
        console.warn("  -r        Outputs raw result instead of pretty");
        console.warn("  -S        Shunted version of input without running code");
        console.warn("  -T        Tokenized version of input without running code");
        process.exit(1);
    }

    const isFlag = str => str[0] === "-" || str[0] === "/";

    let script = null;
    let flags = {};
    let params = [];

    for(let i = 0; i < args.length; i++) {
        let arg = args[i];
        if(isFlag(arg)) {
            let flag = arg.slice(1);
            if(flag === "f") {
                script = fs.readFileSync(args[++i]).toString();
            }
            else {
                flags[flag] = true;
            }
        }
        else if(!script) {
            script = arg;
        }
        else {
            params.push(arg);
        }
    }
    
    let runCode = true;
    
    if(flags["S"]) {
        console.log("Shunted:");
        const FQRShunter = require("./src/shunt.js");
        let shunted = FQRShunter.shunt(script);
        let i = 0;
        for(let s of shunted) {
            let is = (i + ":").padEnd(3, " ");
            console.log(is, s.readable());
            i++;
        }
        runCode = false;
    }
    if(flags["T"]) {
        console.log("Tokenized:");
        const FQRParser = require("./src/parse.js");
        let parsed = FQRParser.parse(script);
        let i = 0;
        for(let p of parsed) {
            let is = (i + ":").padEnd(3, " ");
            console.log(is, p);
            i++;
        }
        runCode = false;
    }
    
    if(!runCode) return;

    let value = fqr.run(script, params);
    if(typeof value !== "undefined") {
        if(flags["r"]) {
            process.stdout.write(value.toString());
        }
        else {
            console.log(value);
        }
    }
}

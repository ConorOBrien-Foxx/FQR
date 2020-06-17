const FQRState = require("./state.js");
const path = require("path");
const fs = require("fs");

const fqr = {};

fqr.fns = {
    add2: (x, y) => x + y,
    sum: (a) => a.reduce(fqr.fns.add2, 0),
    sub2: (x, y) => x - y,
    negate: (a) => -a,
    div2: (x, y) => x / y,
    mul2: (x, y) => x * y,
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
        Array.isArray(a)
            ? a.indexOf(e) !== -1
            : e in a,
    without: (a, b) => {
        if(Array.isArray(a)) {
            return a.filter(e => !fqr.fns.has(b, e));
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
    map: (f, a) => a.map(e => f(e)),
    bond: (a, b) => {
        console.log(a,b);
        let res = typeof a === "function"
            ? (...rest) => a(...rest, b)
            : (...rest) => b(a, ...rest);
        console.log("res", res, res("a\nb"));
        return res;
    },
};
fqr.opFunction = (...fns) => function (...args) {
    let fn = fns[args.length - 1] || fns[fns.length - 1];
    fn = fn.bind(this);
    return fn(...args);
}

fqr.operators = {
    "+":  fqr.opFunction(fqr.fns.sum, fqr.fns.add2),
    "-":  fqr.opFunction(fqr.fns.negate, fqr.fns.sub2),
    "/":  fqr.opFunction(null, fqr.fns.div2),
    "*":  fqr.opFunction(null, fqr.fns.mul2),
    "=":  fqr.opFunction(null, fqr.fns.update),
    ".":  fqr.opFunction(fqr.fns.propda, fqr.fns.get),
    "@":  fqr.opFunction(fqr.fns.formFunction, fqr.fns.compose),
    "|":  fqr.opFunction(null, fqr.fns.pipe),
    "~":  fqr.opFunction(null, fqr.fns.without),
    "&":  fqr.opFunction(null, fqr.fns.bond),
    "=>": fqr.opFunction(null, fqr.fns.map),
    "//": fqr.opFunction(null, fqr.fns.filter),
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
    f: (a) => a*3,
    g: (a) => a+1,
    // f: (...args) => args.reverse(),
    a: { f: (a,b,c)=>a+b }
};

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
        console.warn("No arguments given.");
        console.warn("Usage:");
        console.warn("  fqr script [flags] [args]");
        process.exit(1);
    }

    const isFlag = (str) => str[0] === "-" || str[0] === "/";

    let script = null;
    let flags = [];
    let params = [];

    for(let arg of args) {
        if(isFlag(arg)) {
            let flag = arg.slice(1)
            flags.push(flag);
        }
        else if(!script) {
            script = arg;
        }
        else {
            params.push(arg);
        }
    }

    if(flags.indexOf("S") !== -1) {
        const FQRShunter = require("./shunt.js");
        let shunted = FQRShunter.shunt(script);
        // console.log([...shunted].map(e => e.toString()));
        let i = 0;
        for(let s of shunted) {
            let is = (i + ":").padEnd(3, " ");
            console.log(is, s.readable());
            i++;
        }
        return;
    }

    let value = fqr.run(script, params);
    if(typeof value !== "undefined") {
        console.log(value);
    }
}

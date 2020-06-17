const FQRState = require("./state.js");
const path = require("path");

const fqr = {};

fqr.fns = {
    add2: (x, y) => x + y,
    sum: (a) => a.reduce(fqr.fns.add2, 0),
    sub2: (x, y) => x - y,
    negate: (a) => -a,
    div2: (x, y) => x / y,
    mul2: (x, y) => x * y,
    update: function (name, value) {
        return this.define(name, value);
    },
};
fqr.opFunction = (...fns) => function (...args) {
    let fn = fns[args.length - 1] || fns[fns.length - 1];
    fn = fn.bind(this);
    return fn(...args);
}

fqr.operators = {
    "+": fqr.opFunction(fqr.fns.sum, fqr.fns.add2),
    "-": fqr.opFunction(fqr.fns.negate, fqr.fns.sub2),
    "/": fqr.opFunction(null, fqr.fns.div2),
    "*": fqr.opFunction(null, fqr.fns.mul2),
    "=": fqr.opFunction(null, fqr.fns.update),
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

fqr.run = function runScript (script, params) {
    let state = new FQRState(fqr);
    let headVariables = "abcd";
    params.slice(0, 4).forEach((param, i) => {
        let name = headVariables[i];
        let value = eval(param);
        state.define(name, value);
    });
    state.define("print", console.log);
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

    let value = fqr.run(script, params);
    if(typeof value !== "undefined") {
        console.log(value);
    }
}

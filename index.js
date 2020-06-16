const shunt = require("./shunt.js");;

const fqr = {};

fqr.load = function loadFile (name) {

};

fqr.run = function runScript (script, params) {

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

    fqr.run(script, params);
}

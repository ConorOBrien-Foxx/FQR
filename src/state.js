const FQRShunter = require("./shunt.js");
const { Token } = require("./parse.js");

class FQRState {
    constructor(fqr) {
        this.state = {};
        this.fqr = fqr;

        Object.assign(this.state, this.fqr.DefaultVariables);
    }

    newLocalState() {
        let local = new FQRState(this.fqr);
        local.state = Object.assign({}, this.state);
        return local;
    }

    define(name, value) {
        return this.state[name] = value;
    }

    getVariable(name) {
        if(name in this.state) {
            return this.state[name];
        }
        else {
            console.error("Undefined variable:", name);
            return;
        }
    }

    parseValue(value) {
        if(typeof value === "undefined"
            || value === null
            || value.constructor !== Token)
        {
            return value;
        }
        else if(value.type === Token.Types.Word) {
            return this.getVariable(value.raw);
        }
        else if(value.type === Token.Types.String) {
            let kind = value.raw[0];
            switch(kind) {
                case '"':
                case "'":
                    return value.raw
                        .slice(1, -1)
                        .replace(new RegExp(kind + kind, "g"), kind);
                case "<":
                    return value.raw.slice(2, -2);
                default:
                    console.error("Unrecognized string of kind " + kind);
                    return value.raw;
            }
        }
        else {
            return eval(value.raw);
        }
    }

    handleToken(token) {
        if(token.isData()) {
            this.stack.push(token);
        }
        else if(token.type === Token.Types.Swap) {
            this.swap = token.arity ? this.stack.splice(-token.arity) : [];
        }
        else if(token.isCallable()) {
            let held = token.held;
            let args;
            let after = [];
            let fn;
            if(token.type === Token.Types.Op) {
                fn = this.fqr.operators[token.raw];
                if(!fn) {
                    console.error("no such defined operator", token.raw);
                }
            }
            else if(token.type === Token.Types.Array) {
                fn = (...args) => args;
                if(token.isFunction) {
                    fn = this.fqr.fns.get;
                    let top = this.parseValue(this.stack.pop());
                    after.push(top);
                }
            }
            else if(token.type === Token.Types.Arity) {
                if(this.swap) {
                    args = this.swap;
                    this.swap = null;
                    // console.log("ARGS", args, token);
                }
                else {
                    let arity = -token.arity;
                    // console.log(arity, token.arity);
                    args = arity ? this.stack.splice(arity) : [];
                }
                let top = this.stack.pop();
                fn = this.parseValue(top);
            }
            else {
                console.error("Unanticipated callable type", token.type);
            }
            fn = fn.bind(this);

            if(!args) {
                args = this.stack.splice(-token.arity);
            }
            args = args
               .map((el, i) =>
                   held && held(i, args.length)
                       ? el
                       : this.parseValue(el)
               )
               .concat(after);

            let value = fn(...args);
            this.stack.push(value);
        }

        if(token.next) {
            this.handleToken(token.next);
        }
    }

    inject(code) {
        let postfix = FQRShunter.shunt(code);

        this.stack = [];
        this.swap = null;

        for(let token of postfix) {
            this.handleToken(token);
        }

        let value = this.parseValue(this.stack.pop());

        return value;
    }
}

module.exports = FQRState;

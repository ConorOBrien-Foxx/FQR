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
        return this.state[name];
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

    inject(code) {
        let postfix = FQRShunter.shunt(code);

        let stack = [];
        let swap;

        for(let token of postfix) {
            if(token.isData()) {
                stack.push(token);
            }
            else if(token.type === Token.Types.Swap) {
                swap = token.arity ? stack.splice(-token.arity) : [];
            }
            else if(token.isCallable()) {
                let held = token.held;
                let args;
                let after = [];
                let fn;
                if(token.type === Token.Types.Op) {
                    fn = this.fqr.operators[token.raw];
                }
                else if(token.type === Token.Types.Array) {
                    fn = (...args) => args;
                    if(token.isFunction) {
                        fn = this.fqr.fns.get;
                        let top = this.parseValue(stack.pop());
                        after.push(top);
                    }
                }
                else if(token.type === Token.Types.Arity) {
                    if(swap) {
                        args = swap;
                        swap = null;
                    }
                    else {
                        let arity = -token.arity + 1;
                        console.log(arity, token.arity);
                        args = arity ? stack.splice(arity) : [];
                    }
                    let top = stack.pop();
                    fn = this.parseValue(top);
                }
                else {
                    console.error("Unanticipated callable type", token.type);
                }
                fn = fn.bind(this);

                if(!args) {
                    args = stack.splice(-token.arity);
                }
                args = args
                   .map((el, i) =>
                       held && held(i, args.length)
                           ? el
                           : this.parseValue(el)
                   )
                   .concat(after);

                let value = fn(...args);
                stack.push(value);
                // if(swap) {
                //     stack.push(...swap);
                //     swap = null;
                // }
            }
        }

        let value = this.parseValue(stack.pop());

        return value;
    }
}

module.exports = FQRState;

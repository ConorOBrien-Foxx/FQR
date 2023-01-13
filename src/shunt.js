const FQRParser = require("./parse.js");
const { Token } = FQRParser;

// precedence, isRight, held
const OpAttribtues = {
    ".":   [ 110, false, (i, s) => s === 1 ? true : i === 1],

    [Token.Types.Callable]: [100, false],

    "@":   [ 90,  true  ],
    "&":   [ 90,  false ],

    "^":   [ 60,  true  ],

    "*":   [ 30,  false ],
    "/":   [ 30,  false ],
    
    "+":   [ 25,  false ],
    "-":   [ 25,  false ],

    ":":   [ 20,  false ],
    "..":  [ 20,  false ],
    
    ".^":  [ 18,  false ],
    "./":  [ 17,  false ],
    ".*":  [ 17,  false ],
    ".-":  [ 16,  false ],
    ".+":  [ 16,  false ],

    "~":   [ 15,  false ],
    "//":  [ 15,  false ],
    "#":   [ 15,  false ],

    "=>":  [ 10,  false ],

    "|":   [ 5,   false ],

    "==":  [ 3,   false ],
    "!=":  [ 3,   false ],
    "<":   [ 3,   false ],
    "<=":  [ 3,   false ],
    ">":   [ 3,   false ],
    ">=":  [ 3,   false ],

    "and": [ 2,   false ],
    "or":  [ 1,   false ],

    "=":   [ 0,   false, [ true, false ]],
};

let UnaryPrecedence = {
    "@": 105,
};

class FQRShunter {
    constructor(string) {
        this.parsed = FQRParser.parse(string);
        this.opstack = [];
    }

    *insertOp(token, unaryFlag) {
        unaryFlag = true;
        let [ curPrecedence, curIsRight, curHeld ] = OpAttribtues[token.raw];
        token.held = curHeld || [];
        if(typeof (token.held) !== "function") {
            let held = token.held;
            token.held = (index) => held[index];
        }

        if(token.type !== Token.Types.Op || token.arity >= 2) {
            let topToken, topPrecedence, topIsRight, allowPop;
            do {
                allowPop = false;
                topToken = this.opstack.pop();
                if(topToken && topToken.type === Token.Types.Op) {
                    [ topPrecedence, topIsRight ] = OpAttribtues[topToken.raw];
                    allowPop = topIsRight
                        ? topPrecedence >  curPrecedence
                        : topPrecedence >= curPrecedence;
                    // console.log("T~O~P",topToken)
                    allowPop = allowPop || (topToken.arity === 1);
                }
                if(allowPop) {
                    yield topToken;
                }
                else if(topToken) {
                    this.opstack.push(topToken);
                }
            } while(topToken && allowPop);
        }
        this.opstack.push(token);

        return unaryFlag;
    }

    *flush() {
        while(this.opstack.length) {
            yield this.opstack.pop();
        }
    }

    *flushUntil(fn) {
        while(this.opstack.length) {
            let top = this.opstack.pop();
            if(fn(top)) {
                this.opstack.push(top);
                return;
            }
            else {
                yield top;
            }
        }
    }

    *shunt() {
        let unaryFlag = true;
        let lastToken = null;
        for(let token of this.parsed) {
            // console.log("--", unaryFlag, token.raw, this.opstack.map(e=>e.raw));
            if(token.isData()) {
                if(!unaryFlag) {
                    yield* this.flush();
                }
                unaryFlag = false;
                yield token;
            }
            else if(token.type === Token.Types.Sep) {
                unaryFlag = true;
                yield* this.flush();
            }
            else if(token.type === Token.Types.Comma) {
                unaryFlag = true;
                yield* this.flushUntil(token =>
                    token.type === Token.Types.Comma
                    || token.isBrace()
                );
                this.opstack.push(token);
            }
            else if(token.isBrace()) {
                let searchType = token.type;
                if(token.isOpening()) {
                    token.isFunction = !unaryFlag;
                    unaryFlag = true;
                    this.opstack.push(token);
                }
                else {
                    unaryFlag = false;
                    let topToken, isParen;
                    let args = 1;
                    do {
                        isParen = false;
                        topToken = this.opstack.pop();
                        if(!topToken) {
                            console.error(
                                "Syntax Error: Unmatched parenthesis."
                            );
                            return null;
                        }
                        else if(topToken.type === searchType) {
                            if(topToken.isOpening()) {
                                isParen = true;
                            }
                            else {
                                console.error(
                                    "Syntax Error: Unexpected closing parenthesis, at",
                                    topToken.index
                                );
                                return null;
                            }
                        }
                        else if(topToken.type === Token.Types.Comma) {
                            args++;
                        }
                        else {
                            yield topToken;
                        }
                    } while(!isParen);
                    if(lastToken.type === Token.Types.Paren && lastToken.raw === "(") {
                        args = 0;
                    }
                    let res;
                    if(token.raw === "]") {
                        res = Token.gatherArray(args, topToken.isFunction);
                    }
                    else if(topToken.isFunction) {
                        // console.log("FunctionArity", args, topToken);
                        res = Token.functionArity(args);
                    }
                    if(res) {
                        if(topToken.isFunction) {
                            // console.log("opstack", this.opstack);
                            let optop = this.opstack.pop();
                            if(optop) {
                                if(optop.type === Token.Types.Op) {
                                    let myPrec = OpAttribtues[Token.Types.Callable][0];
                                    // console.log(optop.raw);
                                    let prec = OpAttribtues[optop.raw][0];
                                    if(optop.arity === 1) {
                                        prec = UnaryPrecedence[optop.raw] || prec;
                                    }
                                    // console.log("OPTOP", optop, prec, myPrec);
                                    if(prec > myPrec)
                                    {
                                        yield Token.swap(args);
                                        let needle = optop;
                                        while(needle.next) {
                                            needle = needle.next;
                                        }
                                        needle.next = res;
                                    }
                                    else {
                                        yield res;
                                    }
                                }
                                else {
                                    yield res;
                                }
                                this.opstack.push(optop);
                                // this.opstack.push(res);
                                // unaryFlag = yield* this.insertOp(res, unaryFlag);
                                // yield res;
                            }
                            else {
                                yield res;
                            }
                            // console.log("res", res);
                            // yield res;
                            unaryFlag = false;
                        }
                        else {
                            yield res;
                        }
                    }
                }
            }
            else if(token.type === Token.Types.Op) {
                token.arity = unaryFlag ? 1 : 2;
                unaryFlag = yield* this.insertOp(token, unaryFlag);
            }
            else {
                continue;
            }
            lastToken = token;
        }
        yield* this.flush();
    }

    static shunt(string) {
        let shunter = new FQRShunter(string);
        return shunter.shunt();
    }
}

module.exports = FQRShunter;

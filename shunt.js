const FQRParser = require("./parse.js");
const { Token } = FQRParser;

// precedence, isRight, held
const OpAttribtues = {
    ".": [ 110, false, (i, s) => s === 1 ? true : i === 1],

    [Token.Types.Callable]: [100, false],

    "@": [ 90,  true  ],

    "^": [ 60,  true  ],

    "*": [ 30,  false ],
    "/": [ 30,  false ],

    "+": [ 10,  false ],
    "-": [ 10,  false ],

    "=": [ 5,   false, [ true, false ]],

    "|": [ 0,   false ],
};

class FQRShunter {
    constructor(string) {
        this.parsed = FQRParser.parse(string);
        this.opstack = [];
    }

    *insertOp(token, unaryFlag) {
        token.arity = unaryFlag ? 1 : 2;
        unaryFlag = true;
        let [ curPrecedence, curIsRight, curHeld ] = OpAttribtues[token.raw];
        token.held = curHeld || [];
        if(typeof token.held !== "function") {
            let held = token.held;
            token.held = (index) => held[index];
        }

        if(token.arity === 2) {
            let topToken, topPrecedence, topIsRight, allowPop;
            do {
                allowPop = false;
                topToken = this.opstack.pop();
                if(topToken && topToken.type === Token.Types.Op) {
                    [ topPrecedence, topIsRight ] = OpAttribtues[topToken.raw];
                    allowPop = topIsRight
                        ? topPrecedence >  curPrecedence
                        : topPrecedence >= curPrecedence;
                    allowPop = allowPop || topToken.unary;
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
                        res = Token.functionArity(args);
                    }
                    if(res) {
                        if(topToken.isFunction) {
                            yield Token.swap(args);
                            unaryFlag = yield* this.insertOp(res, unaryFlag);
                        }
                        else {
                            yield res;
                        }
                    }
                }
            }
            else if(token.type === Token.Types.Op) {
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

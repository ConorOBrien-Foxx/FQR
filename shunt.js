const FQRParser = require("./parse.js");
const { Token } = FQRParser;

// precedence, isRight, held
const OpAttribtues = {
    "@": [ 90, true  ],

    "^": [ 60, true  ],

    "*": [ 30, false ],
    "/": [ 30, false ],

    "+": [ 10, false ],
    "-": [ 10, false ],

    "=": [ 0,  false, [ true, false ]],
};

class FQRShunter {
    constructor(string) {
        this.parsed = FQRParser.parse(string);
        this.opstack = [];
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
                    || token.type === Token.Types.Paren
                );
                this.opstack.push(token);
            }
            else if(token.type === Token.Types.Paren) {
                if(token.raw === "(") {
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
                        else if(topToken.type === Token.Types.Paren) {
                            if(topToken.raw === "(") {
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
                    if(topToken.isFunction) {
                        if(lastToken.type === Token.Types.Paren && lastToken.raw === "(") {
                            args = 0;
                        }
                        yield Token.functionArity(args);
                    }
                }
            }
            else if(token.type === Token.Types.Op) {
                token.arity = unaryFlag ? 1 : 2;
                unaryFlag = true;
                let [ curPrecedence, curIsRight, curHeld ] = OpAttribtues[token.raw];
                token.held = curHeld || [];

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

// console.log([...FQRShunter.shunt(process.argv[2])]
// .map(e=>e.raw + (e.arity ? "@" + e.arity : ""))
// )

module.exports = FQRShunter;

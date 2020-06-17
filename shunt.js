const FQRParser = require("./parse.js");
const { Token } = FQRParser;

// precedence, isRight
const OpAttribtues = {
    "^": [ 60, true  ],

    "*": [ 30, false ],
    "/": [ 30, false ],

    "+": [ 10, false ],
    "-": [ 10, false ],
};

class FQRShunter {
    constructor(string) {
        this.parsed = FQRParser.parse(string);
        this.opstack = [];
    }

    *shunt() {
        let unaryFlag = false;
        for(let token of this.parsed) {
            if(token.isData()) {
                unaryFlag = false;
                yield token;
            }
            else if(token.type === Token.Types.Paren) {
                unaryFlag = true;
                if(token.raw === "(") {
                    this.opstack.push(token);
                }
                else {
                    let topToken, isParen;
                    // console.log(this.opstack);
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
                        else {
                            yield topToken;
                        }
                    } while(!isParen);
                }
            }
            else if(token.type === Token.Types.Op) {
                token.unary = unaryFlag;
                unaryFlag = true;
                let [ curPrecedence, curIsRight ] = OpAttribtues[token.raw];

                if(!token.unary) {
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
        }
        while(this.opstack.length) {
            yield this.opstack.pop();
        }
    }

    static shunt(string) {
        let shunter = new FQRShunter(string);
        return shunter.shunt();
    }
}

module.exports = FQRShunter;

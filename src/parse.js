class Token {
    constructor(raw, type, index) {
        this.raw = raw;
        this.type = type;
        this.index = index;
    }

    isData() {
        return this.type === Token.Types.Word
            || this.type === Token.Types.String
            || this.type === Token.Types.Number;
    }

    isBrace() {
        return this.type === Token.Types.Paren
            || this.type === Token.Types.Bracket;
    }

    isOpening() {
        return this.raw === "(" || this.raw === "[";
    }

    isCallable() {
        return this.type === Token.Types.Op
            || this.type === Token.Types.Arity
            || this.type === Token.Types.Array;
    }

    toString() {
        let build = "";
        try {
            build += this.raw;
        }
        catch(e) {
            build += "<?>";
        }
        if(typeof this.arity !== "undefined") {
            build += "@" + this.arity;
        }
        return build;
    }

    readable() {
        let build = "";

        if(typeof this.index === "number") {
            build += this.index.toString().padStart(4, "0");
        }
        else {
            build += "    ";
        }
        let symstr = this.type.toString().match(/(\w+)\)/)[1];
        symstr = "(" + symstr + ")";
        build += " " + symstr.padEnd(12, " ");

        if(typeof this.arity === "number") {
            build += ("@" + this.arity).padEnd(3, " ");
        }
        else {
            build += "   ";
        }

        build += "  " + this.raw.toString();

        if(this.next) {
            build += "\n----" + this.next.readable();
        }

        return build;
    }

    static swap(n) {
        let token = new Token("SWAP", Token.Types.Swap, null);
        token.arity = n;
        return token;
    }

    static functionArity(n) {
        let token = new Token(Token.Types.Callable, Token.Types.Arity, null);
        token.arity = n;
        return token;
    }

    static gatherArray(n, isFunction) {
        let token = new Token(Token.Types.Callable, Token.Types.Array, null);
        token.arity = n;
        token.isFunction = isFunction;
        return token;
    }
}
Token.Types = {
    Word:       Symbol("Token.Types.Word"),
    Op:         Symbol("Token.Types.Op"),
    Space:      Symbol("Token.Types.Space"),
    String:     Symbol("Token.Types.String"),
    Number:     Symbol("Token.Types.Number"),
    Paren:      Symbol("Token.Types.Paren"),
    Bracket:    Symbol("Token.Types.Bracket"),
    Sep:        Symbol("Token.Types.Sep"),
    Comma:      Symbol("Token.Types.Comma"),
    Arity:      Symbol("Token.Types.Arity"),
    Array:      Symbol("Token.Types.Array"),
    Callable:   Symbol("Token.Types.Callable"),
    Swap:       Symbol("Token.Types.Swap"),
    Unknown:    Symbol("Token.Types.Unknown"),
};

const TOKEN_REGEX = /=>|\/\/|\.\.|[<>=]=?|!=|[+-\/*^@.|~&:#]|and|or/;
const PARSE_REGEXES = [
    [/;/,               Token.Types.Sep],
    [/,/,               Token.Types.Comma],
    [/\d+/,             Token.Types.Number],
    [/<<.+?>>/,         Token.Types.String],
    [TOKEN_REGEX,       Token.Types.Op],
    [/\s+/,             Token.Types.Space],
    [/[\[\]]/,          Token.Types.Bracket],
    [/[()]/,            Token.Types.Paren],
    [/'(''|[^'])+'/,    Token.Types.String],
    [/"(""|[^"])+"/,    Token.Types.String],
    [/\w+/,             Token.Types.Word],
    [/./,               Token.Types.Unknown],
];

class FQRParser {
    constructor(string) {
        this.string = string;
        this.processString = string;
        this.index = 0;
        this.offset = 0;
    }

    step() {
        let match;
        for(let [pattern, type] of PARSE_REGEXES) {
            match = this.processString.match(pattern);
            if(match && match.index === 0) {
                let raw = match[0];
                this.processString = this.processString.slice(raw.length);
                let res = new Token(raw, type, this.offset);
                this.offset += raw.length;
                if(type === Token.Types.Unknown) {
                    console.error("Unknown Token encountered: ", res);
                }
                return res;
            }
        }
    }

    *parse() {
        while(this.processString.length) {
            yield this.step();
        }
    }

    static parse(string) {
        let parser = new FQRParser(string);
        return parser.parse();
    }
}
FQRParser.Token = Token;

module.exports = FQRParser;

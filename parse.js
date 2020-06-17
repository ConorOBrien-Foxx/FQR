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

    static functionArity(n) {
        let token = new Token(n, Token.Types.Arity, null);
        token.arity = n;
        return token;
    }
}
Token.Types = {
    Word:   Symbol("Token.Types.Word"),
    Op:     Symbol("Token.Types.Op"),
    Space:  Symbol("Token.Types.Space"),
    String: Symbol("Token.Types.String"),
    Number: Symbol("Token.Types.Number"),
    Paren:  Symbol("Token.Types.Paren"),
    Sep:    Symbol("Token.Types.Sep"),
    Comma:  Symbol("Token.Types.Comma"),
    Arity:  Symbol("Token.Types.Arity"),
};

const PARSE_REGEXES = [
    [/;/,               Token.Types.Sep],
    [/,/,               Token.Types.Comma],
    [/\d+/,             Token.Types.Number],
    [/[+-\/*^@=]/,      Token.Types.Op],
    [/\s+/,             Token.Types.Space],
    [/[()]/,            Token.Types.Paren],
    [/'(''|[^'])+'/,    Token.Types.String],
    [/"(""|[^"])+"/,    Token.Types.String],
    [/<<.+?>>/,         Token.Types.String],
    [/\w+/,             Token.Types.Word],
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

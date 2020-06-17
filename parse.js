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
}
Token.Types = {
    Word:   Symbol("Token.Types.Word"),
    Op:     Symbol("Token.Types.Op"),
    Space:  Symbol("Token.Types.Space"),
    String: Symbol("Token.Types.String"),
    Number: Symbol("Token.Types.Number"),
    Paren:  Symbol("Token.Types.Paren"),
};

const PARSE_REGEXES = [
    [/\d+/,             Token.Types.Number],
    [/[+-\/*^]/,        Token.Types.Op],
    [/\s+/,             Token.Types.Space],
    [/[()]/,            Token.Types.Paren],
    [/'(''|.)+?'/,      Token.Types.String],
    [/"(""|.)+?"/,      Token.Types.String],
    [/<<(.)+?>>/,       Token.Types.String],
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

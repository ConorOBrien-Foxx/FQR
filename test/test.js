const assert = require("assert");

const fqr = require("../index.js");
const FQRParser = require("../parse.js");
const { Token } = FQRParser;
const FQRShunter = require("../shunt.js");

describe("FQRParser", function () {
    describe("Token", function () {
        describe("#constructor()", function () {
            it("instantiates the raw, type, and index properties", function () {
                let token = new Token("3", Token.Types.Number, 513);
                assert.equal(token.raw, "3");
                assert.equal(token.type, Token.Types.Number);
                assert.equal(token.index, 513);
            });
        });
        describe("#isData()", function () {
            it("validates Words", function () {
                let token = new Token("print", Token.Types.Word, 0);
                assert(token.isData());
            });
            it("validates Strings", function () {
                let token = new Token("<<hello world>>", Token.Types.String, 10);
                assert(token.isData());
            });
            it("validates Numbers", function () {
                let token = new Token("12933", Token.Types.Number, 0);
                assert(token.isData());
            });
            it("does not validate Ops", function () {
                let token = new Token("12933", Token.Types.Op, 0);
                assert(!token.isData());
            });
        });
        describe("#isBrace()", function () {
            it("validates Parens", function () {
                let token = new Token(")", Token.Types.Paren, 40);
                assert(token.isBrace());
            });
            it("validates Brackets", function () {
                let token = new Token("[", Token.Types.Bracket, 0);
                assert(token.isBrace());
            });
            it("does not validate bracket-like Strings", function () {
                let token = new Token("'('", Token.Types.String, 0);
                assert(!token.isBrace());
            });
        });
        describe("#isOpening()", function () {
            it("validates '('", function () {
                let token = new Token("(", Token.Types.Paren, 0);
                assert(token.isOpening());
            });
            it("validates '['", function () {
                let token = new Token("[", Token.Types.Bracket, 0);
                assert(token.isOpening());
            });
            it("does not validate ']' or ')'", function () {
                let tokenParen = new Token(")", Token.Types.Paren, 1);
                let tokenBracket = new Token("]", Token.Types.Bracket, 1);
                assert(!tokenParen.isOpening());
                assert(!tokenBracket.isOpening());
            });
        });
        describe("#isCallable()", function () {
            it("validates Ops", function () {
                let token = new Token("+", Token.Types.Op, 2);
                assert(token.isCallable());
            });
            it("validates Arities", function () {
                let token = new Token(null, Token.Types.Arity, 0);
                assert(token.isCallable());
            });
            it("validates Arrays", function () {
                let token = new Token(null, Token.Types.Array, 0);
                assert(token.isCallable());
            });
            it("does not validate Brackets", function () {
                let token = new Token("]", Token.Types.Bracket, 1);
                assert(!token.isCallable());
            });
        });
        describe("#toString()", function () {
            it("properly displays tokens", function () {
                let token = new Token("+", Token.Types.Op, 4);
                assert.equal(token.toString(), "+");
                let stringToken = new Token("<<as'df>>", Token.Types.String, 0);
                assert.equal(stringToken.toString(), "<<as'df>>");
            });
            it("properly displays tokens with arity", function () {
                let token = new Token("f", Token.Types.Word, 0);
                token.arity = 3;
                assert.equal(token.toString(), "f@3");
            });
            it("properly displays symbol tokens", function () {
                let symbolToken = new Token(Token.Types.Callable, Token.Types.Arity, 3);
                assert.equal(symbolToken.toString(), "<?>");
            });
            it("properly displays symbol tokens with arity", function () {
                let symbolToken = new Token(Token.Types.Callable, Token.Types.Arity, 3);
                symbolToken.arity = 12;
                assert.equal(symbolToken.toString(), "<?>@12");
            });
        });
        describe("swap()", function () {
            it("properly instantiates .arity and other properties", function () {
                let swapToken = Token.swap(5);
                assert.equal(swapToken.arity, 5);
                assert.equal(swapToken.type, Token.Types.Swap);
            });
        });
        describe("functionArity()", function () {
            it("properly instantiates .arity and other properties", function () {
                let arityToken = Token.functionArity(2);
                assert.equal(arityToken.arity, 2);
                assert.equal(arityToken.type, Token.Types.Arity);
                assert.equal(arityToken.raw, Token.Types.Callable);
            });
        });
        describe("gatherArray()", function () {
            it("properly instantiates .arity and other properties", function () {
                let gatherToken = Token.gatherArray(3);
                assert.equal(gatherToken.arity, 3);
                assert.equal(gatherToken.type, Token.Types.Array);
                assert.equal(gatherToken.raw, Token.Types.Callable);
            });
            it("properly instantiates .isFunction", function () {
                let gatherTokenA = Token.gatherArray(3);
                assert(!gatherTokenA.isFunction);
                let gatherTokenB = Token.gatherArray(3, true);
                assert(gatherTokenB.isFunction);
            });
        });
    });
    describe("#constructor", function () {
        it("should have index and offset start at 0", function () {
            let parser = new FQRParser("");
            assert.equal(parser.index, 0);
            assert.equal(parser.offset, 0);
        });
        it("should have processString start equal to string", function () {
            let parser = new FQRParser("hello world");
            assert.equal(parser.processString, "hello world");
            assert.equal(parser.string, "hello world");
        });
    });
    describe("#step()", function () {
        it("returns correct values", function () {
            let parser = new FQRParser("a + 8");
            assert.deepEqual(parser.step(), new Token("a", Token.Types.Word, 0));
            assert.deepEqual(parser.step(), new Token(" ", Token.Types.Space, 1));
            assert.deepEqual(parser.step(), new Token("+", Token.Types.Op, 2));
            assert.deepEqual(parser.step(), new Token(" ", Token.Types.Space, 3));
            assert.deepEqual(parser.step(), new Token("8", Token.Types.Number, 4));
        });
    });
    describe("#*parse()", function () {
        it("returns a generator object", function () {
            let parser = new FQRParser("3 * 4");
            let result = parser.parse();
            let GeneratorFunction = (function*(){})().constructor;
            assert.equal(result.constructor, GeneratorFunction);
        });
        it("yields correct values with .next()", function () {
            let parser = new FQRParser("3 * 4");
            let result = parser.parse();
            assert.deepEqual(result.next(), {
                value: new Token("3", Token.Types.Number, 0),
                done: false,
            });
            assert.deepEqual(result.next(), {
                value: new Token(" ", Token.Types.Space, 1),
                done: false,
            });
            assert.deepEqual(result.next(), {
                value: new Token("*", Token.Types.Op, 2),
                done: false,
            });
            assert.deepEqual(result.next(), {
                value: new Token(" ", Token.Types.Space, 3),
                done: false,
            });
            assert.deepEqual(result.next(), {
                value: new Token("4", Token.Types.Number, 4),
                done: false,
            });
            assert.deepEqual(result.next(), {
                value: undefined,
                done: true,
            });
        });
    });
    describe("static parse()", function () {
        it("returns a generator object", function () {
            let result = FQRParser.parse("3 * 4");
            let GeneratorFunction = (function*(){})().constructor;
            assert.equal(result.constructor, GeneratorFunction);
        });
        it("should return the correct raw values", function () {
            let parsed = FQRParser.parse("ha/ai");
            assert.deepEqual(
                [...parsed].map(token => token.raw),
                [ "ha", "/", "ai" ]
            )
        });
    });
});

describe("FQRShunter", function () {
    describe("#constructor()", function () {
        it("instantiates opstack to []", function () {
            let shunter = new FQRShunter("j - a");
            assert.deepEqual(shunter.opstack, []);
        })
    });
});

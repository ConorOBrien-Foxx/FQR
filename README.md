# FQR

It's been two years. I don't remember why this language is called this. Functional Query _something_, I'd imagine, but I have no idea.

FQR is a scripting language with many operators.

Additional command line arguments are stored in `a`, `b`, `c`, and `d`.

## Functions

```js
a = json('{"a":{"key":3},"b":{"key":5}}')
eye(a, "key", 5) == "b"
```

## Operators

```
+ - * / ^       arithmetic operators
#a              length
a.b  a[b]       memory access
n | f | g       pipes - g(f(n))
a ~ b           a without elements/keys of b
a // f          filter by f
f => a          map f over a
@s              convert string to function
                e.g.: 15 == @'a,b,c: a+b+c'(4,5,6)
.a              function that gets a property of input
                (.a)(b)  b.a
f@g             function composition
f&n   n&f       function argument bonding
                (f&x)(y, z) == f(y, z, x)
                (x&f)(y, z) == f(x, y, z)
and, or         logical comparison operators
< <= > >= == != comparison operators
.+ .- ./ .* .^  vectorized operators
```

### Precedence

Unless otherwise noted, unary operators have the same precedence as their corresponding binary operator.

```
a.b   a[b]
@a
a@b   a&b
a^b
a*b   a/b
a+b   a-b
a:b   a..b
a.^b
a.*b  a./b
a.+b  a.-b
a~b   a//b   a#b
a=>b
a|b
a==b  a!=b  a<b   a<=b  a>b   a>=b
a and b
a or b
a=b
```
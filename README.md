# FQR

## operators

```
+ - * / ^       the usual arithmetic operators
f@g             function composition
@s              convert string to function
a.b  a[b]       memory access
.a              function that gets a property of input
                (.a)(b)  b.a
n | f | g       pipes - g(f(n))
a ~ b           a without b

planned

f&n   n&f       bond n to function f's arguments
                (f&x)(y, z) == f(y, z, x)
                (x&f)(y, z) == f(x, y, z)

and, or, xor    logical comparison operators
< <= > >= == != comparison operators

.+ .- ./ .* .^  vectorized operators


f => a          map f over a
a // f          filter a by f

```

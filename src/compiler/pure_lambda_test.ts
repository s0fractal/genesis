import { assertEquals } from "jsr:@std/assert";
import { parseLambda, evaluateLambda, formatTerm } from "./pure_lambda.ts";

Deno.test("Pure Lambda Calculus: I combinator", () => {
    // I x => x
    const term = parseLambda("(I x)");
    const evaluated = evaluateLambda(term);
    assertEquals(formatTerm(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: K combinator", () => {
    // K x y => x
    const term = parseLambda("((K x) y)");
    const evaluated = evaluateLambda(term);
    assertEquals(formatTerm(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: S combinator", () => {
    // (S K K) x => K x (K x) => x (Identity via SKK)
    const term = parseLambda("(((S K) K) x)");
    const evaluated = evaluateLambda(term);
    assertEquals(formatTerm(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: Turing Completeness / Application", () => {
    // (S I I) x => I x (I x) => x x
    const term = parseLambda("(((S I) I) x)");
    const evaluated = evaluateLambda(term);
    assertEquals(formatTerm(evaluated), "x x");
});

Deno.test("Pure Lambda Calculus: Y Combinator reduction block", () => {
    // Y (K x) => K x (Y (K x)) => x
    const term = parseLambda("(Y (K x))");
    // Should reduce to x
    const evaluated = evaluateLambda(term, 10);
    assertEquals(formatTerm(evaluated), "x");
});

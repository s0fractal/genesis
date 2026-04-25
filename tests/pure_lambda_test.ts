import { assertEquals } from "jsr:@std/assert";
import { initSync } from "../omega_core/pkg/omega_core.js";
import { lambda_parse, evaluateFitness, lambda_format_term } from "../src/compiler/pure_lambda.ts";

const wasmBytes = Deno.readFileSync(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
initSync({ module: wasmBytes });

Deno.test("Pure Lambda Calculus: I combinator", () => {
    // I x => x
    const term = lambda_parse("(I x)");
    const evaluated = evaluateFitness(term).result;
    assertEquals(lambda_format_term(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: K combinator", () => {
    // K x y => x
    const term = lambda_parse("((K x) y)");
    const evaluated = evaluateFitness(term).result;
    assertEquals(lambda_format_term(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: S combinator", () => {
    // (S K K) x => K x (K x) => x (Identity via SKK)
    const term = lambda_parse("(((S K) K) x)");
    const evaluated = evaluateFitness(term).result;
    assertEquals(lambda_format_term(evaluated), "x");
});

Deno.test("Pure Lambda Calculus: Turing Completeness / Application", () => {
    // (S I I) x => I x (I x) => x x
    const term = lambda_parse("(((S I) I) x)");
    const evaluated = evaluateFitness(term).result;
    assertEquals(lambda_format_term(evaluated), "x x");
});

Deno.test("Pure Lambda Calculus: Y Combinator reduction block", () => {
    // Y (K x) => K x (Y (K x)) => x
    const term = lambda_parse("(Y (K x))");
    // Should reduce to x
    const evaluated = evaluateFitness(term, 10).result;
    assertEquals(lambda_format_term(evaluated), "x");
});

Deno.test("Semantic Macros: Boolean Logic Pipeline", () => {
    // LLM outputs (AND TRUE FALSE). Parser macro-expands it.
    // AND TRUE FALSE => FALSE => K I
    const termStr = lambda_parse("((AND TRUE) FALSE)");
    const evaluated = evaluateFitness(termStr).result;
    
    // FALSE is encoded as (K I)
    assertEquals(lambda_format_term(evaluated), "K I");
});

Deno.test("Semantic Macros: Inversion Pipeline", () => {
    // LLM outputs (NOT TRUE). Parser macro-expands it.
    // NOT TRUE => FALSE => K I
    const termStr = lambda_parse("(NOT TRUE)");
    const evaluated = evaluateFitness(termStr).result;
    
    // FALSE is encoded as (K I)
    assertEquals(lambda_format_term(evaluated), "K I");
});

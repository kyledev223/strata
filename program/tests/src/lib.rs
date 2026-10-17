//! LiteSVM integration tests. Every transaction runs the real compiled program,
//! SPL Token and Metaplex. After each one, `assert_chain_invariants` re-checks
//! the invariants from account state, independently of the program's own checks.

#[cfg(test)]
mod harness;
#[cfg(test)]
mod lifecycle;
#[cfg(test)]
mod attacks;
#[cfg(test)]
mod fuzz;

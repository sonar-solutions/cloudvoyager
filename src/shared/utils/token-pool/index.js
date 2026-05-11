// -------- Token Pool --------

/**
 * Round-robin token pool for distributing API requests across multiple tokens.
 * Each call to getNext() returns the next token in the list, cycling back
 * to the start when the end is reached.
 *
 * This allows the SonarCloud API rate limit to be spread across N tokens,
 * providing more headroom when syncing large projects.
 */
export class TokenPool {
  /** @param {string[]} tokens - Array of API tokens */
  constructor(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error('TokenPool requires at least one token');
    }
    this.tokens = tokens;
    this.index = 0;
  }

  /** Return the next token in round-robin order. */
  getNext() {
    const token = this.tokens[this.index];
    this.index = (this.index + 1) % this.tokens.length;
    return token;
  }

  /** Number of tokens in the pool. */
  get tokenCount() {
    return this.tokens.length;
  }

  /** Returns a single token (useful for logging/debugging — always returns the first). */
  get primary() {
    return this.tokens[0];
  }
}

## 2025-03-08 - Use stored iteration count for PBKDF2 password verification
**Vulnerability:** The `verifyPassword` function in `src/server/crypto.server.ts` hardcoded the iteration count for PBKDF2 hashing, rather than parsing it from the stored hash string.
**Learning:** If the developer ever changed the global `ITERATIONS` constant in the future to upgrade security, all existing user passwords would have been permanently broken.
**Prevention:** Make sure cryptographic verification functions always parse and use the parameters (like iterations, salt) encoded in the stored hash string to ensure backward compatibility.

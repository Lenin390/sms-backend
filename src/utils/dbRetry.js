async function withRetry(operation, { retries = 2, baseDelayMs = 250 } = {}) {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = isRetryableError(error) && attempt < retries;
      if (!shouldRetry) {
        throw error;
      }

      attempt += 1;
      const delayMs = baseDelayMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function isRetryableError(error) {
  const code = error?.code;
  const message = `${error?.message || ""}`.toLowerCase();

  return (
    code === "P2028" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1003" ||
    code === "P2010" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    message.includes("timed out") ||
    message.includes("connection") ||
    message.includes("transaction")
  );
}

async function cleanupRegistrationArtifacts(prisma, { userId, shopId }) {
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  if (shopId && !userId) {
    await prisma.shop.delete({ where: { id: shopId } }).catch(() => {});
  }
}

module.exports = { withRetry, isRetryableError, cleanupRegistrationArtifacts };

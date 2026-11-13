// Synthetic provider fixtures have no real people. Only transport/lifecycle
// tests use this stub; visual-validator tests exercise the strict real gate.
export async function mockCastValidation({ people, provider }) {
  const visitors = people ?? 1
  return { version: 'closed-cast-v1', provider, model: 'test-only', sourceVisitorCount: visitors, outputVisitorCount: visitors, historicalFigureCount: 1, totalPeople: visitors + 1 }
}

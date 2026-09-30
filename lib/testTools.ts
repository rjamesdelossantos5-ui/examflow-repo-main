// The admin's Testing tools (/admin/testing) — mock enrollment, test teacher
// accounts, clean-up — exist because the school's real enrollment data is
// confidential. They are off unless ENABLE_TEST_TOOLS=true is set, so a real
// deployment never shows them and never reads the mock enrollment list.
export function testToolsEnabled(): boolean {
  return process.env.ENABLE_TEST_TOOLS === 'true'
}

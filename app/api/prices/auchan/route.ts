/** Alpha 0.4's unscoped HTML parser is retired. The comparison route requires concrete shops. */
export async function GET() {
  return Response.json({ available: false, reason: 'legacy_endpoint_retired', error: { code: 'legacy_endpoint_retired', message: 'Válassz konkrét üzletet az új kosár-összehasonlításban.' } }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}

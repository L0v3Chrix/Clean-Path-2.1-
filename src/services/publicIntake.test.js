import { describe, expect, it } from 'vitest';
import { buildPublicIntakePayload, publicIntakeToken } from './publicIntake';

describe('public intake client', () => {
  it('reads only the opaque token from the query string', () => {
    expect(publicIntakeToken('?token=abc123&org=ignored')).toBe('abc123');
    expect(publicIntakeToken('?org=visible')).toBe('');
  });

  it('builds a bounded payload without accepting organization identity', () => {
    const payload = buildPublicIntakePayload({
      token: 'token',
      form: { first_name: 'Jane', last_name: 'Doe', organization_id: 'bad' },
      signatureDataUrl: 'data:image/png;base64,AAA',
      documents: { photo_id: { name: 'id.png', data_url: 'data:image/png;base64,BBB' } },
    });
    expect(payload.token).toBe('token');
    expect(payload.application.organization_id).toBeUndefined();
    expect(payload.documents[0]).toMatchObject({ key: 'photo_id', file_name: 'id.png' });
  });
});

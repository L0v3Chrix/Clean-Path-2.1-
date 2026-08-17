import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: supabaseMock.createClient,
}));

type HarnessOptions = {
  authError?: Error | null;
  authUser?: Record<string, unknown> | null;
  rpcData?: Record<string, unknown> | null;
  rpcError?: Error | null;
  signedUrl?: string | null;
  storageError?: Error | null;
};

function createCallerClient(options: HarnessOptions = {}) {
  const bucketSelector = vi.fn(() => {
    throw new Error('Caller client must never read protected storage directly.');
  });

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.authUser === undefined ? { id: 'caller-user' } : options.authUser },
        error: options.authError ?? null,
      })),
    },
    rpc: vi.fn(async () => ({
      data: options.rpcData ?? null,
      error: options.rpcError ?? null,
    })),
    storage: { from: bucketSelector },
    __bucketSelector: bucketSelector,
  };
}

function createAdminClient(options: HarnessOptions = {}) {
  const createSignedUrl = vi.fn(async () => ({
    data: options.signedUrl === null ? null : { signedUrl: options.signedUrl ?? 'https://signed.example.test/file.pdf' },
    error: options.storageError ?? null,
  }));
  const bucketSelector = vi.fn(() => ({ createSignedUrl }));

  return {
    storage: {
      from: bucketSelector,
    },
    __bucketSelector: bucketSelector,
    __createSignedUrl: createSignedUrl,
  };
}

let handler: (request: Request) => Promise<Response>;
const env: Record<string, string | undefined> = {};

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => env[name] },
    serve: (registeredHandler: typeof handler) => { handler = registeredHandler; },
  });
  await import('./index');
});

beforeEach(() => {
  supabaseMock.createClient.mockReset();
  env.SUPABASE_URL = 'https://supabase.example.test';
  env.SUPABASE_ANON_KEY = 'anon-key-test-value';
  env.SUPABASE_PUBLISHABLE_KEY = undefined;
  env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-value';
  env.CLEARPATH_SUPABASE_PUBLIC_URL = 'http://localhost';
});

async function sendRequest(
  body: unknown,
  options: {
    authorization?: string | null;
    method?: string;
    caller?: HarnessOptions;
    admin?: HarnessOptions;
    rawBody?: string;
  } = {},
  ) {
  const requestBody = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const callerClient = createCallerClient({
    rpcData: {
      bucket: requestBody.bucket,
      path: requestBody.path,
    },
    ...options.caller,
  });
  const adminClient = createAdminClient(options.admin);
  supabaseMock.createClient
    .mockReturnValueOnce(callerClient)
    .mockReturnValueOnce(adminClient);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? 'Bearer caller-token');
  }

  const response = await handler(new Request('http://localhost/document-access', {
    method: options.method ?? 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  }));

  return { response, callerClient, adminClient };
}

describe('document-access edge function', () => {
  it('requires an exact bearer token before doing any Supabase work', async () => {
    const response = await handler(new Request('http://localhost/document-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer' },
      body: JSON.stringify({ bucket: 'secure-documents', path: 'org/file.pdf', expires: 300 }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required.' });
    expect(supabaseMock.createClient).not.toHaveBeenCalled();
  });

  it('validates the small request shape before authenticating or signing', async () => {
    const { response } = await sendRequest({
      bucket: 'secure-documents',
      path: 'org/file.pdf',
      expires: 300,
      extra: 'nope',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Invalid document request.' });
    expect(supabaseMock.createClient).not.toHaveBeenCalled();
  });

  it('audits authorization before using the service role to sign', async () => {
    const events: string[] = [];
    const callerClient = {
      auth: {
        getUser: vi.fn(async () => {
          events.push('getUser');
          return { data: { user: { id: 'caller-user' } }, error: null };
        }),
      },
      rpc: vi.fn(async () => {
        events.push('audit');
        return {
          data: { bucket: 'secure-documents', path: 'org/file.pdf' },
          error: null,
        };
      }),
    };
    const createSignedUrl = vi.fn(async () => {
      events.push('sign');
      return {
        data: { signedUrl: 'https://signed.example.test/file.pdf' },
        error: null,
      };
    });
    const adminClient = {
      storage: {
        from: vi.fn(() => ({ createSignedUrl })),
      },
    };
    supabaseMock.createClient
      .mockReturnValueOnce(callerClient)
      .mockReturnValueOnce(adminClient);

    const response = await handler(new Request('http://localhost/document-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer caller-token',
      },
      body: JSON.stringify({ bucket: 'secure-documents', path: 'org/file.pdf', expires: 300 }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      signedUrl: 'https://signed.example.test/file.pdf',
    });
    expect(events).toEqual(['getUser', 'audit', 'sign']);
  });

  it('never uses the authenticated caller client for direct protected storage access', async () => {
    const { response, callerClient, adminClient } = await sendRequest({
      bucket: 'secure-documents',
      path: 'org/file.pdf',
      expires: 300,
    });

    expect(response.status).toBe(200);
    expect(callerClient.__bucketSelector).not.toHaveBeenCalled();
    expect(adminClient.__bucketSelector).toHaveBeenCalledExactlyOnceWith('secure-documents');
    expect(adminClient.__createSignedUrl).toHaveBeenCalledExactlyOnceWith('org/file.pdf', 300);
    expect(supabaseMock.createClient).toHaveBeenNthCalledWith(
      1,
      'https://supabase.example.test',
      'anon-key-test-value',
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: 'Bearer caller-token' } },
      },
    );
    expect(supabaseMock.createClient).toHaveBeenNthCalledWith(
      2,
      'https://supabase.example.test',
      'service-role-test-value',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });

  it('rewrites the local Docker gateway host to the browser-reachable origin', async () => {
    const { response } = await sendRequest(
      { bucket: 'resident-documents', path: 'org/file.pdf', expires: 300 },
      { admin: { signedUrl: 'http://kong:8000/storage/v1/object/sign/resident-documents/org/file.pdf?token=test' } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      signedUrl: 'http://localhost/storage/v1/object/sign/resident-documents/org/file.pdf?token=test',
    });
  });

  it('does not sign when authorization auditing denies access', async () => {
    const { response, callerClient, adminClient } = await sendRequest(
      { bucket: 'secure-documents', path: 'org/file.pdf', expires: 300 },
      { caller: { rpcError: new Error('Document access denied') } },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Unable to access this secure document.' });
    expect(callerClient.rpc).toHaveBeenCalledWith('record_document_access', {
      p_bucket: 'secure-documents',
      p_path: 'org/file.pdf',
    });
    expect(adminClient.__bucketSelector).not.toHaveBeenCalled();
    expect(adminClient.__createSignedUrl).not.toHaveBeenCalled();
  });

  it('does not sign unless authorization returns the exact immutable object binding', async () => {
    const { response, adminClient } = await sendRequest(
      { bucket: 'secure-documents', path: 'org/house-b/private.pdf', expires: 300 },
      {
        caller: {
          rpcData: {
            bucket: 'secure-documents',
            path: 'org/house-a/private.pdf',
          },
        },
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Unable to access this secure document.' });
    expect(adminClient.__bucketSelector).not.toHaveBeenCalled();
    expect(adminClient.__createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns a generic error when signing fails without leaking path details', async () => {
    const privatePath = 'org-1/residents/private/clinical-notes.pdf';
    const { response } = await sendRequest(
      { bucket: 'secure-documents', path: privatePath, expires: 300 },
      { admin: { storageError: new Error(`Object not found: ${privatePath}`) } },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to access this secure document.' });
  });
});
